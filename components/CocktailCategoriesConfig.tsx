
import React, { useState } from 'react';
import { CocktailCategory } from '../types';

interface CocktailCategoriesConfigProps {
  categories: CocktailCategory[];
  setCategories: React.Dispatch<React.SetStateAction<CocktailCategory[]>>;
  onSync: (action: string, payload: any) => void;
}

const CocktailCategoriesConfig: React.FC<CocktailCategoriesConfigProps> = ({ categories, setCategories, onSync }) => {
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
      if (!newName) return;
      const newItem: CocktailCategory = {
          id: 'cc' + Date.now(),
          name: newName
      };
      setCategories(prev => [...prev, newItem]);
      onSync('SAVE_COCKTAIL_CATEGORY', newItem); // Assumes backend handler exists or generic
      setNewName('');
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Supprimer cette catégorie ?")) {
          setCategories(prev => prev.filter(c => c.id !== id));
          onSync('DELETE_COCKTAIL_CATEGORY', { id });
      }
  };

  return (
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
  );
};

export default CocktailCategoriesConfig;
