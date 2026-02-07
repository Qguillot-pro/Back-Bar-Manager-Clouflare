
import React, { useState } from 'react';
import { Technique } from '../types';

interface TechniquesConfigProps {
  techniques: Technique[];
  setTechniques: React.Dispatch<React.SetStateAction<Technique[]>>;
  onSync: (action: string, payload: any) => void;
}

const TechniquesConfig: React.FC<TechniquesConfigProps> = ({ techniques, setTechniques, onSync }) => {
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
      if (!newName) return;
      const newItem: Technique = {
          id: 't' + Date.now(),
          name: newName
      };
      setTechniques(prev => [...prev, newItem]);
      onSync('SAVE_TECHNIQUE', newItem);
      setNewName('');
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Supprimer cette technique ?")) {
          setTechniques(prev => prev.filter(t => t.id !== id));
          onSync('DELETE_TECHNIQUE', { id });
      }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
        <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>Techniques Cocktail</h3>
        
        <div className="flex gap-2">
            <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom (ex: Shaker)..." value={newName} onChange={e => setNewName(e.target.value)} />
            <button onClick={handleAdd} className="bg-purple-500 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-purple-600">Ajouter</button>
        </div>

        <div className="flex flex-wrap gap-2">
            {techniques.map(t => (
                <div key={t.id} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group">
                    <span className="font-bold text-slate-800">{t.name}</span>
                    <button onClick={() => handleDelete(t.id)} className="text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
};

export default TechniquesConfig;
