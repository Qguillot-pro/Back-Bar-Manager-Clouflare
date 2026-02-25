
import React, { useState } from 'react';
import { StockItem, Transaction, StorageSpace, UnfulfilledOrder, Format, DLCProfile, DLCHistory } from '../types';

interface MovementsProps {
  items: StockItem[];
  transactions: Transaction[];
  storages: StorageSpace[];
  onTransaction: (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer?: boolean) => void;
  onOpenKeypad: (config: any) => void;
  unfulfilledOrders: UnfulfilledOrder[];
  onReportUnfulfilled: (itemId: string, quantity: number) => void;
  onCreateTemporaryItem?: (name: string, quantity: number) => string | void;
  formats: Format[];
  dlcProfiles?: DLCProfile[];
  onUndo?: () => void;
  dlcHistory?: DLCHistory[];
  onDlcEntry?: (itemId: string, storageId: string, type: 'OPENING' | 'PRODUCTION') => void;
  onDlcConsumption?: (itemId: string) => void;
}

const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const Movements: React.FC<MovementsProps> = ({ items, transactions, storages, onTransaction, unfulfilledOrders, onReportUnfulfilled, onCreateTemporaryItem, formats, dlcProfiles = [], onUndo, dlcHistory = [], onDlcEntry, onDlcConsumption }) => {
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'UNFULFILLED'>('MOVEMENTS');
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState<string>('1');
  const [isServiceTransfer, setIsServiceTransfer] = useState(false);
  
  const [unfulfilledSearch, setUnfulfilledSearch] = useState('');
  const [unfulfilledQty, setUnfulfilledQty] = useState<string>('1');

  const [dlcModalOpen, setDlcModalOpen] = useState(false);
  const [pendingDlcItem, setPendingDlcItem] = useState<StockItem | null>(null);
  const [pendingDlcAction, setPendingDlcAction] = useState<'IN' | 'OUT'>('OUT');

  const [isTempItemModalOpen, setIsTempItemModalOpen] = useState(false);
  const [tempItemName, setTempItemName] = useState('');
  const [tempItemQty, setTempItemQty] = useState<number>(0);
  const [tempItemAction, setTempItemAction] = useState<'IN' | 'UNFULFILLED'>('IN');

  const [consigneModalOpen, setConsigneModalOpen] = useState(false);
  const [pendingConsigneItem, setPendingConsigneItem] = useState<StockItem | null>(null);
  const [pendingConsigneAction, setPendingConsigneAction] = useState<'IN' | 'OUT'>('OUT');

  const handleAction = (type: 'IN' | 'OUT') => {
    // Validation stricte : Pas de décimales
    if (qty.includes('.') || qty.includes(',')) {
        alert("Les décimales ne sont pas autorisées sur cet écran. Veuillez saisir un nombre entier.");
        return;
    }

    const searchNormalized = normalizeText(search.trim());
    const item = items.find(i => normalizeText(i.name.trim()) === searchNormalized);

    if (!item) {
        if (type === 'IN' && onCreateTemporaryItem) {
            setTempItemName(search);
            setTempItemAction('IN');
            setIsTempItemModalOpen(true);
        } else {
            alert(`Produit "${search}" introuvable.`);
        }
        return;
    }

    let quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity <= 0) quantity = 1;

    // Logique DLC
    if ((item.isDLC || item.dlcProfileId) && dlcProfiles && onDlcEntry) {
        setPendingDlcItem(item);
        setPendingDlcAction(type);
        setDlcModalOpen(true);
        return;
    }

    // Logique Consigne (Popup)
    if (item.isConsigne) {
        setPendingConsigneItem(item);
        setPendingConsigneAction(type);
        setConsigneModalOpen(true);
        return;
    }

    onTransaction(item.id, type, quantity, isServiceTransfer);
    setSearch('');
    setQty('1');
    setIsServiceTransfer(false);
  };

  const handleUnfulfilledAction = () => {
      if (unfulfilledQty.includes('.') || unfulfilledQty.includes(',')) {
          alert("Les décimales ne sont pas autorisées sur cet écran. Veuillez saisir un nombre entier.");
          return;
      }

      const searchNormalized = normalizeText(unfulfilledSearch.trim());
      const item = items.find(i => normalizeText(i.name.trim()) === searchNormalized);

      let quantity = parseInt(unfulfilledQty, 10);
      if (isNaN(quantity) || quantity <= 0) quantity = 1;

      if (!item) {
          if (onCreateTemporaryItem) {
              setTempItemName(unfulfilledSearch);
              setTempItemQty(quantity);
              setTempItemAction('UNFULFILLED');
              setIsTempItemModalOpen(true);
          } else {
              alert(`Produit "${unfulfilledSearch}" introuvable.`);
          }
          return;
      }

      onReportUnfulfilled(item.id, quantity);
      setUnfulfilledSearch('');
      setUnfulfilledQty('1');
  };

  const finalizeConsigneTransaction = () => {
      if (!pendingConsigneItem) return;
      let quantity = parseInt(qty, 10) || 1;
      onTransaction(pendingConsigneItem.id, pendingConsigneAction, quantity, isServiceTransfer);
      setConsigneModalOpen(false);
      setPendingConsigneItem(null);
      setSearch('');
      setQty('1');
      setIsServiceTransfer(false);
  };

  const finalizeDlcTransaction = () => {
      if (!pendingDlcItem) return;
      let quantity = parseInt(qty, 10) || 1;
      onTransaction(pendingDlcItem.id, pendingDlcAction, quantity, isServiceTransfer);
      
      // Trigger DLC entry for both IN (Production) and OUT (Opening for service)
      if (onDlcEntry) {
          const storageId = storages[0]?.id || 's0';
          onDlcEntry(pendingDlcItem.id, storageId, 'OPENING');
      }
      
      setDlcModalOpen(false);
      setPendingDlcItem(null);
      setSearch('');
      setQty('1');
  };

  const handleCreateTemp = () => {
      if (onCreateTemporaryItem && tempItemName) {
          const newId = onCreateTemporaryItem(tempItemName, tempItemQty);
          if (tempItemAction === 'UNFULFILLED' && newId) {
              onReportUnfulfilled(newId as string, tempItemQty || 1);
              setUnfulfilledSearch('');
              setUnfulfilledQty('1');
          } else if (tempItemAction === 'IN') {
              setSearch('');
              setQty('1');
          }
          setTempItemName('');
          setTempItemQty(0);
          setIsTempItemModalOpen(false);
      }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* MODALE PRODUIT PROVISOIRE */}
      {isTempItemModalOpen && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Créer Produit Temporaire</h3>
                  <div className="space-y-2">
                      <input type="text" className="w-full bg-slate-50 border rounded-xl p-3 font-bold text-slate-900" placeholder="Nom du produit..." value={tempItemName} onChange={(e) => setTempItemName(e.target.value)} />
                      <input type="number" className="w-full bg-slate-50 border rounded-xl p-3 font-bold text-slate-900 text-center" placeholder="Quantité reçue / souhaitée" value={tempItemQty || ''} onChange={(e) => setTempItemQty(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setIsTempItemModalOpen(false)} className="py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px]">Annuler</button>
                      <button onClick={handleCreateTemp} className="py-3 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px]">Créer</button>
                  </div>
              </div>
          </div>
      )}

      {dlcModalOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{pendingDlcItem?.name}</h3>
                  <p className="text-sm font-bold text-slate-600 italic">Rappel : Avez-vous collé l'étiquette DLC ?</p>
                  <button onClick={finalizeDlcTransaction} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Oui, Continuer</button>
                  <button onClick={() => setDlcModalOpen(false)} className="text-slate-400 font-bold text-xs uppercase underline">Annuler</button>
              </div>
          </div>
      )}

      {consigneModalOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-3xl">♻️</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{pendingConsigneItem?.name}</h3>
                  <p className="text-sm font-bold text-slate-600">
                      Ce produit est consigné.<br/>
                      {pendingConsigneAction === 'OUT' ? "N'oubliez pas de récupérer la consigne vide !" : "Avez-vous bien stocké les consignes pleines ?"}
                  </p>
                  <button onClick={finalizeConsigneTransaction} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-all">J'ai compris</button>
                  <button onClick={() => setConsigneModalOpen(false)} className="text-slate-400 font-bold text-xs uppercase underline">Annuler</button>
              </div>
          </div>
      )}

      {/* TABS */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
          <button onClick={() => setActiveTab('MOVEMENTS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Mouvements</button>
          <button onClick={() => setActiveTab('UNFULFILLED')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'UNFULFILLED' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'}`}>Ruptures Client</button>
      </div>

      {activeTab === 'MOVEMENTS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex gap-4 items-end">
                      <div className="flex-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit</label>
                          <input list="movement-items" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
                          <datalist id="movement-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                      </div>
                      <button 
                        onClick={() => { setTempItemName(search); setTempItemAction('IN'); setIsTempItemModalOpen(true); }}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-600 p-4 rounded-2xl transition-colors h-[58px] flex items-center justify-center"
                        title="Créer un produit temporaire"
                      >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                      <div className="w-24">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qté</label>
                          <input 
                            type="number" 
                            inputMode="numeric" 
                            pattern="[0-9]*"
                            step="1"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-center outline-none" 
                            value={qty} 
                            onChange={(e) => {
                                const val = e.target.value;
                                if (/^\d*$/.test(val)) setQty(val);
                            }} 
                          />
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-2 px-1">
                      <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isServiceTransfer ? 'bg-purple-500 border-purple-500' : 'border-slate-300 bg-white'}`}>
                              <input type="checkbox" className="hidden" checked={isServiceTransfer} onChange={e => setIsServiceTransfer(e.target.checked)} />
                              {isServiceTransfer && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isServiceTransfer ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Transfert Interservice</span>
                      </label>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                      <button onClick={() => handleAction('IN')} className="col-span-1 bg-emerald-500 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 text-xs">Entrée (+)</button>
                      <button onClick={() => handleAction('OUT')} className="col-span-2 bg-rose-500 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 text-lg">Sortie (-)</button>
                  </div>
              </div>

              <div className="space-y-3">
                  <div className="flex justify-between items-center mx-4">
                      <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Derniers Mouvements</h3>
                      {onUndo && (
                          <button onClick={onUndo} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-100 transition-all border border-rose-200 shadow-sm">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                              Annuler le dernier
                          </button>
                      )}
                  </div>
                  {transactions.slice(0, 20).map((t, idx) => {
                      const item = items.find(i => i.id === t.itemId);
                      const d = new Date(t.date);
                      return (
                          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm animate-in slide-in-from-right duration-300" style={{animationDelay: `${idx*50}ms`}}>
                              <div>
                                  <p className="font-bold text-slate-800 text-sm">{item?.name || 'Inconnu'}</p>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                          {!isNaN(d.getTime()) ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'} • {t.userName}
                                      </span>
                                      {t.note === 'Régulation' && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 rounded uppercase tracking-wider">Régulation</span>}
                                      {t.isServiceTransfer && <span className="text-[8px] font-black bg-purple-100 text-purple-700 px-1.5 rounded uppercase tracking-wider">Interservice</span>}
                                  </div>
                              </div>
                              <div className={`px-3 py-1.5 rounded-lg font-black text-xs ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                  {t.type === 'IN' ? '+' : '-'}{t.quantity}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* RUPTURES CLIENT VIEW */}
      {activeTab === 'UNFULFILLED' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex gap-4 items-end">
                      <div className="flex-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit en rupture</label>
                          <input list="unfulfilled-items" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-rose-100" placeholder="Rechercher ou saisir un nouveau produit..." value={unfulfilledSearch} onChange={(e) => setUnfulfilledSearch(e.target.value)} />
                          <datalist id="unfulfilled-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                      </div>
                      <div className="w-24">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qté</label>
                          <input 
                            type="number" 
                            inputMode="numeric" 
                            pattern="[0-9]*"
                            step="1"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-center outline-none" 
                            value={unfulfilledQty} 
                            onChange={(e) => {
                                const val = e.target.value;
                                if (/^\d*$/.test(val)) setUnfulfilledQty(val);
                            }} 
                          />
                      </div>
                      <button onClick={handleUnfulfilledAction} className="bg-rose-500 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 text-xs h-[58px]">
                          Signaler
                      </button>
                  </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-rose-50 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                      <h3 className="font-black text-rose-800 uppercase tracking-widest text-xs">Ruptures signalées par le service</h3>
                  </div>
                  <table className="w-full text-left">
                      <thead className="bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <tr>
                              <th className="p-4">Date/Heure</th>
                              <th className="p-4">Produit</th>
                              <th className="p-4 text-center">Qté Perdue</th>
                              <th className="p-4">Signalé par</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {unfulfilledOrders.slice(0, 50).map(u => (
                              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 text-xs font-bold text-slate-500">
                                      {new Date(u.date).toLocaleDateString()} <span className="text-slate-400 text-[10px]">{new Date(u.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                  </td>
                                  <td className="p-4 font-black text-slate-800">
                                      {items.find(i => i.id === u.itemId)?.name || 'Inconnu'}
                                  </td>
                                  <td className="p-4 text-center font-black text-rose-500">{u.quantity || 1}</td>
                                  <td className="p-4 text-xs font-bold text-slate-600">{u.userName || '-'}</td>
                              </tr>
                          ))}
                          {unfulfilledOrders.length === 0 && (
                              <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic">Aucune rupture signalée récemment.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};

export default Movements;
