
import React, { useState, useMemo } from 'react';
import { Task, Event, EventComment, User, StockItem } from '../types';

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
}

const DailyLife: React.FC<DailyLifeProps> = ({ tasks, events, eventComments, currentUser, items, onSync, setTasks, setEvents, setEventComments }) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'CALENDAR'>('TASKS');
  
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      
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
      </div>

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

      {/* EVENT MODAL */}
      {isEventModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center shrink-0">
                      <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">{selectedEvent ? 'Détails Événement' : 'Nouvel Événement'}</h3>
                      <button onClick={closeEventModal} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* ADMIN EDIT FORM */}
                      {currentUser.role === 'ADMIN' ? (
                          <div className="space-y-4">
                              <input className="w-full bg-slate-50 p-3 rounded-xl border font-bold text-lg outline-none" placeholder="Titre..." value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} />
                              <div className="grid grid-cols-2 gap-4">
                                  <div><label className="text-[9px] font-black uppercase text-slate-400 ml-1">Début</label><input type="datetime-local" className="w-full bg-slate-50 p-3 rounded-xl border font-bold text-sm outline-none" value={newEventStart} onChange={e => setNewEventStart(e.target.value)} /></div>
                                  <div><label className="text-[9px] font-black uppercase text-slate-400 ml-1">Fin</label><input type="datetime-local" className="w-full bg-slate-50 p-3 rounded-xl border font-bold text-sm outline-none" value={newEventEnd} onChange={e => setNewEventEnd(e.target.value)} /></div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <input className="w-full bg-slate-50 p-3 rounded-xl border font-bold text-sm outline-none" placeholder="Lieu..." value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} />
                                  <input type="number" className="w-full bg-slate-50 p-3 rounded-xl border font-bold text-sm outline-none" placeholder="Nb Invités..." value={newEventGuests || ''} onChange={e => setNewEventGuests(parseInt(e.target.value))} />
                              </div>
                              <textarea className="w-full bg-slate-50 p-3 rounded-xl border font-medium text-sm outline-none resize-none h-24" placeholder="Description (max 150)..." maxLength={150} value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)}></textarea>
                              
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-2">Produits à prévoir (Sera marqué "EVENT" en prépa cave)</label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-white p-2 rounded-lg border text-xs font-bold mb-2" 
                                    placeholder="Rechercher produit..." 
                                    value={productSearch} 
                                    onChange={e => setProductSearch(e.target.value)} 
                                  />
                                  <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
                                      {items.filter(i => i.name.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5).map(i => (
                                          <div key={i.id} onClick={() => toggleProduct(i.id)} className={`p-2 rounded-lg text-xs font-bold cursor-pointer flex justify-between ${newEventProducts.includes(i.id) ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                                              {i.name}
                                              {newEventProducts.includes(i.id) && <span>✓</span>}
                                          </div>
                                      ))}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                      {newEventProducts.map(id => {
                                          const it = items.find(i => i.id === id);
                                          return it ? <span key={id} onClick={() => toggleProduct(id)} className="bg-indigo-600 text-white text-[9px] font-black px-2 py-1 rounded cursor-pointer">{it.name} ✕</span> : null;
                                      })}
                                  </div>
                              </div>
                          </div>
                      ) : (
                          // VIEW ONLY FOR NON-ADMIN
                          <div className="space-y-4">
                              <div>
                                  <h2 className="text-2xl font-black text-slate-900">{selectedEvent?.title}</h2>
                                  <p className="text-xs font-bold text-slate-500 mt-1">
                                      {selectedEvent && new Date(selectedEvent.startTime).toLocaleString()} - {selectedEvent && new Date(selectedEvent.endTime).toLocaleTimeString()}
                                  </p>
                              </div>
                              <div className="flex gap-4">
                                  <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold text-slate-700">📍 {selectedEvent?.location || 'Bar'}</div>
                                  <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold text-slate-700">👥 {selectedEvent?.guestsCount} pers.</div>
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed p-4 bg-slate-50 rounded-2xl border border-slate-100">{selectedEvent?.description || 'Aucune description.'}</p>
                              
                              {newEventProducts.length > 0 && (
                                  <div>
                                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Produits Spéciaux</p>
                                      <div className="flex flex-wrap gap-2">
                                          {newEventProducts.map(id => {
                                              const it = items.find(i => i.id === id);
                                              return it ? <span key={id} className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded border border-amber-200">{it.name}</span> : null;
                                          })}
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}

                      {/* COMMENTS SECTION */}
                      {selectedEvent && (
                          <div className="border-t border-slate-100 pt-6">
                              <h4 className="font-black text-xs uppercase text-slate-400 mb-4">Commentaires</h4>
                              <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                                  {eventComments.filter(c => c.eventId === selectedEvent.id).map(c => (
                                      <div key={c.id} className="bg-slate-50 p-3 rounded-xl text-sm">
                                          <p className="font-bold text-slate-900 text-xs mb-1">{c.userName} <span className="text-[9px] text-slate-400 font-normal">• {new Date(c.createdAt).toLocaleDateString()}</span></p>
                                          <p className="text-slate-600">{c.content}</p>
                                      </div>
                                  ))}
                                  {eventComments.filter(c => c.eventId === selectedEvent.id).length === 0 && <p className="text-xs text-slate-400 italic">Aucun commentaire.</p>}
                              </div>
                              <div className="flex gap-2">
                                  <input className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Écrire un commentaire..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
                                  <button onClick={handleAddComment} disabled={!newComment.trim()} className="bg-slate-900 text-white px-4 rounded-xl font-black text-[10px] uppercase hover:bg-slate-700 disabled:opacity-50">Envoyer</button>
                              </div>
                          </div>
                      )}
                  </div>

                  {currentUser.role === 'ADMIN' && (
                      <div className="p-6 border-t bg-slate-50 flex justify-between">
                          <button onClick={handleDeleteEvent} className="text-rose-500 font-black text-xs uppercase hover:underline">Supprimer</button>
                          <button onClick={handleCreateEvent} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-lg">Enregistrer</button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default DailyLife;
