
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
  initialTab?: string;
}

const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const DailyLife: React.FC<DailyLifeProps> = ({ 
    tasks, events, eventComments, currentUser, items, onSync, setTasks, setEvents, setEventComments, 
    dailyCocktails = [], setDailyCocktails, recipes = [], onCreateTemporaryItem, stockLevels = [], orders = [], glassware = [],
    appConfig, saveConfig, initialTab
}) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'CALENDAR' | 'COCKTAILS'>('TASKS');
  
  useEffect(() => {
      if (initialTab && (initialTab === 'TASKS' || initialTab === 'CALENDAR' || initialTab === 'COCKTAILS')) {
          setActiveTab(initialTab);
      }
  }, [initialTab]);

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
  const [recipeToAddId, setRecipeToAddId] = useState<string>(''); // For the dropdown in modal

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
          const item = items.find(i => normalizeText(i.name) === normalizeText(productSearch));
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

  // ... (Cycles logic FIX) ...
  const getCycleConfig = (type: DailyCocktailType): CycleConfig => {
      if (!appConfig) return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
      const configStr = appConfig[`cycle_${type}`];
      if (configStr) { try { return JSON.parse(configStr); } catch(e) { console.error('Parse cycle config error', e); } }
      return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
  };

  // Helper pour calculer la différence de jours calendaires strictes (Ignore UTC/Fuseau)
  const getDayDiff = (d1Str: string, d2Str: string) => {
      // Format attendu: YYYY-MM-DD (partie gauche de l'ISO)
      const parseDate = (str: string) => {
          // On coupe au 'T' si présent pour ne garder que la date
          const cleanStr = str.split('T')[0];
          const [y, m, d] = cleanStr.split('-').map(Number);
          // On utilise UTC pour éviter tout décalage d'heure d'été/hiver
          return Date.UTC(y, m - 1, d);
      };

      const t1 = parseDate(d1Str);
      const t2 = parseDate(d2Str);
      
      const msPerDay = 1000 * 60 * 60 * 24;
      return Math.floor((t1 - t2) / msPerDay);
  };

  const getCalculatedCocktail = (dateStr: string, type: DailyCocktailType): DailyCocktail | undefined => {
      // 1. Vérifier si une entrée manuelle existe (priorité absolue)
      const manualEntry = dailyCocktails.find(c => c.date === dateStr && c.type === type);
      if (manualEntry) return manualEntry;

      // 2. Récupérer la config
      const config = getCycleConfig(type);
      if (!config.isActive || config.recipeIds.length === 0) return undefined;

      // 3. Calculer l'index via différence de jours STRICTE
      const diffDays = getDayDiff(dateStr, config.startDate);
      
      if (diffDays < 0) return undefined; // Cycle hasn't started yet

      let index = 0;
      const listLen = config.recipeIds.length;
      
      // Récupération jour semaine pour MON_FRI
      // On re-parse la date cible en UTC pour avoir le bon jour de semaine (0=Dimanche, 1=Lundi...)
      const cleanTargetDate = dateStr.split('T')[0];
      const [y, m, d] = cleanTargetDate.split('-').map(Number);
      const targetDayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

      if (config.frequency === 'DAILY') { index = diffDays % listLen; } 
      else if (config.frequency === '2_DAYS') { index = Math.floor(diffDays / 2) % listLen; } 
      else if (config.frequency === 'WEEKLY') { index = Math.floor(diffDays / 7) % listLen; } 
      else if (config.frequency === '2_WEEKS') { index = Math.floor(diffDays / 14) % listLen; } 
      else if (config.frequency === 'MON_FRI') {
          // Logique pour saut de weekend (Lundi -> Vendredi seulement ?)
          // Ici on suppose un cycle simple : 
          // Semaine 1 : Recette A (Lun-Jeu), Recette B (Ven-Dim) ?
          // Ou juste index basé sur les semaines.
          // Pour faire simple et robuste : On utilise la logique temporelle simple du modulo
          // "Changement Lundi et Vendredi" -> 2 slots par semaine
          
          const weeksPassed = Math.floor(diffDays / 7);
          // Si on est Vendredi(5), Samedi(6) ou Dimanche(0), on est dans le 2ème slot de la semaine
          const isSecondSlot = (targetDayOfWeek === 5 || targetDayOfWeek === 6 || targetDayOfWeek === 0);
          
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
      
      // On s'assure d'afficher la date YYYY-MM-DD propre dans l'input
      const cleanStartDate = conf.startDate.split('T')[0];
      setCycleStartDate(cleanStartDate);
      
      setCycleIsActive(conf.isActive);
      setRecipeToAddId('');
      setIsCycleModalOpen(true);
  };

  const handleSaveCycle = () => {
      if (!saveConfig) return;
      
      // On sauvegarde juste la date YYYY-MM-DD.
      // Le système de calcul utilisera cette chaine directement.
      const config: CycleConfig = { 
          frequency: cycleFrequency, 
          recipeIds: cycleRecipes, 
          startDate: cycleStartDate, // Format YYYY-MM-DD direct
          isActive: cycleIsActive 
      };
      saveConfig(`cycle_${cycleType}`, config);
      setIsCycleModalOpen(false);
  };

  const addRecipeToCycle = () => {
      if (!recipeToAddId) return;
      if (!cycleRecipes.includes(recipeToAddId)) {
          setCycleRecipes([...cycleRecipes, recipeToAddId]);
      }
      setRecipeToAddId('');
  };

  const removeRecipeFromCycle = (index: number) => {
      const newArr = [...cycleRecipes];
      newArr.splice(index, 1);
      setCycleRecipes(newArr);
  };

  const moveCycleRecipe = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === cycleRecipes.length - 1) return;
      const newArr = [...cycleRecipes];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newArr[index], newArr[swapIndex]] = [newArr[swapIndex], newArr[index]];
      setCycleRecipes(newArr);
  };

  // Liste des recettes éligibles pour le cycle (filtrée par catégorie configurée)
  const filteredRecipesForCycle = useMemo(() => {
      // Logic with Config Mapping
      const allowedCategories = appConfig?.programMapping?.[cycleType] || [];
      
      if (allowedCategories.length > 0) {
          return recipes.filter(r => allowedCategories.includes(r.category));
      }

      // Fallback Legacy Logic
      return recipes.filter(r => {
          if (cycleType === 'MOCKTAIL') return r.category === 'Mocktail' || r.category === 'Mocktails du moment';
          if (cycleType === 'THALASSO') return r.category === 'Thalasso' || r.category === 'Healthy';
          if (cycleType === 'WELCOME') return r.category === 'Accueil' || r.category.toLowerCase().includes('accueil'); 
          if (cycleType === 'OF_THE_DAY') {
              const cat = r.category.toLowerCase();
              return !cat.includes('mocktail') && !cat.includes('thalasso') && !cat.includes('healthy') && !cat.includes('accueil');
          }
          return true;
      });
  }, [recipes, cycleType, appConfig]);

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

  // Calcul de l'historique des cocktails d'accueil pour la date sélectionnée (7 jours précédents)
  const previousWelcomeCocktails = useMemo(() => {
      // On filtre pour ne garder que les cocktails d'accueil AVANT la date sélectionnée
      return dailyCocktails
          .filter(c => c.type === 'WELCOME' && c.date < selectedDate && c.customName)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 7);
  }, [dailyCocktails, selectedDate]);

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
                                            <div key={p.itemId} className="flex justify-between items-center px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                                                <span className="text-xs font-bold text-slate-700">{item?.name || 'Inconnu'}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black">{p.quantity}</span>
                                                    <button onClick={() => removeProductFromEvent(p.itemId)} className="text-rose-400 hover:text-rose-600 font-bold">x</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* GLASSWARE SECTION */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Verrerie à prévoir</label>
                                <div className="flex gap-2">
                                    <select className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none" value={selectedGlasswareId} onChange={e => setSelectedGlasswareId(e.target.value)}>
                                        <option value="">Choisir verre...</option>
                                        {glassware.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                    <input type="number" min="1" className="w-16 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-center outline-none" value={glasswareQtyInput} onChange={e => cleanNumberInput(e.target.value, setGlasswareQtyInput)} />
                                    <button onClick={handleAddGlasswareToEvent} className="bg-cyan-500 text-white px-3 rounded-xl font-black text-xs hover:bg-cyan-600 transition-colors">+</button>
                                </div>
                                <div className="flex flex-col gap-2 max-h-24 overflow-y-auto">
                                    {newEventGlassware.map(g => {
                                        const glass = glassware.find(gl => gl.id === g.glasswareId);
                                        return (
                                            <div key={g.glasswareId} className="flex justify-between items-center px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                                                <span className="text-xs font-bold text-slate-700">{glass?.name || 'Inconnu'}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black">{g.quantity}</span>
                                                    <button onClick={() => removeGlasswareFromEvent(g.glasswareId)} className="text-rose-400 hover:text-rose-600 font-bold">x</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                          </>
                      ) : (
                          <div className="space-y-4">
                              {/* Read-only view for non-admin */}
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date</p>
                                  <p className="font-bold text-slate-900">{new Date(newEventStart).toLocaleString()}</p>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</p>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{newEventDesc || '-'}</p>
                              </div>
                              {/* Comments Section */}
                              <div className="border-t border-slate-100 pt-4">
                                  <h4 className="font-bold text-sm mb-2">Commentaires</h4>
                                  <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                                      {eventComments.filter(c => c.eventId === selectedEvent.id).map(c => (
                                          <div key={c.id} className="bg-slate-50 p-2 rounded-lg text-xs">
                                              <span className="font-bold text-indigo-600">{c.userName}: </span>
                                              <span>{c.content}</span>
                                          </div>
                                      ))}
                                  </div>
                                  <div className="flex gap-2">
                                      <input className="flex-1 bg-slate-50 border rounded-lg p-2 text-xs" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ajouter une note..." />
                                      <button onClick={handleAddComment} className="bg-slate-900 text-white px-3 rounded-lg text-xs font-bold">Envoyer</button>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between gap-4 shrink-0">
                      {selectedEvent && currentUser.role === 'ADMIN' && (
                          <button onClick={handleDeleteEvent} className="px-4 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-xs uppercase hover:bg-rose-50">Supprimer</button>
                      )}
                      {(currentUser.role === 'ADMIN' || !selectedEvent) && (
                          <button onClick={handleCreateEvent} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-lg">{selectedEvent ? 'Mettre à jour' : 'Créer Événement'}</button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* TABS */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setActiveTab('TASKS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'TASKS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Tâches</button>
          <button onClick={() => setActiveTab('CALENDAR')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'CALENDAR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Agenda</button>
          <button onClick={() => setActiveTab('COCKTAILS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'COCKTAILS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Cocktails du Jour</button>
      </div>

      {activeTab === 'TASKS' && (
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-black text-sm uppercase mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>À faire</h3>
                  <div className="flex gap-2 mb-6">
                      <input className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={newTaskContent} onChange={e => setNewTaskContent(e.target.value)} placeholder="Nouvelle tâche..." onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
                      <button onClick={handleAddTask} className="bg-slate-900 text-white px-6 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800">Ajouter</button>
                  </div>
                  <div className="space-y-3">
                      {activeTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                              <button onClick={() => handleToggleTask(t)} className="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-emerald-500 transition-colors flex items-center justify-center"></button>
                              <div className="flex-1">
                                  <p className="font-bold text-slate-800 text-sm">{t.content}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Par {t.createdBy} • {new Date(t.createdAt).toLocaleDateString()}</p>
                              </div>
                              <button onClick={() => handleDeleteTask(t.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                      ))}
                      {activeTasks.length === 0 && <p className="text-center text-slate-400 italic text-xs">Rien à faire, profitez-en !</p>}
                  </div>
              </div>

              {doneTasks.length > 0 && (
                  <div className="opacity-60">
                      <h3 className="font-black text-xs uppercase mb-4 text-slate-400 ml-4">Terminées récemment</h3>
                      <div className="space-y-2">
                          {doneTasks.map(t => (
                              <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent">
                                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                                  <p className="font-medium text-slate-500 text-xs line-through flex-1">{t.content}</p>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase">{t.doneBy}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'CALENDAR' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>Événements à venir</h3>
                  <button onClick={() => openEventModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg">+ Créer</button>
              </div>
              <div className="space-y-4">
                  {sortedEvents.filter(e => new Date(e.endTime) >= new Date()).map(e => {
                      const status = getEventStatus(e);
                      return (
                          <div key={e.id} onClick={() => openEventModal(e)} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                              <div className="flex justify-between items-start">
                                  <div className="flex gap-4">
                                      <div className="bg-white rounded-xl p-3 text-center min-w-[60px] shadow-sm border border-slate-100">
                                          <span className="block text-xs font-black text-indigo-600 uppercase">{new Date(e.startTime).toLocaleString('fr-FR', {month:'short'})}</span>
                                          <span className="block text-2xl font-black text-slate-800">{new Date(e.startTime).getDate()}</span>
                                      </div>
                                      <div>
                                          <h4 className="font-black text-slate-800 text-base group-hover:text-indigo-700 transition-colors">{e.title}</h4>
                                          <div className="flex items-center gap-2 mt-1 text-xs font-bold text-slate-500">
                                              <span>{new Date(e.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(e.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                              <span>•</span>
                                              <span>{e.location}</span>
                                              {e.guestsCount ? <span>• {e.guestsCount} pers.</span> : null}
                                          </div>
                                          {status && (
                                              <div className="flex gap-2 mt-2">
                                                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${status.isOrdered ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{status.isOrdered ? 'Commandé' : 'À Commander'}</span>
                                                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${status.isStockOK ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{status.isStockOK ? 'Stock OK' : 'Stock Insuffisant'}</span>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                                  <div className="text-slate-300 group-hover:text-indigo-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></div>
                              </div>
                          </div>
                      );
                  })}
                  {sortedEvents.filter(e => new Date(e.endTime) >= new Date()).length === 0 && (
                      <p className="text-center text-slate-400 italic py-10">Aucun événement à venir.</p>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'COCKTAILS' && (
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-pink-500 rounded-full"></span>Cocktails du Jour</h3>
                  <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['OF_THE_DAY', 'MOCKTAIL', 'WELCOME', 'THALASSO'].map((typeStr) => {
                      const type = typeStr as DailyCocktailType;
                      const cocktail = getCocktailForType(type);
                      const recipe = recipes.find(r => r.id === cocktail?.recipeId);
                      const labels: Record<string, string> = { OF_THE_DAY: 'Cocktail du Jour', MOCKTAIL: 'Mocktail', WELCOME: 'Accueil', THALASSO: 'Thalasso' };
                      const config = getCycleConfig(type);
                      const isAutoCycle = config.isActive;
                      
                      return (
                          <div key={type} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full">
                              <div className="flex justify-between items-center mb-4">
                                  <div className="flex items-center gap-2">
                                      <h4 className="font-black text-slate-800 uppercase tracking-tight">{labels[type]}</h4>
                                      {isAutoCycle && <span title="Cycle Automatique Actif">🔄</span>}
                                  </div>
                                  <button onClick={() => openCycleModal(type)} className="text-[10px] font-black uppercase text-indigo-500 hover:underline">Programmation</button>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4 flex-1 relative">
                                  {cocktail ? (
                                      <>
                                          <p className="font-bold text-slate-900 text-lg mb-1">{cocktail.customName || recipe?.name || 'Non défini'}</p>
                                          <p className="text-xs text-slate-500 line-clamp-2">{cocktail.customDescription || recipe?.description || 'Pas de description'}</p>
                                      </>
                                  ) : <p className="text-slate-400 italic text-sm">Rien de prévu ce jour.</p>}
                                  {isAutoCycle && <div className="absolute top-2 right-2 text-indigo-200"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>}
                              </div>
                              
                              <div className="pt-4 border-t border-slate-100">
                                {type === 'WELCOME' ? (
                                    <div className="flex flex-col gap-3 w-full">
                                        <input 
                                            type="text"
                                            className={`w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-pink-100 ${isAutoCycle ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                            placeholder="Ingrédients du cocktail d'accueil..."
                                            value={cocktail?.customName || ''}
                                            onChange={e => !isAutoCycle && handleUpdateCocktail(type, undefined, e.target.value)}
                                            disabled={isAutoCycle}
                                        />
                                        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-50">
                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Historique (7 jours)</p>
                                            <div className="space-y-1">
                                                {previousWelcomeCocktails.map(h => (
                                                    <div key={h.id} className="flex justify-between text-[10px] items-center">
                                                        <span className="text-slate-400">{new Date(h.date).toLocaleDateString('fr-FR', {weekday:'short', day:'numeric'})}</span>
                                                        <span className="font-bold text-slate-700">{h.customName || 'Non défini'}</span>
                                                    </div>
                                                ))}
                                                {previousWelcomeCocktails.length === 0 && <span className="text-[10px] text-slate-400 italic">Aucun historique récent.</span>}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <select 
                                        className={`w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none cursor-pointer ${isAutoCycle ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                        value={cocktail?.recipeId || ''}
                                        onChange={e => handleUpdateCocktail(type, e.target.value)}
                                        disabled={isAutoCycle}
                                    >
                                        <option value="">-- Sélectionner Recette --</option>
                                        {filteredRecipesForCycle.filter(r => {
                                            if (type === 'MOCKTAIL') {
                                                const allowed = appConfig?.programMapping?.['MOCKTAIL'];
                                                if (allowed && allowed.length > 0) return allowed.includes(r.category);
                                            }
                                            if (type === 'THALASSO') {
                                                const allowed = appConfig?.programMapping?.['THALASSO'];
                                                if (allowed && allowed.length > 0) return allowed.includes(r.category);
                                            }
                                            if (type === 'OF_THE_DAY') {
                                                const allowed = appConfig?.programMapping?.['OF_THE_DAY'];
                                                if (allowed && allowed.length > 0) return allowed.includes(r.category);
                                            }
                                            return true; 
                                        }).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* CYCLE MODAL */}
      {isCycleModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4 flex-shrink-0">Programmation Cycle</h3>
                  
                  <div className="overflow-y-auto pr-2 space-y-6 flex-1">
                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                              <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fréquence changement</label>
                                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={cycleFrequency} onChange={e => setCycleFrequency(e.target.value as CycleFrequency)}>
                                      <option value="DAILY">Tous les jours</option>
                                      <option value="2_DAYS">Tous les 2 jours</option>
                                      <option value="MON_FRI">Lun/Ven (Changement Lundi et Vendredi)</option>
                                      <option value="WEEKLY">Hebdomadaire (Tous les 7 jours)</option>
                                      <option value="2_WEEKS">Quinzaine (Tous les 14 jours)</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de début (Référence)</label>
                                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={cycleStartDate} onChange={e => setCycleStartDate(e.target.value)} />
                              </div>
                              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={cycleIsActive} onChange={e => setCycleIsActive(e.target.checked)} />
                                      <span className="font-bold text-sm text-indigo-900">Activer le cycle automatique</span>
                                  </label>
                                  <p className="text-[10px] text-indigo-600 mt-1 leading-tight">Ceci désactivera la sélection manuelle sur le tableau de bord pour ce créneau.</p>
                              </div>
                          </div>

                          <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Ajouter une Recette</label>
                              <div className="flex gap-2">
                                  <select 
                                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                                      value={recipeToAddId}
                                      onChange={(e) => setRecipeToAddId(e.target.value)}
                                  >
                                      <option value="">-- Choisir --</option>
                                      {filteredRecipesForCycle.map(r => (
                                          <option key={r.id} value={r.id} disabled={cycleRecipes.includes(r.id)}>{r.name}</option>
                                      ))}
                                  </select>
                                  <button onClick={addRecipeToCycle} disabled={!recipeToAddId} className="bg-indigo-600 text-white px-4 rounded-xl font-black text-xs hover:bg-indigo-700 disabled:opacity-50">+</button>
                              </div>
                              
                              <div className="mt-4">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Séquence du Cycle</label>
                                  <div className="bg-slate-50 rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto p-2 space-y-1">
                                      {cycleRecipes.map((id, index) => {
                                          const recipe = recipes.find(r => r.id === id);
                                          return (
                                              <div key={id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 group">
                                                  <div className="flex items-center gap-3">
                                                      <span className="text-[10px] font-black text-slate-300 w-4">{index + 1}</span>
                                                      <span className="text-xs font-bold text-slate-700">{recipe?.name || 'Recette Inconnue'}</span>
                                                  </div>
                                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button onClick={() => moveCycleRecipe(index, 'up')} disabled={index === 0} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30">▲</button>
                                                      <button onClick={() => moveCycleRecipe(index, 'down')} disabled={index === cycleRecipes.length - 1} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30">▼</button>
                                                      <button onClick={() => removeRecipeFromCycle(index)} className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-500">✕</button>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                      {cycleRecipes.length === 0 && <p className="text-center text-xs text-slate-400 py-4 italic">Aucune recette dans le cycle.</p>}
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-3 mt-6 flex-shrink-0">
                      <button onClick={() => setIsCycleModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-200">Annuler</button>
                      <button onClick={handleSaveCycle} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-lg">Enregistrer</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DailyLife;
