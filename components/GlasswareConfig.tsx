
import React, { useState } from 'react';
import { Glassware } from '../types';

interface GlasswareConfigProps {
  glassware: Glassware[];
  setGlassware: React.Dispatch<React.SetStateAction<Glassware[]>>;
  onSync: (action: string, payload: any) => void;
}

const GlasswareConfig: React.FC<GlasswareConfigProps> = ({ glassware, setGlassware, onSync }) => {
  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState(0);
  const [newQuantity, setNewQuantity] = useState(0);

  const handleAdd = () => {
      if (!newName) return;
      const newItem: Glassware = {
          id: 'g' + Date.now(),
          name: newName,
          capacity: newCapacity,
          imageUrl: '', // Placeholder
          quantity: newQuantity,
          lastUpdated: new Date().toISOString()
      };
      setGlassware(prev => [...prev, newItem]);
      onSync('SAVE_GLASSWARE', newItem);
      setNewName('');
      setNewCapacity(0);
      setNewQuantity(0);
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
      const now = new Date().toISOString();
      setGlassware(prev => prev.map(g => g.id === id ? { ...g, quantity: qty, lastUpdated: now } : g));
      
      const item = glassware.find(g => g.id === id);
      if (item) {
          onSync('SAVE_GLASSWARE', { ...item, quantity: qty, lastUpdated: now });
      }
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Supprimer ce verre ?")) {
          setGlassware(prev => prev.filter(g => g.id !== id));
          onSync('DELETE_GLASSWARE', { id });
      }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
        <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>Verrerie Disponible</h3>
        
        <div className="flex gap-2">
            <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom (ex: Coupette)..." value={newName} onChange={e => setNewName(e.target.value)} />
            <div className="flex flex-col w-24">
                <input type="number" className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-center" placeholder="Cl" value={newCapacity || ''} onChange={e => setNewCapacity(parseFloat(e.target.value))} />
                <label className="text-[8px] font-black text-slate-400 text-center uppercase">Capacité</label>
            </div>
            <div className="flex flex-col w-24">
                <input type="number" className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-center" placeholder="Qté" value={newQuantity || ''} onChange={e => setNewQuantity(parseInt(e.target.value))} />
                <label className="text-[8px] font-black text-slate-400 text-center uppercase">Stock</label>
            </div>
            <button onClick={handleAdd} className="bg-cyan-500 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-cyan-600 h-[58px]">Ajouter</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {glassware.map(g => (
                <div key={g.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group relative">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="font-bold text-slate-800">{g.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{g.capacity} cl</p>
                        </div>
                        <button onClick={() => handleDelete(g.id)} className="text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-4 bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Stock :</span>
                        <input 
                            type="number" 
                            className="w-16 font-black text-slate-900 outline-none text-center" 
                            value={g.quantity || 0} 
                            onChange={(e) => handleUpdateQuantity(g.id, parseInt(e.target.value))}
                        />
                    </div>
                    {g.lastUpdated && (
                        <p className="text-[8px] font-bold text-slate-400 mt-2 text-right">
                            MàJ: {new Date(g.lastUpdated).toLocaleDateString()}
                        </p>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

export default GlasswareConfig;
