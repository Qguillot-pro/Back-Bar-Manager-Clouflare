
import React, { useState, useMemo } from 'react';
import { User, DailyCocktail, Message, Task, MealReservation, Recipe, AppConfig } from '../types';

interface DailyBriefingModalProps {
    user: User;
    dailyCocktails: DailyCocktail[];
    messages: Message[];
    tasks: Task[];
    mealReservations: MealReservation[];
    users: User[];
    recipes: Recipe[];
    appConfig: AppConfig;
    onClose: () => void;
    todayDate?: string;
}

const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
    user,
    dailyCocktails,
    messages,
    tasks,
    mealReservations,
    users,
    recipes,
    appConfig,
    onClose,
    todayDate
}) => {
    const [checkedItems, setCheckedItems] = useState({
        cocktails: false,
        messages: false,
        tasks: false,
        meals: false
    });

    // Helper Bar Day
    const getBarDateStr = (d: Date = new Date()) => {
        const shift = new Date(d);
        const barDayStart = appConfig.barDayStart || '04:00';
        const [h, m] = barDayStart.split(':').map(Number);
        if (shift.getHours() < h || (shift.getHours() === h && shift.getMinutes() < m)) {
            shift.setDate(shift.getDate() - 1);
        }
        const y = shift.getFullYear();
        const mm = String(shift.getMonth() + 1).padStart(2, '0');
        const dd = String(shift.getDate()).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    };

    const today = todayDate || getBarDateStr();
    
    // Calculate yesterday based on today string
    const yesterday = useMemo(() => {
        const [y, m, d] = today.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        date.setUTCDate(date.getUTCDate() - 1);
        const yy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }, [today]);

    console.log('DailyBriefingModal - today:', today);
    console.log('DailyBriefingModal - yesterday:', yesterday);
    console.log('DailyBriefingModal - dailyCocktails:', dailyCocktails);

    const todayCocktails = useMemo(() => {
        return dailyCocktails.filter(c => c.date === today && (c.type === 'OF_THE_DAY' || c.type === 'MOCKTAIL'));
    }, [dailyCocktails, today]);

    const yesterdayCocktails = useMemo(() => {
        return dailyCocktails.filter(c => c.date === yesterday && (c.type === 'OF_THE_DAY' || c.type === 'MOCKTAIL'));
    }, [dailyCocktails, yesterday]);

    const hasCocktailChanged = (type: string) => {
        const todayC = todayCocktails.find(c => c.type === type);
        const yesterdayC = yesterdayCocktails.find(c => c.type === type);
        if (!todayC) return false;
        if (!yesterdayC) return true; // New today, wasn't there yesterday
        return todayC.recipeId !== yesterdayC.recipeId;
    };

    const latestMessages = useMemo(() => {
        return messages.filter(m => !m.isArchived).slice(0, 2);
    }, [messages]);

    const pendingTasks = useMemo(() => {
        return tasks.filter(t => !t.isDone).slice(0, 3);
    }, [tasks]);

    const todayMeals = useMemo(() => {
        return mealReservations.filter(r => r.date === today);
    }, [mealReservations, today]);

    const lunchCount = todayMeals.filter(r => r.slot === 'LUNCH').length;
    const dinnerCount = todayMeals.filter(r => r.slot === 'DINNER').length;

    const allChecked = Object.values(checkedItems).every(v => v);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-black mb-1">Bonjour {user.name} !</h2>
                        <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs opacity-80">Briefing du jour • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    
                    {/* Cocktails */}
                    <div className={`p-6 rounded-3xl border-2 transition-all ${checkedItems.cocktails ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                                Cocktails du Jour
                            </h3>
                            <input 
                                type="checkbox" 
                                checked={checkedItems.cocktails} 
                                onChange={(e) => setCheckedItems(p => ({ ...p, cocktails: e.target.checked }))}
                                className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['OF_THE_DAY', 'MOCKTAIL'].map(type => {
                                const dc = todayCocktails.find(c => c.type === type);
                                const recipe = recipes.find(r => r.id === dc?.recipeId);
                                const changed = hasCocktailChanged(type);
                                return (
                                    <div key={type} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{type === 'OF_THE_DAY' ? 'Cocktail' : 'Mocktail'}</span>
                                            {changed && (
                                                <div className="animate-pulse flex items-center gap-1 text-amber-500">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    <span className="text-[8px] font-black uppercase">Nouveau !</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="font-black text-slate-800 truncate">
                                            {recipe?.name || dc?.customName || 'Non défini'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className={`p-6 rounded-3xl border-2 transition-all ${checkedItems.messages ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                                Messages d'équipe
                            </h3>
                            <input 
                                type="checkbox" 
                                checked={checkedItems.messages} 
                                onChange={(e) => setCheckedItems(p => ({ ...p, messages: e.target.checked }))}
                                className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </div>
                        <div className="space-y-3">
                            {latestMessages.length > 0 ? latestMessages.map(m => (
                                <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{m.userName}</span>
                                        <span className="text-[9px] text-slate-400 font-bold">{new Date(m.date).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium line-clamp-2 italic">"{m.content}"</p>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-400 font-bold text-center py-2">Aucun message récent</p>
                            )}
                        </div>
                    </div>

                    {/* Tasks */}
                    <div className={`p-6 rounded-3xl border-2 transition-all ${checkedItems.tasks ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                Tâches à faire
                            </h3>
                            <input 
                                type="checkbox" 
                                checked={checkedItems.tasks} 
                                onChange={(e) => setCheckedItems(p => ({ ...p, tasks: e.target.checked }))}
                                className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </div>
                        <div className="space-y-2">
                            {pendingTasks.length > 0 ? pendingTasks.map(t => (
                                <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                    <p className="text-xs font-bold text-slate-700">{t.content}</p>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-400 font-bold text-center py-2">Toutes les tâches sont terminées !</p>
                            )}
                        </div>
                    </div>

                    {/* Meals */}
                    <div className={`p-6 rounded-3xl border-2 transition-all ${checkedItems.meals ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                                Repas du Jour
                            </h3>
                            <input 
                                type="checkbox" 
                                checked={checkedItems.meals} 
                                onChange={(e) => setCheckedItems(p => ({ ...p, meals: e.target.checked }))}
                                className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Midi</span>
                                    <span className="text-xl font-black text-rose-600">{lunchCount}</span>
                                </div>
                                <div className="flex -space-x-1.5 overflow-hidden">
                                    {todayMeals
                                        .filter(r => r.slot === 'LUNCH')
                                        .map(r => {
                                            const u = users.find(u => u.id === r.userId);
                                            if (!u) return null;
                                            return (
                                                <div key={r.id} className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-rose-50 flex items-center justify-center overflow-hidden" title={u.name}>
                                                    <span className="text-[7px] font-black text-rose-600">{u.name.substring(0, 2).toUpperCase()}</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                            <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Soir</span>
                                    <span className="text-xl font-black text-rose-900">{dinnerCount}</span>
                                </div>
                                <div className="flex -space-x-1.5 overflow-hidden">
                                    {todayMeals
                                        .filter(r => r.slot === 'DINNER')
                                        .map(r => {
                                            const u = users.find(u => u.id === r.userId);
                                            if (!u) return null;
                                            return (
                                                <div key={r.id} className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-rose-50 flex items-center justify-center overflow-hidden" title={u.name}>
                                                    <span className="text-[7px] font-black text-rose-600">{u.name.substring(0, 2).toUpperCase()}</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 border-t border-slate-100">
                    <button 
                        disabled={!allChecked}
                        onClick={onClose}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl ${allChecked ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {allChecked ? 'J\'ai pris connaissance des informations' : 'Veuillez cocher toutes les sections'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyBriefingModal;
