
import React, { useState, useMemo, useEffect } from 'react';
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

const EditableNumberCell = ({ 
    value, 
    onSave, 
    className 
}: { 
    value: number, 
    onSave: (val: number) => void, 
    className?: string 
}) => {
    const [localValue, setLocalValue] = useState<string>(value.toString());

    // Update local state when prop changes, but ONLY if not currently focused (simplified approach: sync on render)
    // Actually, to avoid overwriting while typing, we typically sync only when prop differs significantly or on blur/focus management.
    // Here we will sync on prop change to ensure external updates are reflected, 
    // BUT we must trust that onSave updates the parent which updates the prop back.
    // To fix the "1." issue, we need to allow the local state to diverge from the prop while typing.
    
    useEffect(() => {
        // Only update from prop if it's a new "committed" value that differs from what we think it is,
        // or if we aren't editing. Since we don't track focus easily here without refs, 
        // we'll rely on the parent sending back the parsed number.
        // If the prop value matches the parsed local value, don't overwrite to keep "1." vs "1".
        const parsedLocal = parseFloat(localValue.replace(',', '.'));
        if (value !== parsedLocal) {
             setLocalValue(value.toString());
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow digits, one dot or comma.
        if (/^[0-9]*([.,][0-9]*)?$/.test(val)) {
            setLocalValue(val);
        }
    };

    const handleBlur = () => {
        let normalized = localValue.replace(',', '.');
        if (normalized === '' || normalized === '.') normalized = '0';
        const num = parseFloat(normalized);
        onSave(isNaN(num) ? 0 : num);
    };

    return (
        <input 
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={className}
        />
    );
};

const StockTable: React.FC<StockTableProps> = ({ items, storages, stockLevels, priorities, onUpdateStock, onAdjustTransaction, consignes = [] }) => {
  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'PRODUCT' | 'STORAGE'>('GLOBAL');
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<string[]>(['all', 'none', 'none']);
  
  // States pour les vues spécifiques
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedStorageId, setSelectedStorageId] = useState<string>(storages.find(s => s.id !== 's_global')?.id || storages[0]?.id || '');

  const getConsigneValue = (itemId: string, storageId: string) => consignes.find(c => c.itemId === itemId && c.storageId === storageId)?.minQuantity || 0;

  const handleManualEdit = (itemId: string, storageId: string, val: number) => {
      // Round to 3 decimals to avoid floating point issues
      onUpdateStock(itemId, storageId, Math.round(val * 1000) / 1000);
  };

  const visibleStorages = useMemo(() => {
      const showAll = columnFilters.includes('all');
      if (showAll) return storages.filter(s => s.id !== 's_global');
      const activeIds = columnFilters.filter(id => id !== 'none' && id !== 'all');
      return storages.filter(s => activeIds.includes(s.id));
  }, [storages, columnFilters]);

  const filteredItemsGlobal = items.filter(i => normalizeText(i.name).includes(normalizeText(searchTerm)));

  // Vue Par Produit : Espaces Autorisés
  const authorizedStorages = useMemo(() => {
      if (!selectedProductId) return [];
      return storages.filter(s => {
          if (s.id === 's_global') return false;
          if (s.id === 's0') return true; // Surstock toujours autorisé
          const prio = priorities.find(p => p.itemId === selectedProductId && p.storageId === s.id)?.priority || 0;
          return prio > 0;
      });
  }, [selectedProductId, storages, priorities]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* NAVIGATION TABS */}
      <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
            {[
                { id: 'GLOBAL', label: 'Vue Globale' },
                { id: 'PRODUCT', label: 'Par Produit' },
                { id: 'STORAGE', label: 'Par Espace' }
            ].map(t => (
                <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id as any)} 
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {t.label}
                </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
                <input 
                    type="text" 
                    placeholder="Recherche rapide..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
      </div>

      {/* VUE GLOBALE */}
      {activeTab === 'GLOBAL' && (
          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="p-4 bg-slate-50 border-b grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[0,1,2].map(i => (
                      <select key={i} value={columnFilters[i]} onChange={e => {const n=[...columnFilters]; n[i]=e.target.value; setColumnFilters(n);}} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20">
                          <option value="none">-- Aucun --</option>
                          <option value="all">Tous les espaces</option>
                          {storages.filter(s=>s.id!=='s_global').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                  ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="p-6 sticky left-0 bg-slate-50 z-10 border-r shadow-[1px_0_0_0_#e2e8f0]">Produit</th>
                            {visibleStorages.map(s => <th key={s.id} className="p-6 text-center border-r font-black text-slate-500">{s.name}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredItemsGlobal.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-6 sticky left-0 bg-white z-10 border-r font-bold text-sm text-slate-900 shadow-[1px_0_0_0_#e2e8f0] group-hover:bg-slate-50 transition-colors">{item.name}</td>
                                {visibleStorages.map(s => {
                                    const qty = stockLevels.find(l => l.itemId === item.id && l.storageId === s.id)?.currentQuantity || 0;
                                    const consigne = getConsigneValue(item.id, s.id);
                                    const isLow = consigne > 0 && qty < consigne;

                                    return (
                                        <td key={s.id} className="p-4 border-r text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={() => onAdjustTransaction?.(item.id, s.id, -1)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white font-black transition-all">-</button>
                                                <EditableNumberCell 
                                                    value={qty}
                                                    onSave={(val) => handleManualEdit(item.id, s.id, val)}
                                                    className={`w-14 text-center p-1 rounded-lg font-black text-sm border-2 transition-all ${isLow ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-700'}`}
                                                />
                                                <button onClick={() => onAdjustTransaction?.(item.id, s.id, 1)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-emerald-500 hover:text-white font-black transition-all">+</button>
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

      {/* VUE PAR PRODUIT */}
      {activeTab === 'PRODUCT' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 max-w-4xl mx-auto">
              <div className="bg-white p-6 rounded-3xl border shadow-sm">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Rechercher un produit</label>
                  <input 
                    list="product-search-list-inv"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    placeholder="Tapez le nom d'un produit..."
                    value={productSearch}
                    onChange={e => {
                        setProductSearch(e.target.value);
                        const found = items.find(i => normalizeText(i.name) === normalizeText(e.target.value));
                        if (found) setSelectedProductId(found.id);
                    }}
                  />
                  <datalist id="product-search-list-inv">
                      {items.map(i => <option key={i.id} value={i.name} />)}
                  </datalist>
              </div>

              {selectedProductId ? (
                  <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden animate-in zoom-in-95 duration-300">
                      <div className="p-6 bg-indigo-600 text-white text-center">
                          <h4 className="font-black uppercase text-sm tracking-widest">{items.find(i => i.id === selectedProductId)?.name}</h4>
                          <p className="text-[10px] opacity-75 font-bold uppercase mt-1">Inventaire par emplacement</p>
                      </div>
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <tr>
                                  <th className="p-6">Espace de Stockage</th>
                                  <th className="p-6 text-center">Quantité (Décimale OK)</th>
                                  <th className="p-6 text-center">Consigne</th>
                                  <th className="p-6 text-center">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {authorizedStorages.map(s => {
                                  const qty = stockLevels.find(l => l.itemId === selectedProductId && l.storageId === s.id)?.currentQuantity || 0;
                                  const consigne = getConsigneValue(selectedProductId, s.id);
                                  return (
                                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-6 font-bold text-slate-700">
                                              {s.name}
                                              {s.id === 's0' && <span className="ml-2 bg-amber-100 text-amber-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">Surstock</span>}
                                          </td>
                                          <td className="p-6 text-center">
                                              <EditableNumberCell 
                                                value={qty}
                                                onSave={(val) => handleManualEdit(selectedProductId, s.id, val)}
                                                className={`w-20 text-center p-3 rounded-xl font-black text-base border-2 transition-all ${consigne > 0 && qty < consigne ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                                              />
                                          </td>
                                          <td className="p-6 text-center text-slate-400 font-bold">{consigne || '-'}</td>
                                          <td className="p-6 text-center">
                                              <div className="flex justify-center gap-2">
                                                  <button onClick={() => onAdjustTransaction?.(selectedProductId, s.id, -1)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-black hover:bg-rose-500 hover:text-white transition-all shadow-sm">-</button>
                                                  <button onClick={() => onAdjustTransaction?.(selectedProductId, s.id, 1)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-black hover:bg-emerald-500 hover:text-white transition-all shadow-sm">+</button>
                                              </div>
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              ) : (
                  <div className="p-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-300 text-slate-400 flex flex-col items-center gap-4">
                      <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <p className="font-bold text-sm">Sélectionnez un produit pour gérer son inventaire détaillé.</p>
                  </div>
              )}
          </div>
      )}

      {/* VUE PAR ESPACE */}
      {activeTab === 'STORAGE' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-white p-6 rounded-3xl border shadow-sm">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Sélectionner un espace</label>
                  <select 
                    value={selectedStorageId} 
                    onChange={e => setSelectedStorageId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                  >
                      {storages.filter(s => s.id !== 's_global').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
              </div>

              <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                          <tr>
                              <th className="p-6">Produit</th>
                              <th className="p-6 text-center">Quantité (Décimale OK)</th>
                              <th className="p-6 text-center">Consigne</th>
                              <th className="p-6 text-center">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {items.filter(i => normalizeText(i.name).includes(normalizeText(searchTerm))).map(item => {
                              const qty = stockLevels.find(l => l.itemId === item.id && l.storageId === selectedStorageId)?.currentQuantity || 0;
                              const consigne = getConsigneValue(item.id, selectedStorageId);
                              if (qty === 0 && consigne === 0 && !searchTerm) return null;

                              return (
                                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-6 font-bold text-slate-700">{item.name}</td>
                                      <td className="p-6 text-center">
                                          <EditableNumberCell 
                                            value={qty}
                                            onSave={(val) => handleManualEdit(item.id, selectedStorageId, val)}
                                            className={`w-20 text-center p-2 rounded-xl font-black text-sm border-2 ${consigne > 0 && qty < consigne ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                                          />
                                      </td>
                                      <td className="p-6 text-center text-slate-400 font-bold">{consigne || '-'}</td>
                                      <td className="p-6 text-center">
                                          <div className="flex justify-center gap-2">
                                              <button onClick={() => onAdjustTransaction?.(item.id, selectedStorageId, -1)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-black hover:bg-rose-500 hover:text-white transition-all shadow-sm">-</button>
                                              <button onClick={() => onAdjustTransaction?.(item.id, selectedStorageId, 1)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-black hover:bg-emerald-500 hover:text-white transition-all shadow-sm">+</button>
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};
export default StockTable;
