
import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, StockItem, Glassware, User, AppConfig, RecipeIngredient, Technique } from '../types';
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
}

const RecipesView: React.FC<RecipesViewProps> = ({ recipes, items, glassware, currentUser, appConfig, onSync, setRecipes, techniques = [] }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  
  // Create/Edit Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('Signature');
  const [newGlassId, setNewGlassId] = useState('');
  const [newTech, setNewTech] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newHistory, setNewHistory] = useState('');
  const [newDecoration, setNewDecoration] = useState('');
  const [newIngredients, setNewIngredients] = useState<RecipeIngredient[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Search State
  const [search, setSearch] = useState('');

  // Initialiser la technique par défaut si disponible
  useEffect(() => {
      if (!newTech && techniques.length > 0) {
          setNewTech(techniques[0].name);
      }
  }, [techniques]);

  // --- HELPERS ---
  const getFormatValue = (itemId?: string) => {
      if (!itemId) return 0;
      const item = items.find(i => i.id === itemId);
      return 70; // Valeur par défaut simplifiée, à améliorer avec props formats
  };

  const getIngredientCost = (ing: RecipeIngredient) => {
      if (!ing.itemId) return 0;
      const item = items.find(i => i.id === ing.itemId);
      if (!item || !item.pricePerUnit) return 0;
      
      const formatVal = getFormatValue(item.id); 
      if (formatVal === 0) return 0;

      // Conversion basique
      let qtyInCl = ing.quantity;
      if (ing.unit === 'ml') qtyInCl = ing.quantity / 10;
      if (ing.unit === 'dash') qtyInCl = ing.quantity * 0.1; 
      if (ing.unit === 'piece') qtyInCl = 0; 

      return (item.pricePerUnit / formatVal) * qtyInCl;
  };

  const calculateTotalCost = (ingredients: RecipeIngredient[]) => {
      return ingredients.reduce((acc, curr) => acc + getIngredientCost(curr), 0);
  };

  const margin = appConfig.defaultMargin || 82;
  const calculateSellingPrice = (cost: number) => {
      if (cost === 0) return 0;
      return cost / (1 - (margin / 100));
  };

  // --- HANDLERS ---

  const handleAI = async () => {
      if (!newName) return;
      setIsGenerating(true);
      const availableNames = items.map(i => i.name);
      const result = await generateCocktailWithAI(newName, availableNames);
      setIsGenerating(false);

      if (result) {
          setNewDesc(result.description?.slice(0, 150) || '');
          setNewHistory(result.history?.slice(0, 150) || '');
          setNewDecoration(result.decoration || '');
          
          if (result.technique) {
              setNewTech(result.technique);
          }
          
          const mappedIngs: RecipeIngredient[] = [];
          result.ingredients?.forEach((apiIng: any) => {
              const foundItem = items.find(i => i.name.toLowerCase().includes(apiIng.name.toLowerCase()));
              mappedIngs.push({
                  itemId: foundItem?.id,
                  tempName: foundItem ? undefined : apiIng.name,
                  quantity: apiIng.quantity,
                  unit: ['cl', 'ml', 'dash', 'piece'].includes(apiIng.unit) ? apiIng.unit : 'cl'
              });
          });
          setNewIngredients(mappedIngs);
      }
  };

  const handleAddIngredient = () => {
      setNewIngredients([...newIngredients, { quantity: 0, unit: 'cl' }]);
  };

  const handleRemoveIngredient = (idx: number) => {
      const copy = [...newIngredients];
      copy.splice(idx, 1);
      setNewIngredients(copy);
  };

  const handleIngredientChange = (idx: number, field: keyof RecipeIngredient, value: any) => {
      const copy = [...newIngredients];
      copy[idx] = { ...copy[idx], [field]: value };
      
      if (field === 'itemId' && value) {
          delete copy[idx].tempName;
      }
      setNewIngredients(copy);
  };

  const handleSaveRecipe = () => {
      if (!newName || newIngredients.length === 0) return;
      
      const cost = calculateTotalCost(newIngredients);
      const selling = calculateSellingPrice(cost);

      const recipeId = editingId || 'r' + Date.now();

      const recipe: Recipe = {
          id: recipeId,
          name: newName,
          category: newCat,
          glasswareId: newGlassId,
          technique: newTech,
          description: newDesc,
          history: newHistory,
          decoration: newDecoration,
          ingredients: newIngredients,
          costPrice: cost,
          sellingPrice: selling,
          status: editingId ? 'VALIDATED' : 'DRAFT', // Si admin edit, on valide auto ou on garde le status ? Disons VALIDATED si admin save.
          createdBy: editingId ? (recipes.find(r => r.id === editingId)?.createdBy || currentUser.name) : currentUser.name,
          createdAt: editingId ? (recipes.find(r => r.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
      };

      if (editingId) {
          setRecipes(prev => prev.map(r => r.id === editingId ? recipe : r));
      } else {
          setRecipes(prev => [...prev, recipe]);
      }
      
      onSync('SAVE_RECIPE', recipe);
      setViewMode('LIST');
      
      // Reset
      setEditingId(null);
      setNewName('');
      setNewIngredients([]);
      setNewDesc('');
      setNewHistory('');
  };

  const handleEdit = (recipe: Recipe) => {
      setEditingId(recipe.id);
      setNewName(recipe.name);
      setNewCat(recipe.category);
      setNewGlassId(recipe.glasswareId);
      setNewTech(recipe.technique);
      setNewDesc(recipe.description);
      setNewHistory(recipe.history || '');
      setNewDecoration(recipe.decoration || '');
      setNewIngredients(recipe.ingredients);
      setViewMode('CREATE');
  };

  const handleValidate = (recipe: Recipe) => {
      const updated = { ...recipe, status: 'VALIDATED' as const };
      setRecipes(prev => prev.map(r => r.id === recipe.id ? updated : r));
      onSync('VALIDATE_RECIPE', { id: recipe.id });
      if (selectedRecipe?.id === recipe.id) setSelectedRecipe(updated);
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Supprimer cette recette ?")) {
          setRecipes(prev => prev.filter(r => r.id !== id));
          onSync('DELETE_RECIPE', { id });
          setViewMode('LIST');
      }
  };

  const filteredRecipes = useMemo(() => {
      return recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [recipes, search]);

  // --- RENDER ---

  if (viewMode === 'LIST') {
      return (
          <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                      Cartes des Cocktails
                  </h2>
                  <div className="flex gap-4 w-full md:w-auto">
                      <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-pink-100 flex-1"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      <button 
                        onClick={() => {
                            setEditingId(null);
                            setNewName('');
                            setNewIngredients([]);
                            setViewMode('CREATE');
                        }}
                        className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 shadow-lg"
                      >
                          + Créer
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRecipes.map(r => (
                      <div 
                        key={r.id} 
                        onClick={() => { setSelectedRecipe(r); setViewMode('DETAIL'); }}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-pink-200 transition-all cursor-pointer group relative overflow-hidden"
                      >
                          {r.status === 'VALIDATED' && (
                              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black px-2 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  Vérifié
                              </div>
                          )}
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h3 className="font-black text-lg text-slate-800 group-hover:text-pink-600 transition-colors">{r.name}</h3>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.category}</span>
                              </div>
                              {r.status === 'DRAFT' && <span className="bg-amber-100 text-amber-600 text-[9px] font-black px-2 py-1 rounded uppercase">Brouillon</span>}
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 mb-4">{r.description}</p>
                          <div className="flex justify-between items-center border-t border-slate-50 pt-4">
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{r.technique}</span>
                              <span className="font-black text-slate-900">{r.sellingPrice?.toFixed(2)} €</span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  if (viewMode === 'CREATE') {
      const currentCost = calculateTotalCost(newIngredients);
      const currentPrice = calculateSellingPrice(currentCost);

      return (
          <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                  <h2 className="font-black text-xl text-slate-800 uppercase tracking-tight">{editingId ? 'Modifier le Cocktail' : 'Créer un Cocktail'}</h2>
                  <button onClick={() => setViewMode('LIST')} className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase">Annuler</button>
              </div>
              
              <div className="p-8 space-y-8">
                  {/* HEADER FORM */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du Cocktail</label>
                          <div className="flex gap-2">
                              <input className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Mojito Royal" />
                              <button 
                                onClick={handleAI} 
                                disabled={!newName || isGenerating}
                                className="bg-pink-100 text-pink-600 px-4 rounded-xl font-black text-xs uppercase hover:bg-pink-200 disabled:opacity-50 flex items-center gap-1"
                              >
                                  {isGenerating ? '...' : '✨ IA'}
                              </button>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none text-sm" value={newCat} onChange={e => setNewCat(e.target.value)}>
                              <option>Signature</option>
                              <option>Classique</option>
                              <option>Mocktail</option>
                              <option>Tiki</option>
                              <option>After Dinner</option>
                          </select>
                      </div>
                  </div>

                  {/* DETAILS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Verrerie</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none text-sm" value={newGlassId} onChange={e => setNewGlassId(e.target.value)}>
                              <option value="">Choisir...</option>
                              {glassware.map(g => <option key={g.id} value={g.id}>{g.name} ({g.capacity}cl)</option>)}
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Technique</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none text-sm" value={newTech} onChange={e => setNewTech(e.target.value)}>
                              {techniques.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              {!techniques.length && <option value="Shaker">Shaker (Défaut)</option>}
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Décoration</label>
                          <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none text-sm" value={newDecoration} onChange={e => setNewDecoration(e.target.value)} placeholder="Ex: Zeste Citron" />
                      </div>
                  </div>

                  {/* TEXTS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description (Max 150)</label>
                          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none text-sm h-24 resize-none" maxLength={150} value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Histoire (Max 150)</label>
                          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none text-sm h-24 resize-none" maxLength={150} value={newHistory} onChange={e => setNewHistory(e.target.value)} />
                      </div>
                  </div>

                  {/* INGREDIENTS */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-black text-sm uppercase text-slate-700">Ingrédients</h3>
                          <button onClick={handleAddIngredient} disabled={newIngredients.length >= 8} className="text-indigo-600 font-black text-[10px] uppercase hover:underline">+ Ajouter</button>
                      </div>
                      <div className="space-y-3">
                          {newIngredients.map((ing, idx) => {
                              const cost = getIngredientCost(ing);
                              return (
                                  <div key={idx} className="flex gap-2 items-center">
                                      <div className="flex-1">
                                          <input 
                                            list={`ing-list-${idx}`}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none"
                                            placeholder="Ingrédient..."
                                            value={ing.itemId ? items.find(i => i.id === ing.itemId)?.name : (ing.tempName || '')}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const found = items.find(i => i.name === val);
                                                if (found) handleIngredientChange(idx, 'itemId', found.id);
                                                else {
                                                    handleIngredientChange(idx, 'itemId', undefined);
                                                    handleIngredientChange(idx, 'tempName', val);
                                                }
                                            }}
                                          />
                                          <datalist id={`ing-list-${idx}`}>
                                              {items.map(i => <option key={i.id} value={i.name} />)}
                                          </datalist>
                                      </div>
                                      <input type="number" className="w-16 bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold text-center outline-none" value={ing.quantity} onChange={e => handleIngredientChange(idx, 'quantity', parseFloat(e.target.value))} />
                                      <select className="w-20 bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none" value={ing.unit} onChange={e => handleIngredientChange(idx, 'unit', e.target.value)}>
                                          <option value="cl">cl</option>
                                          <option value="ml">ml</option>
                                          <option value="dash">dash</option>
                                          <option value="piece">pce</option>
                                      </select>
                                      <span className={`text-[10px] font-bold w-12 text-right ${cost === 0 ? 'text-amber-500' : 'text-slate-400'}`}>{cost > 0 ? `${cost.toFixed(2)}€` : '⚠'}</span>
                                      <button onClick={() => handleRemoveIngredient(idx)} className="text-rose-400 hover:text-rose-600 font-bold px-2">X</button>
                                  </div>
                              );
                          })}
                          {newIngredients.length === 0 && <p className="text-center text-slate-400 italic text-xs py-4">Ajoutez des ingrédients.</p>}
                      </div>
                  </div>

                  {/* FOOTER & COSTS */}
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-4 border-t border-slate-100">
                      <div className="flex gap-6">
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coût Matière</p>
                              <p className="text-xl font-black text-slate-700">{currentCost.toFixed(2)} €</p>
                          </div>
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prix Conseillé ({margin}%)</p>
                              <p className="text-xl font-black text-emerald-600">{currentPrice.toFixed(2)} €</p>
                          </div>
                      </div>
                      <button onClick={handleSaveRecipe} disabled={!newName || newIngredients.length === 0} className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 shadow-xl">
                          {editingId ? 'Mettre à jour' : 'Enregistrer le Cocktail'}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- DETAIL POPUP ---
  if (viewMode === 'DETAIL' && selectedRecipe) {
      const glass = glassware.find(g => g.id === selectedRecipe.glasswareId);
      return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="relative h-32 bg-slate-900 flex items-center justify-center p-6 shrink-0">
                      <div className="text-center">
                          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{selectedRecipe.name}</h2>
                          {selectedRecipe.status === 'VALIDATED' && (
                              <div className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  Vérifié
                              </div>
                          )}
                          <p className="text-indigo-300 font-bold uppercase tracking-widest text-xs mt-1">{selectedRecipe.category}</p>
                      </div>
                      <button onClick={() => { setViewMode('LIST'); setSelectedRecipe(null); }} className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-2xl">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Verrerie</p>
                              <p className="font-bold text-slate-800 flex items-center gap-2">
                                  {glass?.name || 'Standard'}
                                  <span className="text-xs text-slate-400 font-normal">({glass?.capacity}cl)</span>
                              </p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Technique</p>
                              <p className="font-bold text-slate-800">{selectedRecipe.technique}</p>
                          </div>
                      </div>

                      <div>
                          <h3 className="font-black text-sm uppercase text-slate-400 tracking-widest mb-3 border-b pb-2">Recette</h3>
                          <ul className="space-y-2">
                              {selectedRecipe.ingredients.map((ing, i) => (
                                  <li key={i} className="flex justify-between items-center text-sm font-bold text-slate-700">
                                      <span>{ing.itemId ? items.find(it => it.id === ing.itemId)?.name : ing.tempName}</span>
                                      <span className="bg-slate-100 px-2 py-1 rounded text-slate-900">{ing.quantity} {ing.unit}</span>
                                  </li>
                              ))}
                          </ul>
                          {selectedRecipe.decoration && (
                              <p className="mt-4 text-xs font-bold text-slate-500 italic">Garnish: {selectedRecipe.decoration}</p>
                          )}
                      </div>

                      <div className="bg-indigo-50 p-6 rounded-2xl text-indigo-900 text-sm leading-relaxed border border-indigo-100">
                          <p className="font-bold mb-2">💡 Histoire & Description</p>
                          <p className="mb-2">{selectedRecipe.description}</p>
                          <p className="italic opacity-70 text-xs">{selectedRecipe.history}</p>
                      </div>
                  </div>

                  <div className="p-6 border-t bg-slate-50 flex justify-between items-center shrink-0">
                      <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prix Vente</span>
                          <span className="text-2xl font-black text-slate-900">{selectedRecipe.sellingPrice?.toFixed(2)} €</span>
                      </div>
                      
                      <div className="flex gap-2">
                          {currentUser.role === 'ADMIN' && (
                              <>
                                <button onClick={() => handleDelete(selectedRecipe.id)} className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-xs uppercase hover:bg-rose-50">Supprimer</button>
                                <button onClick={() => handleEdit(selectedRecipe)} className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold text-xs uppercase hover:bg-indigo-50 shadow-sm">Modifier</button>
                                {selectedRecipe.status === 'DRAFT' && (
                                    <button onClick={() => handleValidate(selectedRecipe)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl