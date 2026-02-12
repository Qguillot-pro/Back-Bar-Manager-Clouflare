
import React, { useState, useMemo } from 'react';
import { StockItem, StorageSpace, StockLevel, Category, StockConsigne, Format } from '../types';

interface GlobalInventoryProps {
  items: StockItem[];
  storages: StorageSpace[];
  stockLevels: StockLevel[];
  categories: Category[];
  consignes: StockConsigne[];
  onSync: (action: string, payload: any) => void;
  onUpdateStock: (itemId: string, storageId: string, qty: number) => void;
  formats: Format[];
}

const GlobalInventory: React.FC<GlobalInventoryProps> = ({ items, storages, stockLevels, categories, consignes, onSync, onUpdateStock, formats = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'ALL'>('ALL');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<Category | ''>('');
  
  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportCategories, setExportCategories] = useState<Set<string>>(new Set(categories));

  // ID technique du stockage "Global/Autre" défini dans le schéma
  const GLOBAL_STORAGE_ID = 's_global';

  // Articles à afficher : Tous les items (Bar + InventoryOnly)
  const displayedItems = useMemo(() => {
      let filtered = items.filter(i => 
          (filterCategory === 'ALL' || i.category === filterCategory) &&
          i.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      );
      
      // Tri par ordre personnalisé
      return filtered.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
  }, [items, filterCategory, searchTerm]);

  // Calcul du stock total BAR (somme de tous les stockages SAUF s_global)
  const getBarStock = (itemId: string) => {
      return stockLevels
        .filter(l => l.itemId === itemId && l.storageId !== GLOBAL_STORAGE_ID)
        .reduce((acc, curr) => acc + curr.currentQuantity, 0);
  };

  const getGlobalStock = (itemId: string) => {
      return stockLevels.find(l => l.itemId === itemId && l.storageId === GLOBAL_STORAGE_ID)?.currentQuantity || 0;
  };

  const handleGlobalStockChange = (itemId: string, val: string) => {
      if (!/^\d*([.,]\d*)?$/.test(val)) return;
      let normalized = val.replace(',', '.');
      if (normalized === '.') normalized = '0';
      const num = parseFloat(normalized) || 0;
      onUpdateStock(itemId, GLOBAL_STORAGE_ID, num);
  };

  const handleAdjustStock = (itemId: string, adjustment: number) => {
      const current = getGlobalStock(itemId);
      const newQty = Math.max(0, parseFloat((current + adjustment).toFixed(2))); // Evite flottants bizarres
      onUpdateStock(itemId, GLOBAL_STORAGE_ID, newQty);
  };

  const handleResetColumn = () => {
      if (window.confirm("ATTENTION : Vous êtes sur le point de remettre à ZÉRO toute la colonne 'Stock Autre' (Restaurant/Autre). Confirmer ?")) {
          // On ne reset que ceux qui ont une valeur > 0 pour éviter des appels inutiles
          const itemsToReset = stockLevels.filter(l => l.storageId === GLOBAL_STORAGE_ID && l.currentQuantity > 0);
          itemsToReset.forEach(l => {
              onUpdateStock(l.itemId, GLOBAL_STORAGE_ID, 0);
          });
      }
  };

  const handleCreateInventoryItem = () => {
      if (!newItemName || !newItemCategory) return;
      const newItem: StockItem = {
          id: 'inv_' + Date.now(),
          name: newItemName,
          category: newItemCategory,
          formatId: 'f1', // Défaut
          pricePerUnit: 0,
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isInventoryOnly: true,
          order: items.length,
          isDraft: false
      };
      // On utilise l'action générique SAVE_ITEM (App.tsx gère l'ajout)
      onSync('SAVE_ITEM', newItem);
      setNewItemName('');
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === displayedItems.length - 1) return;

      const newItems = [...displayedItems];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const currentItem = newItems[index];
      const targetItem = newItems[targetIndex];

      let order1 = currentItem.order ?? index;
      let order2 = targetItem.order ?? targetIndex;
      
      if (order1 === order2) { order1 = index; order2 = targetIndex; }

      onSync('SAVE_ITEM', { ...currentItem, order: order2 });
      onSync('SAVE_ITEM', { ...targetItem, order: order1 });
  };

  const openExportModal = () => {
      setExportCategories(new Set(categories));
      setIsExportModalOpen(true);
  };

  const toggleExportCategory = (cat: string) => {
      const newSet = new Set(exportCategories);
      if (newSet.has(cat)) newSet.delete(cat);
      else newSet.add(cat);
      setExportCategories(newSet);
  };

  const handleConfirmExport = () => {
      let csv = "\uFEFFCatégorie,Produit,Format,Stock Bar,Stock Autre/Resto,Total\n";
      
      // Items sorted by global order, filtered by selected categories
      const itemsToExport = items
          .filter(i => exportCategories.has(i.category))
          .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

      itemsToExport.forEach(i => {
          const bar = getBarStock(i.id);
          const other = getGlobalStock(i.id);
          const total = bar + other;
          const fmt = formats.find(f => f.id === i.formatId)?.name || '';
          csv += `"${i.category}","${i.name}","${fmt}","${bar}","${other}","${total}"\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inventaire_global_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      
      setIsExportModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 relative">
        
        {/* EXPORT MODAL */}
        {isExportModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-200 flex flex-col space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Exporter l'Inventaire</h3>
                        <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pr-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sélectionner les catégories</p>
                        {categories.map(cat => (
                            <label key={cat} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    checked={exportCategories.has(cat)}
                                    onChange={() => toggleExportCategory(cat)}
                                />
                                <span className="font-bold text-sm text-slate-700">{cat}</span>
                            </label>
                        ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => setExportCategories(new Set(categories))} className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Tout</button>
                        <button onClick={() => setExportCategories(new Set())} className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Rien</button>
                        <button onClick={handleConfirmExport} disabled={exportCategories.size === 0} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 shadow-lg active:scale-95 transition-all disabled:opacity-50">Exporter CSV</button>
                    </div>
                </div>
            </div>
        )}

        {/* HEADER */}
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
                <h1 className="text-2xl font-black uppercase tracking-widest flex items-center gap-3">
                    <span className="bg-white text-slate-900 p-2 rounded-lg"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></span>
                    Inventaire Global
                </h1>
                <p className="text-slate-400 text-sm font-bold mt-2 ml-1">Consolidation Bar + Restaurant + Autres Lieux</p>
            </div>
            <div className="flex gap-4">
                <button onClick={openExportModal} className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg active:scale-95">
                    Exporter CSV
                </button>
            </div>
        </div>

        {/* CONTROLS & ADD */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex gap-2">
                    <input 
                        type="text" 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <select 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none cursor-pointer"
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value as any)}
                    >
                        <option value="ALL">Toutes Catégories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* ADD INVENTORY ONLY ITEM */}
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full space-y-1">
                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Ajout Produit Hors Bar</label>
                    <input 
                        type="text" 
                        className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                        placeholder="Nom (ex: Champagne Ruinart Restaurant)"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-48 space-y-1">
                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Catégorie</label>
                    <select 
                        className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                        value={newItemCategory}
                        onChange={e => setNewItemCategory(e.target.value)}
                    >
                        <option value="">Choisir...</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <button onClick={handleCreateInventoryItem} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-md">Ajouter</button>
            </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b">
                    <tr>
                        <th className="p-4 w-16 text-center">Ordre</th>
                        <th className="p-4">Produit</th>
                        <th className="p-4">Catégorie</th>
                        <th className="p-4 text-center bg-slate-100/50">Stock Bar</th>
                        <th className="p-4 text-center bg-amber-50">
                            Stock Autre
                            <button 
                                onClick={handleResetColumn} 
                                className="block mx-auto mt-1 text-[8px] text-rose-400 hover:text-rose-600 hover:underline uppercase tracking-wide"
                                title="Remettre toute la colonne à zéro"
                            >
                                Reset 0
                            </button>
                        </th>
                        <th className="p-4 text-center font-bold text-slate-800">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {displayedItems.map((item, idx) => {
                        const barStock = getBarStock(item.id);
                        const otherStock = getGlobalStock(item.id);
                        const formatName = formats.find(f => f.id === item.formatId)?.name;

                        return (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-4 text-center">
                                    <div className="flex flex-col items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveItem(idx, 'up')} className="hover:text-indigo-600"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                                        <button onClick={() => moveItem(idx, 'down')} className="hover:text-indigo-600"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                                    </div>
                                </td>
                                <td className="p-4 font-bold text-sm text-slate-800">
                                    {item.name}
                                    {formatName && <span className="ml-2 text-slate-400 text-xs font-normal">({formatName})</span>}
                                    {item.isInventoryOnly && <span className="ml-2 bg-indigo-100 text-indigo-600 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-black">Hors Bar</span>}
                                </td>
                                <td className="p-4 text-xs font-bold text-slate-400 uppercase">{item.category}</td>
                                <td className="p-4 text-center font-black text-slate-500 bg-slate-50/50">{parseFloat(barStock.toFixed(2))}</td>
                                <td className="p-4 text-center bg-amber-50/30">
                                    <div className="flex justify-center items-center gap-1">
                                        <button 
                                            onClick={() => handleAdjustStock(item.id, -1)}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 font-black text-sm transition-colors active:scale-95"
                                        >
                                            -
                                        </button>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                inputMode="decimal"
                                                className={`w-16 border rounded-lg p-2 text-center font-black outline-none focus:ring-2 transition-all text-sm bg-white border-amber-200 text-amber-800 focus:ring-amber-200`}
                                                placeholder="0"
                                                value={otherStock || ''}
                                                onChange={(e) => handleGlobalStockChange(item.id, e.target.value)}
                                            />
                                        </div>
                                        <button 
                                            onClick={() => handleAdjustStock(item.id, 1)}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 font-black text-sm transition-colors active:scale-95"
                                        >
                                            +
                                        </button>
                                    </div>
                                </td>
                                <td className="p-4 text-center font-black text-lg text-slate-900">{parseFloat((barStock + otherStock).toFixed(2))}</td>
                            </tr>
                        );
                    })}
                    {displayedItems.length === 0 && (
                        <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">Aucun article trouvé.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default GlobalInventory;
