
import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, StockItem, Glassware, User, AppConfig, RecipeIngredient, Technique, CocktailCategory, StockLevel, Format } from '../types';
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
  stockLevels?: StockLevel[];
  formats?: Format[];
}

const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const RecipesView: React.FC<RecipesViewProps> = ({ recipes, items, glassware, currentUser, appConfig, onSync, setRecipes, techniques = [], cocktailCategories = [], stockLevels = [], formats = [] }) => {
  const [viewMode, setViewMode] = useState<'CATEGORIES' | 'LIST' | 'CREATE' | 'DETAIL'>('CATEGORIES');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
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
      
      const format = formats.find(f => f.id === item.formatId);
      const divider = format?.value || 70; // Utilise la valeur du format (ex: 70cl, 100cl)

      let qtyInCl = ing.quantity;
      if (ing.unit === 'ml') qtyInCl = ing.quantity / 10;
      if (ing.unit === 'dash') qtyInCl = ing.quantity * 0.1;
      if (ing.unit === 'piece') qtyInCl = 1;

      return (item.pricePerUnit / divider) * qtyInCl;
  };

  const getStockLevel = (itemId: string) => {
      return stockLevels.filter(l => l.itemId === itemId).reduce((acc, curr) => acc + curr.currentQuantity, 0);
  };

  const totalCost = useMemo(() => newIngredients.reduce((acc, curr) => acc + getIngredientCost(curr), 0), [newIngredients, items, formats]);
  const margin = appConfig.defaultMargin || 82;
  const suggestedPrice = totalCost / (1 - (margin / 100));

  // Helper pour le calcul de coût d'une recette existante (mode DETAIL)
  const getRecipeCost = (recipe: Recipe) => {
      return recipe.ingredients.reduce((acc, curr) => acc + getIngredientCost(curr), 0);
  };

  const handleAI = async () => {
    if (!newName) {
        alert("Entrez un nom de cocktail pour que l'IA puisse travailler.");
        return;
    }
    setIsGenerating(true);
    const availableItems = items.map(i => i.name);
    const result = await generateCocktailWithAI(newName, availableItems);
    setIsGenerating(false);

    if (result) {
        setNewDesc(result.description || '');
        setNewHistory(result.history || '');
        setNewDecoration(result.decoration || '');
        
        // Tentative de mapping technique
        const foundTech = techniques.find(t => normalizeText(t.name) === normalizeText(result.technique || ''));
        if (foundTech) setNewTech(foundTech.name);

        // Mapping ingrédients IA -> Items Stock
        if (result.ingredients && Array.isArray(result.ingredients)) {
            const mappedIngs: RecipeIngredient[] = result.ingredients.map((iaIng: any) => {
                const foundItem = items.find(i => normalizeText(i.name).includes(normalizeText(iaIng.name)));
                return {
                    itemId: foundItem?.id,
                    tempName: !foundItem ? iaIng.name : undefined,
                    quantity: iaIng.quantity || 0,
                    unit: iaIng.unit || 'cl'
                };
            });
            setNewIngredients(mappedIngs);
        }
    }
  };

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
      
      // Retour à la liste de la catégorie concernée
      setSelectedCategoryFilter(newCat);
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

  const handleIngredientChange = (index: number, val: string) => {
      const copy = [...newIngredients];
      const existing = items.find(i => i.name === val || i.id === val);
      if (existing) {
          copy[index].itemId = existing.id;
          copy[index].tempName = undefined;
      } else {
          copy[index].itemId = undefined;
          copy[index].tempName = val;
      }
      setNewIngredients(copy);
  };

  const handleSelectCategory = (catName: string) => {
      setSelectedCategoryFilter(catName);
      setViewMode('LIST');
  };

  const handlePrint = () => {
      window.print();
  };

  // --- VUE DOSSIERS (CATEGORIES) ---
  if (viewMode === 'CATEGORIES') {
      // Calculate counts
      const counts = cocktailCategories.map(cat => ({
          ...cat,
          count: recipes.filter(r => r.category === cat.name).length
      }));

      return (
          <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
                  <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                      Recettes Cocktails
                  </h2>
                  <button onClick={() => { setEditingId(null); setNewName(''); setNewIngredients([]); setViewMode('CREATE'); }} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all">+ Créer</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {counts.map(cat => (
                      <div 
                        key={cat.id} 
                        onClick={() => handleSelectCategory(cat.name)}
                        className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg hover:border-pink-300 hover:scale-[1.02] cursor-pointer transition-all flex flex-col items-center justify-center h-48 gap-3 group relative overflow-hidden"
                      >
                          <div className="absolute inset-0 bg-gradient-to-br from-pink-50/0 to-pink-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner mb-2 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                              {cat.name.charAt(0)}
                          </div>
                          <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight text-center relative z-10">{cat.name}</h3>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full group-hover:bg-white group-hover:text-pink-500 transition-colors relative z-10">
                              {cat.count} Recettes
                          </span>
                      </div>
                  ))}
                  {/* Dossier "Non Classé" si besoin */}
                  {recipes.filter(r => !cocktailCategories.some(c => c.name === r.category)).length > 0 && (
                      <div 
                        onClick={() => handleSelectCategory('Non Classé')}
                        className="bg-slate-50 p-6 rounded-[2rem] border border-dashed border-slate-300 hover:border-slate-400 cursor-pointer transition-all flex flex-col items-center justify-center h-48 gap-3"
                      >
                          <h3 className="font-black text-lg text-slate-500 uppercase tracking-tight text-center">Non Classé</h3>
                          <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full">
                              {recipes.filter(r => !cocktailCategories.some(c => c.name === r.category)).length} Recettes
                          </span>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- VUE LISTE (FILTRÉE) ---
  if (viewMode === 'LIST') {
      const filteredRecipes = recipes.filter(r => 
          selectedCategoryFilter === 'Non Classé' 
            ? !cocktailCategories.some(c => c.name === r.category)
            : r.category === selectedCategoryFilter
      );

      return (
          <div className="space-y-6">
              <div className="flex items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
                  <button onClick={() => { setViewMode('CATEGORIES'); setSelectedCategoryFilter(null); }} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  </button>
                  <div>
                      <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                          {selectedCategoryFilter}
                      </h2>
                      <p className="text-xs text-slate-400 font-bold ml-3.5">{filteredRecipes.length} recettes</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-4">
                  {filteredRecipes.map(r => (
                      <div key={r.id} onClick={() => { setSelectedRecipe(r); setViewMode('DETAIL'); }} className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-pink-300 hover:shadow-xl cursor-pointer transition-all group">
                          <div className="flex justify-between items-start mb-2">
                              <h3 className="font-black text-lg text-slate-800 group-hover:text-pink-600 transition-colors">{r.name}</h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2 italic font-medium leading-relaxed">"{r.description}"</p>
                          <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{r.technique}</span>
                              <span className="font-black text-slate-900 text-sm">{r.sellingPrice?.toFixed(2)} €</span>
                          </div>
                      </div>
                  ))}
                  {filteredRecipes.length === 0 && <p className="col-span-full text-center py-20 text-slate-400 italic">Aucune recette dans ce dossier.</p>}
              </div>
          </div>
      );
  }

  if (viewMode === 'CREATE') {
      return (
          <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                      <h2 className="font-black text-xl uppercase tracking-tight text-slate-900">{editingId ? 'Modifier' : 'Nouveau'} Cocktail</h2>
                      {!editingId && (
                          <button 
                            onClick={handleAI} 
                            disabled={isGenerating} 
                            className="bg-gradient-to-r from-pink-500 to-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isGenerating ? 'Génération...' : '✨ Générer par IA'}
                          </button>
                      )}
                  </div>
                  <button onClick={() => { setViewMode(selectedCategoryFilter ? 'LIST' : 'CATEGORIES'); }} className="text-slate-400 font-black text-xs uppercase hover:text-slate-600">Annuler</button>
              </div>
              <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du Cocktail</label>
                          <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 outline-none focus:ring-4 focus:ring-pink-500/10 transition-all" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Espresso Martini..." />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 outline-none cursor-pointer" value={newCat} onChange={e => setNewCat(e.target.value)}>
                              {cocktailCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Verrerie</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-slate-800 outline-none" value={newGlassId} onChange={e => setNewGlassId(e.target.value)}>
                              <option value="">Choisir...</option>
                              {glassware.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Technique Principale</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-slate-800 outline-none" value={newTech} onChange={e => setNewTech(e.target.value)}>
                              <option value="">Choisir...</option>
                              {techniques.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Précisions de méthode</label>
                          <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-slate-800 outline-none" value={newTechDetails} onChange={e => setNewTechDetails(e.target.value)} placeholder="Ex: Double-filtration..." />
                      </div>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 space-y-6">
                      <div className="flex justify-between items-center">
                          <h3 className="font-black text-xs uppercase text-slate-500 tracking-widest">Ingrédients de la Recette</h3>
                          <button onClick={() => setNewIngredients([...newIngredients, { quantity: 0, unit: 'cl' }])} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-white border border-indigo-100 px-4 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">+ Ajouter</button>
                      </div>
                      <div className="space-y-3">
                          <datalist id="stock-items-list">
                              {items.map(i => <option key={i.id} value={i.name} />)}
                          </datalist>
                          {newIngredients.map((ing, idx) => (
                              <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm animate-in zoom-in-95">
                                  <input 
                                    list="stock-items-list" 
                                    className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-sm font-bold outline-none"
                                    placeholder="Ingrédient (Stock ou Libre)..."
                                    value={ing.itemId ? items.find(i=>i.id===ing.itemId)?.name : ing.tempName}
                                    onChange={e => handleIngredientChange(idx, e.target.value)}
                                  />
                                  <input type="number" step="0.1" className="w-20 bg-slate-50 border-none rounded-xl p-3 text-sm font-black text-center outline-none" value={ing.quantity} onChange={e => {
                                      const copy = [...newIngredients];
                                      copy[idx].quantity = parseFloat(e.target.value) || 0;
                                      setNewIngredients(copy);
                                  }} />
                                  <select className="w-24 bg-slate-50 border-none rounded-xl p-3 text-sm font-bold outline-none" value={ing.unit} onChange={e => {
                                      const copy = [...newIngredients];
                                      copy[idx].unit = e.target.value as any;
                                      setNewIngredients(copy);
                                  }}>
                                      <option value="cl">cl</option><option value="ml">ml</option><option value="dash">dash</option><option value="piece">pce</option>
                                  </select>
                                  <div className="w-16 text-right font-black text-slate-400 text-[10px]">{getIngredientCost(ing).toFixed(2)}€</div>
                                  <button onClick={() => { const c = [...newIngredients]; c.splice(idx,1); setNewIngredients(c); }} className="text-rose-400 p-2 hover:bg-rose-50 rounded-lg transition-all">✕</button>
                              </div>
                          ))}
                      </div>
                      <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
                          <div className="flex gap-8">
                            <div className="text-center md:text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coût Matière Théorique</p>
                                <p className="text-2xl font-black text-slate-900">{totalCost.toFixed(2)} €</p>
                            </div>
                            <div className="text-center md:text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coût / Prix (%)</p>
                                <p className="text-2xl font-black text-slate-400">{suggestedPrice > 0 ? ((totalCost / suggestedPrice)*100).toFixed(1) : 0}%</p>
                            </div>
                          </div>
                          <div className="text-center md:text-right bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Prix de Vente Min. Conseillé ({margin}% marge)</p>
                              <p className="text-3xl font-black text-indigo-700">{suggestedPrice.toFixed(2)} € <span className="text-xs opacity-50 uppercase tracking-tighter">TTC</span></p>
                          </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Histoire & Anecdotes</label>
                              <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-medium text-sm outline-none h-32 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none" value={newHistory} onChange={e => setNewHistory(e.target.value)} placeholder="Racontez l'origine du cocktail pour aider le staff à le vendre..." />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Décoration / Garniture</label>
                              <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-slate-800 outline-none" value={newDecoration} onChange={e => setNewDecoration(e.target.value)} placeholder="Ex: Zeste d'orange & Cerise griotte..." />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Méthode de Préparation (Étape par étape)</label>
                          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-medium text-sm outline-none h-[220px] focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="1. Refroidir le verre... 2. Shaker vigoureusement... 3. Passer dans le verre..." />
                      </div>
                  </div>

                  <button onClick={handleSaveRecipe} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] hover:bg-indigo-600 shadow-2xl transition-all active:scale-95 mb-8">Enregistrer la fiche technique</button>
              </div>
          </div>
      );
  }

  if (viewMode === 'DETAIL' && selectedRecipe) {
      const glass = glassware.find(g => g.id === selectedRecipe.glasswareId);
      const currentCost = getRecipeCost(selectedRecipe);
      const currentSuggestedPrice = currentCost / (1 - (margin / 100));

      return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] print-section">
                  <div className="bg-slate-900 text-white p-10 relative shrink-0 no-print-bg">
                      <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-black text-pink-400 bg-pink-500/10 px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block border border-pink-500/20">{selectedRecipe.category}</span>
                            <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{selectedRecipe.name}</h2>
                          </div>
                          <div className="flex gap-2 no-print">
                            <button onClick={handlePrint} className="text-white/30 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-all" title="Imprimer">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                            <button onClick={() => setViewMode('LIST')} className="text-white/30 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-all">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-thin">
                      <div className="grid grid-cols-3 gap-6">
                          <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-2">Verre</p><p className="font-bold text-slate-800 text-xs">{glass?.name || 'Standard'}</p></div>
                          <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-2">Méthode</p><p className="font-bold text-slate-800 text-xs">{selectedRecipe.technique}</p></div>
                          <div className="bg-pink-50 p-4 rounded-3xl text-center border border-pink-100 no-print-bg">
                              <p className="text-[9px] font-black text-pink-400 uppercase mb-2">Prix Conseillé</p>
                              <p className="font-black text-pink-600 text-base">{currentSuggestedPrice.toFixed(2)} €</p>
                              <p className="text-[8px] text-pink-400 mt-1">Coût: {currentCost.toFixed(2)}€</p>
                          </div>
                      </div>
                      
                      <div className="space-y-6">
                          <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2">Construction du cocktail</h3>
                          <ul className="space-y-3">
                              {selectedRecipe.ingredients.map((ing, i) => {
                                  const item = items.find(it => it.id === ing.itemId);
                                  const stock = ing.itemId ? getStockLevel(ing.itemId) : null;
                                  const isOutOfStock = ing.itemId && stock <= 0;

                                  return (
                                      <li key={i} className={`flex justify-between items-center text-sm font-bold bg-slate-50/50 px-4 py-3 rounded-2xl group hover:bg-slate-50 transition-colors ${isOutOfStock ? 'border border-rose-200 bg-rose-50/30' : ''}`}>
                                          <span className="flex items-center gap-3">
                                              <div className={`w-2 h-2 rounded-full ${isOutOfStock ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`}></div>
                                              <div className="flex flex-col">
                                                  <span className={isOutOfStock ? 'text-rose-700' : 'text-slate-700'}>{item?.name || ing.tempName}</span>
                                                  {isOutOfStock && <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest">⚠️ Rupture de stock</span>}
                                              </div>
                                          </span>
                                          <span className="bg-white px-3 py-1 rounded-xl text-slate-900 border border-slate-200 font-black">{ing.quantity} {ing.unit}</span>
                                      </li>
                                  );
                              })}
                          </ul>
                          {selectedRecipe.decoration && (
                            <div className="flex items-center gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-100 no-print-bg">
                                <span className="text-xl">🍋</span>
                                <p className="text-xs italic font-bold text-amber-800 uppercase tracking-tighter">Garnish : {selectedRecipe.decoration}</p>
                            </div>
                          )}
                      </div>

                      {selectedRecipe.history && (
                          <div className="bg-indigo-50 p-8 rounded-[2rem] border border-indigo-100 relative no-print-bg">
                              <span className="absolute -top-3 left-8 bg-indigo-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase no-print">Histoire & Origine</span>
                              <p className="text-sm text-indigo-900 font-medium italic leading-relaxed">"{selectedRecipe.history}"</p>
                          </div>
                      )}

                      <div className="space-y-4">
                        <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest">Préparation détaillée</h3>
                        <div className="bg-slate-50 p-8 rounded-[2rem] text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                            {selectedRecipe.description}
                        </div>
                      </div>
                  </div>
                  <div className="p-8 bg-slate-50 border-t flex justify-end gap-3 no-print">
                      <button onClick={() => handleEdit(selectedRecipe)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95">Modifier la fiche</button>
                  </div>
              </div>
          </div>
      );
  }

  return null;
};

export default RecipesView;
