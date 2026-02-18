
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
  
  const [dlcModalOpen, setDlcModalOpen] = useState(false);
  const [pendingDlcItem, setPendingDlcItem] = useState<StockItem | null>(null);
  const [pendingDlcAction, setPendingDlcAction] = useState<'IN' | 'OUT'>('OUT');

  const [isTempItemModalOpen, setIsTempItemModalOpen] = useState(false);
  const [tempItemName, setTempItemName] = useState('');

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
            setIsTempItemModalOpen(true);
        } else {
            alert(`Produit "${search}" introuvable.`);
        }
        return;
    }

    let quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity <= 0) quantity = 1;

    // Logique DLC
    if (item.isDLC && dlcProfiles && onDlcEntry) {
        setPendingDlcItem(item);
        setPendingDlcAction(type);
        setDlcModalOpen(true);
        return;
    }

    onTransaction(item.id, type, quantity, isServiceTransfer);
    setSearch('');
    setQty('1');
  };

  const finalizeDlcTransaction = () => {
      if (!pendingDlcItem) return;
      let quantity = parseInt(qty, 10) || 1;
      onTransaction(pendingDlcItem.id, pendingDlcAction, quantity, isServiceTransfer);
      if (onDlcEntry && pendingDlcAction === 'IN') onDlcEntry(pendingDlcItem.id, 's_global', 'OPENING');
      setDlcModalOpen(false);
      setPendingDlcItem(null);
      setSearch('');
      setQty('1');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* MODALE PRODUIT PROVISOIRE */}
      {isTempItemModalOpen && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Produit Provisoire</h3>
                  <p className="text-xs text-slate-500 font-bold">Produit inconnu. Voulez-vous le créer pour enregistrer l'entrée ?</p>
                  <input type="text" className="w-full bg-slate-50 border rounded-xl p-3 font-bold text-slate-900" value={tempItemName} onChange={(e) => setTempItemName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setIsTempItemModalOpen(false)} className="py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px]">Annuler</button>
                      <button onClick={() => { onCreateTemporaryItem?.(tempItemName, 0); setIsTempItemModalOpen(false); }} className="py-3 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px]">Créer</button>
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

      {/* TABS */}
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
                          <input list="movement-items" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
                          <datalist id="movement-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                      </div>
                      <div className="w-24">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qté (Entier)</label>
                          <input 
                            type="number" 
                            inputMode="numeric" 
                            pattern="[0-9]*"
                            step="1"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-center outline-none" 
                            value={qty} 
                            onChange={(e) => {
                                const val = e.target.value;
                                // On n'accepte que les chiffres
                                if (/^\d*$/.test(val)) setQty(val);
                            }} 
                          />
                      </div>
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
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {!isNaN(d.getTime()) ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'} • {t.userName}
                                  </p>
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
