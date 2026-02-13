
import React, { useState } from 'react';
import { CocktailCategory, AppConfig } from '../types';

interface CocktailCategoriesConfigProps {
  categories: CocktailCategory[];
  setCategories: React.Dispatch<React.SetStateAction<CocktailCategory[]>>;
  onSync: (action: string, payload: any) => void;
  appConfig?: AppConfig;
  setAppConfig?: React.Dispatch<React.SetStateAction<AppConfig>>;
}

const CocktailCategoriesConfig: React.FC<CocktailCategoriesConfigProps> = ({ categories, setCategories, onSync, appConfig, setAppConfig }) => {
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
      if (!newName) return;
      const newItem: CocktailCategory = {
          id: 'cc' + Date.now(),
          name: newName
      };
      setCategories(prev => [...prev, newItem]);
      onSync('SAVE_COCKTAIL_CATEGORY', newItem);
      setNewName('');
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Supprimer cette catégorie ?")) {
          setCategories(prev => prev.filter(c => c.id !== id));
          onSync('DELETE_COCKTAIL_CATEGORY', { id });
      }
  };

  const handleToggleMapping = (program: string, categoryName: string) => {
      if (!appConfig || !setAppConfig) return;
      
      const currentMapping = appConfig.programMapping || {};
      const currentCats = currentMapping[program] || [];
      
      let newCats;
      if (currentCats.includes(categoryName)) {
          newCats = currentCats.filter(c => c !== categoryName);
      } else {
          newCats = [...currentCats, categoryName];
      }

      const updatedConfig = { 
          ...appConfig, 
          programMapping: { ...currentMapping, [program]: newCats }
      };
      
      setAppConfig(updatedConfig);
      onSync('SAVE_CONFIG', { key: 'program_mapping', value: JSON.stringify(updatedConfig.programMapping) });
  };

  const programs = [
      { id: 'OF_THE_DAY', label: 'Cocktail du Jour' },
      { id: 'MOCKTAIL', label: 'Mocktail' },
      { id: 'THALASSO', label: 'Thalasso' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-pink-500 rounded-full"></span>Catégories de Cocktails</h3>
            
            <div className="flex gap-2">
                <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom (ex: Signature)..." value={newName} onChange={e => setNewName(e.target.value)} />
                <button onClick={handleAdd} className="bg-pink-500 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-pink-600">Ajouter</button>
            </div>

            <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group">
                        <span className="font-bold text-slate-800">{c.name}</span>
                        <button onClick={() => handleDelete(c.id)} className="text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {appConfig && (
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>Configuration des Programmes</h3>
                <p className="text-xs text-slate-500">Cochez les catégories autorisées pour chaque type de programme automatique.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {programs.map(prog => (
                        <div key={prog.id} className="bg-slate-50 p-5 rounded-3xl border border-slate-200">
                            <h4 className="font-black text-slate-800 uppercase tracking-tight mb-4 text-center">{prog.label}</h4>
                            <div className="space-y-2">
                                {categories.map(c => {
                                    const isChecked = (appConfig.programMapping?.[prog.id] || []).includes(c.name);
                                    return (
                                        <label key={c.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                checked={isChecked}
                                                onChange={() => handleToggleMapping(prog.id, c.name)}
                                            />
                                            <span className="text-xs font-bold text-slate-700">{c.name}</span>
                                        </label>
                                    );
                                })}
                                {categories.length === 0 && <p className="text-center text-[10px] text-slate-400 italic">Aucune catégorie définie.</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};

export default CocktailCategoriesConfig;
