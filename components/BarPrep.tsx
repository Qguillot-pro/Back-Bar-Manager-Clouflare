
import React, { useMemo, useState } from 'react';
import { StockItem, StorageSpace, StockLevel, StockConsigne, Category, StockPriority, Transaction, DLCProfile } from '../types';

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
  details: NeedDetail[];
}

const BarPrep: React.FC<BarPrepProps> = ({ items, storages, stockLevels, consignes, transactions, priorities, onAction, categories, dlcProfiles }) => {
  const [selectedDetail, setSelectedDetail] = useState<{ item: StockItem, detail: NeedDetail } | null>(null);
  
  // Logic is similar to Restock but exclusively for PRODUCTION type items (e.g., Juices, Pre-mixes)
  const aggregatedNeeds = useMemo<AggregatedNeed[]>(() => {
    const map = new Map<string, AggregatedNeed>();

    consignes.forEach(c => {
        const item = items.find(i => i.id === c.itemId);
        if (!item) return;
        
        // FILTER: Only keep PRODUCTION items
        const profile = item.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
        if (profile?.type !== 'PRODUCTION') return;

        const level = stockLevels.find(l => l.itemId === c.itemId && l.storageId === c.storageId);
        const currentQty = level?.currentQuantity || 0;
        
        if (currentQty < c.minQuantity) {
            const gap = c.minQuantity - currentQty;
            const storage = storages.find(s => s.id === c.storageId);
            const priority = priorities.find(p => p.itemId === item.id && p.storageId === c.storageId)?.priority || 0;

            if (storage) {
                if (!map.has(item.id)) {
                    map.set(item.id, { item, totalGap: 0, details: [] });
                }
                const entry = map.get(item.id)!;
                entry.details.push({ storage, currentQty, minQty: c.minQuantity, gap, priority });
                entry.totalGap += gap;
            }
        }
    });

    const list = Array.from(map.values());
    list.forEach(agg => agg.details.sort((a,b) => b.priority - a.priority));
    return list.sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [consignes, items, stockLevels, storages, priorities, dlcProfiles]);

  const handleProduce = () => {
      if (selectedDetail) {
          // Action standard : on ajoute au stock (Production faite)
          onAction(selectedDetail.item.id, selectedDetail.detail.storage.id, selectedDetail.detail.gap);
          setSelectedDetail(null);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 relative">
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
                      <p className="text-4xl font-black text-purple-600">{selectedDetail.detail.gap.toFixed(2)}</p>
                  </div>

                  <button onClick={handleProduce} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">
                      Confirmer Production (+{selectedDetail.detail.gap})
                  </button>
                  <button onClick={() => setSelectedDetail(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2">✕</button>
              </div>
          </div>
      )}

      <header className="bg-purple-900 rounded-[2rem] p-8 text-white shadow-2xl flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">Préparation Bar</h1>
            <p className="text-purple-200 text-xs font-bold mt-1">Production Produits Frais (Jus, Sirops, Prémix)</p>
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-xl text-center">
            <span className="block text-2xl font-black">{aggregatedNeeds.length}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-200">À Produire</span>
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {aggregatedNeeds.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic">Aucune production nécessaire.</div>
          ) : (
              <div className="divide-y divide-slate-100">
                  {aggregatedNeeds.map(agg => (
                      <div key={agg.item.id} className="p-5 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-center mb-2">
                              <h3 className="font-black text-slate-900 text-base">{agg.item.name}</h3>
                              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Total: +{agg.totalGap}</span>
                          </div>
                          <div className="space-y-2">
                              {agg.details.map((d, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-purple-50/50 p-2 rounded-xl border border-purple-100">
                                      <span className="text-xs font-bold text-purple-900 uppercase ml-2">{d.storage.name}</span>
                                      <div className="flex items-center gap-3">
                                          <span className="text-[10px] text-slate-500 font-bold">Stock: {d.currentQty} / {d.minQty}</span>
                                          <button onClick={() => setSelectedDetail({ item: agg.item, detail: d })} className="bg-white text-purple-600 border border-purple-200 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-purple-600 hover:text-white transition-colors">Produire (+{d.gap})</button>
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
