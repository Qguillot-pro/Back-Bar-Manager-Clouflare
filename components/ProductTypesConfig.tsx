
import React, { useState } from 'react';
import { ProductType } from '../types';

interface ProductTypesConfigProps {
  types: ProductType[];
  setTypes: React.Dispatch<React.SetStateAction<ProductType[]>>;
  onSync: (action: string, payload: any) => void;
}

const ProductTypesConfig: React.FC<ProductTypesConfigProps> = ({ types, setTypes, onSync }) => {
  const [typeName, setTypeName] = useState('');
  const [editingType, setEditingType] = useState<ProductType | null>(null);
  const [fieldInput, setFieldInput] = useState('');

  const handleSaveType = () => {
      if (!typeName) return;
      
      const newType: ProductType = {
          id: editingType ? editingType.id : 'pt_' + Date.now(),
          name: typeName,
          fields: editingType ? editingType.fields : []
      };

      if (editingType) {
          setTypes(prev => prev.map(t => t.id === editingType.id ? newType : t));
      } else {
          setTypes(prev => [...prev, newType]);
      }
      
      onSync('SAVE_PRODUCT_TYPE', newType);
      resetForm();
  };

  const handleAddField = () => {
      if (!fieldInput || !editingType) return;
      const updatedType = { ...editingType, fields: [...editingType.fields, fieldInput] };
      setEditingType(updatedType);
      setFieldInput('');
  };

  const removeField = (index: number) => {
      if (!editingType) return;
      const updatedFields = [...editingType.fields];
      updatedFields.splice(index, 1);
      setEditingType({ ...editingType, fields: updatedFields });
  };

  const deleteType = (id: string) => {
      if (window.confirm("Supprimer ce type de fiche produit ?")) {
          setTypes(prev => prev.filter(t => t.id !== id));
          onSync('DELETE_PRODUCT_TYPE', { id });
      }
  };

  const startEdit = (t: ProductType) => {
      setEditingType(t);
      setTypeName(t.name);
  };

  const resetForm = () => {
      setEditingType(null);
      setTypeName('');
      setFieldInput('');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>Types de Fiches Produits</h3>
            
            <div className="flex gap-2">
                <input 
                    className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" 
                    placeholder="Nom du Type (ex: Rhum, Sirop Maison)..." 
                    value={typeName} 
                    onChange={e => setTypeName(e.target.value)} 
                />
                <button onClick={handleSaveType} className="bg-cyan-500 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-cyan-600">
                    {editingType ? 'Mettre à jour' : 'Ajouter'}
                </button>
                {editingType && <button onClick={resetForm} className="bg-slate-100 text-slate-500 px-4 rounded-2xl font-bold">Annuler</button>}
            </div>

            {editingType && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <h4 className="font-black text-xs uppercase text-slate-500 tracking-widest mb-4">Champs Personnalisés pour "{editingType.name}"</h4>
                    <div className="flex gap-2 mb-4">
                        <input 
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none"
                            placeholder="Nom du champ (ex: Vieillissement, Provenance)..."
                            value={fieldInput}
                            onChange={e => setFieldInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddField()}
                        />
                        <button onClick={handleAddField} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-xs uppercase">+</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {editingType.fields.map((f, i) => (
                            <div key={i} className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2 shadow-sm">
                                <span className="text-xs font-bold text-slate-700">{f}</span>
                                <button onClick={() => removeField(i)} className="text-rose-400 hover:text-rose-600 font-bold">×</button>
                            </div>
                        ))}
                        {editingType.fields.length === 0 && <p className="text-xs text-slate-400 italic">Aucun champ spécifique défini.</p>}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {types.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group h-32">
                        <div>
                            <div className="flex justify-between items-start">
                                <h4 className="font-black text-slate-800">{t.name}</h4>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(t)} className="p-1.5 bg-indigo-50 text-indigo-500 rounded hover:bg-indigo-100"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                    <button onClick={() => deleteType(t.id)} className="p-1.5 bg-rose-50 text-rose-500 rounded hover:bg-rose-100"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{t.fields.length} champs</p>
                        </div>
                        <div className="flex gap-1 flex-wrap overflow-hidden h-6">
                            {t.fields.slice(0, 3).map((f, i) => <span key={i} className="text-[8px] bg-slate-50 px-1.5 rounded text-slate-500 border border-slate-100">{f}</span>)}
                            {t.fields.length > 3 && <span className="text-[8px] text-slate-400">...</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default ProductTypesConfig;
