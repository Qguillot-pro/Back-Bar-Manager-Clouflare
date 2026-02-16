
import React, { useState, useMemo } from 'react';
import { StockItem, StorageSpace, StockLevel, StockConsigne, StockPriority } from '../types';

interface StockTableProps {
  items: StockItem[];
  storages: StorageSpace[];
  stockLevels: StockLevel[];
  consignes?: StockConsigne[]; 
  priorities: StockPriority[];
  onUpdateStock: (itemId: string, storageId: string, qty: number) => void;
  onAdjustTransaction?: (itemId: string, storageId: string, delta: number) => void;
}

const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const StockTable: React.FC<StockTableProps> = ({ items, storages, stockLevels, priorities, onUpdateStock, onAdjustTransaction, consignes = [] }) => {
  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'PRODUCT' | 'STORAGE'>('GLOBAL');
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<string[]>(['all', 'none', 'none']);

  const getConsigneValue = (itemId: string, storageId: string) => consignes.find(c => c.itemId === itemId && c.storageId === storageId)?.minQuantity || 0;
  const getConsigneMax = (itemId: string, storageId: string) => consignes.find(c => c.itemId === itemId && c.storageId === storageId)?.maxCapacity || 0;

  const visibleStorages = useMemo(() => {
      const showAll = columnFilters.includes('all');
      if (showAll) return storages.filter(s => s.id !== 's_global');
      const activeIds = columnFilters.filter(id => id !== 'none' && id !== 'all');
      return storages.filter(s => activeIds.includes(s.id));
  }, [storages, columnFilters]);

  const filteredItems = items.filter(i => normalizeText(i.name).includes(normalizeText(searchTerm)));

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex gap-2">
            {['GLOBAL', 'PRODUCT', 'STORAGE'].map(t => (
                <button key={t} onClick={()=>setActiveTab(t as any)} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{t}</button>
            ))}
          </div>
          <input type="text" placeholder="Recherche rapide..." className="bg-slate-50 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
      </div>

      {activeTab === 'GLOBAL' && (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[0,1,2].map(i => (
                      <select key={i} value={columnFilters[i]} onChange={e => {const n=[...columnFilters]; n[i]=e.target.value; setColumnFilters(n);}} className="bg-white border rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-600">
                          <option value="none">-- Aucun --</option><option value="all">Tous les espaces</option>
                          {storages.filter(s=>s.id!=='s_global').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                  ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <tr>
                            <th className="p-4 sticky left-0 bg-slate-100 z-10 border-r">Produit</th>
                            {visibleStorages.map(s => <th key={s.id} className="p-4 text-center border-r">{s.name}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="p-4 sticky left-0 bg-white z-10 border-r font-bold text-sm">{item.name}</td>
                                {visibleStorages.map(s => {
                                    const qty = stockLevels.find(l => l.itemId === item.id && l.storageId === s.id)?.currentQuantity || 0;
                                    const consigne = getConsigneValue(item.id, s.id);
                                    const maxCap = getConsigneMax(item.id, s.id);
                                    const isCritical = consigne > 0 && qty <= 0;
                                    const isLow = consigne > 0 && qty < consigne;

                                    return (
                                        <td key={s.id} className="p-2 border-r text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={() => onAdjustTransaction?.(item.id, s.id, -1)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 font-black">-</button>
                                                <div className={`w-16 p-2 rounded-lg font-black border-2 ${isCritical ? 'bg-rose-100 border-rose-200 text-rose-700' : isLow ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100'}`}>
                                                    {qty}
                                                </div>
                                                <button onClick={() => onAdjustTransaction?.(item.id, s.id, 1)} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 font-black">+</button>
                                                {consigne > 0 && <span className="text-[10px] text-slate-300">/ {consigne}</span>}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
      )}
    </div>
  );
};
export default StockTable;
