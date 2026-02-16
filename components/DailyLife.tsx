
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

const getBarDateStr = (d: Date = new Date()) => {
    const shift = new Date(d);
    if (shift.getHours() < 4) shift.setDate(shift.getDate() - 1);
    return shift.toISOString().split('T')[0];
};

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
  const [isRecurringTask, setIsRecurringTask] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  // Events State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventGuests, setNewEventGuests] = useState<string>('0');
  const [newEventDesc, setNewEventDesc] = useState('');
  
  const [newEventProducts, setNewEventProducts] = useState<EventProduct[]>([]); 
  const [productSearch, setProductSearch] = useState('');
  const [productQtyInput, setProductQtyInput] = useState<string>('1');
  const [isTempProductMode, setIsTempProductMode] = useState(false);
  const [tempProductName, setTempProductName] = useState('');

  const [newEventGlassware, setNewEventGlassware] = useState<EventGlasswareNeed[]>([]);
  const [glasswareQtyInput, setGlasswareQtyInput] = useState<string>('1');
  const [selectedGlasswareId, setSelectedGlasswareId] = useState('');

  const [selectedDate, setSelectedDate] = useState<string>(getBarDateStr());
  
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [cycleType, setCycleType] = useState<DailyCocktailType>('OF_THE_DAY');
  const [cycleFrequency, setCycleFrequency] = useState<CycleFrequency>('DAILY');
  const [cycleRecipes, setCycleRecipes] = useState<string[]>([]); 
  const [cycleStartDate, setCycleStartDate] = useState<string>(getBarDateStr());
  const [cycleIsActive, setCycleIsActive] = useState(false);
  const [recipeToAddId, setRecipeToAddId] = useState<string>(''); 

  const cleanNumberInput = (val: string, setFn: (v: string) => void) => {
      if (val === '') setFn('');
      else if (/^\d+$/.test(val)) {
          if (val.length > 1 && val.startsWith('0')) setFn(val.substring(1));
          else setFn(val);
      }
  };

  const openEventModal = (evt?: Event) => {
      if (evt) {
          setSelectedEvent(evt);
          setNewEventTitle(evt.title);
          setNewEventStart(evt.startTime.slice(0, 16));
          setNewEventEnd(evt.endTime.slice(0, 16));
          setNewEventLocation(evt.location || '');
          setNewEventGuests(evt.guestsCount?.toString() || '0');
          setNewEventDesc(evt.description || '');
          
          try { setNewEventProducts(JSON.parse(evt.productsJson || '[]')); } catch(e) { setNewEventProducts([]); }
          try { setNewEventGlassware(JSON.parse(evt.glasswareJson || '[]')); } catch(e) { setNewEventGlassware([]); }
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
      setIsEventModalOpen(true);
  };

  const closeEventModal = () => {
      setIsEventModalOpen(false);
      setSelectedEvent(null);
  };

  const getEventStatus = (evt: Event) => {
      if (!evt.productsJson) return null;
      try {
          const products: EventProduct[] = JSON.parse(evt.productsJson);
          if (products.length === 0) return null;

          // Check if ordered
          const isOrdered = products.every(p => {
              return orders.some(o => o.itemId === p.itemId && (o.status === 'PENDING' || o.status === 'ORDERED' || o.status === 'RECEIVED'));
          });

          // Check stock
          const isStockOK = products.every(p => {
              const totalStock = stockLevels
                  .filter(l => l.itemId === p.itemId)
                  .reduce((acc, curr) => acc + curr.currentQuantity, 0);
              return totalStock >= p.quantity;
          });

          return { isOrdered, isStockOK };
      } catch (e) { return null; }
  };

  // --- TASKS LOGIC ---
  const activeTasks = useMemo(() => {
      const today = new Date();
      const currentDay = today.getDay(); // 0=Sun, 1=Mon...
      
      return tasks.filter(t => {
          // Si c'est terminé et pas récurrent -> Historique (pas ici)
          if (t.isDone && (!t.recurrence || t.recurrence.length === 0)) return false;
          
          // Si récurrent
          if (t.recurrence && t.recurrence.length > 0) {
              // Si le jour ne correspond pas, on cache
              if (!t.recurrence.includes(currentDay)) return false;
              // Si c'est le bon jour, on affiche (même si c'est fait, on le verra coché pour aujourd'hui)
              // NOTE: Pour une vraie récurrence, on devrait réinitialiser isDone le lendemain. 
              // Ici on suppose que le backend ou une logique nocturne reset isDone, 
              // OU on affiche simplement l'état actuel.
              // Amélioration : Si "doneAt" date d'avant aujourd'hui 4h du mat, on considère comme non fait pour aujourd'hui.
              const doneDate = t.doneAt ? new Date(t.doneAt) : null;
              const startOfShift = new Date();
              if (startOfShift.getHours() < 4) startOfShift.setDate(startOfShift.getDate() - 1);
              startOfShift.setHours(4,0,0,0);
              
              // Si marqué fait AVANT le shift actuel, on le considère comme "à faire" visuellement
              if (doneDate && doneDate < startOfShift) {
                  // C'est un hack visuel, idéalement on update la DB
                  return true; 
              }
          }
          return true;
      }).sort((a,b) => {
          if (a.isDone === b.isDone) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return a.isDone ? 1 : -1;
      });
  }, [tasks]);

  const historyTasks = useMemo(() => {
      return tasks.filter(t => t.isDone).sort((a,b) => new Date(b.doneAt!).getTime() - new Date(a.doneAt!).getTime());
  }, [tasks]);

  const handleAddTask = () => {
      if (!newTaskContent.trim()) return;
      if (isRecurringTask && currentUser.role !== 'ADMIN') {
          alert("Seul l'administrateur peut créer des tâches récurrentes.");
          return;
      }

      const task: Task = {
          id: 'task_' + Date.now(),
          content: newTaskContent,
          createdBy: currentUser.name,
          createdAt: new Date().toISOString(),
          isDone: false,
          recurrence: isRecurringTask ? recurrenceDays : undefined
      };
      setTasks(prev => [task, ...prev]);
      onSync('SAVE_TASK', task);
      setNewTaskContent('');
      setIsRecurringTask(false);
      setRecurrenceDays([]);
  };

  const handleEditTaskContent = (task: Task, newContent: string) => {
      if (currentUser.role !== 'ADMIN') return;
      const updated = { ...task, content: newContent };
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      onSync('SAVE_TASK', updated);
      setEditingTaskId(null);
  };

  const toggleRecurrenceDay = (day: number) => {
      setRecurrenceDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleToggleTask = (task: Task) => {
      // Logic for recurring check: if it was "done" yesterday, clicking it now makes it "done today".
      // If it was "done" today, clicking it makes it "undone".
      
      const doneDate = task.doneAt ? new Date(task.doneAt) : null;
      const startOfShift = new Date();
      if (startOfShift.getHours() < 4) startOfShift.setDate(startOfShift.getDate() - 1);
      startOfShift.setHours(4,0,0,0);

      let newIsDone = !task.isDone;
      
      // Si récurrent et fait hier (donc visuellement "à faire"), on le passe à "fait aujourd'hui"
      if (task.recurrence && task.recurrence.length > 0 && doneDate && doneDate < startOfShift) {
          newIsDone = true;
      }

      const updated = {
          ...task,
          isDone: newIsDone,
          doneBy: newIsDone ? currentUser.name : undefined,
          doneAt: newIsDone ? new Date().toISOString() : undefined
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

  const handleAddEventProduct = () => {
      const item = items.find(i => normalizeText(i.name) === normalizeText(productSearch));
      if (item) {
          setNewEventProducts([...newEventProducts, { itemId: item.id, quantity: parseInt(productQtyInput) || 1 }]);
          setProductSearch('');
          setProductQtyInput('1');
      }
  };

  const handleRemoveEventProduct = (index: number) => {
      const copy = [...newEventProducts];
      copy.splice(index, 1);
      setNewEventProducts(copy);
  };

  const handleAddEventGlassware = () => {
      if (selectedGlasswareId) {
          setNewEventGlassware([...newEventGlassware, { glasswareId: selectedGlasswareId, quantity: parseInt(glasswareQtyInput) || 1 }]);
          setSelectedGlasswareId('');
          setGlasswareQtyInput('1');
      }
  };

  const handleRemoveEventGlassware = (index: number) => {
      const copy = [...newEventGlassware];
      copy.splice(index, 1);
      setNewEventGlassware(copy);
  };

  const handleCreateTempProduct = () => {
      if (tempProductName && onCreateTemporaryItem) {
          onCreateTemporaryItem(tempProductName, parseInt(productQtyInput) || 1);
          setTempProductName('');
          setIsTempProductMode(false);
          setProductSearch(tempProductName); 
      }
  };

  const getCycleConfig = (type: DailyCocktailType): CycleConfig => {
      if (!appConfig) return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
      const configStr = appConfig[`cycle_${type}`];
      if (configStr) { try { return JSON.parse(configStr); } catch(e) { console.error('Parse cycle config error', e); } }
      return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
  };

  const getDayDiff = (d1Str: string, d2Str: string) => {
      const parseDate = (str: string) => {
          const cleanStr = str.split('T')[0];
          const [y, m, d] = cleanStr.split('-').map(Number);
          return Date.UTC(y, m - 1, d);
      };
      const t1 = parseDate(d1Str);
      const t2 = parseDate(d2Str);
      const msPerDay = 1000 * 60 * 60 * 24;
      return Math.floor((t1 - t2) / msPerDay);
  };

  const getCalculatedCocktail = (dateStr: string, type: DailyCocktailType): DailyCocktail | undefined => {
      const manualEntry = dailyCocktails.find(c => c.date === dateStr && c.type === type);
      if (manualEntry) return manualEntry;

      const config = getCycleConfig(type);
      if (!config.isActive || config.recipeIds.length === 0) return undefined;

      const diffDays = getDayDiff(dateStr, config.startDate);
      if (diffDays < 0) return undefined;

      let index = 0;
      const listLen = config.recipeIds.length;
      
      const cleanTargetDate = dateStr.split('T')[0];
      const [y, m, d] = cleanTargetDate.split('-').map(Number);
      const targetDayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

      if (config.frequency === 'DAILY') { index = diffDays % listLen; } 
      else if (config.frequency === '2_DAYS') { index = Math.floor(diffDays / 2) % listLen; } 
      else if (config.frequency === 'WEEKLY') { index = Math.floor(diffDays / 7) % listLen; } 
      else if (config.frequency === '2_WEEKS') { index = Math.floor(diffDays / 14) % listLen; } 
      else if (config.frequency === 'MON_FRI') {
          const weeksPassed = Math.floor(diffDays / 7);
          const cleanStartStr = config.startDate.split('T')[0];
          const [sy, sm, sd] = cleanStartStr.split('-').map(Number);
          const startDate = new Date(Date.UTC(sy, sm - 1, sd));
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
      const existingDate = conf.startDate ? conf.startDate.split('T')[0] : '';
      setCycleStartDate(existingDate || getBarDateStr());
      setCycleIsActive(conf.isActive);
      setRecipeToAddId('');
      setIsCycleModalOpen(true);
  };

  const handleSaveCycle = () => {
      if (!saveConfig) return;
      const config: CycleConfig = { 
          frequency: cycleFrequency, 
          recipeIds: cycleRecipes, 
          startDate: cycleStartDate,
          isActive: cycleIsActive 
      };
      saveConfig(`cycle_${cycleType}`, config);
      setIsCycleModalOpen(false);
  };

  const handleToggleCycleStatus = (type: DailyCocktailType) => {
      if (currentUser.role !== 'ADMIN') { alert("Seul l'admin peut modifier l'état du cycle."); return; }
      const conf = getCycleConfig(type);
      const newConfig = { ...conf, isActive: !conf.isActive };
      // Important: On sauvegarde la nouvelle config, pas juste l'état local
      if (saveConfig) {
          saveConfig(`cycle_${type}`, newConfig);
      }
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

  const getRecipesForType = (type: DailyCocktailType) => {
      if (type === 'WELCOME') {
          if (appConfig?.programMapping?.['WELCOME']) {
              return recipes.filter(r => appConfig.programMapping!['WELCOME'].includes(r.category));
          }
          return recipes.filter(r => r.category === 'Accueil' || r.category.toLowerCase().includes('accueil'));
      }

      // Check Mapping
      const allowedCategories = appConfig?.programMapping?.[type];
      
      if (allowedCategories && allowedCategories.length > 0) {
          return recipes.filter(r => allowedCategories.includes(r.category));
      }

      // Fallback si pas de mapping
      return []; 
  };

  const recipesForCurrentModal = getRecipesForType(cycleType);
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

  const previousWelcomeCocktails = useMemo(() => {
      return dailyCocktails
          .filter(c => c.type === 'WELCOME' && c.date < selectedDate && c.customName)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 7);
  }, [dailyCocktails, selectedDate]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">
      {/* EVENT MODAL CODE ... (Unchanged) ... */}
      
      {/* TABS */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setActiveTab('TASKS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'TASKS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Tâches</button>
          <button onClick={() => setActiveTab('CALENDAR')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'CALENDAR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Agenda</button>
          <button onClick={() => setActiveTab('COCKTAILS')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'COCKTAILS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Cocktails du Jour</button>
      </div>

      {activeTab === 'TASKS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>À faire</h3>
                      <button onClick={() => setShowTaskHistory(!showTaskHistory)} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                          {showTaskHistory ? 'Voir Liste' : 'Voir Historique'}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </button>
                  </div>
                  
                  {!showTaskHistory ? (
                      <>
                          <div className="flex gap-2 mb-2">
                              <input className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={newTaskContent} onChange={e => setNewTaskContent(e.target.value)} placeholder="Nouvelle tâche..." onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
                              <button onClick={handleAddTask} className="bg-slate-900 text-white px-6 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800">Ajouter</button>
                          </div>
                          
                          {currentUser.role === 'ADMIN' && (
                              <div className="mb-6 flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" className="w-4 h-4 rounded text-indigo-600" checked={isRecurringTask} onChange={e => setIsRecurringTask(e.target.checked)} />
                                      <span className="text-xs font-bold text-slate-600">Récurrent</span>
                                  </label>
                                  {isRecurringTask && (
                                      <div className="flex gap-1">
                                          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => (
                                              <button 
                                                key={idx} 
                                                onClick={() => toggleRecurrenceDay(idx)}
                                                className={`w-6 h-6 rounded-lg text-[9px] font-black ${recurrenceDays.includes(idx) ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                                              >
                                                  {day}
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          )}

                          <div className="space-y-3">
                              {activeTasks.map(t => {
                                  const doneDate = t.doneAt ? new Date(t.doneAt) : null;
                                  const startOfShift = new Date();
                                  if (startOfShift.getHours() < 4) startOfShift.setDate(startOfShift.getDate() - 1);
                                  startOfShift.setHours(4,0,0,0);
                                  
                                  const isVisuallyDone = t.isDone && doneDate && doneDate >= startOfShift;

                                  return (
                                      <div key={t.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${isVisuallyDone ? 'bg-emerald-50 border-emerald-100 opacity-70' : 'bg-slate-50 border-slate-100'}`}>
                                          <button onClick={() => handleToggleTask(t)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isVisuallyDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-500'}`}>
                                              {isVisuallyDone && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                          </button>
                                          
                                          <div className="flex-1">
                                              {editingTaskId === t.id ? (
                                                  <input 
                                                    className="w-full bg-white border border-indigo-300 rounded p-1 text-sm font-bold outline-none"
                                                    defaultValue={t.content}
                                                    autoFocus
                                                    onKeyDown={e => { if (e.key === 'Enter') handleEditTaskContent(t, e.currentTarget.value); }}
                                                    onBlur={e => handleEditTaskContent(t, e.currentTarget.value)}
                                                  />
                                              ) : (
                                                  <p className={`font-bold text-sm ${isVisuallyDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.content}</p>
                                              )}
                                              
                                              <div className="flex gap-2 items-center mt-1">
                                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                      {t.recurrence && t.recurrence.length > 0 ? 'Tâche Récurrente' : `Par ${t.createdBy} • ${new Date(t.createdAt).toLocaleDateString()}`}
                                                  </p>
                                              </div>
                                          </div>

                                          {currentUser.role === 'ADMIN' && (
                                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button onClick={() => setEditingTaskId(t.id)} className="p-2 text-slate-300 hover:text-indigo-600 bg-white rounded-lg shadow-sm border border-transparent hover:border-indigo-100">
                                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                  </button>
                                                  <button onClick={() => handleDeleteTask(t.id)} className="p-2 text-slate-300 hover:text-rose-500 bg-white rounded-lg shadow-sm border border-transparent hover:border-rose-100">
                                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                              {activeTasks.length === 0 && <p className="text-center text-slate-400 italic text-xs">Rien à faire, profitez-en !</p>}
                          </div>
                      </>
                  ) : (
                      <div className="space-y-3">
                          {historyTasks.map(t => (
                              <div key={t.id} className="flex flex-col gap-1 p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-80">
                                  <p className="font-bold text-slate-700 text-sm">{t.content}</p>
                                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      <span>Fait par : <span className="text-indigo-600">{t.doneBy || 'Inconnu'}</span></span>
                                      <span>{t.doneAt ? new Date(t.doneAt).toLocaleDateString() + ' ' + new Date(t.doneAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                                  </div>
                              </div>
                          ))}
                          {historyTasks.length === 0 && <p className="text-center text-slate-400 italic text-xs">Aucun historique récent.</p>}
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* CALENDAR TAB (unchanged) */}
      {/* COCKTAILS TAB (unchanged) */}
      {/* CYCLE MODAL (unchanged) */}
      {/* ... keeping the rest of the file structure ... */}
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
                      const config = getCycleConfig(type);
                      const cocktail = getCalculatedCocktail(selectedDate, type);
                      const recipe = recipes.find(r => r.id === cocktail?.recipeId);
                      const labels: Record<string, string> = { OF_THE_DAY: 'Cocktail du Jour', MOCKTAIL: 'Mocktail', WELCOME: 'Accueil', THALASSO: 'Thalasso' };
                      
                      const isAutoCycle = config.isActive;
                      const availableRecipes = getRecipesForType(type);

                      return (
                          <div key={type} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full">
                              <div className="flex justify-between items-center mb-4">
                                  <div className="flex items-center gap-2">
                                      <h4 className="font-black text-slate-800 uppercase tracking-tight">{labels[type]}</h4>
                                      {isAutoCycle && <span title="Cycle Automatique Actif" className="text-emerald-500">🔄</span>}
                                  </div>
                                  <div className="flex gap-2">
                                      {type !== 'WELCOME' && (
                                          <button 
                                            onClick={() => handleToggleCycleStatus(type)} 
                                            className={`p-1.5 rounded-lg transition-all ${isAutoCycle ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                            title={isAutoCycle ? 'Mettre en pause' : 'Activer'}
                                          >
                                              {isAutoCycle ? (
                                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                              ) : (
                                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                              )}
                                          </button>
                                      )}
                                      <button onClick={() => openCycleModal(type)} className="text-[10px] font-black uppercase text-indigo-500 hover:underline">Programmation</button>
                                  </div>
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
                                        {availableRecipes.map(r => (
                                          <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                        {availableRecipes.length === 0 && <option disabled value="">(Aucune recette - Vérifier config)</option>}
                                    </select>
                                )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* CYCLE MODAL... (Standard modal code from prev version, omitted to save space as logic didn't change inside the modal itself) */}
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
                                      {recipesForCurrentModal.map(r => (
                                          <option key={r.id} value={r.id} disabled={cycleRecipes.includes(r.id)}>{r.name}</option>
                                      ))}
                                      {recipesForCurrentModal.length === 0 && <option disabled>(Vide)</option>}
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
