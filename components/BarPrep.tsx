
import React, { useMemo, useState } from 'react';
import { StockItem, StorageSpace, StockLevel, StockConsigne, Category, StockPriority, Transaction, DLCProfile, DLCHistory } from '../types';

interface BarPrepProps {
  items: StockItem[];
  storages: StorageSpace[];
  stockLevels: StockLevel[];
  consignes: StockConsigne[];
  priorities: StockPriority[];
  transactions: Transaction[];
  onAction: (itemId: string, storageId: string, qtyNeeded: number, qtyToOrder?: number, isRupture?: boolean) => void;
  categories: Category[];
  dlcProfiles: DLCProfile[];
  dlcHistory?: DLCHistory[];
  onUpdateDlc?: (dlc: DLCHistory) => void;
  onDeleteDlc?: (id: string, qtyLostPercent: number) => void;
  userRole?: string;
}

interface NeedDetail {
  storage: StorageSpace;
  currentQty: number;
  minQty: number;
  gap: number;
  priority: number;
  batches: DLCHistory[];
}

interface AggregatedNeed {
  item: StockItem;
  totalGap: number;
  totalStock: number; // Stock théorique global
  dlcInfo: { count: number, closestExpiry: Date | null, label: string, status: 'OK' | 'WARNING' | 'NONE' };
  details: NeedDetail[];
  isComplete: boolean;
}

const BarPrep: React.FC<BarPrepProps> = ({ items, storages, stockLevels, consignes, transactions, priorities, onAction, categories, dlcProfiles, dlcHistory = [], onUpdateDlc, onDeleteDlc, userRole }) => {
  const [selectedDetail, setSelectedDetail] = useState<{ item: StockItem, detail: NeedDetail } | null>(null);
  const [productionQty, setProductionQty] = useState<string>('0');
  const [editingDlc, setEditingDlc] = useState<DLCHistory | null>(null);
  const [editOpenedAt, setEditOpenedAt] = useState('');
  const [editQuantity, setEditQuantity] = useState<string>('1');
  
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [percentLost, setPercentLost] = useState<number>(0);

  const [visualCheck, setVisualCheck] = useState<Record<string, boolean>>({});

  const aggregatedNeeds = useMemo<AggregatedNeed[]>(() => {
    const map = new Map<string, AggregatedNeed>();

    // Itérer sur TOUS les items qui ont un profil DLC
    items.forEach(item => {
        if (!item.dlcProfileId && !item.isDLC) return;
        const profile = item.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;

        // Récupérer les consignes pour cet item
        const itemConsignes = consignes.filter(c => c.itemId === item.id);
        
        // Calcul Stock Total (Théorique)
        const totalStock = stockLevels.filter(l => l.itemId === item.id).reduce((acc, curr) => acc + curr.currentQuantity, 0);

        // Calcul Info DLC
        const itemDlcs = dlcHistory.filter(h => h.itemId === item.id);
        let closestExpiry: Date | null = null;
        let dlcStatus: 'OK' | 'WARNING' | 'NONE' = 'NONE';
        
        if (itemDlcs.length > 0 && profile) {
            const sorted = itemDlcs.map(h => new Date(new Date(h.openedAt).getTime() + profile.durationHours * 3600000)).sort((a,b) => a.getTime() - b.getTime());
            closestExpiry = sorted[0];
            
            const now = new Date();
            const hoursLeft = (closestExpiry.getTime() - now.getTime()) / 3600000;
            if (hoursLeft < 0) dlcStatus = 'WARNING'; // Expiré
            else if (hoursLeft < 4) dlcStatus = 'WARNING'; // Bientôt expiré
            else dlcStatus = 'OK';
        }
        
        const dlcLabel = itemDlcs.length > 0 && closestExpiry 
            ? `${itemDlcs.length} lots (Exp: ${closestExpiry.toLocaleDateString()} ${closestExpiry.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})` 
            : "Aucun lot actif";

        if (itemConsignes.length === 0) return;

        let allOk = true;
        itemConsignes.forEach(c => {
            const level = stockLevels.find(l => l.itemId === c.itemId && l.storageId === c.storageId);
            const currentQty = level?.currentQuantity || 0;
            const minQty = c.minQuantity;
            const gap = Math.max(0, minQty - currentQty);
            if (gap > 0) allOk = false;
            
            const storage = storages.find(s => s.id === c.storageId);
            const priority = priorities.find(p => p.itemId === item.id && p.storageId === c.storageId)?.priority || 0;
            const batches = itemDlcs.filter(h => h.storageId === c.storageId);

            if (storage) {
                if (!map.has(item.id)) {
                    map.set(item.id, { item, totalGap: 0, totalStock, dlcInfo: { count: itemDlcs.length, closestExpiry, label: dlcLabel, status: dlcStatus }, details: [], isComplete: false });
                }
                const entry = map.get(item.id)!;
                entry.details.push({ storage, currentQty, minQty, gap, priority, batches });
                entry.totalGap += gap;
            }
        });

        if (map.has(item.id)) {
            map.get(item.id)!.isComplete = allOk;
        }
    });

    const list = Array.from(map.values());
    list.forEach(agg => agg.details.sort((a,b) => b.priority - a.priority));
    return list.sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [consignes, items, stockLevels, storages, priorities, dlcProfiles, dlcHistory]);

  const completeCount = aggregatedNeeds.filter(a => a.isComplete).length;

  const handleProduce = () => {
      if (selectedDetail) {
          const qty = parseFloat(productionQty);
          if (qty > 0) {
              onAction(selectedDetail.item.id, selectedDetail.detail.storage.id, qty);
          }
          setSelectedDetail(null);
      }
  };

  const handleSaveDlcEdit = () => {
      if (editingDlc && onUpdateDlc) {
          onUpdateDlc({ 
              ...editingDlc, 
              openedAt: new Date(editOpenedAt).toISOString(),
              quantity: parseFloat(editQuantity) || 1
          });
          setEditingDlc(null);
      }
  };

  const handleConfirmLoss = () => {
      if (selectedBatchId && onDeleteDlc) {
          onDeleteDlc(selectedBatchId, percentLost);
          setLossModalOpen(false);
          setSelectedBatchId(null);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 relative animate-in fade-in slide-in-from-bottom-2">
      {/* MODAL PRODUCTION */}
      {selectedDetail && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-500"></div>
                  
                  <div className="space-y-1">
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedDetail.item.name}</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{selectedDetail.detail.storage.name}</p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                      <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Production requise</p>
                      <p className="text-4xl font-black text-purple-600">{selectedDetail.detail.gap > 0 ? selectedDetail.detail.gap.toFixed(2) : 'Stock OK'}</p>
                  </div>

                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantité à produire</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-2xl font-black text-center text-purple-600 outline-none focus:ring-2 focus:ring-purple-200"
                        value={productionQty}
                        onChange={e => setProductionQty(e.target.value)}
                      />
                  </div>

                  <button onClick={handleProduce} disabled={parseFloat(productionQty) <= 0} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                      Confirmer Production (+{parseFloat(productionQty)})
                  </button>
                  
                  <button onClick={() => setSelectedDetail(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2">✕</button>
              </div>
          </div>
      )}

      {/* MODAL EDIT DLC (ADMIN ONLY) */}
      {editingDlc && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Modifier Lot</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Date & Heure</label>
                          <input 
                              type="datetime-local" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-900 outline-none"
                              value={editOpenedAt}
                              onChange={e => setEditOpenedAt(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Quantité (Lot)</label>
                          <input 
                              type="number" 
                              step="0.01"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-900 outline-none"
                              value={editQuantity}
                              onChange={e => setEditQuantity(e.target.value)}
                          />
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button onClick={() => setEditingDlc(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Annuler</button>
                          <button onClick={handleSaveDlcEdit} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-700">Enregistrer</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL LOSS */}
      {lossModalOpen && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Supprimer le lot</h3>
                  <p className="text-xs text-slate-500 font-bold">Quelle part du lot a été perdue ?</p>
                  
                  <div className="space-y-4 py-4">
                      <div className="text-center font-black text-3xl text-rose-500">
                          {percentLost}% <span className="text-sm text-slate-400 font-bold uppercase">Perdu</span>
                      </div>
                      <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="10" 
                          className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:bg-slate-200 transition-colors"
                          value={percentLost}
                          onChange={(e) => setPercentLost(parseInt(e.target.value))}
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => setLossModalOpen(false)} className="py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest">Annuler</button>
                      <button onClick={handleConfirmLoss} className="py-3 bg-rose-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-200">Valider</button>
                  </div>
              </div>
          </div>
      )}

      <header className="bg-purple-900 rounded-[2rem] p-8 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">Préparation Bar</h1>
            <p className="text-purple-200 text-xs font-bold mt-1 uppercase tracking-widest">Vérifier quantité à chaque service.</p>
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-xl text-center">
            <span className="block text-2xl font-black">{completeCount}/{aggregatedNeeds.length}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-200">Produits complets</span>
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {aggregatedNeeds.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic">Aucun produit configuré en Production.</div>
          ) : (
              <div className="divide-y divide-slate-100">
                  {aggregatedNeeds.map(agg => (
                      <div key={agg.item.id} className="p-5 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-2">
                              <div className="flex items-center gap-3">
                                  <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-purple-600 rounded-lg cursor-pointer"
                                    checked={visualCheck[agg.item.id] || false}
                                    onChange={e => setVisualCheck(prev => ({ ...prev, [agg.item.id]: e.target.checked }))}
                                  />
                                  <div>
                                      <h3 className="font-black text-slate-900 text-base">{agg.item.name}</h3>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                              Stock Global: {agg.totalStock}
                                          </span>
                                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                                              agg.dlcInfo.status === 'WARNING' ? 'bg-rose-100 text-rose-600 border-rose-200 animate-pulse' : 
                                              agg.dlcInfo.status === 'OK' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                                          }`}>
                                              DLC: {agg.dlcInfo.label}
                                          </span>
                                          {userRole === 'ADMIN' && agg.dlcInfo.count > 0 && (
                                              <button 
                                                onClick={() => {
                                                    const lastLot = dlcHistory.filter(h => h.itemId === agg.item.id).sort((a,b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
                                                    if (lastLot) {
                                                        setEditingDlc(lastLot);
                                                        setEditOpenedAt(new Date(lastLot.openedAt).toISOString().slice(0, 16));
                                                    }
                                                }}
                                                className="text-[10px] font-black text-purple-500 hover:text-purple-700 uppercase tracking-widest"
                                              >
                                                  Modifier Lot
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              </div>
                              {agg.totalGap > 0 ? (
                                  <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-lg">Manque Total: +{agg.totalGap.toFixed(2)}</span>
                              ) : (
                                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg">Stock OK</span>
                              )}
                          </div>
                          <div className="space-y-3">
                              {agg.details.map((d, idx) => (
                                  <div key={idx} className="bg-purple-50/30 rounded-2xl border border-purple-100 overflow-hidden">
                                      <div className="flex items-center justify-between p-3 bg-purple-50/50 border-b border-purple-100">
                                          <span className="text-xs font-black text-purple-900 uppercase ml-2">📍 {d.storage.name}</span>
                                          <div className="flex items-center gap-3">
                                              <span className={`text-[10px] font-bold ${d.currentQty < d.minQty ? 'text-rose-500' : 'text-emerald-500'}`}>Stock Local: {d.currentQty.toFixed(2)} / Min: {d.minQty.toFixed(2)}</span>
                                              <button 
                                                onClick={() => {
                                                    setSelectedDetail({ item: agg.item, detail: d });
                                                    setProductionQty(d.gap > 0 ? d.gap.toFixed(2) : '1');
                                                }} 
                                                className={`bg-white border px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-colors ${d.gap > 0 ? 'text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white' : 'text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                                              >
                                                  Produire {d.gap > 0 ? `(+${d.gap.toFixed(2)})` : ''}
                                              </button>
                                          </div>
                                      </div>
                                      
                                      {/* BATCHES VISUALIZATION */}
                                      <div className="p-3 flex flex-wrap gap-2">
                                          {d.batches.length > 0 ? d.batches.map(batch => {
                                              const profile = agg.item.dlcProfileId ? dlcProfiles.find(p => p.id === agg.item.dlcProfileId) : null;
                                              const expiry = new Date(new Date(batch.openedAt).getTime() + (profile?.durationHours || 24) * 3600000);
                                              const isExpired = new Date() > expiry;
                                              
                                              return (
                                                  <div key={batch.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isExpired ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-700'}`}>
                                                      <div className="flex flex-col">
                                                          <span className="text-[10px] font-black uppercase tracking-tighter">Lot: {batch.quantity || 1}</span>
                                                          <span className="text-[8px] font-bold opacity-60">Exp: {expiry.toLocaleDateString()}</span>
                                                      </div>
                                                      <div className="flex gap-1 ml-2">
                                                          <button 
                                                            onClick={() => {
                                                                setEditingDlc(batch);
                                                                setEditOpenedAt(new Date(batch.openedAt).toISOString().slice(0, 16));
                                                                setEditQuantity((batch.quantity || 1).toString());
                                                            }}
                                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-500"
                                                          >
                                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                          </button>
                                                          <button 
                                                            onClick={() => {
                                                                setSelectedBatchId(batch.id);
                                                                setPercentLost(0);
                                                                setLossModalOpen(true);
                                                            }}
                                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-500"
                                                          >
                                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                          </button>
                                                      </div>
                                                  </div>
                                              );
                                          }) : (
                                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic p-1">Aucun lot actif ici</span>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default BarPrep;
