
import React, { useState, useMemo, useEffect } from 'react';
import { Task, Event, EventComment, User, StockItem, DailyCocktail, DailyCocktailType, Recipe, EventProduct, StockLevel, PendingOrder, Glassware, EventGlasswareNeed, CycleConfig, CycleFrequency, AppConfig, CocktailCategory, MealReservation } from '../types';

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
  cocktailCategories?: CocktailCategory[];
  onEditTask?: (task: Task) => void;
  mealReservations?: MealReservation[];
  setMealReservations?: React.Dispatch<React.SetStateAction<MealReservation[]>>;
  users?: User[];
}

const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const getBarDateStr = (d: Date = new Date()) => {
    const shift = new Date(d);
    if (shift.getHours() < 4) shift.setDate(shift.getDate() - 1);
    return shift.toISOString().split('T')[0];
};

const toLocalISOString = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
};

const DailyLife: React.FC<DailyLifeProps> = ({ 
    tasks, events, eventComments, currentUser, items, onSync, setTasks, setEvents, setEventComments, 
    dailyCocktails = [], setDailyCocktails, recipes = [], onCreateTemporaryItem, stockLevels = [], orders = [], glassware = [],
    appConfig, saveConfig, initialTab, cocktailCategories = [], onEditTask, mealReservations = [], setMealReservations, users = []
}) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'CALENDAR' | 'COCKTAILS' | 'MEALS'>('TASKS');
  const [configCycleType, setConfigCycleType] = useState<DailyCocktailType | null>(null); 
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  
  // Task Filters
  const [showArchived, setShowArchived] = useState(false);
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskContent, setEditTaskContent] = useState('');

  useEffect(() => {
      if (initialTab && (initialTab === 'TASKS' || initialTab === 'CALENDAR' || initialTab === 'COCKTAILS' || initialTab === 'MEALS')) {
          setActiveTab(initialTab as any);
      }
  }, [initialTab]);

  // Tasks State
  const [newTaskContent, setNewTaskContent] = useState('');
  const [isRecurringTask, setIsRecurringTask] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  
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

  const [newEventGlassware, setNewEventGlassware] = useState<EventGlasswareNeed[]>([]);
  const [glasswareQtyInput, setGlasswareQtyInput] = useState<string>('1');
  const [selectedGlasswareId, setSelectedGlasswareId] = useState('');

  const [selectedDate, setSelectedDate] = useState<string>(getBarDateStr());

  // --- COCKTAIL LOGIC (Configuration et cycles) ---
  const getCycleConfig = (type: DailyCocktailType): CycleConfig => {
      if (!appConfig) return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
      const configStr = appConfig[`cycle_${type}`];
      if (configStr) { try { return JSON.parse(configStr); } catch(e) {} }
      return { frequency: 'DAILY', recipeIds: [], startDate: new Date().toISOString(), isActive: false };
  };

  const saveCycleConfig = (type: DailyCocktailType, cfg: CycleConfig) => {
      if(saveConfig) saveConfig(`cycle_${type}`, cfg);
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

  const getCalculatedCocktail = (targetDate: string, type: DailyCocktailType): DailyCocktail | undefined => {
      const manualEntry = dailyCocktails.find(c => c.date === targetDate && c.type === type);
      if (manualEntry) return manualEntry;

      const config = getCycleConfig(type);
      if (!config.isActive || config.recipeIds.length === 0) return undefined;

      const diffDays = getDayDiff(targetDate, config.startDate);
      if (diffDays < 0) return undefined;

      let index = 0;
      const listLen = config.recipeIds.length;
      
      const cleanTargetDate = targetDate.split('T')[0];
      const [y, m, d] = cleanTargetDate.split('-').map(Number);
      const targetDayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

      if (config.frequency === 'DAILY') { index = diffDays % listLen; } 
      else if (config.frequency === '2_DAYS') { index = Math.floor(diffDays / 2) % listLen; } 
      else if (config.frequency === 'WEEKLY') { index = Math.floor(diffDays / 7) % listLen; } 
      else if (config.frequency === '2_WEEKS') { index = Math.floor(diffDays / 14) % listLen; } 
      else if (config.frequency === 'MON_FRI') {
          const weeksPassed = Math.floor(diffDays / 7);
          const isSecondSlot = (targetDayOfWeek === 5 || targetDayOfWeek === 6 || targetDayOfWeek === 0);
          const totalSlotsPassed = weeksPassed * 2 + (isSecondSlot ? 1 : 0);
          index = totalSlotsPassed % listLen;
      }
      
      return { id: `calc-${targetDate}-${type}`, date: targetDate, type, recipeId: config.recipeIds[index] };
  };

  const CycleConfigModal = ({ type, onClose }: { type: DailyCocktailType, onClose: () => void }) => {
      // (Même implémentation que précédente, inchangée pour brièveté du bloc XML, voir logique d'origine)
      // Je la remets complète car le fichier entier est remplacé.
      const existing = getCycleConfig(type);
      const [isActive, setIsActive] = useState(existing.isActive);
      const [frequency, setFrequency] = useState<CycleFrequency>(existing.frequency);
      const [startDate, setStartDate] = useState(existing.startDate.split('T')[0]);
      const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>(existing.recipeIds);
      const [filterCategory, setFilterCategory] = useState<string>('');

      const availableRecipes = useMemo(() => {
          return recipes.filter(r => !filterCategory || r.category === filterCategory);
      }, [recipes, filterCategory]);

      const handleAddRecipe = (id: string) => setSelectedRecipeIds([...selectedRecipeIds, id]);
      const handleRemoveRecipe = (idx: number) => {
          const c = [...selectedRecipeIds];
          c.splice(idx, 1);
          setSelectedRecipeIds(c);
      };
      
      const handleMoveRecipe = (idx: number, dir: 'up' | 'down') => {
          if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === selectedRecipeIds.length - 1)) return;
          const c = [...selectedRecipeIds];
          const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
          [c[idx], c[swapIdx]] = [c[swapIdx], c[idx]];
          setSelectedRecipeIds(c);
      };

      const handleSave = () => {
          saveCycleConfig(type, { isActive, frequency, startDate: new Date(startDate).toISOString(), recipeIds: selectedRecipeIds });
          onClose();
      };

      return (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[2rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl border border-slate-200">
                  <div className="p-6 border-b flex justify-between items-center">
                      <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">Programmation : {type === 'OF_THE_DAY' ? 'Cocktail du Jour' : type}</h3>
                      <button onClick={onClose} className="text-slate-400 font-bold hover:text-slate-600">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                              <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                              Activer le cycle automatique
                          </label>
                      </div>
                      
                      {isActive && (
                          <>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fréquence de changement</label>
                                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={frequency} onChange={e => setFrequency(e.target.value as any)}>
                                          <option value="DAILY">Tous les jours</option>
                                          <option value="2_DAYS">Tous les 2 jours</option>
                                          <option value="MON_FRI">Lundi / Vendredi</option>
                                          <option value="WEEKLY">Toutes les semaines</option>
                                          <option value="2_WEEKS">Toutes les 2 semaines</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de début (Référence)</label>
                                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                  </div>
                              </div>

                              <div className="flex gap-4 h-96">
                                  <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden">
                                      <div className="p-3 bg-slate-50 border-b flex flex-col gap-2">
                                          <span className="text-[10px] font-black uppercase text-slate-400">Bibliothèque</span>
                                          <select className="bg-white border rounded-lg p-1 text-xs font-bold" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                              <option value="">Toutes catégories</option>
                                              {cocktailCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                          </select>
                                      </div>
                                      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50">
                                          {availableRecipes.map(r => (
                                              <button key={r.id} onClick={() => handleAddRecipe(r.id)} className="w-full text-left p-2 bg-white border border-slate-100 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                                  {r.name}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-center">
                                      <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                  </div>
                                  <div className="flex-1 flex flex-col border-2 border-indigo-100 rounded-xl overflow-hidden bg-indigo-50/30">
                                      <div className="p-3 bg-indigo-50 border-b border-indigo-100 text-[10px] font-black uppercase text-indigo-400">Cycle Sélectionné ({selectedRecipeIds.length})</div>
                                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                          {selectedRecipeIds.map((id, idx) => {
                                              const r = recipes.find(x => x.id === id);
                                              return (
                                                  <div key={`${id}-${idx}`} className="flex items-center justify-between p-2 bg-white border border-indigo-100 rounded-lg shadow-sm">
                                                      <span className="text-xs font-bold truncate flex-1">{idx+1}. {r?.name || 'Inconnu'}</span>
                                                      <div className="flex items-center gap-1 ml-2">
                                                          <button onClick={() => handleMoveRecipe(idx, 'up')} className="text-slate-400 hover:text-indigo-600"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                                                          <button onClick={() => handleMoveRecipe(idx, 'down')} className="text-slate-400 hover:text-indigo-600"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                                                          <button onClick={() => handleRemoveRecipe(idx)} className="text-rose-400 hover:text-rose-600 ml-1">✕</button>
                                                      </div>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                          </>
                      )}
                  </div>
                  <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                      <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase hover:bg-slate-50">Annuler</button>
                      <button onClick={handleSave} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 shadow-lg">Sauvegarder</button>
                  </div>
              </div>
          </div>
      );
  };

  // --- EVENTS LOGIC (Modal et handlers) ---
  const openEventModal = (evt?: Event) => {
      if (evt) {
          setSelectedEvent(evt);
          setNewEventTitle(evt.title);
          setNewEventStart(toLocalISOString(evt.startTime));
          setNewEventEnd(toLocalISOString(evt.endTime));
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

  const handleCreateEvent = () => {
      if (!newEventTitle || !newEventStart || !newEventEnd) {
          alert("Veuillez remplir le titre et les dates.");
          return;
      }
      
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

  // --- TASKS LOGIC (Gestion complète) ---
  const activeTasks = useMemo(() => {
    const now = new Date();
    // Début de la journée bar (4h du matin)
    const startOfShift = new Date(now);
    if (now.getHours() < 4) startOfShift.setDate(now.getDate() - 1);
    startOfShift.setHours(4, 0, 0, 0);

    const currentDayOfWeek = startOfShift.getDay(); // 0=Dim, 1=Lun...

    return tasks.filter(t => {
        const isRecurring = t.recurrence && t.recurrence.length > 0;

        if (showRecurringOnly) {
            return isRecurring;
        }

        if (showArchived) {
            // Show only done tasks (non-recurring OR recurring done today)
            if (!isRecurring) return t.isDone;
            // For recurring, "archived" doesn't make much sense, but maybe show if done today?
            if (t.recurrence?.includes(currentDayOfWeek) && t.doneAt) {
                 const doneDate = new Date(t.doneAt);
                 return doneDate >= startOfShift;
            }
            return false;
        }

        // Default View (To Do)
        if (!isRecurring) {
            return !t.isDone;
        }
        
        // Tâche récurrente
        // 1. Est-elle prévue aujourd'hui ?
        if (t.recurrence?.includes(currentDayOfWeek)) {
            // 2. A-t-elle été faite DEPUIS le début du shift actuel ?
            if (t.doneAt) {
                const doneDate = new Date(t.doneAt);
                return doneDate < startOfShift; // Si faite avant 4h, elle "revient" (return true)
            }
            return true; // Jamais faite, on affiche
        }
        
        return false; // Pas prévue aujourd'hui
    });
  }, [tasks, showArchived, showRecurringOnly]);

  const handleAddTask = () => {
      if (!newTaskContent.trim()) return;
      
      const task: Task = {
          id: 'task_' + Date.now(),
          content: newTaskContent,
          createdBy: currentUser.name,
          createdAt: new Date().toISOString(),
          isDone: false,
          recurrence: isRecurringTask && recurrenceDays.length > 0 ? recurrenceDays : undefined
      };
      
      setTasks(prev => [task, ...prev]);
      onSync('SAVE_TASK', task);
      
      // Reset form
      setNewTaskContent('');
      setIsRecurringTask(false);
      setRecurrenceDays([]);
  };

  const handleDeleteTask = (taskId: string) => {
      if (window.confirm("Supprimer cette tâche ?")) {
          setTasks(prev => prev.filter(t => t.id !== taskId));
          onSync('DELETE_TASK', { id: taskId });
      }
  };

  const handleToggleTask = (task: Task) => {
      // Pour une tâche récurrente, on met à jour le timestamp 'doneAt' à maintenant.
      // Au prochain render ou refresh (après 4h du mat), la logique activeTasks la réaffichera si nécessaire.
      const updated = { 
          ...task, 
          isDone: !task.isDone, // Toggle visuel local
          doneBy: !task.isDone ? currentUser.name : undefined, 
          doneAt: !task.isDone ? new Date().toISOString() : undefined 
      };
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      onSync('SAVE_TASK', updated);
  };

  const handleEditClick = (task: Task) => {
      setEditingTask(task);
      setEditTaskContent(task.content);
  };

  const handleSaveEdit = () => {
      if (editingTask && onEditTask && editTaskContent.trim()) {
          onEditTask({ ...editingTask, content: editTaskContent });
          setEditingTask(null);
          setEditTaskContent('');
      }
  };

  const toggleRecurrenceDay = (dayIndex: number) => {
      if (recurrenceDays.includes(dayIndex)) {
          setRecurrenceDays(prev => prev.filter(d => d !== dayIndex));
      } else {
          setRecurrenceDays(prev => [...prev, dayIndex].sort());
      }
  };

  const handleToggleMeal = (userId: string, date: string, slot: 'LUNCH' | 'DINNER') => {
      if (!setMealReservations) return;
      
      const existing = mealReservations.find(r => r.userId === userId && r.date === date && r.slot === slot);
      
      if (existing) {
          // Remove
          setMealReservations(prev => prev.filter(r => r.id !== existing.id));
          onSync('DELETE_MEAL_RESERVATION', { id: existing.id });
      } else {
          // Add - Use deterministic ID to prevent duplicates
          const deterministicId = `meal_${userId}_${date}_${slot}`;
          const newReservation: MealReservation = {
              id: deterministicId,
              userId,
              date,
              slot
          };
          setMealReservations(prev => [...prev, newReservation]);
          onSync('SAVE_MEAL_RESERVATION', newReservation);
      }
  };

  const weekDays = useMemo(() => {
      const today = new Date();
      const currentDay = today.getDay(); // 0=Sun, 1=Mon...
      const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1) + (currentWeekOffset * 7); // Adjust to get Monday + Offset
      
      const monday = new Date(today.setDate(diff));
      const days = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          days.push(d.toISOString().split('T')[0]);
      }
      return days;
  }, [currentWeekOffset]);

  const daysLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">
      
      {configCycleType && <CycleConfigModal type={configCycleType} onClose={() => setConfigCycleType(null)} />}

      {/* EVENT MODAL (Rendu conditionnel) */}
      {isEventModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
                  {/* ... (Contenu Modal Evénement inchangé pour économiser place, voir code précédent) ... */}
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedEvent ? 'Modifier Événement' : 'Créer un Événement'}</h3>
                      <button onClick={closeEventModal} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  {/* ... Formulaire Event simplifié ... */}
                  <div className="overflow-y-auto pr-2 space-y-6 flex-1 custom-scrollbar">
                      {/* Champs Titre, Date, Lieu... */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} /></div>
                          <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Début</label><input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" value={newEventStart} onChange={e => setNewEventStart(e.target.value)} /></div>
                          <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fin</label><input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" value={newEventEnd} onChange={e => setNewEventEnd(e.target.value)} /></div>
                          
                          <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lieu</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} placeholder="Ex: Terrasse" /></div>
                          <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Convives</label><input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" value={newEventGuests} onChange={e => setNewEventGuests(e.target.value)} /></div>
                          <div className="md:col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none h-20" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} placeholder="Détails de l'événement..." /></div>
                      </div>
                      {/* Produits & Verres */}
                      <div className="space-y-4">
                          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                              <h4 className="font-black text-xs uppercase text-indigo-700 mb-3">Produits</h4>
                              <div className="flex gap-2 mb-3"><input list="evt-prod-list" className="flex-1 bg-white border border-indigo-200 rounded-lg p-2 text-xs font-bold outline-none" placeholder="Chercher..." value={productSearch} onChange={e => setProductSearch(e.target.value)} /><datalist id="evt-prod-list">{items.map(i => <option key={i.id} value={i.name} />)}</datalist><input type="number" className="w-20 bg-white border border-indigo-200 rounded-lg p-2 text-xs font-bold text-center outline-none" value={productQtyInput} onChange={e => setProductQtyInput(e.target.value)} /><button onClick={handleAddEventProduct} className="bg-indigo-600 text-white px-4 rounded-lg font-black text-xs">+</button></div>
                              <div className="space-y-1">{newEventProducts.map((p, idx) => (<div key={idx} className="flex justify-between bg-white/50 p-2 rounded-lg text-xs"><span className="font-bold">{items.find(i=>i.id===p.itemId)?.name}</span><div className="flex gap-2"><span className="font-black text-indigo-600">x{p.quantity}</span><button onClick={()=>handleRemoveEventProduct(idx)} className="text-rose-400">✕</button></div></div>))}</div>
                          </div>

                          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                              <h4 className="font-black text-xs uppercase text-blue-700 mb-3">Verrerie</h4>
                              <div className="flex gap-2 mb-3">
                                  <select className="flex-1 bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none" value={selectedGlasswareId} onChange={e => setSelectedGlasswareId(e.target.value)}>
                                      <option value="">Choisir un verre...</option>
                                      {glassware.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                  </select>
                                  <input type="number" className="w-20 bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold text-center outline-none" value={glasswareQtyInput} onChange={e => setGlasswareQtyInput(e.target.value)} />
                                  <button onClick={handleAddEventGlassware} className="bg-blue-600 text-white px-4 rounded-lg font-black text-xs">+</button>
                              </div>
                              <div className="space-y-1">
                                  {newEventGlassware.map((g, idx) => (
                                      <div key={idx} className="flex justify-between bg-white/50 p-2 rounded-lg text-xs">
                                          <span className="font-bold">{glassware.find(gl => gl.id === g.glasswareId)?.name || 'Verre inconnu'}</span>
                                          <div className="flex gap-2">
                                              <span className="font-black text-blue-600">x{g.quantity}</span>
                                              <button onClick={() => handleRemoveEventGlassware(idx)} className="text-rose-400">✕</button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-3 pt-6 border-t mt-4">
                      {selectedEvent && currentUser.role === 'ADMIN' && <button onClick={handleDeleteEvent} className="bg-rose-50 text-rose-500 px-6 py-3 rounded-xl font-black uppercase text-xs">Supprimer</button>}
                      <div className="flex-1"></div>
                      <button onClick={closeEventModal} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-xs">Annuler</button>
                      <button onClick={handleCreateEvent} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">Sauvegarder</button>
                  </div>
              </div>
          </div>
      )}

      {/* TABS */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          {['TASKS', 'CALENDAR', 'COCKTAILS', 'MEALS'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                  {tab === 'TASKS' ? 'Tâches' : tab === 'CALENDAR' ? 'Agenda' : tab === 'COCKTAILS' ? 'Cocktails du Jour' : 'Repas Staff'}
              </button>
          ))}
      </div>

      {activeTab === 'MEALS' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>Réservation Repas Personnel</h3>
                  <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                      <button onClick={() => setCurrentWeekOffset(p => p - 1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-indigo-600 transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <span className="text-xs font-black uppercase text-slate-600 min-w-[140px] text-center">
                          Semaine {currentWeekOffset === 0 ? 'en cours' : (currentWeekOffset > 0 ? `+${currentWeekOffset}` : currentWeekOffset)}
                      </span>
                      <button onClick={() => setCurrentWeekOffset(p => p + 1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-indigo-600 transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                  </div>
              </div>
              
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[150px]">Nom</th>
                          {weekDays.map(dateStr => {
                              const d = new Date(dateStr);
                              const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
                              const dayNum = d.getDate();
                              const isToday = dateStr === getBarDateStr();
                              return (
                                  <th key={dateStr} className={`p-2 text-center border-b border-slate-100 ${isToday ? 'bg-indigo-50 text-indigo-700 rounded-t-lg' : ''}`}>
                                      <div className="flex flex-col items-center">
                                          <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{dayName}</span>
                                          <span className="text-lg font-black">{dayNum}</span>
                                      </div>
                                  </th>
                              );
                          })}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {users.filter(u => (u.role === 'BARMAN' || u.role === 'ADMIN') && u.showInMealPlanning !== false).map(user => (
                          <tr key={user.id} className="hover:bg-slate-50/50">
                              <td className="p-4 font-bold text-slate-800 text-sm">{user.name}</td>
                              {weekDays.map(dateStr => {
                                  const isLunchReserved = mealReservations.some(r => r.userId === user.id && r.date === dateStr && r.slot === 'LUNCH');
                                  const isDinnerReserved = mealReservations.some(r => r.userId === user.id && r.date === dateStr && r.slot === 'DINNER');
                                  const isCurrentUser = user.id === currentUser.id;
                                  const isToday = dateStr === getBarDateStr();

                                  return (
                                      <td key={dateStr} className={`p-2 text-center border-l border-slate-50 ${isToday ? 'bg-indigo-50/30' : ''}`}>
                                          <div className="flex flex-col gap-2 items-center justify-center">
                                              <label className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isLunchReserved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                                                  <input 
                                                      type="checkbox" 
                                                      className="hidden" 
                                                      checked={isLunchReserved} 
                                                      onChange={() => handleToggleMeal(user.id, dateStr, 'LUNCH')}
                                                      disabled={!isCurrentUser && currentUser.role !== 'ADMIN'}
                                                  />
                                                  <span className="text-[9px] font-black uppercase">Midi</span>
                                              </label>
                                              <label className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isDinnerReserved ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                                                  <input 
                                                      type="checkbox" 
                                                      className="hidden" 
                                                      checked={isDinnerReserved} 
                                                      onChange={() => handleToggleMeal(user.id, dateStr, 'DINNER')}
                                                      disabled={!isCurrentUser && currentUser.role !== 'ADMIN'}
                                                  />
                                                  <span className="text-[9px] font-black uppercase">Soir</span>
                                              </label>
                                          </div>
                                      </td>
                                  );
                              })}
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'TASKS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              
              {/* EDIT MODAL */}
              {editingTask && (
                  <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
                      <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl space-y-4">
                          <h3 className="font-black text-slate-800 uppercase">Modifier la tâche</h3>
                          <input 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none"
                              value={editTaskContent}
                              onChange={e => setEditTaskContent(e.target.value)}
                          />
                          <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-slate-400 font-bold text-xs uppercase">Annuler</button>
                              <button onClick={handleSaveEdit} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs">Sauvegarder</button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>{showArchived ? 'Tâches Archivées' : showRecurringOnly ? 'Tâches Récurrentes' : 'À faire'}</h3>
                      <div className="flex gap-2">
                          <button onClick={() => { setShowArchived(false); setShowRecurringOnly(false); }} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${!showArchived && !showRecurringOnly ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-50'}`}>À Faire</button>
                          <button onClick={() => { setShowArchived(false); setShowRecurringOnly(true); }} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${showRecurringOnly ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-50'}`}>Récurrentes</button>
                          <button onClick={() => { setShowArchived(true); setShowRecurringOnly(false); }} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${showArchived ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-50'}`}>Archives</button>
                      </div>
                  </div>
                  
                  {/* AJOUT TACHE */}
                  {!showArchived && !showRecurringOnly && (
                  <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex gap-2">
                          <input 
                            className="flex-1 bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-100" 
                            value={newTaskContent} 
                            onChange={e => setNewTaskContent(e.target.value)} 
                            placeholder="Nouvelle tâche..." 
                            onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                          />
                          <button onClick={handleAddTask} className="bg-slate-900 text-white px-6 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">Ajouter</button>
                      </div>
                      
                      {currentUser.role === 'ADMIN' && (
                          <div className="flex items-center gap-4 pt-1">
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isRecurringTask ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'}`}>
                                      <input type="checkbox" className="hidden" checked={isRecurringTask} onChange={e => setIsRecurringTask(e.target.checked)} />
                                      {isRecurringTask && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${isRecurringTask ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Tâche Récurrente</span>
                              </label>

                              {isRecurringTask && (
                                  <div className="flex gap-1 animate-in fade-in slide-in-from-left-2">
                                      {daysLabels.map((day, idx) => {
                                          const isSelected = recurrenceDays.includes(idx);
                                          return (
                                              <button 
                                                key={idx} 
                                                onClick={() => toggleRecurrenceDay(idx)}
                                                className={`w-6 h-6 rounded-full text-[9px] font-black flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 text-white shadow-sm scale-110' : 'bg-white border border-slate-200 text-slate-400 hover:border-amber-300'}`}
                                              >
                                                  {day}
                                              </button>
                                          );
                                      })}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
                  )}

                  <div className="space-y-3">
                      {activeTasks.map(t => {
                          const isRecurring = t.recurrence && t.recurrence.length > 0;
                          return (
                              <div key={t.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${t.isDone ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                                  <button onClick={() => handleToggleTask(t)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${t.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                                      {t.isDone && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                  </button>
                                  <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                          <p className={`font-bold text-sm ${t.isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.content}</p>
                                          {isRecurring && (
                                              <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                  Hebdo
                                              </span>
                                          )}
                                      </div>
                                      {t.isDone && t.doneBy && <p className="text-[9px] text-slate-400 font-bold mt-0.5">Fait par {t.doneBy}</p>}
                                  </div>
                                  {(currentUser.role === 'ADMIN' || t.createdBy === currentUser.name) && (
                                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          {currentUser.role === 'ADMIN' && (
                                              <button onClick={() => handleEditClick(t)} className="text-slate-300 hover:text-indigo-500 p-2">
                                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                              </button>
                                          )}
                                          <button onClick={() => handleDeleteTask(t.id)} className="text-slate-300 hover:text-rose-500 p-2">
                                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                          </button>
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                      {activeTasks.length === 0 && <p className="text-center text-slate-400 italic text-sm py-8">Rien à faire pour le moment !</p>}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CALENDAR' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>Événements à venir</h3>
                  <button onClick={() => openEventModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg">+ Créer</button>
              </div>
              <div className="space-y-4">
                  {events.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(e => (
                      <div key={e.id} onClick={() => openEventModal(e)} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 cursor-pointer transition-all">
                          <div className="flex gap-4">
                              <div className="bg-white rounded-xl p-3 text-center min-w-[60px] border">
                                  <span className="block text-xs font-black text-indigo-600 uppercase">{new Date(e.startTime).toLocaleString('fr-FR', {month:'short'})}</span>
                                  <span className="block text-2xl font-black text-slate-800">{new Date(e.startTime).getDate()}</span>
                              </div>
                              <div>
                                  <h4 className="font-black text-slate-800 text-base">{e.title}</h4>
                                  <p className="text-xs font-bold text-slate-500 mt-1">{new Date(e.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {e.location || 'Bar'}</p>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'COCKTAILS' && (
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-pink-500 rounded-full"></span>Carte du Jour</h3>
                  <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                      {type: 'OF_THE_DAY', label: 'Cocktail du Jour', color: 'amber'},
                      {type: 'MOCKTAIL', label: 'Mocktail', color: 'emerald'},
                      {type: 'WELCOME', label: 'Accueil', color: 'indigo'},
                      {type: 'THALASSO', label: 'Thalasso', color: 'cyan'}
                  ].map((cfg) => {
                      const cocktail = getCalculatedCocktail(selectedDate, cfg.type as DailyCocktailType);
                      const recipe = recipes.find(r => r.id === cocktail?.recipeId);
                      
                      const bgColor = {
                          amber: 'bg-amber-50 border-amber-100 text-amber-900',
                          emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
                          indigo: 'bg-indigo-50 border-indigo-100 text-indigo-900',
                          cyan: 'bg-cyan-50 border-cyan-100 text-cyan-900'
                      }[cfg.color];

                      return (
                          <div key={cfg.type} className={`p-6 rounded-3xl border ${bgColor} flex flex-col justify-between min-h-[180px] shadow-sm relative group`}>
                              {currentUser.role === 'ADMIN' && (
                                  <button 
                                    onClick={() => setConfigCycleType(cfg.type as DailyCocktailType)} 
                                    className="absolute top-2 right-2 p-2 bg-white/50 hover:bg-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title="Configurer le cycle"
                                  >
                                      <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  </button>
                              )}
                              <div>
                                  <h4 className="font-black uppercase text-xs tracking-widest opacity-60 mb-2">{cfg.label}</h4>
                                  <p className="font-black text-xl leading-tight">
                                      {recipe?.name || cocktail?.customName || 'Non défini'}
                                  </p>
                              </div>
                              <div>
                                  {recipe ? (
                                      <p className="text-xs font-medium opacity-80 mt-2 line-clamp-2 italic">
                                          "{recipe.description}"
                                      </p>
                                  ) : (
                                      <p className="text-[10px] font-bold opacity-50 uppercase mt-4">Aucune recette associée</p>
                                  )}
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
