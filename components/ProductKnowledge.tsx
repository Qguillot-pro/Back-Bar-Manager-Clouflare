
import React, { useState, useMemo, useEffect } from 'react';
import { ProductSheet, StockItem, UserRole, ProductType } from '../types';
import { generateProductSheetWithAI } from '../services/geminiService';

interface ProductKnowledgeProps {
  sheets: ProductSheet[];
  items: StockItem[];
  currentUserRole: UserRole;
  onSync: (action: string, payload: any) => void;
  productTypes?: ProductType[];
}

const ProductKnowledge: React.FC<ProductKnowledgeProps> = ({ sheets, items, currentUserRole, onSync, productTypes = [] }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<ProductSheet | null>(null);
  const [search, setSearch] = useState('');
  
  // Create Form
  const [selectedItemId, setSelectedItemId] = useState('');
  const [fullName, setFullName] = useState('');
  const [sheetType, setSheetType] = useState('Autre');
  const [desc, setDesc] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [tasting, setTasting] = useState({ nose: '', mouth: '', eye: '' });
  const [pairing, setPairing] = useState('');
  const [temp, setTemp] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const linkedItem = items.find(i => i.id === selectedSheet?.itemId);

  const handleAI = async () => {
      const searchName = fullName || items.find(i => i.id === selectedItemId)?.name;
      if (!searchName) return;
      
      setIsGenerating(true);
      const result = await generateProductSheetWithAI(searchName, sheetType);
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
          fullName,
          type: sheetType,
          region,
          country,
          tastingNotes: JSON.stringify(tasting),
          customFields: JSON.stringify(customFields),
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
      setFullName('');
      setDesc('');
      setRegion('');
      setCountry('');
      setTasting({ nose: '', mouth: '', eye: '' });
      setPairing('');
      setTemp('');
      setCustomFields({});
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
      let res = sheets;
      if (search) {
          const term = search.toLowerCase();
          res = res.filter(s => {
              const item = items.find(i => i.id === s.itemId);
              return item?.name.toLowerCase().includes(term) || 
                     s.fullName?.toLowerCase().includes(term) ||
                     s.type.toLowerCase().includes(term) ||
                     s.region?.toLowerCase().includes(term);
          });
      } else if (selectedCategory) {
          res = res.filter(s => s.type === selectedCategory);
      }
      return res;
  }, [sheets, items, search, selectedCategory]);

  const activeTypes = useMemo(() => {
      return productTypes; 
  }, [productTypes]);

  const getTastingObj = (json?: string) => { try { return JSON.parse(json || '{}'); } catch { return {}; } };
  const getCustomFieldsObj = (json?: string) => { try { return JSON.parse(json || '{}'); } catch { return {}; } };
  const selectedTypeConfig = productTypes.find(pt => pt.name === sheetType);

  if (viewMode === 'LIST') {
      return (
          <div className="space-y-6 max-w-6xl mx-auto">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                      {selectedCategory && !search && (
                          <button onClick={() => setSelectedCategory(null)} className="mr-2 p-2 rounded-full bg-slate-100 hover:bg-slate-200">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                      )}
                      <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                          {selectedCategory && !search ? selectedCategory : 'Fiches Produits'}
                      </h2>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                      <input 
                        type="text" 
                        placeholder="Recherche rapide..." 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-cyan-100 flex-1 w-64"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      <button onClick={openCreate} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 shadow-lg">+ Créer</button>
                  </div>
              </div>

              {!search && !selectedCategory && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-2">
                      {activeTypes.map(pt => (
                          <div 
                            key={pt.id} 
                            onClick={() => setSelectedCategory(pt.name)}
                            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all cursor-pointer group flex flex-col items-center justify-center h-40 text-center gap-3"
                          >
                              <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <span className="text-xl">🍷</span>
                              </div>
                              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">{pt.name}</h3>
                              <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-full">{sheets.filter(s => s.type === pt.name).length} Fiches</span>
                          </div>
                      ))}
                  </div>
              )}

              {(search || selectedCategory) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                      {filteredSheets.map(s => {
                          const item = items.find(i => i.id === s.itemId);
                          return (
                              <div key={s.id} onClick={() => openDetail(s)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-cyan-200 transition-all cursor-pointer group relative overflow-hidden">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <span className="text-[9px] font-black uppercase tracking-widest text-cyan-500">{s.type}</span>
                                          <h3 className="font-black text-lg text-slate-800 group-hover:text-cyan-600 transition-colors line-clamp-1">{s.fullName || item?.name || 'Inconnu'}</h3>
                                          {s.fullName && item?.name && <p className="text-[10px] text-slate-400">Ref: {item.name}</p>}
                                      </div>
                                      {s.status === 'DRAFT' && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-1 rounded uppercase">Brouillon</span>}
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium mb-3">{s.region} {s.country ? `• ${s.country}` : ''}</p>
                                  <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{s.description}</p>
                              </div>
                          );
                      })}
                      {filteredSheets.length === 0 && <p className="col-span-full text-center text-slate-400 italic">Aucune fiche trouvée.</p>}
                  </div>
              )}
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
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit Stock (Référence)</label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                          <option value="">Sélectionner...</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet (Pour le client/recherche)</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" placeholder="Ex: Rhum Clément VSOP 40°..." value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  
                  <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={sheetType} onChange={e => setSheetType(e.target.value)}>
                              {productTypes.map(pt => <option key={pt.id} value={pt.name}>{pt.name}</option>)}
                              {productTypes.length === 0 && <option value="Autre">Autre</option>}
                          </select>
                      </div>
                      <button onClick={handleAI} disabled={!selectedItemId || isGenerating} className="bg-cyan-500 text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-cyan-600 shadow-lg disabled:opacity-50 mt-6">{isGenerating ? '...' : '✨ IA Auto-Fill'}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <input className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none" placeholder="Région" value={region} onChange={e => setRegion(e.target.value)} />
                      <input className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none" placeholder="Pays" value={country} onChange={e => setCountry(e.target.value)} />
                  </div>
                  
                  {selectedTypeConfig && selectedTypeConfig.fields.length > 0 && (
                      <div className="bg-indigo-50 p-4 rounded-xl space-y-3 border border-indigo-100">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Caractéristiques spécifiques ({sheetType})</p>
                          <div className="grid grid-cols-2 gap-4">
                              {selectedTypeConfig.fields.map(field => (
                                  <div key={field}><input className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-sm outline-none" placeholder={field} value={customFields[field] || ''} onChange={e => setCustomFields({...customFields, [field]: e.target.value})} /></div>
                              ))}
                          </div>
                      </div>
                  )}

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

  // --- DETAIL POPUP (Simplified) ---
  if (viewMode === 'DETAIL' && selectedSheet) {
      const notes = getTastingObj(selectedSheet.tastingNotes);
      const custom = getCustomFieldsObj(selectedSheet.customFields);
      
      return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-slate-900 text-white p-8 flex justify-between items-start">
                      <div>
                          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded text-white mb-2 inline-block">{selectedSheet.type}</span>
                          <h2 className="text-3xl font-black uppercase tracking-tighter">{selectedSheet.fullName || linkedItem?.name}</h2>
                          <p className="text-cyan-300 font-bold mt-1 text-sm">{selectedSheet.region} {selectedSheet.country ? `• ${selectedSheet.country}` : ''}</p>
                      </div>
                      <button onClick={() => setViewMode('LIST')} className="text-white/50 hover:text-white">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-8">
                      <p className="text-lg text-slate-700 font-medium leading-relaxed">{selectedSheet.description}</p>
                      {Object.keys(custom).length > 0 && (
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                              {Object.entries(custom).map(([key, val]) => (<div key={key}><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{key}</p><p className="font-bold text-slate-800">{val as string}</p></div>))}
                          </div>
                      )}
                      <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                          <h3 className="font-black text-sm uppercase text-slate-800 tracking-widest border-b pb-2">Dégustation</h3>
                          <div className="grid grid-cols-3 gap-4 text-center">
                              <div><span className="block font-black text-slate-400 text-xs uppercase mb-1">Oeil</span><span className="text-slate-800 font-bold text-sm">{notes.eye || '-'}</span></div>
                              <div><span className="block font-black text-slate-400 text-xs uppercase mb-1">Nez</span><span className="text-slate-800 font-bold text-sm">{notes.nose || '-'}</span></div>
                              <div><span className="block font-black text-slate-400 text-xs uppercase mb-1">Bouche</span><span className="text-slate-800 font-bold text-sm">{notes.mouth || '-'}</span></div>
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
