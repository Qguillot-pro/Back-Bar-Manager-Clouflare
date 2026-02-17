
import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, StockItem, Glassware, User, AppConfig, RecipeIngredient, Technique, CocktailCategory } from '../types';
import { generateCocktailWithAI } from '../services/geminiService';

interface RecipesViewProps {
  recipes: Recipe[];
  items: StockItem[];
  glassware: Glassware[];
  currentUser: User;
  appConfig: AppConfig;
  onSync: (action: string, payload: any) => void;
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  techniques?: Technique[];
  cocktailCategories?: CocktailCategory[];
}

const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const RecipesView: React.FC<RecipesViewProps> = ({ recipes, items, glassware, currentUser, appConfig, onSync, setRecipes, techniques = [], cocktailCategories = [] }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newGlassId, setNewGlassId] = useState('');
  const [newTech, setNewTech] = useState('');
  const [newTechDetails, setNewTechDetails] = useState(''); 
  const [newDesc, setNewDesc] = useState('');
  const [newHistory, setNewHistory] = useState('');
  const [newDecoration, setNewDecoration] = useState('');
  const [newIngredients, setNewIngredients] = useState<RecipeIngredient[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
      if (!newCat && cocktailCategories.length > 0) setNewCat(cocktailCategories[0].name);
  }, [cocktailCategories]);

  // Calcul du coût et prix suggéré
  const getIngredientCost = (ing: RecipeIngredient) => {
      if (!ing.itemId) return 0;
      const item = items.find(i => i.id === ing.itemId);
      if (!item || !item.pricePerUnit) return 0;
      
      // Approximation : On divise par 70cl si Spiritueux, par 75cl si Vin, etc.
      let divider = 70;
      if (item.category === 'Vins') divider = 75;
      else if (item.category === 'Softs') divider = 20;

      let qtyInCl = ing.quantity;
      if (ing.unit === 'ml') qtyInCl = ing.quantity / 10;
      if (ing.unit === 'dash') qtyInCl = ing.quantity * 0.1;

      return (item.pricePerUnit / divider) * qtyInCl;
  };

  const totalCost = useMemo(() => newIngredients.reduce((acc, curr) => acc + getIngredientCost(curr), 0), [newIngredients, items]);
  const margin = appConfig.defaultMargin || 82;
  const suggestedPrice = totalCost / (1 - (margin / 100));

  const handleSaveRecipe = () => {
      if (!newName || newIngredients.length === 0) return;
      const recipe: Recipe = {
          id: editingId || 'r' + Date.now(),
          name: newName,
          category: newCat,
          glasswareId: newGlassId,
          technique: newTech,
          technicalDetails: newTechDetails, 
          description: newDesc,
          history: newHistory,
          decoration: newDecoration,
          ingredients: newIngredients,
          costPrice: totalCost,
          sellingPrice: suggestedPrice,
          status: 'VALIDATED',
          createdBy: currentUser.name,
          createdAt: new Date().toISOString()
      };
      if (editingId) setRecipes(prev => prev.map(r => r.id === editingId ? recipe : r));
      else setRecipes(prev => [...prev, recipe]);
      onSync('SAVE_RECIPE', recipe);
      setViewMode('LIST');
  };

  const handleEdit = (recipe: Recipe) => {
      setEditingId(recipe.id);
      setNewName(recipe.name);
      setNewCat(recipe.category);
      setNewGlassId(recipe.glasswareId);
      setNewTech(recipe.technique);
      setNewTechDetails(recipe.technicalDetails || '');
      setNewDesc(recipe.description);
      setNewHistory(recipe.history || '');
      setNewDecoration(recipe.decoration || '');
      setNewIngredients(recipe.ingredients);
      setViewMode('CREATE');
  };

  if (viewMode === 'LIST') {
      return (
          <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
                  <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                      Fiches Cocktails
                  </h2>
                  <button onClick={() => { setEditingId(null); setNewName(''); setNewIngredients([]); setViewMode('CREATE'); }} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest">+ Créer</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recipes.map(r => (
                      <div key={r.id} onClick={() => { setSelectedRecipe(r); setViewMode('DETAIL'); }} className="bg-white p-6 rounded-3xl border hover:border-pink-200 hover:shadow-md cursor-pointer transition-all">
                          <h3 className="font-black text-lg text-slate-800">{r.name}</h3>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.category}</span>
                          <p className="text-sm text-slate-500 mt-3 line-clamp-2">{r.description}</p>
                          <div className="mt-4 pt-4 border-t flex justify-between items-center">
                              <span className="text-[10px] font-black text-indigo-500 uppercase">{r.technique}</span>
                              <span className="font-black text-slate-900">{r.sellingPrice?.toFixed(2)} €</span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  if (viewMode === 'CREATE') {
      return (
          <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-xl border overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                  <h2 className="font-black text-xl uppercase">{editingId ? 'Modifier' : 'Nouveau'} Cocktail</h2>
                  <button onClick={() => setViewMode('LIST')} className="text-slate-400 font-black text-xs uppercase">Annuler</button>
              </div>
              <div className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du Cocktail</label>
                          <input className="w-full bg-slate-50 border rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-pink-100" value={newName} onChange={e => setNewName(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                          <select className="w-full bg-slate-50 border rounded-xl p-3 font-bold outline-none" value={newCat} onChange={e => setNewCat(e.target.value)}>
                              {cocktailCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Verrerie</label>
                          <select className="w-full bg-slate-50 border rounded-xl p-3 font-bold outline-none" value={newGlassId} onChange={e => setNewGlassId(e.target.value)}>
                              <option value="">Choisir...</option>
                              {glassware.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Technique</label>
                          <select className="w-full bg-slate-50 border rounded-xl p-3 font-bold outline-none" value={newTech} onChange={e => setNewTech(e.target.value)}>
                              <option value="">Choisir...</option>
                              {techniques.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Détails Techniques</label>
                          <input className="w-full bg-slate-50 border rounded-xl p-3 font-bold outline-none" value={newTechDetails} onChange={e => setNewTechDetails(e.target.value)} placeholder="Tours de main..." />
                      </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border space-y-4">
                      <div className="flex justify-between items-center">
                          <h3 className="font-black text-xs uppercase text-slate-500">Ingrédients & Coût</h3>
                          <button onClick={() => setNewIngredients([...newIngredients, { quantity: 0, unit: 'cl' }])} className="text-indigo-600 font-black text-[10px] uppercase underline">+ Ajouter</button>
                      </div>
                      <div className="space-y-2">
                          {newIngredients.map((ing, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                  <select className="flex-1 bg-white border rounded-lg p-2 text-sm font-bold outline-none" value={ing.itemId || ''} onChange={e => {
                                      const copy = [...newIngredients];
                                      copy[idx].itemId = e.target.value;
                                      setNewIngredients(copy);
                                  }}>
                                      <option value="">Article Stock...</option>
                                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                  </select>
                                  <input type="number" className="w-16 bg-white border rounded-lg p-2 text-sm font-bold text-center outline-none" value={ing.quantity} onChange={e => {
                                      const copy = [...newIngredients];
                                      copy[idx].quantity = parseFloat(e.target.value) || 0;
                                      setNewIngredients(copy);
                                  }} />
                                  <select className="w-20 bg-white border rounded-lg p-2 text-sm font-bold outline-none" value={ing.unit} onChange={e => {
                                      const copy = [...newIngredients];
                                      copy[idx].unit = e.target.value as any;
                                      setNewIngredients(copy);
                                  }}>
                                      <option value="cl">cl</option><option value="ml">ml</option><option value="dash">dash</option><option value="piece">pce</option>
                                  </select>
                                  <span className="text-[10px] font-black text-slate-400 w-12 text-right">{getIngredientCost(ing).toFixed(2)}€</span>
                                  <button onClick={() => { const c = [...newIngredients]; c.splice(idx,1); setNewIngredients(c); }} className="text-rose-400 px-2 font-bold">✕</button>
                              </div>
                          ))}
                      </div>
                      <div className="pt-4 border-t flex justify-between items-center">
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">Coût Matière</p>
                              <p className="text-xl font-black text-slate-900">{totalCost.toFixed(2)} €</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[9px] font-black text-pink-500 uppercase">PV Min Conseillé ({margin}%)</p>
                              <p className="text-2xl font-black text-pink-600">{suggestedPrice.toFixed(2)} €</p>
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Décoration / Garniture</label>
                          <input className="w-full bg-slate-50 border rounded-xl p-3 font-bold outline-none" value={newDecoration} onChange={e => setNewDecoration(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Histoire du Cocktail</label>
                          <textarea className="w-full bg-slate-50 border rounded-xl p-3 font-medium text-sm outline-none h-20" value={newHistory} onChange={e => setNewHistory(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description (Méthode)</label>
                          <textarea className="w-full bg-slate-50 border rounded-xl p-3 font-medium text-sm outline-none h-24" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                      </div>
                  </div>

                  <button onClick={handleSaveRecipe} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl">Enregistrer la recette</button>
              </div>
          </div>
      );
  }

  if (viewMode === 'DETAIL' && selectedRecipe) {
      const glass = glassware.find(g => g.id === selectedRecipe.glasswareId);
      return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-slate-900 text-white p-8 relative shrink-0">
                      <h2 className="text-3xl font-black uppercase tracking-tighter">{selectedRecipe.name}</h2>
                      <p className="text-pink-400 font-bold uppercase tracking-widest text-xs mt-1">{selectedRecipe.category}</p>
                      <button onClick={() => setViewMode('LIST')} className="absolute top-6 right-6 text-white/50 hover:text-white">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                      <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 p-3 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Verre</p><p className="font-bold text-slate-800 text-xs">{glass?.name || 'Standard'}</p></div>
                          <div className="bg-slate-50 p-3 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Méthode</p><p className="font-bold text-slate-800 text-xs">{selectedRecipe.technique}</p></div>
                          <div className="bg-slate-50 p-3 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Prix</p><p className="font-black text-slate-900 text-sm">{selectedRecipe.sellingPrice?.toFixed(2)} €</p></div>
                      </div>
                      
                      <div>
                          <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-3 border-b pb-1">Recette</h3>
                          <ul className="space-y-2">
                              {selectedRecipe.ingredients.map((ing, i) => (
                                  <li key={i} className="flex justify-between items-center text-sm font-bold text-slate-700">
                                      <span>{items.find(it => it.id === ing.itemId)?.name || ing.tempName}</span>
                                      <span className="bg-slate-100 px-2 py-1 rounded text-slate-900">{ing.quantity} {ing.unit}</span>
                                  </li>
                              ))}
                          </ul>
                          {selectedRecipe.decoration && <p className="mt-3 text-xs italic font-bold text-pink-500">Garnish: {selectedRecipe.decoration}</p>}
                      </div>

                      {selectedRecipe.history && (
                          <div className="bg-slate-50 p-5 rounded-2xl border-l-4 border-indigo-200">
                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Histoire</p>
                              <p className="text-sm text-slate-600 font-medium italic">"{selectedRecipe.history}"</p>
                          </div>
                      )}

                      <div className="bg-indigo-50 p-6 rounded-2xl text-indigo-900 text-sm leading-relaxed whitespace-pre-wrap"><p>{selectedRecipe.description}</p></div>
                  </div>
                  <div className="p-6 bg-slate-50 border-t flex justify-end gap-2">
                      <button onClick={() => handleEdit(selectedRecipe)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs">Modifier</button>
                  </div>
              </div>
          </div>
      );
  }

  return null;
};

export default RecipesView;
