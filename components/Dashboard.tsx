
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StockItem, Category, StockLevel, StockConsigne, DLCHistory, DLCProfile, UserRole, Transaction, Message, Event, Task, DailyCocktail, Recipe, Glassware, DailyCocktailType, AppConfig, CycleConfig } from '../types';

interface DashboardProps {
  items: StockItem[];
  stockLevels: StockLevel[];
  consignes: StockConsigne[];
  categories: Category[];
  dlcHistory?: DLCHistory[];
  dlcProfiles?: DLCProfile[];
  userRole?: UserRole;
  transactions?: Transaction[];
  messages: Message[];
  events?: Event[];
  tasks?: Task[];
  currentUserName: string;
  onNavigate: (view: string) => void;
  onSendMessage: (text: string) => void;
  onArchiveMessage: (id: string) => void;
  dailyCocktails?: DailyCocktail[];
  recipes?: Recipe[];
  glassware?: Glassware[];
  onUpdateDailyCocktail?: (cocktail: DailyCocktail) => void;
  appConfig: AppConfig; // AJOUT
}

const Dashboard: React.FC<DashboardProps> = ({ items, stockLevels, consignes, categories, dlcHistory = [], dlcProfiles = [], userRole, transactions = [], messages, events = [], tasks = [], currentUserName, onNavigate, onSendMessage, onArchiveMessage, dailyCocktails = [], recipes = [], glassware = [], onUpdateDailyCocktail, appConfig }) => {
  const [newMessageText, setNewMessageText] = useState('');
  const [selectedCocktailRecipe, setSelectedCocktailRecipe] = useState<Recipe | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeCustomName, setWelcomeCustomName] = useState('');

  // 1. KPI Alertes Réappro
  const totalRestockNeeded = useMemo(() => {
      let total = 0;
      consignes.forEach(c => {
          const level = stockLevels.find(l => l.itemId === c.itemId && l.storageId === c.storageId);
          const current = level?.currentQuantity || 0;
          if (current < c.minQuantity) {
              total += (c.minQuantity - current);
          }
      });
      return Math.ceil(total);
  }, [consignes, stockLevels]);

  // 2. KPI DLC Expirées
  const expiredDlcCount = useMemo(() => {
      return dlcHistory.filter(h => {
        const item = items.find(i => i.id === h.itemId);
        const profile = dlcProfiles.find(p => p.id === item?.dlcProfileId);
        if (!profile) return false;
        const expirationDate = new Date(new Date(h.openedAt).getTime() + profile.durationHours * 60 * 60 * 1000);
        return new Date() > expirationDate;
    }).length;
  }, [dlcHistory, items, dlcProfiles]);
  
  const totalItemsCount = items.length;

  // Helper Bar Day
  const getBarDateStr = (d: Date = new Date()) => {
      const shift = new Date(d);
      if (shift.getHours() < 4) shift.setDate(shift.getDate() - 1);
      return shift.toISOString().split('T')[0];
  };

  const currentBarDate = getBarDateStr();

  // 3. Chart Data
  const restockHistoryData = useMemo(() => {
    const data = [];
    const today = new Date();
    if (today.getHours() < 4) today.setDate(today.getDate() - 1);
    today.setHours(4,0,0,0);

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString('fr-FR', { weekday: 'short' });
        const shiftEnd = new Date(d);
        shiftEnd.setDate(shiftEnd.getDate() + 1);

        const dailyTotal = transactions
            .filter(t => t.type === 'IN' && t.isCaveTransfer)
            .filter(t => {
                const tDate = new Date(t.date);
                return tDate >= d && tDate < shiftEnd;
            })
            .reduce((acc, curr) => acc + curr.quantity, 0);

        data.push({ name: dayStr, value: dailyTotal });
    }
    return data;
  }, [transactions]);

  // 4. Messages & Vie Quotidienne Data
  const activeMessages = useMemo(() => messages.filter(m => !m.isArchived).slice(0, 5), [messages]);
  const upcomingEvents = useMemo(() => events.filter(e => new Date(e.endTime) >= new Date()).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).slice(0, 3), [events]);
  const pendingTasksCount = useMemo(() => {
      const now = new Date();
      const startOfShift = new Date(now);
      if (now.getHours() < 4) startOfShift.setDate(now.getDate() - 1);
      startOfShift.setHours(4, 0, 0, 0);
      const currentDayOfWeek = startOfShift.getDay();

      return tasks.filter(t => {
          if (!t.recurrence || t.recurrence.length === 0) return !t.isDone;
          if (t.recurrence.includes(currentDayOfWeek)) {
              if (t.doneAt) {
                  const doneDate = new Date(t.doneAt);
                  return doneDate < startOfShift;
              }
              return true;
          }
          return false;
      }).length;
  }, [tasks]);

  // 5. Cocktails Data - CYCLE CALCULATION LOGIC DUPLICATED HERE FOR AUTONOMY
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

  const getCalculatedCocktail = (type: DailyCocktailType): DailyCocktail | undefined => {
      // 1. Check manual entry first
      const manualEntry = dailyCocktails.find(c => c.date === currentBarDate && c.type === type);
      if (manualEntry) return manualEntry;

      // 2. Calculate cycle
      const config = getCycleConfig(type);
      if (!config.isActive || config.recipeIds.length === 0) return undefined;

      const diffDays = getDayDiff(currentBarDate, config.startDate);
      if (diffDays < 0) return undefined;

      let index = 0;
      const listLen = config.recipeIds.length;
      
      const cleanTargetDate = currentBarDate.split('T')[0];
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
      
      return { id: `calc-${currentBarDate}-${type}`, date: currentBarDate, type, recipeId: config.recipeIds[index] };
  };

  const getCocktailInfo = (type: string) => {
      // Use the calculation logic directly
      const c = getCalculatedCocktail(type as DailyCocktailType);
      
      let name = 'Non défini';
      let recipe: Recipe | undefined;

      if (c) {
          if (c.customName) {
              name = c.customName;
          } else if (c.recipeId) {
              recipe = recipes.find(r => r.id === c.recipeId);
              name = recipe?.name || 'Recette Inconnue';
          }
      }
      
      // Determine if manual override (warning) exists
      const isManual = dailyCocktails.some(dc => dc.date === currentBarDate && dc.type === type);
      
      return { name, recipe, hasWarning: isManual };
  };

  const handlePostMessage = () => {
      if (newMessageText.length > 0 && newMessageText.length <= 300) {
          onSendMessage(newMessageText);
          setNewMessageText('');
      }
  };

  const handleCocktailClick = (type: string) => {
      const info = getCocktailInfo(type);
      
      if (type === 'WELCOME') {
          // Open edit modal if welcome
          const c = dailyCocktails.find(dc => dc.date === currentBarDate && dc.type === 'WELCOME');
          setWelcomeCustomName(c?.customName || '');
          setIsWelcomeModalOpen(true);
          return;
      }

      if (info.recipe) {
          setSelectedCocktailRecipe(info.recipe);
      } else {
          // Si pas de recette, on redirige vers la configuration (Vie Quotidienne)
          onNavigate('daily_life:COCKTAILS');
      }
  };

  const handleSaveWelcome = () => {
      if (onUpdateDailyCocktail) {
          const existing = dailyCocktails.find(c => c.date === currentBarDate && c.type === 'WELCOME');
          const id = existing ? existing.id : `dc_${currentBarDate}_WELCOME_${Date.now()}`;
          onUpdateDailyCocktail({
              id,
              date: currentBarDate,
              type: 'WELCOME',
              customName: welcomeCustomName
          });
      }
      setIsWelcomeModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* COCKTAIL DETAIL MODAL (READ ONLY) */}
      {selectedCocktailRecipe && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="relative h-24 bg-slate-900 flex items-center justify-center p-6 shrink-0">
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter text-center">{selectedCocktailRecipe.name}</h2>
                      <button onClick={() => setSelectedCocktailRecipe(null)} className="absolute top-4 right-4 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Verrerie</p>
                              <p className="font-bold text-slate-800 text-sm">
                                  {glassware?.find(g => g.id === selectedCocktailRecipe.glasswareId)?.name || 'Standard'}
                              </p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Technique</p>
                              <p className="font-bold text-slate-800 text-sm">{selectedCocktailRecipe.technique}</p>
                          </div>
                      </div>
                      <div>
                          <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-3 border-b pb-2">Recette</h3>
                          <ul className="space-y-2">
                              {selectedCocktailRecipe.ingredients.map((ing, i) => (
                                  <li key={i} className="flex justify-between items-center text-sm font-bold text-slate-700">
                                      <span>{ing.itemId ? items.find(it => it.id === ing.itemId)?.name : ing.tempName}</span>
                                      <span className="bg-slate-100 px-2 py-1 rounded text-slate-900">{ing.quantity} {ing.unit}</span>
                                  </li>
                              ))}
                          </ul>
                          {selectedCocktailRecipe.decoration && (
                              <p className="mt-4 text-xs font-bold text-slate-500 italic">Garnish: {selectedCocktailRecipe.decoration}</p>
                          )}
                      </div>
                      {selectedCocktailRecipe.description && (
                          <div className="bg-indigo-50 p-4 rounded-xl text-indigo-900 text-xs leading-relaxed border border-indigo-100">
                              <p>{selectedCocktailRecipe.description}</p>
                          </div>
                      )}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                        <button 
                            onClick={() => onNavigate('daily_life:COCKTAILS')} 
                            className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 flex items-center gap-2"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Gérer le programme
                        </button>
                  </div>
              </div>
          </div>
      )}

      {/* WELCOME EDIT MODAL */}
      {isWelcomeModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Cocktail d'Accueil</h3>
                  <p className="text-xs text-slate-500 mb-4">Saisissez la recette ou les ingrédients du jour.</p>
                  <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-900 outline-none mb-4"
                      placeholder="Ex: Punch Planteur (Rhum, Jus, Sirop)"
                      value={welcomeCustomName}
                      onChange={e => setWelcomeCustomName(e.target.value)}
                      autoFocus
                  />
                  <div className="flex gap-2">
                      <button onClick={() => setIsWelcomeModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-200">Annuler</button>
                      <button onClick={handleSaveWelcome} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700">Enregistrer</button>
                  </div>
              </div>
          </div>
      )}

      {/* COCKTAILS DU MOMENT */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-30 pointer-events-none"></div>
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
              <div className="space-y-2">
                  <h2 className="text-2xl font-black uppercase tracking-tighter italic">Carte du Moment</h2>
                  <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
                  {['OF_THE_DAY', 'MOCKTAIL', 'WELCOME', 'THALASSO'].map(type => {
                      const info = getCocktailInfo(type);
                      const labels: Record<string, string> = { OF_THE_DAY: 'Du Jour', MOCKTAIL: 'Mocktail', WELCOME: 'Accueil', THALASSO: 'Thalasso' };
                      const colors: Record<string, string> = { OF_THE_DAY: 'text-amber-400', MOCKTAIL: 'text-emerald-400', WELCOME: 'text-indigo-300', THALASSO: 'text-cyan-300' };
                      const icons: Record<string, string> = { OF_THE_DAY: '🍸', MOCKTAIL: '🍹' };
                      
                      return (
                          <div 
                            key={type} 
                            onClick={() => handleCocktailClick(type)}
                            className={`bg-white/10 p-4 rounded-2xl border border-white/10 flex flex-col justify-between h-32 transition-all relative hover:bg-white/20 cursor-pointer`}
                          >
                              {info.hasWarning && (
                                  <div className="absolute top-2 right-2 text-amber-400 animate-pulse" title="Saisie Manuelle">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </div>
                              )}
                              <div className="flex justify-between items-start">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${colors[type]}`}>{labels[type]}</span>
                                  {icons[type] && <span className="text-[10px]">{icons[type]}</span>}
                              </div>
                              <p className={`font-bold text-sm leading-tight line-clamp-2 ${info.name === 'Non défini' ? 'opacity-50 italic' : ''}`}>{info.name}</p>
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>

      {/* KPIS */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6`}>
        <div onClick={() => onNavigate('restock')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Unités à Remonter</p>
            {totalRestockNeeded === 0 ? (
                <div className="flex items-center gap-2"><p className="text-4xl font-black text-emerald-500">OK</p><span className="bg-emerald-100 text-emerald-600 rounded-full p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></span></div>
            ) : (<p className="text-4xl font-black text-rose-500">{totalRestockNeeded} <span className="text-lg opacity-50 font-bold">UNIT.</span></p>)}
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${totalRestockNeeded > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg></div>
        </div>
        
        <div onClick={() => onNavigate('dlc_tracking')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Alertes DLC Expirées</p>
              {expiredDlcCount === 0 ? (
                <div className="flex items-center gap-2"><p className="text-4xl font-black text-emerald-500">OK</p><span className="bg-emerald-100 text-emerald-600 rounded-full p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></span></div>
              ) : (<p className="text-4xl font-black text-rose-500">{expiredDlcCount} <span className="text-lg opacity-50 font-bold">PROD.</span></p>)}
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${expiredDlcCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
        </div>

        <div onClick={() => onNavigate('articles')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all group">
          <div><p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Base Articles</p><p className="text-4xl font-black text-slate-900">{totalItemsCount} <span className="text-lg opacity-50 font-bold">RÉF.</span></p></div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></div>
        </div>
      </div>

      {/* VIE QUOTIDIENNE WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div onClick={() => onNavigate('daily_life:CALENDAR')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-bl-[4rem] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <h3 className="font-black text-sm uppercase tracking-widest text-indigo-900 mb-4 relative z-10 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Agenda
              </h3>
              <div className="space-y-3 relative z-10">
                  {upcomingEvents.length > 0 ? upcomingEvents.map(evt => (
                      <div key={evt.id} className="flex items-center gap-3">
                          <div className="bg-indigo-100 text-indigo-700 font-bold text-[10px] px-2 py-1 rounded text-center min-w-[3.5rem]">
                              {new Date(evt.startTime).getDate()} {new Date(evt.startTime).toLocaleDateString('fr-FR', {month:'short'})}
                          </div>
                          <div>
                              <p className="font-bold text-sm text-slate-800 truncate">{evt.title}</p>
                              <p className="text-[10px] text-slate-400">{evt.startTime.slice(11,16)} - {evt.location || 'Bar'}</p>
                          </div>
                      </div>
                  )) : <p className="text-slate-400 italic text-xs">Aucun événement à venir.</p>}
              </div>
          </div>

          <div onClick={() => onNavigate('daily_life:TASKS')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-amber-300 transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[4rem] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <h3 className="font-black text-sm uppercase tracking-widest text-amber-800 mb-4 relative z-10 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  Tâches à faire
              </h3>
              <div className="flex items-center justify-between relative z-10">
                  <div>
                      <p className="text-3xl font-black text-slate-800">{pendingTasksCount}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En attente</p>
                  </div>
                  <button className="bg-amber-500 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-200">Voir</button>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
          <h3 className="flex-none text-sm font-black uppercase tracking-widest mb-8 text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
            Volume Remontées Cave (7 Jours)
          </h3>
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={restockHistoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8'}} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MESSAGERIE */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 h-[500px] flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
              <h3 className="flex-none text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                Messages Équipe
              </h3>
              <button onClick={() => onNavigate('messages')} className="text-[10px] font-bold text-indigo-500 hover:underline uppercase">Tout voir</button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
              {activeMessages.map(msg => (
                  <div key={msg.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{msg.userName}</span>
                              <span className="text-[9px] text-slate-400">{new Date(msg.date).toLocaleDateString()} {new Date(msg.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                          {userRole === 'ADMIN' && (
                              <button onClick={() => onArchiveMessage(msg.id)} className="text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Archiver"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg></button>
                          )}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{msg.content}</p>
                      {msg.adminReply && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-[9px] font-black uppercase text-indigo-400">Réponse Admin</p>
                              <p className="text-xs text-indigo-800">{msg.adminReply}</p>
                          </div>
                      )}
                  </div>
              ))}
              {activeMessages.length === 0 && <p className="text-center text-slate-400 italic py-10 text-xs">Aucun message récent.</p>}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100">
              <div className="relative">
                  <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none resize-none" rows={3} placeholder="Laisser un message à l'équipe..." maxLength={300} value={newMessageText} onChange={e => setNewMessageText(e.target.value)}></textarea>
                  <div className="flex justify-between items-center mt-2">
                      <span className="text-[9px] font-bold text-slate-300">{newMessageText.length}/300</span>
                      <button onClick={handlePostMessage} disabled={!newMessageText.trim()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all">Envoyer</button>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
