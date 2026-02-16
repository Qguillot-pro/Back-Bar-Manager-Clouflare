
import React, { useState, useMemo } from 'react';
import { PendingOrder, StockItem, StorageSpace, Format, Event, EventProduct, EmailTemplate } from '../types';

interface OrderProps {
  orders: PendingOrder[];
  items: StockItem[];
  storages: StorageSpace[];
  onUpdateOrder: (orderId: string, quantity: number, status?: 'PENDING' | 'ORDERED' | 'RECEIVED', ruptureDate?: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onAddManualOrder: (itemId: string, qty: number) => void;
  formats: Format[];
  events?: Event[];
  emailTemplates?: EmailTemplate[]; // Ajout
}

const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const Order: React.FC<OrderProps> = ({ orders, items, storages, onUpdateOrder, onDeleteOrder, onAddManualOrder, formats, events = [], emailTemplates = [] }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'ORDERED'>('PENDING');
  const [manualSearch, setManualSearch] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  
  // Email Modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Filtres
  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'PENDING'), [orders]);
  const orderedOrders = useMemo(() => orders.filter(o => o.status === 'ORDERED'), [orders]);

  // Upcoming Event Suggestions (10 days)
  const eventSuggestions = useMemo(() => {
      const now = new Date();
      const limit = new Date();
      limit.setDate(limit.getDate() + 10);

      const suggestions: { event: Event, products: EventProduct[] }[] = [];

      events.forEach(evt => {
          const start = new Date(evt.startTime);
          if (start >= now && start <= limit && evt.productsJson) {
              try {
                  const prods: EventProduct[] = JSON.parse(evt.productsJson);
                  // Filter out products that are already in pending or ordered
                  const neededProds = prods.filter(p => {
                      return !orders.some(o => o.itemId === p.itemId && (o.status === 'PENDING' || o.status === 'ORDERED'));
                  });
                  if (neededProds.length > 0) {
                      suggestions.push({ event: evt, products: neededProds });
                  }
              } catch(e) {}
          }
      });
      return suggestions;
  }, [events, orders]);

  const handleValidateAll = () => {
      if (window.confirm(`Valider l'envoi de ${pendingOrders.length} lignes de commande ?`)) {
          pendingOrders.forEach(o => {
             onUpdateOrder(o.id, o.quantity, 'ORDERED');
          });
          setSelectedOrders(new Set());
      }
  };

  const handleManualAdd = () => {
      const item = items.find(i => normalizeText(i.name) === normalizeText(manualSearch));
      if (item) {
          onAddManualOrder(item.id, manualQty);
          setManualSearch('');
          setManualQty(1);
      } else {
          alert("Produit introuvable. Veuillez sélectionner un produit de la liste.");
      }
  };

  const addEventProduct = (itemId: string, qty: number) => {
      onAddManualOrder(itemId, qty);
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedOrders);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedOrders(newSet);
  };

  const toggleAll = () => {
      if (selectedOrders.size === pendingOrders.length) setSelectedOrders(new Set());
      else setSelectedOrders(new Set(pendingOrders.map(o => o.id)));
  };

  const generateEmailContent = () => {
      const tpl = emailTemplates.find(t => t.id === selectedTemplateId);
      if (!tpl) return { subject: '', body: '' };

      const ordersToInclude = selectedOrders.size > 0 
          ? pendingOrders.filter(o => selectedOrders.has(o.id)) 
          : pendingOrders;

      let table = "Produit | Format | Quantité\n----------------------------\n";
      ordersToInclude.forEach(o => {
          const item = items.find(i => i.id === o.itemId);
          const fmt = formats.find(f => f.id === item?.formatId)?.name || '';
          table += `${item?.name} | ${fmt} | ${o.quantity}\n`;
      });

      const body = tpl.body.replace('{TABLEAU_COMMANDE}', table);
      return { subject: tpl.subject, body };
  };

  const handleSendEmail = () => {
      const content = generateEmailContent();
      const mailtoLink = `mailto:?subject=${encodeURIComponent(content.subject)}&body=${encodeURIComponent(content.body)}`;
      window.open(mailtoLink, '_blank');
      
      if (window.confirm("Avez-vous envoyé le mail ? Si oui, valider les commandes comme 'Commandé' ?")) {
          const ordersToUpdate = selectedOrders.size > 0 
            ? pendingOrders.filter(o => selectedOrders.has(o.id)) 
            : pendingOrders;
          
          ordersToUpdate.forEach(o => onUpdateOrder(o.id, o.quantity, 'ORDERED'));
          setIsEmailModalOpen(false);
      }
  };

  const handleCopyToClipboard = () => {
      const content = generateEmailContent();
      navigator.clipboard.writeText(`Sujet: ${content.subject}\n\n${content.body}`).then(() => {
          alert("Contenu copié ! Vous pouvez le coller dans votre messagerie.");
      });
  };

  const handleExportSelected = () => {
      if (selectedOrders.size === 0) return;
      
      const ordersToExport = pendingOrders.filter(o => selectedOrders.has(o.id));
      let csv = "\uFEFFProduit,Format,Quantité,Note\n";
      
      ordersToExport.forEach(o => {
          const item = items.find(i => i.id === o.itemId);
          const fmt = formats.find(f => f.id === item?.formatId)?.name || '';
          const note = o.ruptureDate ? 'Rupture' : '';
          csv += `"${item?.name}","${fmt}","${o.quantity}","${note}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `commande_selection_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
  };

  const getFormatName = (formatId?: string) => formats.find(f => f.id === formatId)?.name || '-';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 relative">
      
      {/* EMAIL MODAL */}
      {isEmailModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-6">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Préparer E-mail</h3>
                  <div className="space-y-2 text-left">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Modèle</label>
                      <select 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none cursor-pointer"
                          value={selectedTemplateId}
                          onChange={e => setSelectedTemplateId(e.target.value)}
                      >
                          <option value="">Choisir un modèle...</option>
                          {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                      <button onClick={handleSendEmail} disabled={!selectedTemplateId} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                          Ouvrir Client Mail
                      </button>
                      <button onClick={handleCopyToClipboard} disabled={!selectedTemplateId} className="w-full py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-50">
                          Copier Texte
                      </button>
                      <button onClick={() => setIsEmailModalOpen(false)} className="mt-2 text-slate-400 font-bold text-xs uppercase">Annuler</button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER & TABS */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
          <button 
            onClick={() => setActiveTab('PENDING')}
            className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'PENDING' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              Brouillon ({pendingOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('ORDERED')}
            className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'ORDERED' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              En Attente de Réception ({orderedOrders.length})
          </button>
      </div>

      {/* CONTENT */}
      {activeTab === 'PENDING' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              
              {/* EVENT SUGGESTIONS */}
              {eventSuggestions.length > 0 && (
                  <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 space-y-4">
                      <h3 className="font-black text-purple-800 uppercase tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                          Suggestions Événements (J-10)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {eventSuggestions.map((sug, i) => (
                              <div key={i} className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm">
                                  <div className="mb-2">
                                      <p className="font-bold text-slate-800">{sug.event.title}</p>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(sug.event.startTime).toLocaleDateString()}</p>
                                  </div>
                                  <div className="space-y-2">
                                      {sug.products.map(p => {
                                          const item = items.find(i => i.id === p.itemId);
                                          return (
                                              <div key={p.itemId} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                                                  <span className="text-xs font-bold text-slate-700">{item?.name}</span>
                                                  <button onClick={() => addEventProduct(p.itemId, p.quantity)} className="bg-purple-500 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-purple-600 transition-colors">
                                                      Ajouter (+{p.quantity})
                                                  </button>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* AJOUT MANUEL */}
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full space-y-2">
                      <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Ajout Manuel</label>
                      <input 
                        list="items-list-order"
                        className="w-full bg-white border border-indigo-200 rounded-2xl p-4 font-bold text-indigo-900 outline-none placeholder-indigo-300"
                        placeholder="Rechercher un produit..."
                        value={manualSearch}
                        onChange={e => setManualSearch(e.target.value)}
                      />
                      <datalist id="items-list-order">
                          {items.map(i => <option key={i.id} value={i.name} />)}
                      </datalist>
                  </div>
                  <div className="w-24 space-y-2">
                      <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Qté</label>
                      <input 
                        type="number"
                        min="1"
                        className="w-full bg-white border border-indigo-200 rounded-2xl p-4 font-bold text-center text-indigo-900 outline-none"
                        value={manualQty}
                        onChange={e => setManualQty(parseInt(e.target.value) || 1)}
                      />
                  </div>
                  <button 
                    onClick={handleManualAdd}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
                  >
                      Ajouter
                  </button>
              </div>

              {/* LISTE */}
              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Panier Commande</h3>
                      <div className="flex gap-2">
                          <button 
                            onClick={() => setIsEmailModalOpen(true)}
                            className="bg-purple-500 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-600 shadow-lg active:scale-95 transition-all flex items-center gap-2"
                          >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              Mail
                          </button>
                          {selectedOrders.size > 0 && (
                              <button 
                                onClick={handleExportSelected}
                                className="bg-slate-800 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 shadow-lg active:scale-95 transition-all flex items-center gap-2"
                              >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                                  Export CSV ({selectedOrders.size})
                              </button>
                          )}
                          <button 
                            onClick={handleValidateAll}
                            disabled={pendingOrders.length === 0}
                            className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                          >
                              Valider la commande
                          </button>
                      </div>
                  </div>
                  <table className="w-full text-left">
                      <thead className="bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                          <tr>
                              <th className="p-4 w-12 text-center">
                                  <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 cursor-pointer" onChange={toggleAll} checked={pendingOrders.length > 0 && selectedOrders.size === pendingOrders.length} />
                              </th>
                              <th className="p-4">Produit</th>
                              <th className="p-4">Format</th>
                              <th className="p-4">Détail</th>
                              <th className="p-4 text-center">Quantité</th>
                              <th className="p-4 text-center">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {pendingOrders.map(o => {
                              const item = items.find(i => i.id === o.itemId);
                              if (!item) return null;
                              return (
                                  <tr key={o.id} className={`hover:bg-slate-50 ${selectedOrders.has(o.id) ? 'bg-indigo-50/30' : ''}`}>
                                      <td className="p-4 text-center">
                                          <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 cursor-pointer" checked={selectedOrders.has(o.id)} onChange={() => toggleSelection(o.id)} />
                                      </td>
                                      <td className="p-4 font-black text-slate-800">{item.name}</td>
                                      <td className="p-4 text-xs font-bold text-slate-500">{getFormatName(item.formatId)}</td>
                                      <td className="p-4 text-[10px] font-bold text-slate-400">
                                          {o.ruptureDate ? <span className="text-rose-500">Suite Rupture</span> : 'Réassort'}
                                      </td>
                                      <td className="p-4 text-center">
                                          <input 
                                            type="number"
                                            className="w-16 bg-slate-100 rounded-lg p-2 text-center font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            value={o.quantity}
                                            onChange={(e) => onUpdateOrder(o.id, parseInt(e.target.value) || 0)}
                                          />
                                      </td>
                                      <td className="p-4 text-center">
                                          <button 
                                            onClick={() => onDeleteOrder(o.id)}
                                            className="text-slate-300 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors"
                                          >
                                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                          </button>
                                      </td>
                                  </tr>
                              );
                          })}
                          {pendingOrders.length === 0 && (
                              <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Aucune commande en préparation.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* ... Ordered Tab (unchanged) ... */}
      {activeTab === 'ORDERED' && (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
               <div className="p-4 border-b bg-amber-50 flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                   <h3 className="font-black text-amber-800 uppercase text-xs tracking-widest">Commandes passées (En attente de livraison)</h3>
               </div>
               <table className="w-full text-left">
                  <thead className="bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                      <tr>
                          <th className="p-4">Date Commande</th>
                          <th className="p-4">Produit</th>
                          <th className="p-4 text-center">Qté Commandée</th>
                          <th className="p-4 text-center">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {orderedOrders.map(o => {
                          const item = items.find(i => i.id === o.itemId);
                          if (!item) return null;
                          return (
                              <tr key={o.id} className="hover:bg-slate-50">
                                  <td className="p-4 text-xs font-bold text-slate-500">
                                      {o.orderedAt ? new Date(o.orderedAt).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="p-4 font-black text-slate-800">{item.name}</td>
                                  <td className="p-4 text-center font-bold text-slate-900">{o.quantity}</td>
                                  <td className="p-4 text-center">
                                      <button 
                                        onClick={() => onUpdateOrder(o.id, o.quantity, 'RECEIVED')}
                                        className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-colors shadow-sm"
                                      >
                                          Réceptionner
                                      </button>
                                  </td>
                              </tr>
                          );
                      })}
                      {orderedOrders.length === 0 && (
                          <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">Aucune commande en attente.</td></tr>
                      )}
                  </tbody>
               </table>
          </div>
      )}
    </div>
  );
};

export default Order;
