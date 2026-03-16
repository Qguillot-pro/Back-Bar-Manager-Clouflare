
import React, { useState, useMemo } from 'react';
import { User, WorkShift, ActivityMoment, ScheduleConfig, Event, MealReservation } from '../types';
import { Calendar, Clock, Settings, TrendingUp, Plus, Trash2, Save, Printer, Sparkles, ChevronLeft, ChevronRight, Lock, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface StaffSchedulingProps {
  users: User[];
  workShifts: WorkShift[];
  activityMoments: ActivityMoment[];
  scheduleConfig: ScheduleConfig;
  events: Event[];
  mealReservations: MealReservation[];
  absenceRequests: any[];
  onSync: (action: string, payload: any) => void;
  onSaveShift: (shift: WorkShift) => void;
  onDeleteShift: (id: string) => void;
  onSaveActivityMoment: (moment: ActivityMoment) => void;
  onDeleteActivityMoment: (id: string) => void;
  onSaveAbsenceRequest: (request: any) => void;
  onDeleteAbsenceRequest: (id: string) => void;
  onSaveConfig: (config: ScheduleConfig) => void;
}

const StaffScheduling: React.FC<StaffSchedulingProps> = ({
  users,
  workShifts,
  activityMoments,
  scheduleConfig,
  events,
  mealReservations,
  absenceRequests,
  onSync,
  onSaveShift,
  onDeleteShift,
  onSaveActivityMoment,
  onDeleteActivityMoment,
  onSaveAbsenceRequest,
  onDeleteAbsenceRequest,
  onSaveConfig
}) => {
  const [activeTab, setActiveTab] = useState<'planning' | 'config' | 'activity' | 'absences'>('planning');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinError, setShowPinError] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isFetchingContext, setIsFetchingContext] = useState(false);
  const [externalContext, setExternalContext] = useState<{ holidays: string[], weather: string, legislation: string }>({
    holidays: [],
    weather: '',
    legislation: ''
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
      2. Prévisions météo simplifiées.
      3. Rappel rapide de la législation française sur le temps de travail (pauses, durée max, coupures).
      
      Réponds en JSON: { "holidays": ["..."], "weather": "...", "legislation": "..." }`;

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/50 p-6 rounded-3xl border border-white/10">
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
          users={users}
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
          mealReservations={mealReservations}
          absenceRequests={absenceRequests}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityManager
          activityMoments={activityMoments}
          days={days}
          onSave={onSaveActivityMoment}
          onDelete={onDeleteActivityMoment}
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

const PlanningGrid = ({ users, workShifts, weekDates, days, timeSlots, onSaveShift, onDeleteShift, currentDate, setCurrentDate, onOptimize, isOptimizing, onPrint, mealReservations, absenceRequests }: {
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
  mealReservations: MealReservation[],
  absenceRequests: any[]
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
    <div className="bg-slate-800/50 rounded-3xl border border-white/10 overflow-hidden">
      <div className="p-6 border-bottom border-white/10 flex items-center justify-between bg-slate-800/30">
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
          <div className="grid grid-cols-8 border-b border-white/10">
            <div className="p-4 border-r border-white/10 bg-slate-900/30"></div>
            {days.map((day: string, i: number) => (
              <div key={day} className="p-4 text-center border-r border-white/10 last:border-r-0 bg-slate-900/30">
                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{day}</span>
                <span className="block text-lg font-black text-white">{new Date(weekDates[i]).getDate()}</span>
              </div>
            ))}
          </div>

          <div className="relative h-[800px] overflow-y-auto custom-scrollbar">
            {timeSlots.map((time: string) => (
              <div key={time} className="grid grid-cols-8 border-b border-white/5 h-12 group">
                <div className="p-2 border-r border-white/10 text-[10px] font-bold text-slate-500 text-right pr-4 bg-slate-900/10">
                  {time}
                </div>
                {weekDates.map((date: string) => {
                  const isRestDay = !workShifts.some(s => s.date === date);
                  const dayAbsences = absenceRequests.filter(a => a.startDate <= date && a.endDate >= date && a.status === 'APPROVED');

                  return (
                    <div 
                      key={`${date}-${time}`} 
                      className={`border-r border-white/5 last:border-r-0 relative hover:bg-indigo-500/5 cursor-pointer transition-colors ${isRestDay ? 'bg-slate-900/20' : ''}`}
                      onClick={() => handleAddShift(date, time)}
                    >
                      {isRestDay && time === '12:00' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                          <span className="text-[10px] font-black uppercase tracking-widest rotate-45">Repos</span>
                        </div>
                      )}
                      
                      {dayAbsences.map(abs => (
                        <div key={abs.id} className="absolute inset-x-0 top-0 bottom-0 bg-rose-500/20 pointer-events-none z-0">
                          {time === '12:00' && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-40">
                              <span className="text-[8px] font-black uppercase tracking-tight">Absence</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Render shifts for this date and time */}
                      {workShifts
                        .filter((s: WorkShift) => s.date === date && s.startTime === time)
                        .map((shift: WorkShift) => {
                          const user = users.find((u: User) => u.id === shift.userId);
                          const hasMeal = mealReservations.some((r: MealReservation) => r.userId === shift.userId && r.date === date && user?.showInMealPlanning);
                          return (
                            <div
                              key={shift.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShift(shift);
                                setIsModalOpen(true);
                              }}
                              className="absolute inset-x-1 top-1 bottom-1 bg-indigo-600/90 rounded-lg p-2 text-white shadow-lg border border-white/20 z-10 overflow-hidden"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase truncate">{user?.name || 'Inconnu'}</span>
                                {hasMeal && <span className="text-[8px] bg-emerald-500 px-1 rounded">REPAS</span>}
                              </div>
                              <div className="text-[9px] font-bold opacity-80">
                                {shift.startTime} - {shift.endTime}
                              </div>
                            </div>
                          );
                        })}
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

const ActivityManager = ({ activityMoments, days, onSave, onDelete }: {
  activityMoments: ActivityMoment[],
  days: string[],
  onSave: (m: ActivityMoment) => void,
  onDelete: (id: string) => void
}) => {
  const [newMoment, setNewMoment] = useState<Partial<ActivityMoment>>({
    dayOfWeek: 1,
    startTime: '12:00',
    endTime: '14:00',
    level: 'HIGH'
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
      <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/10">
        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6">Ajouter un moment d'activité</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Jour</label>
            <select
              value={newMoment.dayOfWeek}
              onChange={(e) => setNewMoment({ ...newMoment, dayOfWeek: parseInt(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
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
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fin</label>
            <input
              type="time"
              value={newMoment.endTime}
              onChange={(e) => setNewMoment({ ...newMoment, endTime: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Niveau</label>
            <select
              value={newMoment.level}
              onChange={(e) => setNewMoment({ ...newMoment, level: e.target.value as any })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
            >
              <option value="LOW">Faible</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="HIGH">Forte</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activityMoments.map((m: ActivityMoment) => (
          <div key={m.id} className="bg-slate-800/50 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{days[m.dayOfWeek - 1]}</div>
              <div className="text-white font-bold">{m.startTime} - {m.endTime}</div>
              <div className={`text-[10px] font-black uppercase mt-1 ${m.level === 'HIGH' ? 'text-rose-400' : m.level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>
                Activité {m.level === 'HIGH' ? 'Forte' : m.level === 'MEDIUM' ? 'Moyenne' : 'Faible'}
              </div>
            </div>
            <button
              onClick={() => onDelete(m.id)}
              className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConfigManager = ({ config, onSave }: {
  config: ScheduleConfig,
  onSave: (c: ScheduleConfig) => void
}) => {
  const [editedConfig, setEditedConfig] = useState<ScheduleConfig>({ ...config });

  return (
    <div className="bg-slate-800/50 p-8 rounded-3xl border border-white/10 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Horaires d'ouverture
          </h3>
          <div className="space-y-3">
            {Object.entries(editedConfig.openingHours).map(([day, hours]: [string, any]) => (
              <div key={day} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-xl border border-white/5">
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
                  className="bg-slate-800 border border-white/10 rounded-lg p-1.5 text-xs text-white"
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
                  className="bg-slate-800 border border-white/10 rounded-lg p-1.5 text-xs text-white"
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
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fermeture (min)</label>
              <input
                type="number"
                value={editedConfig.closingTimeMinutes}
                onChange={(e) => setEditedConfig({ ...editedConfig, closingTimeMinutes: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              />
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
