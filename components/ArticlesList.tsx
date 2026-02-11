
import React, { useState } from 'react';
import { StockItem, Format, Category, UserRole, DLCProfile, Event, Recipe, EventProduct } from '../types';

interface ArticlesListProps {
  items: StockItem[];
  setItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  formats: Format[];
  categories: Category[];
  onDelete: (id: string) => void;
  userRole: UserRole;
  dlcProfiles?: DLCProfile[];
  onSync: (action: string, payload: any) => void;
  filter?: 'ALL' | 'TEMPORARY';
  events?: Event[]; // Ajout pour vérification dépendance
  recipes?: Recipe[]; // Ajout pour vérification dépendance
}

const ArticlesList: React.FC<ArticlesListProps> = ({ items, setItems, formats, categories, onDelete, userRole, dlcProfiles = [], onSync, filter = 'ALL', events = [], recipes = [] }) => {
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{ id: string, value: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const displayedItems = (filter === 'TEMPORARY' 
      ? items.filter(i => i.isTemporary) 
      : items).filter(i => 
          i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (i.articleCode && i.articleCode.toLowerCase().includes(searchTerm.toLowerCase()))
      );

  const updateItem = (id: string, field: keyof StockItem, value: any) => {
    setItems(prev => prev.map(i => {
        if (i.id === id) {
            const updated = { ...i, [field]: value };
            onSync('SAVE_ITEM', updated);
            return updated;
        }
        return i;
    }));
  };

  const integrateItem = (item: StockItem) => {
      const updated = { ...item, isTemporary: false };
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      onSync('SAVE_ITEM', updated);
  };

  // --- LOGIQUE PRIX ---
  const handlePriceFocus = (item: StockItem) => {
    setEditingPrice({ id: item.id, value: item.pricePerUnit.toString() });
  };

  const handlePriceChange = (val: string) => {
    // Autoriser vide, chiffres, point ou virgule
    if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
        setEditingPrice(prev => prev ? { ...prev, value: val } : null);
    }
  };

  const handlePriceBlur = (id: string) => {
    if (!editingPrice) return;
    let normalized = editingPrice.value.replace(',', '.');
    if (normalized === '.') normalized = '0';
    
    const num = parseFloat(normalized) || 0;
    updateItem(id, 'pricePerUnit', num);
    setEditingPrice(null);
  };

  // --- LOGIQUE REORDER ---
  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === displayedItems.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentItem = displayedItems[index];
    const targetItem = displayedItems[targetIndex];

    // On échange les valeurs de 'order'. 
    // Si les valeurs sont identiques (ex: 0 pour les deux), on force une divergence basée sur l'index visuel.
    let newOrderCurrent = targetItem.order ?? targetIndex;
    let newOrderTarget = currentItem.order ?? index;

    if (newOrderCurrent === newOrderTarget) {
        newOrderCurrent = targetIndex;
        newOrderTarget = index;
    }

    // Mise à jour locale et DB
    updateItem(currentItem.id, 'order', newOrderCurrent);
    updateItem(targetItem.id, 'order', newOrderTarget);
  };

  const handleSafeDelete = (item: StockItem) => {
      // 1. Check Events
      const linkedEvents = events.filter(e => {
          try {
              const products: EventProduct[] = JSON.parse(e.productsJson || '[]');
              return products.some(p => p.itemId === item.id);
          } catch(err) { return false; }
      });

      // 2. Check Recipes
      const linkedRecipes = recipes.filter(r => 
          r.ingredients.some(ing => ing.itemId === item.id)
      );

      if (linkedEvents.length > 0 || linkedRecipes.length > 0) {
          let message = `Impossible de supprimer "${item.name}" car il est utilisé dans :\n`;
          if (linkedEvents.length > 0) {
              message += `- Événements : ${linkedEvents.map(e => e.title).join(', ')}\n`;
          }
          if (linkedRecipes.length > 0) {
              message += `- Recettes : ${linkedRecipes.map(r => r.name).join(', ')}\n`;
          }
          message += "\nVeuillez retirer cet article de ces éléments avant de le supprimer.";
          alert(message);
          return;
      }

      onDelete(item.id);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4 ${filter === 'TEMPORARY' ? 'bg-amber-50' : 'bg-slate-50'}`}>
        <div className="flex flex-col gap-1">
            <h2 className={`font-black uppercase tracking-tight flex items-center gap-2 ${filter === 'TEMPORARY' ? 'text-amber-800' : 'text-slate-800'}`}>
                <span className={`w-1.5 h-6 rounded-full ${filter === 'TEMPORARY' ? 'bg-amber-500' : 'bg-indigo-600'}`}></span>
                {filter === 'TEMPORARY' ? 'Intégration Articles Temporaires' : 'Base de Données Articles'}
            </h2>
            <span className={`text-[10px] font-black uppercase tracking-widest ${filter === 'TEMPORARY' ? 'text-amber-400' : 'text-slate-400'}`}>{displayedItems.length} réf. affichées</span>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Barre de recherche */}
            <div className="relative flex-1 md:w-64">
                <input 
                    type="text" 
                    placeholder="Rechercher nom ou code..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            {userRole === 'ADMIN' && filter === 'ALL' && (
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${!isReorderMode ? 'text-slate-400' : 'text-slate-300'}`}>Lecture</span>
                    <button 
                        onClick={() => { setIsReorderMode(!isReorderMode); setSearchTerm(''); }} 
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isReorderMode ? 'bg-indigo-600' : 'bg-slate-200'}`} 
                        aria-label="Activer le mode réorganisation"
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${isReorderMode ? 'left-7' : 'left-1'}`}></div>
                    </button>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isReorderMode ? 'text-indigo-600' : 'text-slate-400'}`}>Réorganiser</span>
                </div>
            )}
        </div>
      </div>
      
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-20 shadow-sm">
            <tr>
              {isReorderMode && <th className="p-6 w-16 text-center bg-slate-100">Ordre</th>}
              <th className="p-6 bg-slate-100">Produit</th>
              <th className="p-6 w-32 bg-slate-100">Code Article</th>
              <th className="p-6 bg-slate-100">Format</th>
              <th className="p-6 bg-slate-100">Catégorie</th>
              <th className="p-6 bg-slate-100">Configuration</th>
              <th className="p-6 text-right bg-slate-100">Prix Unit (€HT)</th>
              <th className="p-6 text-center bg-slate-100">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedItems.map((item, index) => (
              <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group relative ${item.isTemporary ? 'bg-amber-50/30' : ''}`}>
                
                {isReorderMode && (
                    <td className="p-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                            <button 
                                onClick={() => moveItem(index, 'up')} 
                                disabled={index === 0}
                                className={`p-1 rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors ${index === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <span className="text-[9px] font-black text-slate-300">{index + 1}</span>
                            <button 
                                onClick={() => moveItem(index, 'down')}
                                disabled={index === displayedItems.length - 1}
                                className={`p-1 rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors ${index === displayedItems.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                        </div>
                    </td>
                )}

                <td className="p-6">
                  <input 
                    className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-bold text-slate-900"
                    value={item.name}
                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                    disabled={isReorderMode}
                  />
                  {item.isTemporary && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 block">Temporaire</span>}
                </td>
                <td className="p-6">
                  <input 
                    className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-bold text-xs text-slate-500 placeholder-slate-300"
                    value={item.articleCode || ''}
                    placeholder="-"
                    onChange={e => updateItem(item.id, 'articleCode', e.target.value)}
                    disabled={isReorderMode}
                  />
                </td>
                <td className="p-6">
                  <select 
                    className="bg-transparent outline-none font-bold text-slate-600 text-xs uppercase cursor-pointer"
                    value={item.formatId}
                    onChange={e => updateItem(item.id, 'formatId', e.target.value)}
                    disabled={isReorderMode}
                  >
                    {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </td>
                <td className="p-6">
                  <select 
                    className="bg-transparent outline-none font-black text-indigo-600 text-[10px] uppercase tracking-tighter cursor-pointer"
                    value={item.category}
                    onChange={e => updateItem(item.id, 'category', e.target.value as Category)}
                    disabled={isReorderMode}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="p-6">
                  <div className={`flex flex-col gap-3 ${isReorderMode ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                        checked={item.isConsigne || false}
                        onChange={e => updateItem(item.id, 'isConsigne', e.target.checked)}
                        />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${item.isConsigne ? 'text-blue-500' : 'text-slate-300'}`}>
                            {item.isConsigne ? '♻ Consigne' : 'Consigne'}
                        </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                        type="checkbox"
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        checked={item.isDLC || false}
                        onChange={e => updateItem(item.id, 'isDLC', e.target.checked)}
                        />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${item.isDLC ? 'text-amber-500' : 'text-slate-300'}`}>Tracking DLC</span>
                    </label>
                    {item.isDLC && (
                        <select 
                            className="bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 text-[10px] font-bold text-amber-700 outline-none ml-7"
                            value={item.dlcProfileId || ''}
                            onChange={(e) => updateItem(item.id, 'dlcProfileId', e.target.value)}
                        >
                            <option value="">Sélectionner Durée...</option>
                            {dlcProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                  </div>
                </td>
                <td className="p-6">
                  <input 
                    type="text"
                    inputMode="decimal"
                    className="w-24 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-right font-black text-slate-900"
                    value={editingPrice?.id === item.id ? editingPrice.value : item.pricePerUnit}
                    onFocus={() => handlePriceFocus(item)}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    onBlur={() => handlePriceBlur(item.id)}
                    disabled={isReorderMode}
                    placeholder="0"
                  />
                </td>
                <td className="p-6 text-center relative z-10 flex items-center justify-center gap-2">
                  {userRole === 'ADMIN' && item.isTemporary && !isReorderMode && (
                      <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleSafeDelete(item)}
                            className="bg-rose-500 text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-rose-600 shadow-sm transition-all"
                            title="Refuser et Supprimer"
                          >
                              Refuser
                          </button>
                          <button 
                            type="button"
                            onClick={() => integrateItem(item)}
                            className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase hover:bg-emerald-600 shadow-sm transition-all"
                            title="Valider l'intégration définitive"
                          >
                              Intégrer
                          </button>
                      </div>
                  )}
                  {userRole === 'ADMIN' && !item.isTemporary && !isReorderMode && (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSafeDelete(item);
                      }}
                      className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all active:scale-90 cursor-pointer shadow-sm border border-transparent hover:border-rose-100"
                      title={`Supprimer ${item.name}`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {displayedItems.length === 0 && (
              <tr>
                <td colSpan={isReorderMode ? 8 : 7} className="py-20 text-center italic text-slate-400 text-sm">Aucun produit trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArticlesList;
