
import React, { useState, useMemo } from 'react';
import { Task, Event, EventComment, User, StockItem, DailyCocktail, DailyCocktailType, Recipe } from '../types';

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
}

const DailyLife: React.FC<DailyLifeProps> = ({ tasks, events, eventComments, currentUser, items, onSync, setTasks, setEvents, setEventComments, dailyCocktails = [], setDailyCocktails, recipes = [] }) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'CALENDAR' | 'COCKTAILS'>('TASKS');
  
  // Tasks State
  const [newTaskContent, setNewTaskContent] = useState('');
  
  // Events State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null); // For details or editing
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventGuests, setNewEventGuests] = useState(0);
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventProducts, setNewEventProducts] = useState<string[]>([]); // Array of itemIds
  const [productSearch, setProductSearch] = useState('');
  const [newComment, setNewComment] = useState('');

  // Daily Cocktails State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Cycle Generator State
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [cycleType, setCycleType] = useState<DailyCocktailType>('OF_THE_DAY');
  const [cycleRecipes, setCycleRecipes] = useState<string[]>([]);
  const [cycleStartDate, setCycleStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cycleDuration, setCycleDuration] = useState(4); // weeks

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
          startTime: newEventStart,
          endTime: newEventEnd,
          location: newEventLocation,
          guestsCount: newEventGuests,
          description: newEventDesc,
          productsJson: JSON.stringify(newEventProducts),
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
          setNewEventStart(evt.startTime.slice(0, 16)); // Format for datetime-local
          setNewEventEnd(evt.endTime.slice(0, 16));
          setNewEventLocation(evt.location || '');
          setNewEventGuests(evt.guestsCount || 0);
          setNewEventDesc(evt.description || '');
          try { setNewEventProducts(JSON.parse(evt.productsJson || '[]')); } catch(e) { setNewEventProducts([]); }
      } else {
          setSelectedEvent(null);
          setNewEventTitle('');
          setNewEventStart('');
          setNewEventEnd('');
          setNewEventLocation('');
          setNewEventGuests(0);
          setNewEventDesc('');
          setNewEventProducts([]);
      }
      setIsEventModalOpen(true);
  };

  const closeEventModal = () => {
      setIsEventModalOpen(false);
      setSelectedEvent(null);
  };

  const toggleProduct = (itemId: string) => {
      if (newEventProducts.includes(itemId)) {
          setNewEventProducts(prev => prev.filter(id => id !== itemId));
      } else {
          setNewEventProducts(prev => [...prev, itemId]);
      }
  };

  // --- COCKTAILS LOGIC ---
  const handleUpdateCocktail = (type: DailyCocktailType, recipeId?: string, customName?: string, customDesc?: string) => {
      if (!setDailyCocktails) return;
      const newEntry: DailyCocktail = {
          id: `${selectedDate}-${type}`,
          date: selectedDate,
          type,
          recipeId,
          customName,
          customDescription: customDesc
      };
      
      // Update local state
      setDailyCocktails(prev => {
          const filtered = prev.filter(c => !(c.date === selectedDate && c.type === type));
          return [...filtered, newEntry];
      });
      onSync('SAVE_DAILY_COCKTAIL', newEntry);
  };

  const getCocktailForType = (type: DailyCocktailType) => {
      return dailyCocktails.find(c => c.date === selectedDate && c.type === type);
  };

  const recentWelcomes = useMemo(() => {
      const history = dailyCocktails
          .filter(c => c.type === 'WELCOME' && c.customName)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const uniqueNames = new Set();
      const distinct: DailyCocktail[] = [];
      history.forEach(h => {
          if (!uniqueNames.has(h.customName)) {
              uniqueNames.add(h.customName);
              distinct.push(h);
          }
      });
      return distinct.slice(0, 4);
  }, [dailyCocktails]);

  // --- CYCLE GENERATOR LOGIC ---
  const toggleCycleRecipe = (id: string) => {
      const set = new Set(cycleRecipes);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      setCycleRecipes(Array.from(set));
  };

  const handleGenerateCycle = () => {
      if (!setDailyCocktails || cycleRecipes.length === 0) return;
      
      const daysCount = cycleDuration * 7;
      const newEntries: DailyCocktail[] = [];
      let recipeIndex = 0;

      for (let i = 0; i < daysCount; i++) {
          const d = new Date(cycleStartDate);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri

          let shouldAssign = false;

          // LOGIC: Cocktail/Mocktail changes Mon (1) and Fri (5)
          if (cycleType === 'OF_THE_DAY' || cycleType === 'MOCKTAIL') {
              // On assigne tous les jours, mais on ne change d'index que le Lundi et Vendredi
              // Cependant, pour simplifier le dashboard, on va dire que le cocktail RESTE le même jusqu'au prochain changement
              // Donc on génère une entrée par jour pour que le dashboard l'affiche toujours
              
              if (dayOfWeek === 1 || dayOfWeek === 5) {
                  // Changement de recette
                  if (i > 0) recipeIndex = (recipeIndex + 1) % cycleRecipes.length;
              }
              // Note: Le premier jour (i=0), on prend l'index 0
              shouldAssign = true;
          } 
          // LOGIC: Thalasso changes every day
          else if (cycleType === 'THALASSO') {
              recipeIndex = i % cycleRecipes.length; // Simple rotation daily
              shouldAssign = true;
          }

          if (shouldAssign) {
              const entry: DailyCocktail = {
                  id: `${dateStr}-${cycleType}`,
                  date: dateStr,
                  type: cycleType,
                  recipeId: cycleRecipes[recipeIndex]
              };
              newEntries.push(entry);
              // OnSync un par un (limitation actuelle du backend simple)
              onSync('SAVE_DAILY_COCKTAIL', entry);
          }
      }

      setDailyCocktails(prev => {
          // Merge logic: remove existing for same dates/type
          const newMap = new Map(prev.map(p => [p.id, p]));
          newEntries.forEach(e => newMap.set(e.id, e));
          return Array.from(newMap.values());
      });

      setIsCycleModalOpen(false);
      setCycleRecipes([]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      
      {/* CYCLE MODAL */}
      {isCycleModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                          <span className="text-2xl">♻️</span> Générateur de Cycle
                      </h3>
                      <button onClick={() => setIsCycleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                      <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => { setCycleType('OF_THE_DAY'); setCycleRecipes([]); }} className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${cycleType === 'OF_THE_DAY' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Cocktail du Jour</button>
                          <button onClick={() => { setCycleType('MOCKTAIL'); setCycleRecipes([]); }} className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${cycleType === 'MOCKTAIL' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Mocktail</button>
                          <button onClick={() => { setCycleType('THALASSO'); setCycleRecipes([]); }} className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${cycleType === 'THALASSO' ? 'bg-cyan-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Thalasso</button>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <p className="text-xs font-bold text-slate-700 mb-2">Règle appliquée :</p>
                          {cycleType === 'THALASSO' ? (
                              <p className="text-sm text-slate-500">Les 4 cocktails sélectionnés tourneront <strong>tous les jours</strong> en boucle.</p>
                          ) : (
                              <p className="text-sm text-slate-500">Le cocktail changera uniquement les <strong>Lundi</strong> et <strong>Vendredi</strong>.</p>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Début du cycle</label>
                              <input type="date" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-sm outline-none" value={cycleStartDate} onChange={e => setCycleStartDate(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Durée (Semaines)</label>
                              <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-sm outline-none" value={cycleDuration} onChange={e => setCycleDuration(parseInt(e.target.value))}>
                                  <option value={1}>1 Semaine</option>
                                  <option value={2}>2 Semaines</option>
                                  <option value={4}>1 Mois</option>
                                  <option value={8}>2 Mois</option>
                              </select>
                          </div>
                      </div>

                      <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-1 mb-2 block">Sélectionner les recettes ({cycleRecipes.length})</label>
                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                              {recipes.filter(r => cycleType === 'MOCKTAIL' ? r.category === 'Mocktail' : true).map(r => (
                                  <div key={r.id} onClick={() => toggleCycleRecipe(r.id)} className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${cycleRecipes.includes(r.id) ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                      <span className="font-bold text-xs truncate">{r.name}</span>
                                      {cycleRecipes.includes(r.id) && <span className="text-indigo-600 font-black">✓</span>}
                                  </div>
                              ))}
                          </div>
                          {cycleType === 'THALASSO' && cycleRecipes.length !== 4 && (
                              <p className="text-rose-500 text-[10px] font-bold mt-2 text-right">Veuillez sélectionner exactement 4 recettes pour la Thalasso.</p>
                          )}
                      </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-4">
                      <button 
                        onClick={handleGenerateCycle} 
                        disabled={cycleRecipes.length === 0 || (cycleType === 'THALASSO' && cycleRecipes.length !== 4)}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          Générer le Planning
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* TABS */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full md:w-fit mx-auto">
          <button 
            onClick={() => setActiveTab('TASKS')}
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'TASKS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
              Tâches à faire
          </button>
          <button 
            onClick={() => setActiveTab('CALENDAR')}
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'CALENDAR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
              Agenda Événements
          </button>
          <button 
            onClick={() => setActiveTab('COCKTAILS')}
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'COCKTAILS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
              Carte du Moment
          </button>
      </div>

      {activeTab === 'COCKTAILS' && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[600px] space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                      Programmation Cocktails
                  </h3>
                  <div className="flex gap-2">
                      <button onClick={() => setIsCycleModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 shadow-lg flex items-center gap-2">
                          <span className="text-base">⚙️</span> Programmer Cycle
                      </button>
                      <input type="date" className="bg-slate-100 border-none rounded-xl px-4 py-2 font-bold text-slate-700 outline-none" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* COCKTAIL DU JOUR */}
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-black">1</div>
                          <div>
                              <h4 className="font-black text-slate-800 uppercase tracking-tight">Cocktail du Jour</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Change Lundi & Vendredi</p>
                          </div>
                      </div>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none"
                        value={getCocktailForType('OF_THE_DAY')?.recipeId || ''}
                        onChange={(e) => handleUpdateCocktail('OF_THE_DAY', e.target.value)}
                      >
                          <option value="">-- Sélectionner une recette --</option>
                          {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                  </div>

                  {/* MOCKTAIL DU JOUR */}
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black">2</div>
                          <div>
                              <h4 className="font-black text-slate-800 uppercase tracking-tight">Mocktail du Jour</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Change Lundi & Vendredi</p>
                          </div>
                      </div>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none"
                        value={getCocktailForType('MOCKTAIL')?.recipeId || ''}
                        onChange={(e) => handleUpdateCocktail('MOCKTAIL', e.target.value)}
                      >
                          <option value="">-- Sélectionner une recette --</option>
                          {recipes.filter(r => r.category === 'Mocktail').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          {recipes.filter(r => r.category !== 'Mocktail').map(r => <option key={r.id} value={r.id}>{r.name} (Autre)</option>)}
                      </select>
                  </div>

                  {/* COCKTAIL D'ACCUEIL */}
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-black">3</div>
                          <div>
                              <h4 className="font-black text-slate-800 uppercase tracking-tight">Cocktail d'Accueil</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Création Libre</p>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <input 
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none" 
                            placeholder="Nom de la création..."
                            value={getCocktailForType('WELCOME')?.customName || ''}
                            onChange={(e) => handleUpdateCocktail('WELCOME', undefined, e.target.value, getCocktailForType('WELCOME')?.customDescription)}
                          />
                          <input 
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white font-medium text-xs outline-none" 
                            placeholder="Brève description / Ingrédients..."
                            value={getCocktailForType('WELCOME')?.customDescription || ''}
                            onChange={(e) => handleUpdateCocktail('WELCOME', undefined, getCocktailForType('WELCOME')?.customName, e.target.value)}
                          />
                          
                          {/* HISTORIQUE ACCUEIL */}
                          {recentWelcomes.length > 0 && (
                              <div className="pt-2">
                                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Récents :</p>
                                  <div className="flex flex-wrap gap-2">
                                      {recentWelcomes.map(h => (
                                          <button 
                                            key={h.id} 
                                            onClick={() => handleUpdateCocktail('WELCOME', undefined, h.customName, h.customDescription)}
                                            className="bg-white border border-indigo-100 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-indigo-50 transition-colors"
                                          >
                                              {h.customName}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* COCKTAIL THALASSO */}
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center text-white font-black">4</div>
                          <div>
                              <h4 className="font-black text-slate-800 uppercase tracking-tight">Cocktail Thalasso</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Rotation Quotidienne (Cycle 4)</p>
                          </div>
                      </div>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none"
                        value={getCocktailForType('THALASSO')?.recipeId || ''}
                        onChange={(e) => handleUpdateCocktail('THALASSO', e.target.value)}
                      >
                          <option value="">-- Sélectionner une recette --</option>
                          {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                  </div>
              </div>
          </div>
      )}

      {/* TASKS & CALENDAR TABS (Existing content hidden for brevity as requested by diff logic, but included in full file) */}
      {activeTab === 'TASKS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LISTE ACTIVE */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                      En cours ({activeTasks.length})
                  </h3>
                  
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                        placeholder="Nouvelle tâche..."
                        value={newTaskContent}
                        onChange={e => setNewTaskContent(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                      />
                      <button onClick={handleAddTask} disabled={!newTaskContent.trim()} className="bg-indigo-600 text-white px-4 rounded-xl font-black text-xs uppercase hover:bg-indigo-700 disabled:opacity-50">+</button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                      {activeTasks.map(task => (
                          <div key={task.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3 group">
                              <button onClick={() => handleToggleTask(task)} className="mt-1 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"></button>
                              <div className="flex-1">
                                  <p className="font-bold text-slate-800 text-sm">{task.content}</p>
                                  <p className="text-[9px] font-bold text-slate-400 mt-1">Ajouté par {task.createdBy} • {new Date(task.createdAt).toLocaleDateString()}</p>
                              </div>
                              {currentUser.role === 'ADMIN' && (
                                  <button onClick={() => handleDeleteTask(task.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                              )}
                          </div>
                      ))}
                      {activeTasks.length === 0 && <p className="text-center text-slate-400 italic text-xs py-10">Rien à faire pour le moment !</p>}
                  </div>
              </div>

              {/* HISTORIQUE */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner flex flex-col h-[600px]">
                  <h3 className="font-black text-slate-500 uppercase tracking-tight mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                      Terminées Récemment
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                      {doneTasks.map(task => (
                          <div key={task.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-start gap-3 opacity-60 hover:opacity-100 transition-opacity">
                              <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              </div>
                              <div className="flex-1">
                                  <p className="font-bold text-slate-600 text-sm line-through">{task.content}</p>
                                  <p className="text-[9px] font-bold text-slate-400 mt-1">Fait par {task.doneBy} le {new Date(task.doneAt!).toLocaleDateString()}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

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
