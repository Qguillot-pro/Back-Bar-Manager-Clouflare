
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
}

interface NeedDetail {
  storage: StorageSpace;
  currentQty: number;
  minQty: number;
  gap: number;
  priority: number;
}

interface AggregatedNeed {
  item: StockItem;
  totalGap: number;
  totalStock: number; // Stock théorique global
  dlcInfo: { count: number, closestExpiry: Date | null, label: string, status: 'OK' | 'WARNING' | 'NONE' };
  details: NeedDetail[];
}

const BarPrep: React.FC<BarPrepProps> = ({ items, storages, stockLevels, consignes, transactions, priorities, onAction, categories, dlcProfiles, dlcHistory = [] }) => {
  const [selectedDetail, setSelectedDetail] = useState<{ item: StockItem, detail: NeedDetail } | null>(null);
  
  const aggregatedNeeds = useMemo<AggregatedNeed[]>(() => {
    const map = new Map<string, AggregatedNeed>();

    // Itérer sur TOUS les items qui ont un profil DLC type 'PRODUCTION'
    items.forEach(item => {
        const profile = item.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
        if (profile?.type !== 'PRODUCTION') return;

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

        // Pour chaque lieu de stockage (défini par une consigne), calculer le gap
        // Si pas de consigne définie, on peut imaginer un stockage par défaut 'Bar' mais ici on se base sur les consignes existantes
        if (itemConsignes.length === 0) {
             // Cas rare: item de prod sans consigne de stockage. On l'affiche quand même si on veut, mais sans bouton de prod précis ?
             // Pour simplifier, on ne traite que si une consigne existe (lieu de stockage défini).
        }

        itemConsignes.forEach(c => {
            const level = stockLevels.find(l => l.itemId === c.itemId && l.storageId === c.storageId);
            const currentQty = level?.currentQuantity || 0;
            const minQty = c.minQuantity;
            const gap = Math.max(0, minQty - currentQty); // Gap peut être 0
            
            const storage = storages.find(s => s.id === c.storageId);
            const priority = priorities.find(p => p.itemId === item.id && p.storageId === c.storageId)?.priority || 0;

            if (storage) {
                if (!map.has(item.id)) {
                    map.set(item.id, { item, totalGap: 0, totalStock, dlcInfo: { count: itemDlcs.length, closestExpiry, label: dlcLabel, status: dlcStatus }, details: [] });
                }
                const entry = map.get(item.id)!;
                entry.details.push({ storage, currentQty, minQty, gap, priority });
                entry.totalGap += gap;
            }
        });
    });

    const list = Array.from(map.values());
    list.forEach(agg => agg.details.sort((a,b) => b.priority - a.priority));
    return list.sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [consignes, items, stockLevels, storages, priorities, dlcProfiles, dlcHistory]);

  const handleProduce = () => {
      if (selectedDetail) {
          onAction(selectedDetail.item.id, selectedDetail.detail.storage.id, selectedDetail.detail.gap);
          setSelectedDetail(null);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 relative animate-in fade-in slide-in-from-bottom-2">
      {/* MODAL */}
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

                  <button onClick={handleProduce} disabled={selectedDetail.detail.gap <= 0} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                      Confirmer Production (+{selectedDetail.detail.gap > 0 ? selectedDetail.detail.gap : 1})
                  </button>
                  <p className="text-[10px] text-slate-400">Si le stock est OK, vous pouvez forcer une production de 1 unité.</p>
                  
                  <button onClick={() => setSelectedDetail(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2">✕</button>
              </div>
          </div>
      )}

      <header className="bg-purple-900 rounded-[2rem] p-8 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">Préparation Bar</h1>
            <p className="text-purple-200 text-xs font-bold mt-1">Production Produits Frais (Jus, Sirops, Prémix)</p>
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-xl text-center">
            <span className="block text-2xl font-black">{aggregatedNeeds.length}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-200">Produits suivis</span>
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
                                  </div>
                              </div>
                              {agg.totalGap > 0 ? (
                                  <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-lg">Manque Total: +{agg.totalGap}</span>
                              ) : (
                                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg">Stock OK</span>
                              )}
                          </div>
                          <div className="space-y-2">
                              {agg.details.map((d, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-purple-50/50 p-2 rounded-xl border border-purple-100">
                                      <span className="text-xs font-bold text-purple-900 uppercase ml-2">{d.storage.name}</span>
                                      <div className="flex items-center gap-3">
                                          <span className={`text-[10px] font-bold ${d.currentQty < d.minQty ? 'text-rose-500' : 'text-emerald-500'}`}>Stock Local: {d.currentQty} / Min: {d.minQty}</span>
                                          <button 
                                            onClick={() => setSelectedDetail({ item: agg.item, detail: d })} 
                                            className={`bg-white border px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-colors ${d.gap > 0 ? 'text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white' : 'text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                                          >
                                              Produire {d.gap > 0 ? `(+${d.gap})` : ''}
                                          </button>
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
