
import React, { useState, useMemo } from 'react';
import { StockItem, StorageSpace, StockPriority, Category } from '../types';

interface PriorityConfigProps {
  items: StockItem[];
  storages: StorageSpace[];
  priorities: StockPriority[];
  setPriorities: React.Dispatch<React.SetStateAction<StockPriority[]>>;
  categories: Category[];
  onSync?: (action: string, payload: any) => void;
}

const PriorityConfig: React.FC<PriorityConfigProps> = ({ items, storages, priorities, setPriorities, categories, onSync }) => {
  const [bulkCategory, setBulkCategory] = useState<Category | 'ALL' | 'SELECTED'>('ALL');
  const [bulkStorage, setBulkStorage] = useState<string>(storages.find(s => s.id !== 's0')?.id || storages[0]?.id || '');
  const [bulkValue, setBulkValue] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
      return items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [items, searchTerm]);

  const toggleSelection = (itemId: string) => {
      const newSet = new Set(selectedItems);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      setSelectedItems(newSet);
      // Si on sélectionne manuellement, on bascule le mode bulk sur SELECTED pour que ce soit intuitif
      if (bulkCategory !== 'SELECTED') setBulkCategory('SELECTED');
  };

  const toggleAll = () => {
      if (selectedItems.size === filteredItems.length) {
          setSelectedItems(new Set());
      } else {
          setSelectedItems(new Set(filteredItems.map(i => i.id)));
          setBulkCategory('SELECTED');
      }
  };

  const updatePriority = (itemId: string, storageId: string, priority: number) => {
    if (storageId === 's0') return;

    setPriorities(prev => {
      const filtered = prev.filter(p => !(p.itemId === itemId && p.storageId === storageId));
      return [...filtered, { itemId, storageId, priority }];
    });
    
    if (onSync) onSync('SAVE_PRIORITY', { itemId, storageId, priority });
  };

  const handleBulkApply = () => {
    if (bulkStorage === 's0') {
        alert("La priorité du Surstock est gérée par le système et ne peut pas être modifiée en masse.");
        return;
    }

    let itemsToUpdate: StockItem[] = [];

    if (bulkCategory === 'SELECTED') {
        if (selectedItems.size === 0) {
            alert("Aucun produit sélectionné.");
            return;
        }
        itemsToUpdate = items.filter(i => selectedItems.has(i.id));
    } else {
        itemsToUpdate = items.filter(item => bulkCategory === 'ALL' || item.category === bulkCategory);
    }

    if (itemsToUpdate.length === 0) return;
    
    const label = bulkCategory === 'SELECTED' ? `${itemsToUpdate.length} articles sélectionnés` : `${itemsToUpdate.length} articles (${bulkCategory})`;

    if (window.confirm(`Appliquer la priorité ${bulkValue} à ${label} dans "${storages.find(s => s.id === bulkStorage)?.name}" ?`)) {
      setPriorities(prev => {
        const updatedItemIds = new Set(itemsToUpdate.map(i => i.id));
        const filtered = prev.filter(p => !(p.storageId === bulkStorage && updatedItemIds.has(p.itemId)));
        const newRules: StockPriority[] = itemsToUpdate.map(item => ({ itemId: item.id, storageId: bulkStorage, priority: bulkValue }));
        return [...filtered, ...newRules];
      });
      
      // Sync loop
      itemsToUpdate.forEach(item => {
          if (onSync) onSync('SAVE_PRIORITY', { itemId: item.id, storageId: bulkStorage, priority: bulkValue });
      });
      
      // Reset selection if used
      if (bulkCategory === 'SELECTED') {
          setSelectedItems(new Set());
      }
    }
  };

  const getPriority = (itemId: string, storageId: string) => {
    if (storageId === 's0') return 11;
    return priorities.find(p => p.itemId === itemId && p.storageId === storageId)?.priority || 0;
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50/50 border-2 border-indigo-100 p-6 rounded-[2rem] shadow-sm">
        <h3 className="font-black text-xs uppercase tracking-widest text-indigo-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Modification de Masse
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cible</label>
              <select className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value as any)}>
                  <option value="SELECTED">-- Éléments Cochés ({selectedItems.size}) --</option>
                  <option value="ALL">Toutes les catégories</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
          </div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Espace de Stockage</label><select className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none" value={bulkStorage} onChange={(e) => setBulkStorage(e.target.value)}>{storages.map(s => <option key={s.id} value={s.id} disabled={s.id === 's0'}>{s.name} {s.id === 's0' ? '(Verrouillé)' : ''}</option>)}</select></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Niveau de Priorité (0-10)</label><div className="flex bg-white border border-indigo-200 rounded-xl p-1 gap-1"><input type="range" min="0" max="10" className="flex-1 accent-indigo-600" value={bulkValue} onChange={(e) => setBulkValue(parseInt(e.target.value))} /><span className="w-10 text-center font-black text-indigo-600">{bulkValue}</span></div></div>
          <button onClick={handleBulkApply} disabled={bulkStorage === 's0'} className="bg-indigo-600 text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 disabled:bg-slate-300 transition-all active:scale-95">Appliquer</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
                <input 
                    type="text" 
                    placeholder="Rechercher produit..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredItems.length} produits</span>
        </div>

        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-20 shadow-sm">
              <tr>
                  <th className="p-4 bg-slate-100 border-r w-12 text-center">
                      <input type="checkbox" className="w-4 h-4 rounded text-indigo-600" onChange={toggleAll} checked={selectedItems.size === filteredItems.length && filteredItems.length > 0} />
                  </th>
                  <th className="p-4 border-r sticky left-0 bg-slate-100 z-30 w-64 shadow-[1px_0_0_0_#e2e8f0]">Produit</th>
                  {storages.map(s => <th key={s.id} className="p-4 text-center border-r min-w-[320px] bg-slate-100">{s.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${selectedItems.has(item.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="p-4 border-r text-center">
                      <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 cursor-pointer" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} />
                  </td>
                  <td className="p-4 sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-900">{item.name}</span>
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.category}</span>
                      </div>
                  </td>
                  {storages.map(s => {
                    const currentP = getPriority(item.id, s.id);
                    return (
                      <td key={s.id} className="p-4 border-r text-center">
                        {s.id === 's0' ? <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black">SURSTOCK</span> : <div className="inline-flex bg-slate-100 p-1 rounded-lg gap-0.5">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => <button key={v} onClick={() => updatePriority(item.id, s.id, v)} className={`w-7 h-8 rounded font-bold text-[11px] ${currentP === v ? (v === 0 ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white') : 'text-slate-400 hover:bg-white'}`}>{v}</button>)}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PriorityConfig;
