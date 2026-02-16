
import React, { useState, useMemo } from 'react';
import { ProductSheet, StockItem, UserRole, Category } from '../types';
import { generateProductSheetWithAI } from '../services/geminiService';

interface ProductKnowledgeProps {
  sheets: ProductSheet[];
  items: StockItem[];
  currentUserRole: UserRole;
  onSync: (action: string, payload: any) => void;
}

const ProductKnowledge: React.FC<ProductKnowledgeProps> = ({ sheets, items, currentUserRole, onSync }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
  const [selectedSheet, setSelectedSheet] = useState<ProductSheet | null>(null);
  const [search, setSearch] = useState('');
  
  // Create Form
  const [selectedItemId, setSelectedItemId] = useState('');
  const [sheetType, setSheetType] = useState('WINE');
  const [desc, setDesc] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [tasting, setTasting] = useState({ nose: '', mouth: '', eye: '' });
  const [pairing, setPairing] = useState('');
  const [temp, setTemp] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const linkedItem = items.find(i => i.id === selectedSheet?.itemId);

  const handleAI = async () => {
      const item = items.find(i => i.id === selectedItemId);
      if (!item) return;
      setIsGenerating(true);
      const result = await generateProductSheetWithAI(item.name, sheetType);
      setIsGenerating(false);
      
      if (result) {
          setDesc(result.description || '');
          setRegion(result.region || '');
          setCountry(result.country || '');
          setTasting({ nose: result.nose || '', mouth: result.mouth || '', eye: result.eye || '' });
          setPairing(result.pairing || '');
          setTemp(result.temp || '');
      }
  };

  const handleSave = () => {
      if (!selectedItemId) return;
      const newSheet: ProductSheet = {
          id: selectedSheet ? selectedSheet.id : 'sheet_' + Date.now(),
          itemId: selectedItemId,
          type: sheetType as any,
          region,
          country,
          tastingNotes: JSON.stringify(tasting),
          foodPairing: pairing,
          servingTemp: temp,
          allergens: '',
          description: desc,
          status: currentUserRole === 'ADMIN' ? 'VALIDATED' : 'DRAFT',
          updatedAt: new Date().toISOString()
      };
      onSync('SAVE_PRODUCT_SHEET', newSheet);
      setViewMode('LIST');
      resetForm();
  };

  const resetForm = () => {
      setSelectedItemId('');
      setDesc('');
      setRegion('');
      setCountry('');
      setTasting({ nose: '', mouth: '', eye: '' });
      setPairing('');
      setTemp('');
      setSelectedSheet(null);
  };

  const openCreate = () => {
      resetForm();
      setViewMode('CREATE');
  };

  const openDetail = (sheet: ProductSheet) => {
      setSelectedSheet(sheet);
      setViewMode('DETAIL');
  };

  const filteredSheets = useMemo(() => {
      return sheets.filter(s => {
          const item = items.find(i => i.id === s.itemId);
          const term = search.toLowerCase();
          return item?.name.toLowerCase().includes(term) || 
                 s.region?.toLowerCase().includes(term) || 
                 s.description.toLowerCase().includes(term);
      });
  }, [sheets, items, search]);

  const getTastingObj = (json?: string) => {
      try { return JSON.parse(json || '{}'); } catch { return {}; }
  };

  if (viewMode === 'LIST') {
      return (
          <div className="space-y-6 max-w-6xl mx-auto">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                      Fiches Produits
                  </h2>
                  <div className="flex gap-4 w-full md:w-auto">
                      <input 
                        type="text" 
                        placeholder="Recherche rapide (ex: Sec, Alsace)..." 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-cyan-100 flex-1 w-64"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      <button onClick={openCreate} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 shadow-lg">+ Créer</button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSheets.map(s => {
                      const item = items.find(i => i.id === s.itemId);
                      return (
                          <div key={s.id} onClick={() => openDetail(s)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-cyan-200 transition-all cursor-pointer group relative overflow-hidden">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <span className="text-[9px] font-black uppercase tracking-widest text-cyan-500">{s.type}</span>
                                      <h3 className="font-black text-lg text-slate-800 group-hover:text-cyan-600 transition-colors line-clamp-1">{item?.name || 'Inconnu'}</h3>
                                  </div>
                                  {s.status === 'DRAFT' && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-1 rounded uppercase">Brouillon</span>}
                              </div>
                              <p className="text-xs text-slate-500 font-medium mb-3">{s.region} {s.country ? `• ${s.country}` : ''}</p>
                              <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{s.description}</p>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  }

  if (viewMode === 'CREATE') {
      return (
          <div className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                  <h2 className="font-black text-xl text-slate-800 uppercase tracking-tight">Nouvelle Fiche</h2>
                  <button onClick={() => setViewMode('LIST')} className="text-slate-400 font-bold text-xs uppercase">Annuler</button>
              </div>
              <div className="p-8 space-y-6">
                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit Stock</label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                          <option value="">Sélectionner...</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                  </div>
                  <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={sheetType} onChange={e => setSheetType(e.target.value)}>
                              <option value="WINE">Vin</option>
                              <option value="SPIRIT">Spiritueux</option>
                              <option value="BEER">Bière</option>
                              <option value="COCKTAIL">Cocktail</option>
                          </select>
                      </div>
                      <button onClick={handleAI} disabled={!selectedItemId || isGenerating} className="bg-cyan-500 text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-cyan-600 shadow-lg disabled:opacity-50 mt-6">
                          {isGenerating ? '...' : '✨ IA Auto-Fill'}
                      </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <input className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none" placeholder="Région" value={region} onChange={e => setRegion(e.target.value)} />
                      <input className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none" placeholder="Pays" value={country} onChange={e => setCountry(e.target.value)} />
                  </div>
                  <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none h-24" placeholder="Description courte et vendeuse..." value={desc} onChange={e => setDesc(e.target.value)} />
                  
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dégustation</p>
                      <input className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none" placeholder="Oeil (Robe)" value={tasting.eye} onChange={e => setTasting({...tasting, eye: e.target.value})} />
                      <input className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none" placeholder="Nez (Arômes)" value={tasting.nose} onChange={e => setTasting({...tasting, nose: e.target.value})} />
                      <input className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none" placeholder="Bouche (Saveurs)" value={tasting.mouth} onChange={e => setTasting({...tasting, mouth: e.target.value})} />
                  </div>

                  <button onClick={handleSave} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl">Enregistrer</button>
              </div>
          </div>
      );
  }

  if (viewMode === 'DETAIL' && selectedSheet) {
      const notes = getTastingObj(selectedSheet.tastingNotes);
      return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-slate-900 text-white p-8 flex justify-between items-start">
                      <div>
                          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded text-white mb-2 inline-block">{selectedSheet.type}</span>
                          <h2 className="text-3xl font-black uppercase tracking-tighter">{linkedItem?.name}</h2>
                          <p className="text-cyan-300 font-bold mt-1 text-sm">{selectedSheet.region} {selectedSheet.country ? `• ${selectedSheet.country}` : ''}</p>
                      </div>
                      <button onClick={() => setViewMode('LIST')} className="text-white/50 hover:text-white"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-8 space-y-8">
                      <p className="text-lg text-slate-700 font-medium leading-relaxed">{selectedSheet.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                              <h3 className="font-black text-sm uppercase text-slate-800 tracking-widest border-b pb-2">Dégustation</h3>
                              {notes.eye && <div className="flex gap-2"><span className="font-bold text-slate-400 w-16">Oeil</span><span className="text-slate-800">{notes.eye}</span></div>}
                              {notes.nose && <div className="flex gap-2"><span className="font-bold text-slate-400 w-16">Nez</span><span className="text-slate-800">{notes.nose}</span></div>}
                              {notes.mouth && <div className="flex gap-2"><span className="font-bold text-slate-400 w-16">Bouche</span><span className="text-slate-800">{notes.mouth}</span></div>}
                          </div>
                          
                          <div className="space-y-6">
                              {selectedSheet.foodPairing && (
                                  <div>
                                      <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-1">Accords Mets</h3>
                                      <p className="font-bold text-slate-800">{selectedSheet.foodPairing}</p>
                                  </div>
                              )}
                              {selectedSheet.servingTemp && (
                                  <div>
                                      <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-1">Service</h3>
                                      <p className="font-bold text-slate-800">{selectedSheet.servingTemp}</p>
                                  </div>
                              )}
                              {/* MAP PLACEHOLDER */}
                              {(selectedSheet.type === 'WINE' || selectedSheet.type === 'SPIRIT') && (
                                  <div className="h-32 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
                                      <p className="text-xs font-bold text-slate-400 uppercase">Carte : {selectedSheet.region}</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return null;
};

export default ProductKnowledge;
