import React, { useState, useMemo } from 'react';
import { StockItem, Transaction, StorageSpace, UnfulfilledOrder, Format, DLCProfile, DLCHistory } from '../types';

interface MovementsProps {
  items: StockItem[];
  transactions: Transaction[];
  storages: StorageSpace[];
  onTransaction: (itemId: string, type: 'IN' | 'OUT', qty: number) => void;
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
    const searchNormalized = normalizeText(search);
    const item = items.find(i => normalizeText(i.name) === searchNormalized);

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

            // SCÉNARIO SORTIE (OUT)
            if (type === 'OUT') {
                if (profile.type === 'OPENING') {
                    // DLC Ouverture : On sort une bouteille -> Faut étiqueter la nouvelle ouverte
                    setDlcStep('LABEL_CHECK');
                    setDlcModalOpen(true);
                    return;
                } 
                else if (profile.type === 'PRODUCTION') {
                    // DLC Production : On sort un lot -> Faut vérifier si on a du stock DLC
                    const existingBatches = dlcHistory.filter(h => h.itemId === item.id);
                    if (existingBatches.length > 0) {
                        setDlcStep('USE_OLDEST'); // "Prenez le plus vieux"
                    } else {
                        setDlcStep('EMPTY'); // "Plus de stock frais, pensez à produire"
                    }
                    setDlcModalOpen(true);
                    return;
                }
            } 
            
            // SCÉNARIO ENTRÉE (IN)
            if (type === 'IN') {
                if (profile.type === 'PRODUCTION') {
                    // DLC Production : On rentre une production -> Faut étiqueter
                    setDlcStep('LABEL_CHECK');
                    setDlcModalOpen(true);
                    return;
                }
                // Si DLC Ouverture et IN : Pas d'action spéciale (c'est une bouteille fermée qui rentre)
            }
        }
    }

    // Gestion Consigne (Uniquement si pas intercepté par DLC ou après DLC résolu)
    if (type === 'OUT' && item.isConsigne) {
        setPendingConsigneItem(item);
        setConsigneModalOpen(true);
        return;
    }

    // Si pas d'interception, on exécute
    onTransaction(item.id, type, quantity);
    setSearch('');
    setQty('1');
  };

  const finalizeDlcTransaction = () => {
      if (!pendingDlcItem) return;
      
      let normalized = qty.replace(',', '.');
      if (normalized === '.') normalized = '0';
      const quantity = parseFloat(normalized) || 1;

      const profile = dlcProfiles?.find(p => p.id === pendingDlcItem.dlcProfileId);
      
      // Exécution de la transaction stock
      onTransaction(pendingDlcItem.id, pendingDlcAction, quantity);

      // Gestion Side-Effects DLC
      if (pendingDlcAction === 'IN') {
          if (profile?.type === 'PRODUCTION' && onDlcEntry) {
              // On crée une entrée DLC
              // Note: storageId est approximatif ici (on prend s0 ou premier dispo), idéalement faudrait demander
              // Pour simplifier, on associe au premier stockage valide de l'item ou 's0'
              // (Dans une V2, demander le stockage destination)
              onDlcEntry(pendingDlcItem.id, 's_global', 'PRODUCTION'); 
          }
      } else { // OUT
          if (profile?.type === 'OPENING' && onDlcEntry) {
              onDlcEntry(pendingDlcItem.id, 's_global', 'OPENING');
          }
          if (profile?.type === 'PRODUCTION' && onDlcConsumption && dlcStep === 'USE_OLDEST') {
              // On consomme le plus vieux lot
              onDlcConsumption(pendingDlcItem.id);
          }
      }

      // Check Consigne chaining
      if (pendingDlcAction === 'OUT' && pendingDlcItem.isConsigne) {
          setDlcModalOpen(false);
          setPendingConsigneItem(pendingDlcItem);
          setConsigneModalOpen(true);
      } else {
          setDlcModalOpen(false);
          setPendingDlcItem(null);
          setSearch('');
          setQty('1');
      }
  };

  const confirmConsigneAction = () => {
      if (pendingConsigneItem) {
          // Si on arrive ici, c'est que la transaction n'a PAS encore été faite (cas simple)
          // OU elle a été faite via finalizeDlcTransaction mais on a juste besoin de fermer la modale ?
          // Attention : si on vient du chaînage DLC, la transaction a DEJA été faite dans finalizeDlcTransaction.
          // Mais dans ce cas, pendingConsigneItem est set APRES.
          // Si on est ici direct (pas de DLC), on doit faire la transaction.
          
          if (!pendingDlcItem) { // Si pas de contexte DLC en cours
             let normalized = qty.replace(',', '.');
             if (normalized === '.') normalized = '0';
             const quantity = parseFloat(normalized) || 1;
             onTransaction(pendingConsigneItem.id, 'OUT', quantity);
             setSearch('');
             setQty('1');
          }
          
          setConsigneModalOpen(false);
          setPendingConsigneItem(null);
          setPendingDlcItem(null); // Cleanup
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
      const searchNormalized = normalizeText(unfulfilledSearch);
      const item = items.find(i => normalizeText(i.name) === searchNormalized);
      
      if (item) {
          if (window.confirm(`Déclarer une rupture client pour "${item.name}" (Qté: ${unfulfilledQty}) ?\n\nCela mettra les stocks à jour.`)) {
              onReportUnfulfilled(item.id, unfulfilledQty);
              setUnfulfilledSearch('');
              setUnfulfilledQty(1);
          }
      } else {
          alert(`Produit "${unfulfilledSearch}" introuvable.\nAssurez-vous de sélectionner un produit existant dans la liste.`);
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

        if (isSameTime && isSameItem && isSameType && isSameUser) {
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
      {/* DLC MODAL */}
      {dlcModalOpen && pendingDlcItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-8 relative overflow-hidden">
                
                {/* HEADER COLOR & ICON */}
                <div className={`absolute top-0 left-0 w-full h-2 ${dlcStep === 'EMPTY' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${dlcStep === 'EMPTY' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                    {dlcStep === 'EMPTY' ? (
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : (
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                        {dlcStep === 'EMPTY' ? 'Rupture DLC' : (dlcStep === 'USE_OLDEST' ? 'Rotation Stock' : 'Étiquetage Requis')}
                    </h3>
                    <p className="text-slate-500 font-medium leading-relaxed">
                        {dlcStep === 'EMPTY' && "Plus aucun lot frais disponible. Pensez à lancer une production !"}
                        {dlcStep === 'USE_OLDEST' && "Des lots sont déjà ouverts/produits. Merci d'utiliser le plus ancien en priorité."}
                        {dlcStep === 'LABEL_CHECK' && "N'oubliez pas d'étiqueter la bouteille/contenant avec la date du jour."}
                    </p>
                    {pendingDlcItem && (
                        <div className="bg-slate-50 p-3 rounded-xl inline-block mt-2">
                            <span className="font-bold text-slate-800">{pendingDlcItem.name}</span>
                            <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Durée: {getDlcDurationLabel(pendingDlcItem)}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <button onClick={finalizeDlcTransaction} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-slate-800 shadow-lg active:scale-95 transition-all">
                        Confirmer & Continuer
                    </button>
                    <button onClick={() => setDlcModalOpen(false)} className="text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600">Annuler</button>
                </div>
            </div>
        </div>
      )}

      {/* CONSIGNE MODAL */}
      {consigneModalOpen && pendingConsigneItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-100 text-blue-600">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Consigne</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">
                        Cet article est consigné. Veuillez placer la bouteille vide dans le bac de recyclage approprié.
                    </p>
                    <div className="bg-slate-50 p-3 rounded-xl inline-block mt-2">
                        <span className="font-bold text-slate-800">{pendingConsigneItem.name}</span>
                    </div>
                </div>
                <button onClick={confirmConsigneAction} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-blue-700 shadow-lg active:scale-95 transition-all">
                    C'est fait
                </button>
            </div>
        </div>
      )}

      {/* TEMP ITEM MODAL */}
      {isTempItemModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Produit Non Prévu</h3>
                  <div className="space-y-4">
                      <div className="text-left space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du produit</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none" value={tempItemName} onChange={(e) => setTempItemName(e.target.value)} autoFocus /></div>
                      <div className="text-left space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Consigne Surstock</label><input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none text-center" value={tempItemQty} onChange={(e) => setTempItemQty(parseInt(e.target.value) || 0)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => setIsTempItemModalOpen(false)} className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">Annuler</button>
                      <button onClick={handleCreateTempItem} disabled={!tempItemName} className="py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all">Créer</button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER TABS */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
          <button onClick={() => setActiveTab('MOVEMENTS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Mouvements Stock</button>
          <button onClick={() => setActiveTab('UNFULFILLED')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'UNFULFILLED' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Ruptures Client</button>
      </div>

      {activeTab === 'MOVEMENTS' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              
              {/* ACTION AREA */}
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
                  
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleAction('IN')} className="bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all">Entrée (+)</button>
                      <button onClick={() => handleAction('OUT')} className="bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-100 active:scale-95 transition-all">Sortie (-)</button>
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
                                  <p className="font-bold text-slate-800 text-sm">{item?.name || 'Inconnu'}</p>
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

      {activeTab === 'UNFULFILLED' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                      <h3 className="font-black text-rose-800 uppercase tracking-tight">Déclarer une rupture</h3>
                      <button onClick={handleExportUnfulfilled} className="text-[9px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-600">Export CSV</button>
                  </div>
                  <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                          <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest ml-1">Produit</label>
                          <input 
                            list="unfulfilled-items"
                            className="w-full bg-white border border-rose-200 rounded-2xl p-4 font-bold text-rose-900 outline-none placeholder-rose-300"
                            placeholder="Rechercher..."
                            value={unfulfilledSearch}
                            onChange={(e) => setUnfulfilledSearch(e.target.value)}
                          />
                          <datalist id="unfulfilled-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                      </div>
                      <div className="w-24 space-y-1">
                          <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest ml-1">Qté</label>
                          <input 
                            type="number" 
                            min="1"
                            className="w-full bg-white border border-rose-200 rounded-2xl p-4 font-black text-center text-rose-900 outline-none"
                            value={unfulfilledQty}
                            onChange={(e) => setUnfulfilledQty(parseInt(e.target.value) || 1)}
                          />
                      </div>
                  </div>
                  <button onClick={handleAddUnfulfilled} className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-200 active:scale-95 transition-all">Signaler Rupture Client</button>
              </div>

              <div className="space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 ml-4">Historique Ruptures</h3>
                  {unfulfilledOrders.slice(0, 20).map(u => {
                      const item = items.find(i => i.id === u.itemId);
                      return (
                          <div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm opacity-80">
                              <div>
                                  <p className="font-bold text-slate-800 text-sm">{item?.name || 'Inconnu'}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {new Date(u.date).toLocaleDateString()} {new Date(u.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {u.userName}
                                  </p>
                              </div>
                              <div className="px-3 py-1.5 rounded-lg font-black text-xs bg-slate-100 text-slate-600">
                                  {u.quantity}
                              </div>
                          </div>
                      );
                  })}
                  {unfulfilledOrders.length === 0 && <p className="text-center text-slate-400 italic py-4">Aucune rupture signalée.</p>}
              </div>
          </div>
      )}
    </div>
  );
};

export default Movements;
