
import React, { useState, useMemo } from 'react';
import { StockItem, Transaction, StorageSpace, UnfulfilledOrder, Format, DLCProfile, DLCHistory } from '../types';

interface MovementsProps {
  items: StockItem[];
  transactions: Transaction[];
  storages: StorageSpace[];
  onTransaction: (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer?: boolean) => void;
  onOpenKeypad: (config: any) => void;
  unfulfilledOrders: UnfulfilledOrder[];
  onReportUnfulfilled: (itemId: string, quantity: number) => void;
  onCreateTemporaryItem?: (name: string, quantity: number) => void;
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
  
  // DLC Modal State
  const [dlcModalOpen, setDlcModalOpen] = useState(false);
  const [pendingDlcItem, setPendingDlcItem] = useState<StockItem | null>(null);
  const [pendingDlcAction, setPendingDlcAction] = useState<'IN' | 'OUT'>('OUT');
  const [dlcStep, setDlcStep] = useState<'LABEL_CHECK' | 'USE_OLDEST' | 'EMPTY' | 'NONE'>('NONE');

  // Consigne Modal State
  const [consigneModalOpen, setConsigneModalOpen] = useState(false);
  const [pendingConsigneItem, setPendingConsigneItem] = useState<StockItem | null>(null);

  // Temp Item State
  const [isTempItemModalOpen, setIsTempItemModalOpen] = useState(false);
  const [tempItemName, setTempItemName] = useState('');
  const [tempItemQty, setTempItemQty] = useState<number>(0);

  const handleAction = (type: 'IN' | 'OUT') => {
    const searchNormalized = normalizeText(search.trim());
    const item = items.find(i => normalizeText(i.name.trim()) === searchNormalized);

    if (!item) {
        // Si produit non trouvé, proposer de le créer si c'est une entrée
        if (type === 'IN' && onCreateTemporaryItem) {
            if (window.confirm(`Produit "${search}" introuvable. Voulez-vous créer un produit provisoire ?`)) {
                setTempItemName(search);
                setIsTempItemModalOpen(true);
            }
        } else {
            alert(`Produit "${search}" introuvable.`);
        }
        return;
    }

    let normalized = qty.replace(',', '.');
    if (normalized === '.') normalized = '0';
    let quantity = parseFloat(normalized);
    if (isNaN(quantity) || quantity <= 0) quantity = 1;

    // LOGIQUE DLC
    if (item.isDLC && dlcProfiles && onDlcEntry && onDlcConsumption) {
        const profile = dlcProfiles.find(p => p.id === item.dlcProfileId);
        if (profile) {
            setPendingDlcItem(item);
            setPendingDlcAction(type);
            if (type === 'OUT') {
                if (profile.type === 'OPENING') { setDlcStep('LABEL_CHECK'); setDlcModalOpen(true); return; } 
                else if (profile.type === 'PRODUCTION') {
                    const existing = dlcHistory.filter(h => h.itemId === item.id);
                    setDlcStep(existing.length > 0 ? 'USE_OLDEST' : 'EMPTY');
                    setDlcModalOpen(true); return;
                }
            } else if (type === 'IN' && profile.type === 'PRODUCTION') {
                setDlcStep('LABEL_CHECK'); setDlcModalOpen(true); return;
            }
        }
    }

    // LOGIQUE CONSIGNE
    if (type === 'OUT' && item.isConsigne) {
        setPendingConsigneItem(item);
        setConsigneModalOpen(true);
        return;
    }

    onTransaction(item.id, type, quantity, isServiceTransfer);
    setSearch('');
    setQty('1');
    setIsServiceTransfer(false);
  };

  const finalizeDlcTransaction = () => {
      if (!pendingDlcItem) return;
      let normalized = qty.replace(',', '.');
      const quantity = parseFloat(normalized) || 1;
      const profile = dlcProfiles?.find(p => p.id === pendingDlcItem.dlcProfileId);
      
      onTransaction(pendingDlcItem.id, pendingDlcAction, quantity, isServiceTransfer);

      if (pendingDlcAction === 'IN') {
          if (profile?.type === 'PRODUCTION' && onDlcEntry) onDlcEntry(pendingDlcItem.id, 's_global', 'PRODUCTION'); 
      } else { 
          if (profile?.type === 'OPENING' && onDlcEntry) onDlcEntry(pendingDlcItem.id, 's_global', 'OPENING');
          if (profile?.type === 'PRODUCTION' && onDlcConsumption && dlcStep === 'USE_OLDEST') onDlcConsumption(pendingDlcItem.id);
      }

      setDlcModalOpen(false);
      if (pendingDlcAction === 'OUT' && pendingDlcItem.isConsigne) {
          setPendingConsigneItem(pendingDlcItem);
          setConsigneModalOpen(true);
      } else {
          setPendingDlcItem(null);
          setSearch('');
          setQty('1');
          setIsServiceTransfer(false);
      }
  };

  const confirmConsigneAction = () => {
      if (pendingConsigneItem) {
          if (!pendingDlcItem) { 
             let normalized = qty.replace(',', '.');
             onTransaction(pendingConsigneItem.id, 'OUT', parseFloat(normalized) || 1, isServiceTransfer);
          }
          setConsigneModalOpen(false);
          setPendingConsigneItem(null);
          setPendingDlcItem(null);
          setSearch('');
          setQty('1');
          setIsServiceTransfer(false);
      }
  };

  const handleCreateTempItem = () => {
      if (!tempItemName || !onCreateTemporaryItem) return;
      onCreateTemporaryItem(tempItemName, tempItemQty);
      setTempItemName('');
      setTempItemQty(0);
      setIsTempItemModalOpen(false);
      // On ne reset pas search pour enchainer
  };

  const groupedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted.slice(0, 30);
  }, [transactions]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      
      {/* TEMP ITEM MODAL */}
      {isTempItemModalOpen && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Produit Provisoire</h3>
                  <div className="space-y-4">
                      <div className="text-left space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du produit</label>
                          <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none" value={tempItemName} onChange={(e) => setTempItemName(e.target.value)} autoFocus />
                      </div>
                      <div className="text-left space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Consigne Surstock (Optionnel)</label>
                          <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none text-center" value={tempItemQty} onChange={(e) => setTempItemQty(parseInt(e.target.value) || 0)} />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => setIsTempItemModalOpen(false)} className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">Annuler</button>
                      <button onClick={handleCreateTempItem} disabled={!tempItemName} className="py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all">Créer</button>
                  </div>
              </div>
          </div>
      )}

      {/* DLC MODAL */}
      {dlcModalOpen && pendingDlcItem && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                  <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{pendingDlcItem.name}</h3>
                  
                  {dlcStep === 'LABEL_CHECK' && (
                      <div className="space-y-4">
                          <p className="text-sm font-bold text-slate-600">Avez-vous bien collé l'étiquette DLC sur le produit ?</p>
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 p-2 rounded-lg italic">Rappel : La durée est de {dlcProfiles.find(p => p.id === pendingDlcItem.dlcProfileId)?.durationHours}h</p>
                          <button onClick={finalizeDlcTransaction} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800">Oui, Étiquette Collée</button>
                      </div>
                  )}

                  {dlcStep === 'USE_OLDEST' && (
                      <div className="space-y-4">
                          <p className="text-sm font-bold text-slate-600">Utilisez-vous le lot <span className="text-rose-600">le plus ancien</span> ?</p>
                          <p className="text-xs text-slate-400">Cette action va sortir un lot de la liste des DLC actives.</p>
                          <button onClick={finalizeDlcTransaction} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800">Oui, Sortie du lot ancien</button>
                      </div>
                  )}

                  {dlcStep === 'EMPTY' && (
                      <div className="space-y-4">
                          <p className="text-sm font-bold text-slate-600">Aucun lot actif trouvé en stock.</p>
                          <p className="text-xs text-slate-400">Voulez-vous quand même enregistrer le mouvement ?</p>
                          <button onClick={finalizeDlcTransaction} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800">Confirmer la sortie</button>
                      </div>
                  )}

                  <button onClick={() => setDlcModalOpen(false)} className="text-slate-400 font-bold text-xs uppercase hover:underline">Annuler</button>
              </div>
          </div>
      )}

      {/* CONSIGNE MODAL */}
      {consigneModalOpen && pendingConsigneItem && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"></div>
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-2">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Rappel Consigne</h3>
                  <p className="text-sm font-bold text-slate-600 italic">"Une bouteille pleine sort, une bouteille vide revient !"</p>
                  <p className="text-xs text-slate-400">Veuillez placer la bouteille vide dans le bac de récupération.</p>
                  <button onClick={confirmConsigneAction} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700">J'ai récupéré la vide</button>
                  <button onClick={() => setConsigneModalOpen(false)} className="text-slate-400 font-bold text-xs uppercase hover:underline">Fermer</button>
              </div>
          </div>
      )}

      {/* TABS & MAIN UI */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
          <button onClick={() => setActiveTab('MOVEMENTS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Mouvements</button>
          <button onClick={() => setActiveTab('UNFULFILLED')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'UNFULFILLED' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'}`}>Ruptures Client</button>
      </div>

      {activeTab === 'MOVEMENTS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex gap-4">
                      <div className="flex-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit</label>
                          <input list="movement-items" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
                          <datalist id="movement-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                      </div>
                      <div className="w-24">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qté</label>
                          <input type="text" inputMode="decimal" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-center text-slate-900 outline-none" value={qty} onChange={(e) => setQty(e.target.value)} />
                      </div>
                  </div>
                  
                  {onCreateTemporaryItem && (
                      <div className="flex justify-end -mt-2">
                          <button onClick={() => setIsTempItemModalOpen(true)} className="text-[10px] font-black text-amber-500 hover:text-amber-700 uppercase tracking-widest flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                              Créer produit provisoire
                          </button>
                      </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                      <button onClick={() => handleAction('IN')} className="col-span-1 bg-emerald-500 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-xs">Entrée (+)</button>
                      <button onClick={() => handleAction('OUT')} className="col-span-2 bg-rose-500 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-lg">Sortie (-)</button>
                  </div>
              </div>

              <div className="space-y-3">
                  <div className="flex justify-between items-center ml-4 mr-4">
                      <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Mouvements Récents</h3>
                      {onUndo && (
                          <button onClick={onUndo} className="text-[10px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                              Annuler dernier
                          </button>
                      )}
                  </div>
                  {groupedTransactions.map((t, idx) => {
                      const item = items.find(i => i.id === t.itemId);
                      return (
                          <div key={`${t.id}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                              <div>
                                  <p className="font-bold text-slate-800 text-sm">{item?.name || 'Inconnu'}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {t.userName}</p>
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
    </div>
  );
};

export default Movements;
