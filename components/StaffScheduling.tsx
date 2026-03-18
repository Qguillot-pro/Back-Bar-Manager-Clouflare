
import React, { useState, useMemo } from 'react';
import { User, WorkShift, ActivityMoment, ScheduleConfig, Event, MealReservation } from '../types';
import { Calendar, Clock, Settings, TrendingUp, Plus, Trash2, Save, Printer, Sparkles, ChevronLeft, ChevronRight, Lock, Loader2, Search, Sun, Cloud, CloudRain, CloudLightning, Wind } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface StaffSchedulingProps {
  users: User[];
  workShifts: WorkShift[];
  activityMoments: ActivityMoment[];
  scheduleConfig: ScheduleConfig;
  events: Event[];
  absenceRequests: any[];
  onSync: (action: string, payload: any) => void;
  onSaveShift: (shift: WorkShift) => void;
  onDeleteShift: (id: string) => void;
  onSaveActivityMoment: (moment: ActivityMoment) => void;
  onDeleteActivityMoment: (id: string) => void;
  onSaveAbsenceRequest: (request: any) => void;
  onDeleteAbsenceRequest: (id: string) => void;
  onSaveConfig: (config: ScheduleConfig) => void;
  mealReservations: MealReservation[];
}

const StaffScheduling: React.FC<StaffSchedulingProps> = ({
  users,
  workShifts,
  activityMoments,
  scheduleConfig,
  events,
  absenceRequests,
  onSync,
  onSaveShift,
  onDeleteShift,
  onSaveActivityMoment,
  onDeleteActivityMoment,
  onSaveAbsenceRequest,
  onDeleteAbsenceRequest,
  onSaveConfig,
  mealReservations
}) => {
  const [activeTab, setActiveTab] = useState<'planning' | 'config' | 'activity' | 'absences'>('planning');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinError, setShowPinError] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isFetchingContext, setIsFetchingContext] = useState(false);
  const [externalContext, setExternalContext] = useState<{ holidays: string[], weather: string, legislation: string, dailyWeather?: { date: string, morning: string, afternoon: string }[] }>({
    holidays: [],
    weather: '',
    legislation: '',
    dailyWeather: []
  });

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const timeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }, [currentDate]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [startOfWeek]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') { // Simple PIN for demo, should be configurable
      setIsAdminUnlocked(true);
      setShowPinError(false);
    } else {
      setShowPinError(true);
      setPinInput('');
    }
  };

  const handleFetchContext = async () => {
    setIsFetchingContext(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const prompt = `Recherche les informations suivantes pour la semaine du ${weekDates[0]} à ${scheduleConfig.location}:
      1. Vacances scolaires (Zone A, B, C en France) et jours fériés.
      2. Prévisions météo simplifiées pour chaque jour (matin et après-midi). Choisis parmi: SUN, CLOUD, RAIN, STORM, WIND.
      3. Rappel rapide de la législation française sur le temps de travail (pauses, durée max, coupures).
      
      Réponds en JSON: { 
        "holidays": ["..."], 
        "weather": "Résumé global...", 
        "legislation": "...",
        "dailyWeather": [
          { "date": "YYYY-MM-DD", "morning": "SUN/CLOUD/RAIN/STORM/WIND", "afternoon": "SUN/CLOUD/RAIN/STORM/WIND" },
          ... (pour les 7 jours)
        ]
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setExternalContext(data);
    } catch (e) {
      console.error("Context Error", e);
    } finally {
      setIsFetchingContext(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Planning Hebdomadaire</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { bg-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
            .shift { margin-bottom: 4px; padding: 2px; background: #eef; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Planning du ${new Date(weekDates[0]).toLocaleDateString()} au ${new Date(weekDates[6]).toLocaleDateString()}</h1>
          </div>
          <table>
            <thead>
              <tr>
                <th>Employé</th>
                ${days.map(d => `<th>${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><strong>${u.name}</strong></td>
                  ${weekDates.map(date => {
                    const shifts = workShifts.filter(s => s.userId === u.id && s.date === date);
                    return `<td>${shifts.map(s => `<div class="shift">${s.startTime} - ${s.endTime}</div>`).join('')}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const prompt = `Génère un planning de travail optimisé pour la semaine du ${weekDates[0]} au ${weekDates[6]}.
      
      Paramètres:
      - Horaires d'ouverture: ${JSON.stringify(scheduleConfig.openingHours)}
      - Temps de mise en place: ${scheduleConfig.setupTimeMinutes} min
      - Temps de fermeture: ${scheduleConfig.closingTimeMinutes} min
      - Type de contrat: ${scheduleConfig.contractType}
      - Coupures autorisées: ${scheduleConfig.splitShiftAllowed}
      
      Employés: ${users.map(u => u.name).join(', ')}
      Moments d'activité: ${JSON.stringify(activityMoments)}
      Évènements: ${JSON.stringify(events)}
      
      Règles:
      1. Respecte la législation française (repos quotidien de 11h, durée max 10h/jour).
      2. Aligne le staff sur les moments de forte activité.
      3. Prévois une pause de 30 min après 6h de travail.
      
      Réponds UNIQUEMENT avec un tableau JSON d'objets WorkShift:
      [{ "userId": "id", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "breakMinutes": 30, "isSplitShift": false }]`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const generatedShifts = JSON.parse(response.text || '[]');
      if (Array.isArray(generatedShifts)) {
        generatedShifts.forEach(s => {
          const user = users.find(u => u.name === s.userId) || users[0];
          onSaveShift({
            ...s,
            id: `shift_ai_${Date.now()}_${Math.random()}`,
            userId: user.id
          });
        });
      }
    } catch (e) {
      console.error("Optimization Error", e);
      alert("Erreur lors de l'optimisation IA. Veuillez réessayer.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => u.showInMealPlanning === true);
  }, [users]);

  if (!isAdminUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] bg-slate-900/50 rounded-3xl border border-white/10">
        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-white/10 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Accès Administrateur</h2>
          <p className="text-slate-400 mb-8">Veuillez saisir votre code PIN pour accéder au module d'optimisation des plannings.</p>
          
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Code PIN"
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-center text-2xl tracking-[1em] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={4}
              autoFocus
            />
            {showPinError && <p className="text-rose-500 text-sm font-bold">Code PIN incorrect</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/50 uppercase tracking-widest"
            >
              Déverrouiller
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-white/20 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Optimisation Plannings</h1>
            <p className="text-slate-400 text-sm">Gérez et optimisez les horaires de votre équipe</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {externalContext.weather && (
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-900/50 rounded-xl border border-white/5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300">{externalContext.weather}</span>
            </div>
          )}
          <button
            onClick={handleFetchContext}
            disabled={isFetchingContext}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
          >
            {isFetchingContext ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
            Contexte IA
          </button>
          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-2xl border border-white/5">
            <button
              onClick={() => setActiveTab('planning')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'planning' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar className="w-4 h-4" />
              Planning
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'activity' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <TrendingUp className="w-4 h-4" />
              Activité
            </button>
            <button
              onClick={() => setActiveTab('absences')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'absences' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Clock className="w-4 h-4" />
              Absences
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'config' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Settings className="w-4 h-4" />
              Paramètres
            </button>
          </div>
        </div>
      </div>

      {externalContext.holidays.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-4">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-sm text-amber-200">
            <span className="font-black uppercase mr-2">Alertes IA:</span>
            {externalContext.holidays.join(', ')}
          </div>
        </div>
      )}

      {activeTab === 'planning' && (
        <PlanningGrid
          users={filteredUsers}
          workShifts={workShifts}
          weekDates={weekDates}
          days={days}
          timeSlots={timeSlots}
          onSaveShift={onSaveShift}
          onDeleteShift={onDeleteShift}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          onOptimize={handleOptimize}
          isOptimizing={isOptimizing}
          onPrint={handlePrint}
          absenceRequests={absenceRequests}
          dailyWeather={externalContext.dailyWeather}
          mealReservations={mealReservations}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityManager
          activityMoments={activityMoments}
          days={days}
          onSave={onSaveActivityMoment}
          onDelete={onDeleteActivityMoment}
          dailyWeather={externalContext.dailyWeather}
          weekDates={weekDates}
        />
      )}

      {activeTab === 'absences' && (
        <AbsenceManager
          users={users}
          absenceRequests={absenceRequests}
          onSave={onSaveAbsenceRequest}
          onDelete={onDeleteAbsenceRequest}
        />
      )}

      {activeTab === 'config' && (
        <ConfigManager
          config={scheduleConfig}
          onSave={onSaveConfig}
        />
      )}
    </div>
  );
};

// --- Sub-components ---

const WeatherIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'SUN': return <Sun className="w-4 h-4 text-amber-400" />;
    case 'CLOUD': return <Cloud className="w-4 h-4 text-slate-400" />;
    case 'RAIN': return <CloudRain className="w-4 h-4 text-blue-400" />;
    case 'STORM': return <CloudLightning className="w-4 h-4 text-indigo-400" />;
    case 'WIND': return <Wind className="w-4 h-4 text-slate-300" />;
    default: return null;
  }
};

const PlanningGrid = ({ users, workShifts, weekDates, days, timeSlots, onSaveShift, onDeleteShift, currentDate, setCurrentDate, onOptimize, isOptimizing, onPrint, absenceRequests, dailyWeather, mealReservations }: {
  users: User[],
  workShifts: WorkShift[],
  weekDates: string[],
  days: string[],
  timeSlots: string[],
  onSaveShift: (s: WorkShift) => void,
  onDeleteShift: (id: string) => void,
  currentDate: Date,
  setCurrentDate: (d: Date) => void,
  onOptimize: () => void,
  isOptimizing: boolean,
  onPrint: () => void,
  absenceRequests: any[],
  dailyWeather?: { date: string, morning: string, afternoon: string }[],
  mealReservations: MealReservation[]
}) => {
  const [selectedShift, setSelectedShift] = useState<WorkShift | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddShift = (date: string, time: string) => {
    const newShift: WorkShift = {
      id: `shift_${Date.now()}`,
      userId: users[0]?.id || '',
      date,
      startTime: time,
      endTime: `${(parseInt(time.split(':')[0]) + 7).toString().padStart(2, '0')}:00`,
      breakMinutes: 30,
      isSplitShift: false
    };
    setSelectedShift(newShift);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-800/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() - 7);
              setCurrentDate(d);
            }}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Semaine du {new Date(weekDates[0]).toLocaleDateString('fr-FR')}
          </h2>
          <button 
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() + 7);
              setCurrentDate(d);
            }}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-900/50"
          >
            {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Optimisation IA
          </button>
          <button 
            onClick={onPrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="grid grid-cols-8 border-b border-white/20">
            <div className="p-4 border-r border-white/20 bg-slate-950/50"></div>
            {days.map((day: string, i: number) => {
              const weather = dailyWeather?.find(w => w.date === weekDates[i]);
              return (
                <div key={day} className="p-4 text-center border-r border-white/20 last:border-r-0 bg-slate-950/50">
                  <div className="flex justify-center gap-2 mb-2">
                    {weather && (
                      <>
                        <div title="Matin"><WeatherIcon type={weather.morning} /></div>
                        <div title="Après-midi"><WeatherIcon type={weather.afternoon} /></div>
                      </>
                    )}
                  </div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</span>
                  <span className="block text-lg font-black text-white">{new Date(weekDates[i]).getDate()}</span>
                  
                  <div className="flex justify-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-rose-500/20 px-1.5 py-0.5 rounded-md border border-rose-500/30" title="Repas Staff">
                      <span className="text-[8px] font-black text-rose-400">R</span>
                      <span className="text-[9px] font-black text-white">{mealReservations.filter((r: MealReservation) => r.date === weekDates[i]).length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative h-[800px] overflow-y-auto custom-scrollbar">
            {timeSlots.map((time: string) => (
              <div key={time} className="grid grid-cols-8 border-b border-white/10 h-16 group">
                <div className="p-2 border-r border-white/20 text-[11px] font-black text-slate-400 text-right pr-4 bg-slate-950/20 flex items-center justify-end">
                  {time}
                </div>
                {weekDates.map((date: string) => {
                  const isRestDay = !workShifts.some(s => s.date === date);
                  const timeHour = parseInt(time.split(':')[0]);
                  
                  // Find absences for this specific hour
                  const hourAbsences = absenceRequests.filter(a => {
                    if (a.status !== 'APPROVED' && a.status !== 'PENDING') return false;
                    if (a.startDate > date || a.endDate < date) return false;
                    
                    // If it's a single day absence with times
                    if (a.startDate === date && a.endDate === date && a.startTime && a.endTime) {
                      const startH = parseInt(a.startTime.split(':')[0]);
                      const endH = parseInt(a.endTime.split(':')[0]);
                      return timeHour >= startH && timeHour < endH;
                    }
                    // Full day absence
                    return true;
                  });

                  // Find shifts covering this hour
                  const hourShifts = workShifts.filter(s => {
                    if (s.date !== date) return false;
                    const startH = parseInt(s.startTime.split(':')[0]);
                    const endH = parseInt(s.endTime.split(':')[0]);
                    // Handle shifts crossing midnight (though unlikely here)
                    if (endH < startH) return timeHour >= startH || timeHour < endH;
                    return timeHour >= startH && timeHour < endH;
                  });

                  return (
                    <div 
                      key={`${date}-${time}`} 
                      className={`border-r border-white/10 last:border-r-0 relative hover:bg-indigo-500/10 cursor-pointer transition-colors ${isRestDay ? 'bg-slate-950/30' : 'bg-slate-900/20'}`}
                      onClick={() => handleAddShift(date, time)}
                    >
                      {isRestDay && time === '12:00' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] rotate-45 text-white">Repos</span>
                        </div>
                      )}
                      
                      {hourAbsences.map(abs => (
                        <div key={abs.id} className={`absolute inset-0 ${abs.status === 'APPROVED' ? 'bg-rose-500/30' : 'bg-amber-500/20'} border-l-2 ${abs.status === 'APPROVED' ? 'border-rose-500' : 'border-amber-500'} z-0 flex items-center justify-center`}>
                          <span className="text-[8px] font-black uppercase tracking-tighter text-white/60 rotate-90 whitespace-nowrap">
                            {abs.status === 'APPROVED' ? 'ABSENCE' : 'ATTENTE'}
                          </span>
                        </div>
                      ))}

                      <div className="absolute inset-0 p-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar z-10">
                        {hourShifts.map((shift: WorkShift) => {
                          const user = users.find((u: User) => u.id === shift.userId);
                          const isStart = shift.startTime === time;
                          return (
                            <div
                              key={shift.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShift(shift);
                                setIsModalOpen(true);
                              }}
                              className={`w-full min-h-[20px] bg-indigo-600 rounded-md px-1.5 py-0.5 text-white shadow-md border border-white/20 flex flex-col justify-center ${!isStart ? 'opacity-80' : ''}`}
                            >
                              {isStart && (
                                <div className="text-[9px] font-black uppercase truncate leading-none mb-0.5">{user?.name}</div>
                              )}
                              <div className="text-[8px] font-bold opacity-70 leading-none">
                                {shift.startTime}-{shift.endTime}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && selectedShift && (
        <ShiftModal
          shift={selectedShift}
          users={users}
          onClose={() => setIsModalOpen(false)}
          onSave={(s: WorkShift) => {
            onSaveShift(s);
            setIsModalOpen(false);
          }}
          onDelete={(id: string) => {
            onDeleteShift(id);
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

const ShiftModal = ({ shift, users, onClose, onSave, onDelete }: {
  shift: WorkShift,
  users: User[],
  onClose: () => void,
  onSave: (s: WorkShift) => void,
  onDelete: (id: string) => void
}) => {
  const [editedShift, setEditedShift] = useState<WorkShift>({ ...shift });

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Détails du Shift</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Employé</label>
            <select
              value={editedShift.userId}
              onChange={(e) => setEditedShift({ ...editedShift, userId: e.target.value })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {users.map((u: User) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Début</label>
              <input
                type="time"
                value={editedShift.startTime}
                onChange={(e) => setEditedShift({ ...editedShift, startTime: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fin</label>
              <input
                type="time"
                value={editedShift.endTime}
                onChange={(e) => setEditedShift({ ...editedShift, endTime: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Pause (minutes)</label>
            <input
              type="number"
              value={editedShift.breakMinutes}
              onChange={(e) => setEditedShift({ ...editedShift, breakMinutes: parseInt(e.target.value) })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl border border-white/5">
            <input
              type="checkbox"
              id="isSplit"
              checked={editedShift.isSplitShift}
              onChange={(e) => setEditedShift({ ...editedShift, isSplitShift: e.target.checked })}
              className="w-5 h-5 rounded border-white/10 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isSplit" className="text-sm font-bold text-slate-300">Coupure autorisée</label>
          </div>
        </div>

        <div className="p-6 bg-slate-800/30 flex gap-3">
          <button
            onClick={() => onDelete(editedShift.id)}
            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
          <button
            onClick={() => onSave(editedShift)}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

const ActivityManager = ({ activityMoments, days, onSave, onDelete, dailyWeather, weekDates }: {
  activityMoments: ActivityMoment[],
  days: string[],
  onSave: (m: ActivityMoment) => void,
  onDelete: (id: string) => void,
  dailyWeather?: { date: string, morning: string, afternoon: string }[],
  weekDates: string[]
}) => {
  const [newMoment, setNewMoment] = useState<Partial<ActivityMoment>>({
    dayOfWeek: 1,
    startTime: '12:00',
    endTime: '14:00',
    level: 'HIGH',
    cycle: 'WEEKLY'
  });

  const handleAdd = () => {
    if (newMoment.dayOfWeek !== undefined && newMoment.startTime && newMoment.endTime && newMoment.level) {
      onSave({
        id: `moment_${Date.now()}`,
        ...newMoment
      } as ActivityMoment);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-8 rounded-3xl border border-white/20 shadow-2xl">
        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-indigo-400" />
          Configuration de l'Activité
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Jour</label>
            <select
              value={newMoment.dayOfWeek}
              onChange={(e) => setNewMoment({ ...newMoment, dayOfWeek: parseInt(e.target.value) })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500"
            >
              {days.map((day: string, i: number) => (
                <option key={day} value={i + 1}>{day}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Début</label>
            <input
              type="time"
              value={newMoment.startTime}
              onChange={(e) => setNewMoment({ ...newMoment, startTime: e.target.value })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fin</label>
            <input
              type="time"
              value={newMoment.endTime}
              onChange={(e) => setNewMoment({ ...newMoment, endTime: e.target.value })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Niveau</label>
            <select
              value={newMoment.level}
              onChange={(e) => setNewMoment({ ...newMoment, level: e.target.value as any })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white"
            >
              <option value="LOW">Faible</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="HIGH">Forte</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cycle</label>
            <select
              value={newMoment.cycle}
              onChange={(e) => setNewMoment({ ...newMoment, cycle: e.target.value as any })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white"
            >
              <option value="DAILY">Quotidien</option>
              <option value="WEEKLY">Hebdomadaire</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2 h-[46px]"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-white/10">
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jour / Météo</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horaires</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Niveau</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cycle</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activityMoments.map((m: ActivityMoment) => {
              const weather = dailyWeather?.find(w => w.date === weekDates[m.dayOfWeek - 1]);
              return (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white uppercase text-xs">{days[m.dayOfWeek - 1]}</span>
                      {weather && (
                        <div className="flex gap-1">
                          <WeatherIcon type={weather.morning} />
                          <WeatherIcon type={weather.afternoon} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-indigo-400 text-sm">{m.startTime} - {m.endTime}</td>
                <td className="p-4">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${m.level === 'HIGH' ? 'bg-rose-500/10 text-rose-400' : m.level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {m.level === 'HIGH' ? 'Forte' : m.level === 'MEDIUM' ? 'Moyenne' : 'Faible'}
                  </span>
                </td>
                <td className="p-4 text-slate-400 text-xs font-bold uppercase tracking-wider">{m.cycle === 'DAILY' ? 'Quotidien' : 'Hebdo'}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onDelete(m.id)}
                    className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
};

const ConfigManager = ({ config, onSave }: {
  config: ScheduleConfig,
  onSave: (c: ScheduleConfig) => void
}) => {
  const [editedConfig, setEditedConfig] = useState<ScheduleConfig>({ ...config });
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const handleLocationSearch = async () => {
    setIsSearchingLocation(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const prompt = `Valide et formate l'adresse suivante pour une utilisation météo: "${editedConfig.location}". 
      Réponds UNIQUEMENT avec l'adresse formatée (Ville, Pays).`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      
      if (response.text) {
        setEditedConfig({ ...editedConfig, location: response.text.trim() });
      }
    } catch (e) {
      console.error("Location Search Error", e);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  return (
    <div className="bg-slate-900 p-8 rounded-3xl border border-white/20 shadow-2xl space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Horaires d'ouverture
          </h3>
          <div className="space-y-3">
            {Object.entries(editedConfig.openingHours).map(([day, hours]: [string, any]) => (
              <div key={day} className="flex items-center gap-4 p-3 bg-slate-950/50 rounded-xl border border-white/10">
                <div className="w-24 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][parseInt(day)]}
                </div>
                <input
                  type="time"
                  value={hours.open}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    openingHours: {
                      ...editedConfig.openingHours,
                      [day]: { ...hours, open: e.target.value }
                    }
                  })}
                  className="bg-slate-800 border border-white/10 rounded-lg p-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-slate-600">à</span>
                <input
                  type="time"
                  value={hours.close}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    openingHours: {
                      ...editedConfig.openingHours,
                      [day]: { ...hours, close: e.target.value }
                    }
                  })}
                  className="bg-slate-800 border border-white/10 rounded-lg p-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="checkbox"
                  checked={hours.isOpen}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    openingHours: {
                      ...editedConfig.openingHours,
                      [day]: { ...hours, isOpen: e.target.checked }
                    }
                  })}
                  className="w-4 h-4 rounded border-white/10 bg-slate-900 text-indigo-600"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Paramètres Généraux
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Mise en place (min)</label>
              <input
                type="number"
                value={editedConfig.setupTimeMinutes}
                onChange={(e) => setEditedConfig({ ...editedConfig, setupTimeMinutes: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fermeture (min)</label>
              <input
                type="number"
                value={editedConfig.closingTimeMinutes}
                onChange={(e) => setEditedConfig({ ...editedConfig, closingTimeMinutes: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Localisation (Météo)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={editedConfig.location}
                    onChange={(e) => setEditedConfig({ ...editedConfig, location: e.target.value })}
                    placeholder="Ville, Pays..."
                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 pl-10 text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleLocationSearch}
                  disabled={isSearchingLocation}
                  className="px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-white/10 transition-all"
                >
                  {isSearchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Type de contrat</label>
              <select
                value={editedConfig.contractType}
                onChange={(e) => setEditedConfig({ ...editedConfig, contractType: e.target.value as any })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              >
                <option value="35H">35 Heures</option>
                <option value="39H">39 Heures</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Jours de repos</label>
              <select
                value={editedConfig.restDayPattern}
                onChange={(e) => setEditedConfig({ ...editedConfig, restDayPattern: e.target.value as any })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              >
                <option value="CONTINUOUS">Continus</option>
                <option value="SPLIT">Fractionnés</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ville (Météo)</label>
              <input
                type="text"
                value={editedConfig.location}
                onChange={(e) => setEditedConfig({ ...editedConfig, location: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
                placeholder="Ex: Paris"
              />
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
              <input
                type="checkbox"
                id="splitAllowed"
                checked={editedConfig.splitShiftAllowed}
                onChange={(e) => setEditedConfig({ ...editedConfig, splitShiftAllowed: e.target.checked })}
                className="w-5 h-5 rounded border-white/10 bg-slate-900 text-indigo-600"
              />
              <label htmlFor="splitAllowed" className="text-sm font-bold text-slate-300">Coupures autorisées par défaut</label>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-white/10 flex justify-end">
        <button
          onClick={() => onSave(editedConfig)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-12 py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/50 uppercase tracking-widest flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          Enregistrer les paramètres
        </button>
      </div>
    </div>
  );
};

const AbsenceManager = ({ users, absenceRequests, onSave, onDelete }: {
  users: User[],
  absenceRequests: any[],
  onSave: (a: any) => void,
  onDelete: (id: string) => void
}) => {
  const [newAbsence, setNewAbsence] = useState<any>({
    userId: users[0]?.id || '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    reason: '',
    status: 'PENDING'
  });

  const handleAdd = () => {
    if (newAbsence.userId && newAbsence.startDate && newAbsence.endDate) {
      onSave({
        id: `abs_${Date.now()}`,
        ...newAbsence
      });
      setNewAbsence({
        ...newAbsence,
        reason: '',
        startTime: '',
        endTime: ''
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'text-emerald-400 bg-emerald-500/10';
      case 'REJECTED': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-amber-400 bg-amber-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Validé';
      case 'REJECTED': return 'Refusé';
      default: return 'Non traité';
    }
  };

  const handleUpdateStatus = (abs: any, status: 'APPROVED' | 'REJECTED') => {
    onSave({ ...abs, status });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/10">
        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6">Nouvelle demande d'absence</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div className="lg:col-span-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Employé</label>
            <select
              value={newAbsence.userId}
              onChange={(e) => setNewAbsence({ ...newAbsence, userId: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Du</label>
            <input
              type="date"
              value={newAbsence.startDate}
              onChange={(e) => setNewAbsence({ ...newAbsence, startDate: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Au</label>
            <input
              type="date"
              value={newAbsence.endDate}
              onChange={(e) => setNewAbsence({ ...newAbsence, endDate: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Motif</label>
            <input
              type="text"
              value={newAbsence.reason}
              onChange={(e) => setNewAbsence({ ...newAbsence, reason: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              placeholder="Ex: Congés payés"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Heure Début (Opt.)</label>
            <input
              type="time"
              value={newAbsence.startTime}
              onChange={(e) => setNewAbsence({ ...newAbsence, startTime: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Heure Fin (Opt.)</label>
            <input
              type="time"
              value={newAbsence.endTime}
              onChange={(e) => setNewAbsence({ ...newAbsence, endTime: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <button
            onClick={handleAdd}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Soumettre
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...absenceRequests].sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map((abs: any) => {
          const user = users.find(u => u.id === abs.userId);
          return (
            <div key={abs.id} className="bg-slate-800/50 p-6 rounded-3xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white font-black">
                    {user?.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="text-white font-bold">{user?.name}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {new Date(abs.startDate).toLocaleDateString()} - {new Date(abs.endDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(abs.status)}`}>
                  {getStatusLabel(abs.status)}
                </div>
              </div>

              {abs.reason && (
                <p className="text-sm text-slate-400 italic">"{abs.reason}"</p>
              )}

              {(abs.startTime || abs.endTime) && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {abs.startTime || '00:00'} - {abs.endTime || '23:59'}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {abs.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => onSave({ ...abs, status: 'APPROVED' })}
                      className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => onSave({ ...abs, status: 'REJECTED' })}
                      className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                    >
                      Refuser
                    </button>
                  </>
                )}
                <button
                  onClick={() => onDelete(abs.id)}
                  className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StaffScheduling;
