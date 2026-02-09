
import React, { useState, useMemo, useEffect } from 'react';
import { StockItem, StorageSpace, StockConsigne, StockPriority } from '../types';

interface ConsignesProps {
  items: StockItem[];
  storages: StorageSpace[];
  consignes: StockConsigne[];
  priorities: StockPriority[];
  setConsignes: React.Dispatch<React.SetStateAction<StockConsigne[]>>;
  onSync?: (action: string, payload: any) => void;
}

const Consignes: React.FC<ConsignesProps> = ({ items, storages, consignes, priorities, setConsignes, onSync }) => {
  const [isEditOrderMode, setIsEditOrderMode] = useState(false);
  const [editingValue, setEditingValue] = useState<{key: string, val: string} | null>(null);
  
  // États pour les filtres de colonnes (similaire à StockTable)
  const [columnFilters, setColumnFilters] = useState<string[]>(['all', 'none', 'none']);
  
  // Barre de recherche
  const [searchTerm, setSearchTerm] = useState('');

  // Utilisation de l'état local pour gérer les positions en cours d'édition
  const [storagePositions, setStoragePositions] = useState<Record<string, number>>({});

  useEffect(() => {
    const initial: Record<string, number> = {};
    storages.forEach(s => {
      initial[s.id] = s.order ?? 0;
    });
    setStoragePositions(initial);
  }, [storages]);


  // Gestion du blur pour sauvegarder et formater
  const handleInputBlur = (itemId: string, storageId: string, val: string, field: 'min' | 'max') => {
    setEditingValue(null);
    let normalized = val.replace(',', '.');
    if (normalized === '.') normalized = '0';

    let num = parseFloat(normalized);

    if (isNaN(num) || num < 0) num = 0; // Prevent negative
    
    // Si c'est Max, entier uniquement
    if (field === 'max') {
        num = Math.floor(num);
    } else {
        // Min: Limite à 2 décimales
        num = Math.round(num * 100) / 100;
    }

    setConsignes(prev => {
        const exists = prev.find(c => c.itemId === itemId && c.storageId === storageId);
        if (exists) {
            const updated = field === 'min' ? { ...exists, minQuantity: num } : { ...exists, maxCapacity: num > 0 ? num : undefined };
            if (onSync) onSync('SAVE_CONSIGNE', updated);
            return prev.map(c => (c.itemId === itemId && c.storageId === storageId) ? updated : c);
        }
        
        const newConsigne: StockConsigne = { 
            itemId, 
            storageId, 
            minQuantity: field === 'min' ? num : 0,
            maxCapacity: field === 'max' && num > 0 ? num : undefined
        };
        if (onSync) onSync('SAVE_CONSIGNE', newConsigne);
        return [...prev, newConsigne];
    });
  };

  const handleInputChange = (itemId: string, storageId: string, val: string, field: 'min' | 'max') => {
    // Autoriser uniquement chiffres, point, virgule
    if (!/^[0-9]*[.,]?[0-9]*$/.test(val)) return;
    
    const key = `${itemId}-${storageId}-${field}`;
    setEditingValue({ key, val: val });
  };

  const handlePositionChange = (storageId: string, newPos: number) => {
    setStoragePositions(prev => ({ ...prev, [storageId]: newPos }));
  };

  const handlePositionBlur = (storageId: string, newPos: number) => {
      if (onSync) {
          onSync('SAVE_STORAGE_ORDER', { id: storageId, order: newPos });
      }
  };

  const handleColumnFilterChange = (index: number, value: string) => {
    const newFilters = [...columnFilters];
    newFilters[index] = value;
    setColumnFilters(newFilters);
  };

  const visibleStorages = useMemo(() => {
    const showAll = columnFilters.includes('all');
    // Si 'all' est sélectionné dans un des filtres, on montre tout, trié par position
    if (showAll) {
        return [...storages].sort((a, b) => {
            const posA = storagePositions[a.id] ?? (a.order ?? 999);
            const posB = storagePositions[b.id] ?? (b.order ?? 999);
            return posA - posB;
        });
    }

    const activeStorageIds = Array.from(new Set(columnFilters.filter(f => f !== 'none')));
    
    // On retourne les stockages sélectionnés
    const selected = storages.filter(s => activeStorageIds.includes(s.id));
    
    // On trie quand même par position pour garder la cohérence visuelle
    return selected.sort((a, b) => {
        const posA = storagePositions[a.id] ?? (a.order ?? 999);
        const posB = storagePositions[b.id] ?? (b.order ?? 999);
        return posA - posB;
    });
  }, [storages, columnFilters, storagePositions]);

  // Filtrage des items basé sur la recherche
  const filteredItems = useMemo(() => {
      if (!searchTerm) return items;
      return items.filter(i => 
          i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (i.articleCode && i.articleCode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }, [items, searchTerm]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b bg-slate-50 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 whitespace-nowrap">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
              Consignes Stock (Min / Max)
            </h2>
          </div>
          
          <div className="flex flex-1 w-full md:w-auto items-center gap-4">
             {/* SEARCH BAR */}
             <div className="relative flex-1 max-w-md">
                <input 
                    type="text" 
                    placeholder="Rechercher article..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>

             <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                <span className={`text-[10px] font-black uppercase tracking-widest ${!isEditOrderMode ? 'text-indigo-600' : 'text-slate-400'}`}>Saisie</span>
                <button onClick={() => setIsEditOrderMode(!isEditOrderMode)} className={`relative w-10 h-5 rounded-full transition-colors ${isEditOrderMode ? 'bg-indigo-600' : 'bg-slate-200'}`} aria-label="Changer le mode d'édition"><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isEditOrderMode ? 'left-6' : 'left-1'}`}></div></button>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isEditOrderMode ? 'text-indigo-600' : 'text-slate-400'}`}>Ordre Col.</span>
             </div>
          </div>
        </div>
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
                <div key={i} className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtre Espace {i + 1}</label>
                    <select 
                        value={columnFilters[i]} 
                        onChange={(e) => handleColumnFilterChange(i, e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                    >
                        <option value="none">-- Aucun --</option>
                        <option value="all">Tous les espaces</option>
                        {storages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            ))}
            </div>
            <div className="flex items-start gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <svg className="w-4 h-4 text-indigo-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-[10px] text-slate-500 font-medium leading-tight">
                    <strong className="text-indigo-700">Configuration requise :</strong> La saisie est désactivée pour les emplacements à priorité 0.
                    Le champ <strong>MAX</strong> définit la capacité physique (bouteilles pleines) pour éviter les débordements lors des entrées.
                </p>
            </div>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-left">
          <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="p-6 sticky left-0 bg-white z-30 border-r shadow-[1px_0_0_0_#e2e8f0]">Article</th>
              {visibleStorages.map(s => (
                <th key={s.id} className={`p-6 text-center border-r min-w-[200px] bg-white transition-all ${s.id === 's0' ? 'text-amber-600' : ''}`}>
                  <div className="flex flex-col items-center gap-2">
                      <span className="whitespace-nowrap">{s.name}</span>
                      {isEditOrderMode && (
                          <div className="mt-1 group">
                              <label className="block text-[8px] text-indigo-400 mb-1 font-black">POS</label>
                              <input 
                                  type="number" 
                                  className="w-14 bg-white border border-indigo-200 rounded-lg p-1 text-center text-indigo-600 font-black" 
                                  value={storagePositions[s.id] ?? (s.order ?? 0)} 
                                  onChange={(e) => handlePositionChange(s.id, parseInt(e.target.value) || 0)} 
                                  onBlur={(e) => handlePositionBlur(s.id, parseInt(e.target.value) || 0)}
                              />
                          </div>
                      )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-6 font-bold text-sm sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{item.name}</td>
                {visibleStorages.map(s => {
                  const consigne = consignes.find(c => c.itemId === item.id && c.storageId === s.id);
                  const priority = priorities.find(p => p.itemId === item.id && p.storageId === s.id);
                  const currentMin = consigne?.minQuantity || 0;
                  const currentMax = consigne?.maxCapacity || 0;
                  
                  const minKey = `${item.id}-${s.id}-min`;
                  const maxKey = `${item.id}-${s.id}-max`;
                  
                  const displayMin = editingValue?.key === minKey ? editingValue.val : currentMin.toString().replace('.', ',');
                  const displayMax = editingValue?.key === maxKey ? editingValue.val : (currentMax > 0 ? currentMax.toString() : '');
                    
                  const priorityVal = priority?.priority ?? 0;
                  const isZeroPriority = priorityVal === 0 && s.id !== 's0';
                  
                  return (
                    <td key={s.id} className={`p-4 text-center border-r transition-opacity relative ${isEditOrderMode ? 'opacity-40 select-none' : 'opacity-100'} ${s.id === 's0' ? 'bg-amber-50/10' : ''}`}>
                      <div className="flex justify-center items-center gap-1">
                        <div className="flex flex-col items-center">
                            <label className="text-[8px] font-bold text-slate-300 uppercase mb-1">Min</label>
                            <input 
                                type="text" 
                                inputMode="decimal" 
                                disabled={isEditOrderMode || isZeroPriority} 
                                className={`w-16 p-3 border border-slate-200 rounded-l-2xl text-center font-black text-lg text-slate-900 outline-none transition-all ${isZeroPriority ? 'bg-slate-100 opacity-50 cursor-not-allowed' : 'bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'}`} 
                                value={displayMin} 
                                onChange={e => handleInputChange(item.id, s.id, e.target.value, 'min')}
                                onBlur={e => handleInputBlur(item.id, s.id, e.target.value, 'min')}
                                onFocus={e => e.target.select()}
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <label className="text-[8px] font-bold text-slate-300 uppercase mb-1">Max</label>
                            <input 
                                type="text" 
                                inputMode="numeric" 
                                disabled={isEditOrderMode || isZeroPriority} 
                                placeholder="-"
                                className={`w-14 p-3 border-y border-r border-slate-200 rounded-r-2xl text-center font-bold text-sm text-slate-500 outline-none transition-all placeholder-slate-200 ${isZeroPriority ? 'bg-slate-100 opacity-50 cursor-not-allowed' : 'bg-white focus:bg-slate-50 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-400'}`} 
                                value={displayMax} 
                                onChange={e => handleInputChange(item.id, s.id, e.target.value, 'max')}
                                onBlur={e => handleInputBlur(item.id, s.id, e.target.value, 'max')}
                                onFocus={e => e.target.select()}
                            />
                        </div>
                      </div>
                      {isZeroPriority && !isEditOrderMode && (
                        <div className="absolute top-2 right-2 w-4 h-4 bg-slate-300 rounded-full flex items-center justify-center shadow-sm" title="Priorité 0 : Saisie désactivée">
                            <span className="text-white font-bold text-[10px]">✕</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredItems.length === 0 && (
                <tr>
                    <td colSpan={visibleStorages.length + 1} className="p-8 text-center text-slate-400 italic">Aucun article trouvé.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Consignes;
