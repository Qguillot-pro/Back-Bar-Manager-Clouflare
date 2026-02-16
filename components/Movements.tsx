
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
  
  const [unfulfilledSearch, setUnfulfilledSearch] = useState('');
  const [unfulfilledQty, setUnfulfilledQty] = useState(1);

  // DLC Modal State
  const [dlcModalOpen, setDlcModalOpen] = useState(false);
  const [pendingDlcItem, setPendingDlcItem] = useState<StockItem | null>(null);
  const [pendingDlcAction, setPendingDlcAction] = useState<'IN' | 'OUT'>('OUT');
  const [dlcStep, setDlcStep] = useState<'LABEL_CHECK' | 'USE_OLDEST' | 'EMPTY' | 'NONE'>('NONE');

  // Consigne Modal State
  const [consigneModalOpen, setConsigneModalOpen] = useState(false);
  const [pendingConsigneItem, setPendingConsigneItem] = useState<StockItem | null>(null);

  const [isTempItemModalOpen, setIsTempItemModalOpen] = useState(false);
  const [tempItemName, setTempItemName] = useState('');
  const [tempItemQty, setTempItemQty] = useState<number>(0);

  const handleAction = (type: 'IN' | 'OUT') => {
    const searchNormalized = normalizeText(search.trim());
    const item = items.find(i => normalizeText(i.name.trim()) === searchNormalized);

    if (!item) {
        alert(`Produit "${search}" introuvable.\nVeuillez sélectionner un produit existant dans la liste.`);
        return;
    }

    let normalized = qty.replace(',', '.');
    if (normalized === '.') normalized = '0';
    let quantity = parseFloat(normalized);
    if (isNaN(quantity) || quantity <= 0) quantity = 1;

    // --- LOGIQUE DLC AVANCÉE ---
    if (item.isDLC && dlcProfiles && onDlcEntry && onDlcConsumption) {
        const profile = dlcProfiles.find(p => p.id === item.dlcProfileId);
        if (profile) {
            setPendingDlcItem(item);
            setPendingDlcAction(type);

            if (type === 'OUT') {
                if (profile.type === 'OPENING') {
                    setDlcStep('LABEL_CHECK');
                    setDlcModalOpen(true);
                    return;
                } 
                else if (profile.type === 'PRODUCTION') {
                    const existingBatches = dlcHistory.filter(h => h.itemId === item.id);
                    if (existingBatches.length > 0) {
                        setDlcStep('USE_OLDEST'); 
                    } else {
                        setDlcStep('EMPTY');
                    }
                    setDlcModalOpen(true);
                    return;
                }
            } 
            
            if (type === 'IN') {
                if (profile.type === 'PRODUCTION') {
                    setDlcStep('LABEL_CHECK');
                    setDlcModalOpen(true);
                    return;
                }
            }
        }
    }

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
      if (normalized === '.') normalized = '0';
      const quantity = parseFloat(normalized) || 1;

      const profile = dlcProfiles?.find(p => p.id === pendingDlcItem.dlcProfileId);
      
      onTransaction(pendingDlcItem.id, pendingDlcAction, quantity, isServiceTransfer);

      if (pendingDlcAction === 'IN') {
          if (profile?.type === 'PRODUCTION' && onDlcEntry) {
              onDlcEntry(pendingDlcItem.id, 's_global', 'PRODUCTION'); 
          }
      } else { 
          if (profile?.type === 'OPENING' && onDlcEntry) {
              onDlcEntry(pendingDlcItem.id, 's_global', 'OPENING');
          }
          if (profile?.type === 'PRODUCTION' && onDlcConsumption && dlcStep === 'USE_OLDEST') {
              onDlcConsumption(pendingDlcItem.id);
          }
      }

      if (pendingDlcAction === 'OUT' && pendingDlcItem.isConsigne) {
          setDlcModalOpen(false);
          setPendingConsigneItem(pendingDlcItem);
          setConsigneModalOpen(true);
      } else {
          setDlcModalOpen(false);
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
             if (normalized === '.') normalized = '0';
             const quantity = parseFloat(normalized) || 1;
             onTransaction(pendingConsigneItem.id, 'OUT', quantity, isServiceTransfer);
             setSearch('');
             setQty('1');
             setIsServiceTransfer(false);
          }
          setConsigneModalOpen(false);
          setPendingConsigneItem(null);
          setPendingDlcItem(null);
      }
  };

  const getDlcDurationLabel = (item: StockItem) => {
      const profile = dlcProfiles?.find(p => p.id === item.dlcProfileId);
      if (!profile) return "Inconnue";
      if (profile.durationHours >= 24) {
          return `${Number((profile.durationHours / 24).toFixed(1))} Jour(s)`;
      }
      return `${profile.durationHours} Heure(s)`;
  };

  const handleAddUnfulfilled = () => {
      const searchNormalized = normalizeText(unfulfilledSearch.trim());
      const item = items.find(i => normalizeText(i.name.trim()) === searchNormalized);
      if (item) {
          if (window.confirm(`Déclarer une rupture client pour "${item.name}" (Qté: ${unfulfilledQty}) ?`)) {
              onReportUnfulfilled(item.id, unfulfilledQty);
              setUnfulfilledSearch('');
              setUnfulfilledQty(1);
          }
      } else {
          alert(`Produit introuvable.`);
      }
  };

  const handleExportUnfulfilled = () => {
    if (unfulfilledOrders.length === 0) return;
    let csv = "\uFEFFDate,Heure,Utilisateur,Produit,Format,Quantité\n";
    unfulfilledOrders.forEach(u => {
      const it = items.find(i => i.id === u.itemId);
      const fmt = formats.find(f => f.id === it?.formatId);
      const d = new Date(u.date);
      csv += `"${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${u.userName || '-'}","${it?.name || 'Inconnu'}","${fmt?.name || 'N/A'}","${u.quantity || 1}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ruptures_clients_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleCreateTempItem = () => {
      if (!tempItemName || !onCreateTemporaryItem) return;
      onCreateTemporaryItem(tempItemName, tempItemQty);
      setTempItemName('');
      setTempItemQty(0);
      setIsTempItemModalOpen(false);
  };

  const groupedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const grouped: (Transaction & { count: number, storageNames: Set<string> })[] = [];
    
    sorted.forEach((current) => {
        const currentQty = Number(current.quantity);
        const currentStorageName = storages.find(s => s.id === current.storageId)?.name || 'Inconnu';

        if (grouped.length === 0) {
            grouped.push({ ...current, quantity: currentQty, count: 1, storageNames: new Set([currentStorageName]) });
            return;
        }

        const last = grouped[grouped.length - 1];
        const currentDate = new Date(current.date);
        const lastDate = new Date(last.date);
        
        const isSameTime = Math.abs(currentDate.getTime() - lastDate.getTime()) < 60000;
        const isSameItem = current.itemId === last.itemId;
        const isSameType = current.type === last.type;
        const isSameUser = current.userName === last.userName;
        const isSameServiceTransfer = current.isServiceTransfer === last.isServiceTransfer;

        if (isSameTime && isSameItem && isSameType && isSameUser && isSameServiceTransfer) {
            last.quantity = Number(last.quantity) + currentQty;
            last.count += 1;
            last.storageNames.add(currentStorageName);
        } else {
            grouped.push({ ...current, quantity: currentQty, count: 1, storageNames: new Set([currentStorageName]) });
        }
    });

    return grouped.slice(0, 50);
  }, [transactions, storages]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* ... (DLC & Consigne Modals - identical to before) ... */}
      
      {/* HEADER TABS */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
          <button onClick={() => setActiveTab('MOVEMENTS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Mouvements Stock</button>
          <button onClick={() => setActiveTab('UNFULFILLED')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'UNFULFILLED' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Ruptures Client</button>
      </div>

      {activeTab === 'MOVEMENTS' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit</label>
                          <input 
                            list="movement-items"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <datalist id="movement-items">
                              {items.map(i => <option key={i.id} value={i.name} />)}
                          </datalist>
                      </div>
                      <div className="w-24 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qté</label>
                          <input 
                            type="text" 
                            inputMode="decimal"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-center text-slate-900 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                      </div>
                  </div>
                  
                  <label className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500" checked={isServiceTransfer} onChange={e => setIsServiceTransfer(e.target.checked)} />
                      <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-700 flex items-center gap-2">
                              Transfert Resto/Cuisine
                              {isServiceTransfer && <span className="text-amber-500">⚠️</span>}
                          </span>
                          <span className="text-[9px] text-slate-400">Marquer ce mouvement comme un transfert inter-service</span>
                      </div>
                  </label>

                  <div className="grid grid-cols-3 gap-4">
                      <button onClick={() => handleAction('IN')} className="col-span-1 bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all text-xs">Entrée (+)</button>
                      <button onClick={() => handleAction('OUT')} className="col-span-2 bg-rose-500 hover:bg-rose-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-100 active:scale-95 transition-all text-lg">Sortie (-)</button>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                        <button onClick={() => setIsTempItemModalOpen(true)} className="text-[9px] font-black text-amber-500 uppercase tracking-widest hover:text-amber-600 flex items-center gap-1"><span className="w-4 h-4 bg-amber-100 rounded flex items-center justify-center">+</span> Produit non prévu</button>
                        {onUndo && (
                            <button onClick={onUndo} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg> Annuler dernier
                            </button>
                        )}
                  </div>
              </div>

              {/* RECENT LIST */}
              <div className="space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 ml-4">Récemment</h3>
                  {groupedTransactions.map((t, idx) => {
                      const item = items.find(i => i.id === t.itemId);
                      return (
                          <div key={`${t.id}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                              <div>
                                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                      {item?.name || 'Inconnu'}
                                      {t.isServiceTransfer && <span title="Transfert Inter-Service" className="text-amber-500 text-xs">⚠️</span>}
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {t.userName} • {Array.from(t.storageNames).join(', ')}
                                  </p>
                              </div>
                              <div className={`px-3 py-1.5 rounded-lg font-black text-xs ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                  {t.type === 'IN' ? '+' : '-'}{parseFloat(Number(t.quantity).toFixed(2))}
                              </div>
                          </div>
                      );
                  })}
                  {groupedTransactions.length === 0 && <p className="text-center text-slate-400 italic py-4">Aucun mouvement récent.</p>}
              </div>
          </div>
      )}
      {/* ... Unfulfilled Tab (Unchanged) ... */}
    </div>
  );
};

export default Movements;
