
import React, { useState, useMemo, useEffect } from 'react';
import { Task, Event, EventComment, User, StockItem, DailyCocktail, DailyCocktailType, Recipe, EventProduct, StockLevel, PendingOrder, Glassware, EventGlasswareNeed, CycleConfig, CycleFrequency, AppConfig } from '../types';

interface DailyLifeProps {
  tasks: Task[];
  events: Event[];
  eventComments: EventComment[];
  currentUser: User;
  items: StockItem[];
  onSync: (action: string, payload: any) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  setEventComments: React.Dispatch<React.SetStateAction<EventComment[]>>;
  dailyCocktails?: DailyCocktail[];
  setDailyCocktails?: React.Dispatch<React.SetStateAction<DailyCocktail[]>>;
  recipes?: Recipe[];
  onCreateTemporaryItem?: (name: string, quantity: number) => void;
  stockLevels?: StockLevel[];
  orders?: PendingOrder[];
  glassware?: Glassware[];
  appConfig?: AppConfig;
  saveConfig?: (key: string, value: any) => void;
}

const DailyLife: React.FC<DailyLifeProps> = ({ 
    tasks, events, eventComments, currentUser, items, onSync, setTasks, setEvents, setEventComments, 
    dailyCocktails = [], setDailyCocktails, recipes = [], onCreateTemporaryItem, stockLevels = [], orders = [], glassware = [],
    appConfig, saveConfig
}) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'CALENDAR' | 'COCKTAILS'>('TASKS');
  
  // Tasks State
  const [newTaskContent, setNewTaskContent] = useState('');
  
  // Events State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventGuests, setNewEventGuests] = useState<string>('0');
  const [newEventDesc, setNewEventDesc] = useState('');
  
  // New Product Selection State (Array of {itemId, quantity})
  const [newEventProducts, setNewEventProducts] = useState<EventProduct[]>([]); 
  const [productSearch, setProductSearch] = useState('');
  const [productQtyInput, setProductQtyInput] = useState<string>('1');
  const [isTempProductMode, setIsTempProductMode] = useState(false);
  const [tempProductName, setTempProductName] = useState('');

  // Event Glassware State
  const [newEventGlassware, setNewEventGlassware] = useState<EventGlasswareNeed[]>([]);
  const [glasswareQtyInput, setGlasswareQtyInput] = useState<string>('1');
  const [selectedGlasswareId, setSelectedGlasswareId] = useState('');

  const [newComment, setNewComment] = useState('');

  // Daily Cocktails State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Cycle Generator State (Redesigned)
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [cycleType, setCycleType] = useState<DailyCocktailType>('OF_THE_DAY');
  const [cycleFrequency, setCycleFrequency] = useState<CycleFrequency>('DAILY');
  const [cycleRecipes, setCycleRecipes] = useState<string[]>([]); // Ordered IDs
  const [cycleStartDate, setCycleStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cycleIsActive, setCycleIsActive] = useState(false);

  // Helper for cleaner number inputs
  const cleanNumberInput = (val: string, setFn: (v: string) => void) => {
      if (val === '') setFn('');
      else if (/^\d+$/.test(val)) {
          if (val.length > 1 && val.startsWith('0')) setFn(val.substring(1));
          else setFn(val);
      }
  };

  // --- TASKS LOGIC ---
  const activeTasks = useMemo(() => tasks.filter(t => !t.isDone).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.isDone).sort((a,b) => new Date(b.doneAt!).getTime() - new Date(a.doneAt!).getTime()).slice(0, 20), [tasks]);

  const handleAddTask = () => {
      if (!newTaskContent.trim()) return;
      const task: Task = {
          id: 'task_' + Date.now(),
          content: newTaskContent,
          createdBy: currentUser.name,
          createdAt: new Date().toISOString(),
          isDone: false
      };
      setTasks(prev => [task, ...prev]);
      onSync('SAVE_TASK', task);
      setNewTaskContent('');
  };

  const handleToggleTask = (task: Task) => {
      const updated = {
          ...task,
          isDone: !task.isDone,
          doneBy: !task.isDone ? currentUser.name : undefined,
          doneAt: !task.isDone ? new Date().toISOString() : undefined
      };
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      onSync('SAVE_TASK', updated);
  };

  const handleDeleteTask = (id: string) => {
      if (currentUser.role !== 'ADMIN') return;
      if (window.confirm("Supprimer cette tâche ?")) {
          setTasks(prev => prev.filter(t => t.id !== id));
          onSync('DELETE_TASK', { id });
      }
  };

  // --- EVENTS LOGIC ---
  const sortedEvents = useMemo(() => events.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()), [events]);
  
  const handleCreateEvent = () => {
      if (!newEventTitle || !newEventStart || !newEventEnd) return;
      
      const evt: Event = {
          id: selectedEvent ? selectedEvent.id : 'evt_' + Date.now(),
          title: newEventTitle,
          startTime: new Date(newEventStart).toISOString(),
          endTime: new Date(newEventEnd).toISOString(),
          location: newEventLocation,
          guestsCount: parseInt(newEventGuests) || 0,
          description: newEventDesc,
          productsJson: JSON.stringify(newEventProducts),
          glasswareJson: JSON.stringify(newEventGlassware),
          createdAt: selectedEvent ? selectedEvent.createdAt : new Date().toISOString()
      };

      if (selectedEvent) {
          setEvents(prev => prev.map(e => e.id === evt.id ? evt : e));
      } else {
          setEvents(prev => [...prev, evt]);
      }
      onSync('SAVE_EVENT', evt);
      closeEventModal();
  };

  const handleDeleteEvent = () => {
      if (!selectedEvent || currentUser.role !== 'ADMIN') return;
      if (window.confirm("Supprimer cet événement ?")) {
          setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
          onSync('DELETE_EVENT', { id: selectedEvent.id });
          closeEventModal();
      }
  };

  const handleAddComment = () => {
      if (!selectedEvent || !newComment.trim()) return;
      const comment: EventComment = {
          id: 'com_' + Date.now(),
          eventId: selectedEvent.id,
          userName: currentUser.name,
          content: newComment,
          createdAt: new Date().toISOString()
      };
      setEventComments(prev => [...prev, comment]);
      onSync('SAVE_EVENT_COMMENT', comment);
      setNewComment('');
  };

  const openEventModal = (evt?: Event) => {
      if (evt) {
          setSelectedEvent(evt);
          setNewEventTitle(evt.title);
          
          const start = new Date(evt.startTime);
          const end = new Date(evt.endTime);
          
          const toInputString = (d: Date) => {
              const pad = (n: number) => n < 10 ? '0'+n : n;
              return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          };

          setNewEventStart(toInputString(start)); 
          setNewEventEnd(toInputString(end));
          setNewEventLocation(evt.location || '');
          setNewEventGuests((evt.guestsCount || 0).toString());
          setNewEventDesc(evt.description || '');
          
          try { 
              const parsed = JSON.parse(evt.productsJson || '[]');
              if (parsed.length > 0 && typeof parsed[0] === 'string') {
                  setNewEventProducts(parsed.map((id: string) => ({ itemId: id, quantity: 1 })));
              } else {
                  setNewEventProducts(parsed); 
              }
          } catch(e) { setNewEventProducts([]); }

          try {
              setNewEventGlassware(JSON.parse(evt.glasswareJson || '[]'));
          } catch(e) { setNewEventGlassware([]); }

      } else {
          setSelectedEvent(null);
          setNewEventTitle('');
          setNewEventStart('');
          setNewEventEnd('');
          setNewEventLocation('');
          setNewEventGuests('0');
          setNewEventDesc('');
          setNewEventProducts([]);
          setNewEventGlassware([]);
      }
      setProductSearch('');
      setProductQtyInput('1');
      setGlasswareQtyInput('1');
      setSelectedGlasswareId('');
      setIsTempProductMode(false);
      setIsEventModalOpen(true);
  };

  const closeEventModal = () => {
      setIsEventModalOpen(false);
      setSelectedEvent(null);
  };

  const handleAddProductToEvent = () => {
      const qty = parseInt(productQtyInput) || 1;
      if (isTempProductMode) {
          if (!tempProductName || !onCreateTemporaryItem) return;
          if (window.confirm(`Créer le produit temporaire "${tempProductName}" ?`)) {
              onCreateTemporaryItem(tempProductName, 0); 
              alert("Produit créé. Vous pouvez maintenant le rechercher et l'ajouter.");
              setIsTempProductMode(false);
              setTempProductName('');
              setProductSearch(tempProductName); 
          }
      } else {
          const item = items.find(i => i.name.toLowerCase() === productSearch.toLowerCase());
          if (item) {
              setNewEventProducts(prev => {
                  const existing = prev.find(p => p.itemId === item.id);
                  if (existing) {
                      return prev.map(p => p.itemId === item.id ? { ...p, quantity: p.quantity + qty } : p);
                  }
                  return [...prev, { itemId: item.id, quantity: qty }];
              });
              setProductSearch('');
              setProductQtyInput('1');
          }
      }
  };

  const removeProductFromEvent = (itemId: string) => {
      setNewEventProducts(prev => prev.filter(p => p.itemId !== itemId));
  };

  const handleAddGlasswareToEvent = () => {
      if (!selectedGlasswareId) return;
      const qty = parseInt(glasswareQtyInput) || 1;
      setNewEventGlassware(prev => {
          const existing = prev.find(g => g.glasswareId === selectedGlasswareId);
          if (existing) return prev.map(g => g.glasswareId === selectedGlasswareId ? { ...g, quantity: g.quantity + qty } : g);
          return [...prev, { glasswareId: selectedGlasswareId, quantity: qty }];
      });
      setSelectedGlasswareId('');
      setGlasswareQtyInput('1');
  };

  const removeGlasswareFromEvent = (gId: string) => {
      setNewEventGlassware(prev => prev.filter(g => g.glasswareId !== gId));
  };

  const getEventStatus = (evt: Event) => {
      let products: EventProduct[] = [];
      try { products = JSON.parse(evt.productsJson || '[]'); } catch(e) {}
      if (products.length === 0) return null;

      const isOrdered = products.every(p => {
          return orders.some(o => o.itemId === p.itemId && (o.status === 'ORDERED' || o.status === 'RECEIVED'));
      });

      const isStockOK = products.every(p => {
          const s0Level = stockLevels.find(l => l.itemId === p.itemId && l.storageId === 's0')?.currentQuantity || 0;
          return s0Level >= p.quantity;
      });

      return { isOrdered, isStockOK };
  };

  // ... (Cycles logic identical to previous version) ...
  const getCycleConfig = (type: DailyCocktailType): CycleConfig => {
      if (!appConfig) return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
      const configStr = appConfig[`cycle_${type}`];
      if (configStr) { try { return JSON.parse(configStr); } catch(e) { console.error('Parse cycle config error', e); } }
      return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
  };

  const getCalculatedCocktail = (dateStr: string, type: DailyCocktailType): DailyCocktail | undefined => {
      const manualEntry = dailyCocktails.find(c => c.date === dateStr && c.type === type);
      if (manualEntry) return manualEntry;
      const config = getCycleConfig(type);
      if (!config.isActive || config.recipeIds.length === 0) return undefined;
      const targetDate = new Date(dateStr);
      const startDate = new Date(config.startDate);
      targetDate.setHours(0,0,0,0);
      startDate.setHours(0,0,0,0);
      const diffTime = targetDate.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return undefined;
      let index = 0;
      const listLen = config.recipeIds.length;
      if (config.frequency === 'DAILY') { index = diffDays % listLen; } 
      else if (config.frequency === '2_DAYS') { index = Math.floor(diffDays / 2) % listLen; } 
      else if (config.frequency === 'WEEKLY') { index = Math.floor(diffDays / 7) % listLen; } 
      else if (config.frequency === '2_WEEKS') { index = Math.floor(diffDays / 14) % listLen; } 
      else if (config.frequency === 'MON_FRI') {
          const weeksPassed = Math.floor(diffDays / 7);
          const dayOfCurrentWeek = (diffDays % 7 + startDate.getDay()) % 7; 
          const isSecondSlot = (dayOfCurrentWeek === 5 || dayOfCurrentWeek === 6 || dayOfCurrentWeek === 0);
          const totalSlotsPassed = weeksPassed * 2 + (isSecondSlot ? 1 : 0);
          index = totalSlotsPassed % listLen;
      }
      return { id: `calc-${dateStr}-${type}`, date: dateStr, type, recipeId: config.recipeIds[index] };
  };

  const openCycleModal = (type: DailyCocktailType) => {
      if (currentUser.role !== 'ADMIN') { alert("Seul l'administrateur peut modifier la programmation."); return; }
      setCycleType(type);
      const conf = getCycleConfig(type);
      setCycleFrequency(conf.frequency);
      setCycleRecipes(conf.recipeIds);
      setCycleStartDate(conf.startDate.split('T')[0]);
      setCycleIsActive(conf.isActive);
      setIsCycleModalOpen(true);
  };

  const handleSaveCycle = () => {
      if (!saveConfig) return;
      const config: CycleConfig = { frequency: cycleFrequency, recipeIds: cycleRecipes, startDate: new Date(cycleStartDate).toISOString(), isActive: cycleIsActive };
      saveConfig(`cycle_${cycleType}`, config);
      setIsCycleModalOpen(false);
  };

  const toggleCycleRecipe = (rId: string) => {
      setCycleRecipes(prev => { if (prev.includes(rId)) return prev.filter(id => id !== rId); return [...prev, rId]; });
  };

  const moveCycleRecipe = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === cycleRecipes.length - 1) return;
      const newArr = [...cycleRecipes];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newArr[index], newArr[swapIndex]] = [newArr[swapIndex], newArr[index]];
      setCycleRecipes(newArr);
  };

  const filteredRecipesForCycle = useMemo(() => {
      return recipes.filter(r => {
          if (cycleType === 'MOCKTAIL') return r.category === 'Mocktail';
          if (cycleType === 'THALASSO') return r.category === 'Thalasso' || r.category === 'Healthy'; 
          if (cycleType === 'OF_THE_DAY') return r.category !== 'Mocktail' && r.category !== 'Thalasso' && r.category !== 'Healthy';
          return true;
      });
  }, [recipes, cycleType]);

  const getCocktailForType = (type: DailyCocktailType) => getCalculatedCocktail(selectedDate, type);

  const handleUpdateCocktail = (type: DailyCocktailType, recipeId?: string, customName?: string, customDescription?: string) => {
      if (!setDailyCocktails) return;
      const existing = dailyCocktails.find(c => c.date === selectedDate && c.type === type);
      const id = existing ? existing.id : `dc_${selectedDate}_${type}_${Date.now()}`;
      const newCocktail: DailyCocktail = { id, date: selectedDate, type, recipeId: recipeId || undefined, customName: customName || undefined, customDescription: customDescription || undefined };
      setDailyCocktails(prev => {
          const idx = prev.findIndex(c => c.id === id);
          if (idx >= 0) { const copy = [...prev]; copy[idx] = newCocktail; return copy; }
          const idx2 = prev.findIndex(c => c.date === selectedDate && c.type === type);
          if (idx2 >= 0) { const copy = [...prev]; copy[idx2] = newCocktail; return copy; }
          return [...prev, newCocktail];
      });
      onSync('SAVE_DAILY_COCKTAIL', newCocktail);
  };

  const recentWelcomes = useMemo(() => {
      const welcomes = dailyCocktails.filter(c => c.type === 'WELCOME' && c.customName);
      welcomes.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const unique: DailyCocktail[] = [];
      const seen = new Set<string>();
      for (const w of welcomes) { if (w.customName && !seen.has(w.customName)) { seen.add(w.customName); unique.push(w); } }
      return unique.slice(0, 5);
  }, [dailyCocktails]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">
      {/* EVENT MODAL */}
      {isEventModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden relative">
                  {/* ... Header ... */}
                  <div className="flex justify-between items-center mb-6 shrink-0">
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedEvent ? 'Modifier Événement' : 'Nouvel Événement'}</h3>
                      <button onClick={closeEventModal} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                      {(currentUser.role === 'ADMIN' || !selectedEvent) ? (
                          <>
                            {/* ... Inputs ... */}
                            <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Ex: Soirée Jazz" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Début</label><input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-xs text-slate-900 outline-none" value={newEventStart} onChange={e => setNewEventStart(e.target.value)} /></div>
                                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fin</label><input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-xs text-slate-900 outline-none" value={newEventEnd} onChange={e => setNewEventEnd(e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lieu</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} placeholder="Bar" /></div>
                                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Invités (Est.)</label><input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none text-center" value={newEventGuests} onChange={e => cleanNumberInput(e.target.value, setNewEventGuests)} /></div>
                            </div>
                            <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-900 outline-none h-24 resize-none text-sm" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} placeholder="Détails, setup, notes..." maxLength={150} /></div>
                            
                            {/* PRODUCTS SECTION SAFEGUARDED */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produits à prévoir</label>
                                <div className="flex gap-2">
                                    {isTempProductMode ? (
                                        <input className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-2 text-xs font-bold outline-none text-amber-800 placeholder-amber-400" placeholder="Nom produit temporaire..." value={tempProductName} onChange={e => setTempProductName(e.target.value)} />
                                    ) : (
                                        <>
                                            <input list="event-items-list" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none" placeholder="Ajouter produit..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                                            <datalist id="event-items-list">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                                        </>
                                    )}
                                    <input type="number" min="1" className="w-16 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-center outline-none" value={productQtyInput} onChange={e => cleanNumberInput(e.target.value, setProductQtyInput)} />
                                    <button onClick={handleAddProductToEvent} className="bg-indigo-600 text-white px-3 rounded-xl font-black text-xs hover:bg-indigo-700 transition-colors">+</button>
                                </div>
                                <div className="flex justify-end"><button onClick={() => setIsTempProductMode(!isTempProductMode)} className="text-[9px] font-black text-amber-500 uppercase tracking-widest hover:underline">{isTempProductMode ? "Annuler Mode Temporaire" : "Créer produit temporaire"}</button></div>
                                <div className="flex flex-col gap-2 max-h-24 overflow-y-auto">
                                    {newEventProducts.map(p => {
                                        const item = items.find(i => i.id === p.itemId);
                                        return (
                                            <div key={p.itemId} className={`flex justify-between items-center px-3 py-2 rounded-lg border ${!item ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                                                <span className={`text-xs font-bold ${!item ? 'text-rose-600 italic' : 'text-slate-700'}`}>{item ? item.name : 'Produit Supprimé/Inconnu'}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-indigo-600">x{p.quantity}</span>
                                                    <button onClick={() => removeProductFromEvent(p.itemId)} className="text-rose-400 hover:text-rose-600 text-[10px] font-bold">X</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* GLASSWARE SECTION SAFEGUARDED */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Verrerie à prévoir</label>
                                <div className="flex gap-2">
                                    <select className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none" value={selectedGlasswareId} onChange={e => setSelectedGlasswareId(e.target.value)}>
                                        <option value="">Sélectionner verre...</option>
                                        {glassware.map(g => <option key={g.id} value={g.id}>{g.name} ({g.capacity}cl)</option>)}
                                    </select>
                                    <input type="number" min="1" className="w-16 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-center outline-none" value={glasswareQtyInput} onChange={e => cleanNumberInput(e.target.value, setGlasswareQtyInput)} />
                                    <button onClick={handleAddGlasswareToEvent} className="bg-cyan-600 text-white px-3 rounded-xl font-black text-xs hover:bg-cyan-700 transition-colors">+</button>
                                </div>
                                <div className="flex flex-col gap-2 max-h-24 overflow-y-auto">
                                    {newEventGlassware.map(g => {
                                        const glass = glassware.find(gl => gl.id === g.glasswareId);
                                        return (
                                            <div key={g.glasswareId} className="flex justify-between items-center bg-cyan-50 px-3 py-2 rounded-lg border border-cyan-100">
                                                <span className="text-xs font-bold text-cyan-900">{glass?.name || 'Verre Inconnu'}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-cyan-600">x{g.quantity}</span>
                                                    <button onClick={() => removeGlasswareFromEvent(g.glasswareId)} className="text-rose-400 hover:text-rose-600 text-[10px] font-bold">X</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                          </>
                      ) : (
                          // Read Only View Safe Guarded
                          <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600">
                              <p><strong>Titre:</strong> {selectedEvent.title}</p>
                              <p><strong>Date:</strong> {new Date(selectedEvent.startTime).toLocaleString()} - {new Date(selectedEvent.endTime).toLocaleTimeString()}</p>
                              <p><strong>Lieu:</strong> {selectedEvent.location}</p>
                              <p><strong>Desc:</strong> {selectedEvent.description}</p>
                              <p className="mt-2 font-bold">Produits:</p>
                              <ul className="list-disc pl-5 mb-2">
                                  {newEventProducts.map(p => {
                                      const item = items.find(i => i.id === p.itemId);
                                      return <li key={p.itemId} className={!item ? 'text-rose-500 italic' : ''}>{item ? item.name : 'Produit Supprimé'} (x{p.quantity})</li>
                                  })}
                              </ul>
                              <p className="font-bold">Verrerie:</p>
                              <ul className="list-disc pl-5">
                                  {newEventGlassware.map(g => {
                                      const glass = glassware.find(gl => gl.id === g.glasswareId);
                                      return <li key={g.glasswareId}>{glass?.name || 'Verre Inconnu'} (x{g.quantity})</li>
                                  })}
                              </ul>
                          </div>
                      )}

                      {/* Comments section */}
                      {selectedEvent && (
                          <div className="space-y-2 pt-4 border-t border-slate-100">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fil de discussion</label>
                              <div className="bg-slate-50 rounded-xl p-3 max-h-32 overflow-y-auto space-y-2">
                                  {eventComments.filter(c => c.eventId === selectedEvent.id).map(c => (
                                      <div key={c.id} className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                          <p className="text-[9px] font-black text-indigo-600">{c.userName} <span className="text-slate-300 font-normal">• {new Date(c.createdAt).toLocaleDateString()}</span></p>
                                          <p className="text-xs text-slate-700">{c.content}</p>
                                      </div>
                                  ))}
                                  {eventComments.filter(c => c.eventId === selectedEvent.id).length === 0 && <p className="text-[10px] text-slate-400 italic text-center">Aucun message.</p>}
                              </div>
                              <div className="flex gap-2">
                                  <input className="flex-1 bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none" placeholder="Ajouter une note..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
                                  <button onClick={handleAddComment} disabled={!newComment.trim()} className="bg-slate-200 text-slate-600 px-3 rounded-xl font-black text-xs hover:bg-indigo-100 hover:text-indigo-600 transition-colors">Envoyer</button>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 grid grid-cols-1 gap-3 shrink-0">
                      {(currentUser.role === 'ADMIN' || !selectedEvent) && (
                          <button onClick={handleCreateEvent} disabled={!newEventTitle || !newEventStart || !newEventEnd} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                              {selectedEvent ? 'Enregistrer Modifications' : 'Créer l\'événement'}
                          </button>
                      )}
                      {selectedEvent && currentUser.role === 'ADMIN' && (
                          <button onClick={handleDeleteEvent} className="w-full bg-white text-rose-500 border border-rose-100 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-50 transition-all">
                              Supprimer
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* TABS */}
      {/* ... (Tabs JSX unchanged) ... */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full md:w-fit mx-auto">
          <button onClick={() => setActiveTab('TASKS')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'TASKS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Tâches à faire</button>
          <button onClick={() => setActiveTab('CALENDAR')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'CALENDAR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Agenda Événements</button>
          <button onClick={() => setActiveTab('COCKTAILS')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'COCKTAILS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Carte du Moment</button>
      </div>

      {activeTab === 'COCKTAILS' && (
          // ... (Cocktails JSX unchanged) ...
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[600px] space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>Programmation Cocktails</h3>
                  <div className="flex gap-2"><input type="date" className="bg-slate-100 border-none rounded-xl px-4 py-2 font-bold text-slate-700 outline-none" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 relative group">
                      <button onClick={() => openCycleModal('OF_THE_DAY')} className="absolute top-4 right-4 bg-white p-2 rounded-lg text-slate-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Programmer le cycle"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg></button>
                      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-black">1</div><div><h4 className="font-black text-slate-800 uppercase tracking-tight">Cocktail du Jour</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto: {getCycleConfig('OF_THE_DAY').isActive ? 'OUI' : 'NON'}</p></div></div>
                      <select className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none" value={getCalculatedCocktail(selectedDate, 'OF_THE_DAY')?.recipeId || ''} onChange={(e) => handleUpdateCocktail('OF_THE_DAY', e.target.value)}><option value="">-- Sélectionner --</option>{recipes.filter(r => r.category !== 'Mocktail' && r.category !== 'Thalasso').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 relative group">
                      <button onClick={() => openCycleModal('MOCKTAIL')} className="absolute top-4 right-4 bg-white p-2 rounded-lg text-slate-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Programmer le cycle"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg></button>
                      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black">2</div><div><h4 className="font-black text-slate-800 uppercase tracking-tight">Mocktail du Jour</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto: {getCycleConfig('MOCKTAIL').isActive ? 'OUI' : 'NON'}</p></div></div>
                      <select className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none" value={getCalculatedCocktail(selectedDate, 'MOCKTAIL')?.recipeId || ''} onChange={(e) => handleUpdateCocktail('MOCKTAIL', e.target.value)}><option value="">-- Sélectionner --</option>{recipes.filter(r => r.category === 'Mocktail').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-black">3</div><div><h4 className="font-black text-slate-800 uppercase tracking-tight">Cocktail d'Accueil</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Création Libre</p></div></div>
                      <div className="space-y-2">
                          <input className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none" placeholder="Nom de la création..." value={getCocktailForType('WELCOME')?.customName || ''} onChange={(e) => handleUpdateCocktail('WELCOME', undefined, e.target.value, getCocktailForType('WELCOME')?.customDescription)} />
                          <input className="w-full p-3 rounded-xl border border-slate-200 bg-white font-medium text-xs outline-none" placeholder="Brève description / Ingrédients..." value={getCocktailForType('WELCOME')?.customDescription || ''} onChange={(e) => handleUpdateCocktail('WELCOME', undefined, getCocktailForType('WELCOME')?.customName, e.target.value)} />
                          {recentWelcomes.length > 0 && (<div className="pt-2"><p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Récents :</p><div className="flex flex-wrap gap-2">{recentWelcomes.map(h => (<button key={h.id} onClick={() => handleUpdateCocktail('WELCOME', undefined, h.customName, h.customDescription)} className="bg-white border border-indigo-100 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-indigo-50 transition-colors">{h.customName}</button>))}</div></div>)}
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 relative group">
                      <button onClick={() => openCycleModal('THALASSO')} className="absolute top-4 right-4 bg-white p-2 rounded-lg text-slate-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Programmer le cycle"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg></button>
                      <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center text-white font-black">4</div><div><h4 className="font-black text-slate-800 uppercase tracking-tight">Cocktail Thalasso</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto: {getCycleConfig('THALASSO').isActive ? 'OUI' : 'NON'}</p></div></div>
                      <select className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none" value={getCalculatedCocktail(selectedDate, 'THALASSO')?.recipeId || ''} onChange={(e) => handleUpdateCocktail('THALASSO', e.target.value)}><option value="">-- Sélectionner --</option>{recipes.filter(r => r.category === 'Thalasso' || r.category === 'Healthy').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'TASKS' && (
          // ... (Tasks JSX unchanged) ...
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>En cours ({activeTasks.length})</h3>
                  <div className="flex gap-2 mb-4">
                      <input type="text" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Nouvelle tâche..." value={newTaskContent} onChange={e => setNewTaskContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
                      <button onClick={handleAddTask} disabled={!newTaskContent.trim()} className="bg-indigo-600 text-white px-4 rounded-xl font-black text-xs uppercase hover:bg-indigo-700 disabled:opacity-50">+</button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                      {activeTasks.map(task => (
                          <div key={task.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3 group">
                              <button onClick={() => handleToggleTask(task)} className="mt-1 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"></button>
                              <div className="flex-1"><p className="font-bold text-slate-800 text-sm">{task.content}</p><p className="text-[9px] font-bold text-slate-400 mt-1">Ajouté par {task.createdBy} • {new Date(task.createdAt).toLocaleDateString()}</p></div>
                              {currentUser.role === 'ADMIN' && (<button onClick={() => handleDeleteTask(task.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>)}
                          </div>
                      ))}
                      {activeTasks.length === 0 && <p className="text-center text-slate-400 italic text-xs py-10">Rien à faire pour le moment !</p>}
                  </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner flex flex-col h-[600px]">
                  <h3 className="font-black text-slate-500 uppercase tracking-tight mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>Terminées Récemment</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                      {doneTasks.map(task => (
                          <div key={task.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-start gap-3 opacity-60 hover:opacity-100 transition-opacity">
                              <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                              <div className="flex-1"><p className="font-bold text-slate-600 text-sm line-through">{task.content}</p><p className="text-[9px] font-bold text-slate-400 mt-1">Fait par {task.doneBy} le {new Date(task.doneAt!).toLocaleDateString()}</p></div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* CALENDAR VIEW */}
      {activeTab === 'CALENDAR' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[600px]">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                      Prochains Événements
                  </h3>
                  {currentUser.role === 'ADMIN' && (
                      <button onClick={() => openEventModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg">+ Créer</button>
                  )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedEvents.map(evt => {
                      const start = new Date(evt.startTime);
                      const isToday = new Date().toDateString() === start.toDateString();
                      const status = getEventStatus(evt);

                      return (
                          <div key={evt.id} onClick={() => openEventModal(evt)} className={`p-6 rounded-3xl border cursor-pointer hover:shadow-md transition-all group relative overflow-hidden ${isToday ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                              {isToday && <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">Aujourd'hui</div>}
                              
                              <div className="mb-4">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                  <h4 className="font-black text-lg text-slate-900 leading-tight mb-2">{evt.title}</h4>
                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                      {start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(evt.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                  </div>
                              </div>
                              
                              <div className="flex gap-2 mb-3">
                                  {status?.isOrdered && (
                                      <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Commandé
                                      </span>
                                  )}
                                  {status?.isStockOK && (
                                      <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Stock OK
                                      </span>
                                  )}
                              </div>

                              <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                      {evt.location || 'Bar'}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                      {evt.guestsCount || '?'} pers.
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}
    </div>
  );
};

export default DailyLife;
