
import React, { useState, useMemo } from 'react';
import { User, StaffShift, DailyAffluence, ActivityMoment, ScheduleConfig, Event, MealReservation } from '../types';
import { Calendar, Clock, Settings, TrendingUp, Plus, Trash2, Save, Printer, Sparkles, ChevronLeft, ChevronRight, Lock, Loader2, Search, Sun, Cloud, CloudRain, CloudLightning, Wind, AlertTriangle, Copy } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface StaffSchedulingProps {
  users: User[];
  staffShifts: StaffShift[];
  dailyAffluence: DailyAffluence[];
  activityMoments: ActivityMoment[];
  scheduleConfig: ScheduleConfig;
  events: Event[];
  absenceRequests: any[];
  onSync: (action: string, payload: any) => void;
  onSaveShift: (shift: StaffShift) => void;
  onDeleteShift: (id: string) => void;
  onSaveDailyAffluence: (affluence: DailyAffluence) => void;
  onSaveActivityMoment: (moment: ActivityMoment) => void;
  onDeleteActivityMoment: (id: string) => void;
  onSaveAbsenceRequest: (request: any) => void;
  onDeleteAbsenceRequest: (id: string) => void;
  onSaveConfig: (config: ScheduleConfig) => void;
  mealReservations: MealReservation[];
}

const StaffScheduling: React.FC<StaffSchedulingProps> = ({
  users,
  staffShifts,
  dailyAffluence,
  activityMoments,
  scheduleConfig,
  events,
  absenceRequests,
  onSync,
  onSaveShift,
  onDeleteShift,
  onSaveDailyAffluence,
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
  const [isRestrictedView, setIsRestrictedView] = useState(true);
  const [externalContext, setExternalContext] = useState<{ holidays: string[], weather: string, legislation: string, dailyWeather?: { date: string, morning: string, afternoon: string }[] }>({
    holidays: [],
    weather: '',
    legislation: '',
    dailyWeather: []
  });

  // Weather Refresh Logic
  React.useEffect(() => {
    const refreshMinutes = scheduleConfig.weatherRefreshMinutes || 30;
    const interval = setInterval(() => {
      handleFetchContext();
    }, refreshMinutes * 60 * 1000);
    
    // Initial fetch
    handleFetchContext();
    
    return () => clearInterval(interval);
  }, [scheduleConfig.weatherRefreshMinutes, scheduleConfig.location]);

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

  const visibleRange = useMemo(() => {
    if (!isRestrictedView) return { start: 0, end: 24 * 60 };
    
    let minStart = 24 * 60;
    let maxEnd = 0;
    
    Object.values(scheduleConfig.openingHours).forEach((hours: any) => {
      if (hours.isOpen) {
        const [sh, sm] = hours.open.split(':').map(Number);
        const [eh, em] = hours.close.split(':').map(Number);
        const start = (sh * 60 + sm) - scheduleConfig.setupTimeMinutes;
        const end = (eh * 60 + em) + scheduleConfig.closingTimeMinutes;
        minStart = Math.min(minStart, start);
        maxEnd = Math.max(maxEnd, end);
      }
    });
    
    if (minStart === 24 * 60) return { start: 8 * 60, end: 20 * 60 };
    
    return { 
      start: Math.max(0, Math.floor(minStart / 60) * 60), 
      end: Math.min(24 * 60, Math.ceil(maxEnd / 60) * 60) 
    };
  }, [isRestrictedView, scheduleConfig]);

  const visibleDuration = useMemo(() => visibleRange.end - visibleRange.start, [visibleRange]);

  const visibleTimeSlots = useMemo(() => {
    const slots = [];
    const startHour = Math.floor(visibleRange.start / 60);
    const endHour = Math.ceil(visibleRange.end / 60);
    for (let i = startHour; i <= endHour; i++) {
      slots.push(`${i.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, [visibleRange]);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

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
      // 1. Fetch Weather from our new API
      const weatherRes = await fetch('/api/weather');
      const weatherData = await weatherRes.json();
      
      // 2. Fetch other context from Gemini
      const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY) as string;
      if (!apiKey) throw new Error('API Key missing');
      
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Recherche les informations suivantes pour la semaine du ${weekDates[0]} à ${scheduleConfig.location}:
      1. Vacances scolaires (Zone A, B, C en France) et jours fériés.
      2. Rappel rapide de la législation française sur le temps de travail (pauses, durée max, coupures).
      
      Réponds en JSON: { 
        "holidays": ["..."], 
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
      setExternalContext({
        ...data,
        weather: weatherData.title + ': ' + weatherData.description
      });
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
                    const shifts = staffShifts.filter((s: StaffShift) => s.date === date && s.userId === u.id);
                    return `<td>${shifts.map((s: StaffShift) => `<div class="shift">${s.startTime} - ${s.endTime}</div>`).join('')}</td>`;
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

  const handlePrefill = (userId: string, date: string) => {
    const dayOfWeek = new Date(date).getDay();
    const hours = scheduleConfig.openingHours[dayOfWeek as keyof typeof scheduleConfig.openingHours];
    
    if (hours && hours.isOpen) {
      onSaveShift({
        id: `shift_${Date.now()}_${Math.random()}`,
        userId,
        date,
        startTime: hours.open,
        endTime: hours.close,
        type: 'SHIFT'
      });
    }
  };

  const checkViolations = (userId: string, date: string, currentShifts?: StaffShift[]) => {
    const shiftsToUse = currentShifts || staffShifts;
    const userShifts = shiftsToUse
      .filter(s => s.userId === userId && s.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    if (userShifts.length === 0) return [];
    
    const violations: string[] = [];
    const workShifts = userShifts.filter(s => s.type === 'SHIFT');
    
    // 1. Max Worked Time
    const maxWorkedTime = scheduleConfig.maxWorkedTime;
    let totalWorked = 0;
    workShifts.forEach(s => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      totalWorked += (eh * 60 + em) - (sh * 60 + sm);
    });

    if (maxWorkedTime && totalWorked > maxWorkedTime) {
      violations.push(`Temps de travail max dépassé (${formatDuration(totalWorked)} > ${formatDuration(maxWorkedTime)})`);
    }

    // 2. Max Amplitude
    const maxAmplitude = scheduleConfig.maxAmplitude;
    const activeShifts = userShifts.filter(s => s.type !== 'REST' && s.type !== 'ABSENCE');
    if (activeShifts.length > 0 && maxAmplitude) {
      const first = activeShifts[0];
      const last = activeShifts[activeShifts.length - 1];
      const [sh, sm] = first.startTime.split(':').map(Number);
      const [eh, em] = last.endTime.split(':').map(Number);
      const amplitude = (eh * 60 + em) - (sh * 60 + sm);
      if (amplitude > maxAmplitude) {
        violations.push(`Amplitude max dépassée (${formatDuration(amplitude)} > ${formatDuration(maxAmplitude)})`);
      }
    }

    // 3. Max Continuous Work
    const maxContinuousWorkTime = scheduleConfig.maxContinuousWorkTime;
    if (maxContinuousWorkTime) {
      workShifts.forEach(s => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        const duration = (eh * 60 + em) - (sh * 60 + sm);
        if (duration > maxContinuousWorkTime) {
          violations.push(`Travail continu max dépassé (${formatDuration(duration)} > ${formatDuration(maxContinuousWorkTime)})`);
        }
      });
    }

    // 4. Max Split Time
    const maxSplitTime = scheduleConfig.maxSplitTime;
    if (maxSplitTime) {
      const splitShifts = userShifts.filter(s => s.type === 'SPLIT');
      splitShifts.forEach(s => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        const duration = (eh * 60 + em) - (sh * 60 + sm);
        if (duration > maxSplitTime) {
          violations.push(`Coupure max dépassée (${formatDuration(duration)} > ${formatDuration(maxSplitTime)})`);
        }
      });
    }

    // 5. Daily Rest (Repos quotidien) - 11h min (CHR: 10h30 is alert, <10h30 is violation)
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const prevDayShifts = shiftsToUse
      .filter(s => s.userId === userId && s.date === prevDateStr && s.type === 'SHIFT')
      .sort((a, b) => b.endTime.localeCompare(a.endTime));
    
    if (prevDayShifts.length > 0 && workShifts.length > 0) {
      const lastShiftPrev = prevDayShifts[0];
      const firstShiftToday = workShifts[0];
      
      const [ph, pm] = lastShiftPrev.endTime.split(':').map(Number);
      const [th, tm] = firstShiftToday.startTime.split(':').map(Number);
      
      const restMinutes = (24 * 60 - (ph * 60 + pm)) + (th * 60 + tm);
      
      if (restMinutes < 10.5 * 60) {
        violations.push(`ALERTE CRITIQUE: Repos quotidien < 10h30 (${formatDuration(restMinutes)}). INTERDIT par la réglementation CHR.`);
      } else if (restMinutes < 11 * 60) {
        violations.push(`ALERTE: Repos quotidien entre 10h30 et 11h (${formatDuration(restMinutes)}).`);
      }
    }

    // 6. Weekly Rest (Repos hebdomadaire) - 35h min
    const allShiftsSorted = shiftsToUse
      .filter(s => s.userId === userId && (s.type === 'SHIFT' || s.type === 'REST'))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    
    if (allShiftsSorted.length > 1) {
      let maxRestGap = 0;
      for (let i = 0; i < allShiftsSorted.length - 1; i++) {
        const s1 = allShiftsSorted[i];
        const s2 = allShiftsSorted[i+1];
        
        // Only calculate gap between end of a shift/rest and start of next shift/rest
        // But specifically we want a gap of 35h total rest.
        // A REST shift is already rest.
        
        const d1 = new Date(s1.date);
        const [h1, m1] = s1.endTime.split(':').map(Number);
        d1.setHours(h1, m1, 0, 0);
        
        const d2 = new Date(s2.date);
        const [h2, m2] = s2.startTime.split(':').map(Number);
        d2.setHours(h2, m2, 0, 0);
        
        const gapMinutes = (d2.getTime() - d1.getTime()) / (1000 * 60);
        if (gapMinutes > maxRestGap) maxRestGap = gapMinutes;
      }
      
      if (maxRestGap < 35 * 60 && workShifts.length > 0) {
        violations.push(`ALERTE CRITIQUE: Pas de repos hebdomadaire de 35h consécutives détecté (${formatDuration(maxRestGap)} max).`);
      }
    }

    return violations;
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY) as string;
      if (!apiKey) throw new Error('API Key missing');
      
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Optimise le planning du staff pour la semaine du ${weekDates[0]} au ${weekDates[6]}.
      
      CONTEXTE EXTERNE:
      - Météo prévue: ${JSON.stringify(externalContext.dailyWeather)}
      
      CONTRAINTES:
      - Horaires d'ouverture: ${JSON.stringify(scheduleConfig.openingHours)}
      - Temps de préparation: ${scheduleConfig.setupTimeMinutes} min
      - Temps de fermeture: ${scheduleConfig.closingTimeMinutes} min
      - Amplitude max: ${scheduleConfig.maxAmplitude} min
      - Travail max/jour: ${scheduleConfig.maxWorkedTime} min
      - Coupure max: ${scheduleConfig.maxSplitTime} min
      - Travail continu max: ${scheduleConfig.maxContinuousWorkTime} min
      - Agents disponibles: ${users.map(u => u.name).join(', ')}
      - Affluence prévue: ${JSON.stringify(dailyAffluence)}
      - Absences approuvées: ${JSON.stringify(absenceRequests.filter(a => a.status === 'APPROVED'))}
      
      RÈGLES PERSONNALISÉES DU MANAGER:
      ${scheduleConfig.customAiRules || "Aucune règle spécifique."}
      
      OBJECTIF:
      Générer un planning équilibré respectant toutes les contraintes et les règles personnalisées.
      Utilise les types de tuiles: SHIFT (travail), PAUSE (pause non payée), SPLIT (coupure).
      
      Réponds UNIQUEMENT en JSON (tableau d'objets StaffShift):
      [{ "userId": "Nom de l'agent", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "type": "SHIFT/PAUSE/SPLIT" }]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
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
            userId: user.id,
            type: s.type || 'SHIFT'
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
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-2xl border border-white/5">
            <button
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() - 7);
                setCurrentDate(d);
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 bg-slate-900 rounded-xl border border-white/10 flex flex-col items-center min-w-[160px]">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Semaine du</span>
              <span className="text-sm font-black text-white">{new Date(weekDates[0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
            </div>
            <button
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

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
        <>
          <WeeklySummary 
            users={filteredUsers}
            staffShifts={staffShifts}
            weekDates={weekDates}
            planningWeeks={scheduleConfig.planningWeeks || 1}
          />
          <PlanningGrid
            users={filteredUsers}
            staffShifts={staffShifts}
            dailyAffluence={dailyAffluence}
            activityMoments={activityMoments}
            onSaveDailyAffluence={onSaveDailyAffluence}
            weekDates={weekDates}
            days={days}
            timeSlots={timeSlots}
            visibleTimeSlots={visibleTimeSlots}
            visibleRange={visibleRange}
            visibleDuration={visibleDuration}
            isRestrictedView={isRestrictedView}
            setIsRestrictedView={setIsRestrictedView}
            onSaveShift={onSaveShift}
            onDeleteShift={onDeleteShift}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            onOptimize={handleOptimize}
            isOptimizing={isOptimizing}
            onPrefill={handlePrefill}
            onPrint={handlePrint}
            absenceRequests={absenceRequests}
            dailyWeather={externalContext.dailyWeather}
            mealReservations={mealReservations}
            config={scheduleConfig}
            events={events}
            checkViolations={checkViolations}
            formatDuration={formatDuration}
          />
        </>
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

const WeeklySummary = ({ users, staffShifts, weekDates, planningWeeks }: {
  users: User[],
  staffShifts: StaffShift[],
  weekDates: string[],
  planningWeeks: number
}) => {
  const calculateWeeklyHours = (userId: string, dates: string[]) => {
    const shifts = staffShifts.filter(s => s.userId === userId && dates.includes(s.date) && s.type === 'SHIFT');
    let totalMinutes = 0;
    shifts.forEach(s => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      totalMinutes += (eh * 60 + em) - (sh * 60 + sm);
    });
    return totalMinutes / 60;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {users.map(user => {
        const weeklyHours = calculateWeeklyHours(user.id, weekDates);
        // For average, we'd need more data than just the current week, but let's assume we have it or calculate based on what we have
        // The user said "moyenne semaine sur la période 'durée du planning'"
        // We might need to fetch more shifts or just use the current ones if they cover the period
        const totalPeriodShifts = staffShifts.filter(s => s.userId === user.id && s.type === 'SHIFT');
        let totalPeriodMinutes = 0;
        totalPeriodShifts.forEach(s => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          totalPeriodMinutes += (eh * 60 + em) - (sh * 60 + sm);
        });
        const avgHours = (totalPeriodMinutes / 60) / planningWeeks;

        return (
          <div key={user.id} className="bg-slate-800 border-2 border-indigo-500/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-md">
            <span className="text-[10px] font-black text-slate-100 uppercase tracking-widest mb-1">{user.name}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white">{weeklyHours.toFixed(1)}h</span>
              <span className="text-[10px] font-bold text-slate-200">/ sem</span>
            </div>
            <div className="text-[10px] font-black text-indigo-100 mt-2 px-3 py-1 bg-indigo-600 rounded-full uppercase tracking-tighter border border-indigo-400/30">
              Moy: {avgHours.toFixed(1)}h
            </div>
          </div>
        );
      })}
    </div>
  );
};

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

const PlanningGrid = ({
  users,
  staffShifts,
  dailyAffluence,
  activityMoments,
  onSaveDailyAffluence,
  weekDates,
  days,
  timeSlots,
  visibleTimeSlots,
  visibleRange,
  visibleDuration,
  isRestrictedView,
  setIsRestrictedView,
  onSaveShift,
  onDeleteShift,
  currentDate,
  setCurrentDate,
  onOptimize,
  isOptimizing,
  onPrefill,
  onPrint,
  absenceRequests,
  dailyWeather,
  mealReservations,
  config,
  events,
  checkViolations,
  formatDuration
}: {
  users: User[],
  staffShifts: StaffShift[],
  dailyAffluence: DailyAffluence[],
  activityMoments: ActivityMoment[],
  onSaveDailyAffluence: (a: DailyAffluence) => void,
  weekDates: string[],
  days: string[],
  timeSlots: string[],
  visibleTimeSlots: string[],
  visibleRange: { start: number, end: number },
  visibleDuration: number,
  isRestrictedView: boolean,
  setIsRestrictedView: (v: boolean) => void,
  onSaveShift: (s: StaffShift) => void,
  onDeleteShift: (id: string) => void,
  currentDate: Date,
  setCurrentDate: (d: Date) => void,
  onOptimize: () => void,
  isOptimizing: boolean,
  onPrefill: (userId: string, date: string) => void,
  onPrint: () => void,
  absenceRequests: any[],
  dailyWeather?: { date: string, morning: string, afternoon: string }[],
  mealReservations: MealReservation[],
  config: ScheduleConfig,
  events: Event[],
  checkViolations: (userId: string, date: string, currentShifts?: StaffShift[]) => string[],
  formatDuration: (minutes: number) => string
}) => {
  const [selectedShift, setSelectedShift] = useState<StaffShift | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [showSchedules, setShowSchedules] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const currentDayDate = weekDates[selectedDayIndex];

  const handleAddShift = (userId: string, time: string) => {
    const newShift: StaffShift = {
      id: `shift_${Date.now()}`,
      userId,
      date: currentDayDate,
      startTime: time,
      endTime: `${(parseInt(time.split(':')[0]) + 7).toString().padStart(2, '0')}:00`,
      type: 'SHIFT',
      role: 'BAR'
    };
    setSelectedShift(newShift);
    setIsModalOpen(true);
  };

  const handleAddRest = (userId: string) => {
    // Find the last work shift for this user before or on the current day
    const allUserShifts = staffShifts
      .filter(s => s.userId === userId && s.type === 'SHIFT')
      .sort((a, b) => b.date.localeCompare(a.date) || b.endTime.localeCompare(a.endTime));
    
    const lastWorkShift = allUserShifts.find(s => s.date <= currentDayDate);

    if (lastWorkShift) {
      const lastWorkDate = new Date(lastWorkShift.date);
      
      // 1. Complete the last work day with rest until 23:59
      const restDay0: StaffShift = {
        id: `shift_rest0_${Date.now()}`,
        userId,
        date: lastWorkShift.date,
        startTime: lastWorkShift.endTime,
        endTime: '23:59',
        type: 'REST',
        isValidated: false
      };
      onSaveShift(restDay0);

      // 2. Add 24h rest the following day
      const nextDay = new Date(lastWorkDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      
      const restDay1: StaffShift = {
        id: `shift_rest1_${Date.now()}`,
        userId,
        date: nextDayStr,
        startTime: '00:00',
        endTime: '23:59',
        type: 'REST',
        isValidated: false
      };
      onSaveShift(restDay1);

      // 3. Add rest on Day 2 to reach 35h total
      // Duration on Day 0: 23:59 - lastWorkShift.endTime
      const [h, m] = lastWorkShift.endTime.split(':').map(Number);
      const restDurationDay0Minutes = (23 * 60 + 59) - (h * 60 + m);
      const remainingRestMinutes = (35 * 60) - (24 * 60) - restDurationDay0Minutes;
      
      if (remainingRestMinutes > 0) {
        const day2 = new Date(nextDay);
        day2.setDate(day2.getDate() + 1);
        const day2Str = day2.toISOString().split('T')[0];
        
        const endH = Math.floor(remainingRestMinutes / 60);
        const endM = remainingRestMinutes % 60;
        const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        const restDay2: StaffShift = {
          id: `shift_rest2_${Date.now()}`,
          userId,
          date: day2Str,
          startTime: '00:00',
          endTime: endTimeStr,
          type: 'REST',
          isValidated: false
        };
        onSaveShift(restDay2);
      }
    } else {
      // Fallback if no work shift found
      const newShift: StaffShift = {
        id: `shift_rest_${Date.now()}`,
        userId,
        date: currentDayDate,
        startTime: '00:00',
        endTime: '23:59',
        type: 'REST',
        isValidated: false
      };
      setSelectedShift(newShift);
      setIsModalOpen(true);
    }
  };

  const handleSaveShiftWithSplitting = (newShift: StaffShift) => {
    // If it's a PAUSE or SPLIT, check if it cuts an existing SHIFT
    if (newShift.type === 'PAUSE' || newShift.type === 'SPLIT') {
      const existingShifts = staffShifts.filter(s => 
        s.userId === newShift.userId && 
        s.date === newShift.date && 
        s.type === 'SHIFT'
      );

      const [newStartH, newStartM] = newShift.startTime.split(':').map(Number);
      const [newEndH, newEndM] = newShift.endTime.split(':').map(Number);
      const newStartTotal = newStartH * 60 + newStartM;
      const newEndTotal = newEndH * 60 + newEndM;

      existingShifts.forEach(s => {
        const [sStartH, sStartM] = s.startTime.split(':').map(Number);
        const [sEndH, sEndM] = s.endTime.split(':').map(Number);
        const sStartTotal = sStartH * 60 + sStartM;
        const sEndTotal = sEndH * 60 + sEndM;

        // If the new shift is strictly inside the existing shift
        if (newStartTotal > sStartTotal && newEndTotal < sEndTotal) {
          // Split the existing shift into two
          const firstShift: StaffShift = {
            ...s,
            endTime: newShift.startTime
          };
          const secondShift: StaffShift = {
            ...s,
            id: `shift_split_${Date.now()}_${Math.random()}`,
            startTime: newShift.endTime
          };
          onSaveShift(firstShift);
          onSaveShift(secondShift);
        } else if (newStartTotal <= sStartTotal && newEndTotal > sStartTotal && newEndTotal < sEndTotal) {
          // New shift overlaps the start of existing shift
          onSaveShift({ ...s, startTime: newShift.endTime });
        } else if (newStartTotal > sStartTotal && newStartTotal < sEndTotal && newEndTotal >= sEndTotal) {
          // New shift overlaps the end of existing shift
          onSaveShift({ ...s, endTime: newShift.startTime });
        }
      });
    }
    onSaveShift(newShift);
  };

  const getAffluenceColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-emerald-500 text-white border-emerald-400';
      case 'MEDIUM': return 'bg-amber-500 text-white border-amber-400';
      case 'HIGH': return 'bg-rose-500 text-white border-rose-400';
      default: return 'bg-slate-800 text-slate-400 border-white/5';
    }
  };

  const getShiftColor = (type: string) => {
    switch (type) {
      case 'SHIFT': return 'bg-indigo-600 border-indigo-400';
      case 'PAUSE': return 'bg-emerald-600 border-emerald-400';
      case 'SPLIT': return 'bg-amber-600 border-amber-400';
      case 'REST': return 'bg-slate-600 border-slate-400';
      case 'ABSENCE': return 'bg-rose-600 border-rose-400';
      default: return 'bg-indigo-600 border-indigo-400';
    }
  };

  const calculateAgentsPresent = (time: string) => {
    const timeHour = parseInt(time.split(':')[0]);
    const timeMin = parseInt(time.split(':')[1]);
    const totalMinutes = timeHour * 60 + timeMin;

    return staffShifts.filter(s => {
      if (s.date !== currentDayDate) return false;
      if (s.type !== 'SHIFT' && s.type !== 'SPLIT') return false;
      
      const [startH, startM] = s.startTime.split(':').map(Number);
      const [endH, endM] = s.endTime.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;

      return totalMinutes >= startTotal && totalMinutes < endTotal;
    }).length;
  };

  const calculateTotalWorkTime = (userId: string, date: string) => {
    const userShifts = staffShifts.filter(s => s.userId === userId && s.date === date && s.type === 'SHIFT');
    let totalMinutes = 0;
    userShifts.forEach(s => {
      const [startH, startM] = s.startTime.split(':').map(Number);
      const [endH, endM] = s.endTime.split(':').map(Number);
      totalMinutes += (endH * 60 + endM) - (startH * 60 + startM);
    });
    return totalMinutes;
  };

  const timeToPercent = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return ((h * 60 + m) / (24 * 60)) * 100;
  };

  const durationToPercent = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    return ((endMin - startMin) / (24 * 60)) * 100;
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-white/20 overflow-hidden shadow-2xl flex flex-col h-[800px]">
      {/* Header with Day Tabs */}
      <div className="p-4 border-b border-white/10 bg-slate-800/50 flex items-center justify-between shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() - 7);
              setCurrentDate(d);
            }}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1 bg-slate-950 p-1 rounded-2xl border border-white/5">
            {weekDates.map((date, i) => (
              <button
                key={date}
                onClick={() => setSelectedDayIndex(i)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex flex-col items-center min-w-[80px] ${selectedDayIndex === i ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <span>{days[i]}</span>
                <span className="text-lg leading-none mt-1">{new Date(date).getDate()}</span>
              </button>
            ))}
          </div>
          <button 
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() + 7);
              setCurrentDate(d);
            }}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl border border-white/10">
            <input 
              type="checkbox" 
              id="isRestrictedView" 
              checked={isRestrictedView} 
              onChange={(e) => setIsRestrictedView(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-slate-900 text-indigo-600"
            />
            <label htmlFor="isRestrictedView" className="text-xs font-bold text-slate-300 cursor-pointer">Vue Restreinte</label>
          </div>
          <button 
            onClick={onOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-900/50"
          >
            {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Optimisation IA
          </button>
          <button 
            onClick={() => users.forEach(u => onPrefill(u.id, currentDayDate))}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all border border-white/10"
          >
            <Copy className="w-4 h-4" />
            Pré-remplir
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

      {/* Timeline Grid */}
      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <div className="min-w-[1200px] h-full flex flex-col">
          {/* Time Markers Header */}
          <div className="sticky top-0 z-40 bg-slate-900 border-b border-white/10 flex">
            <div className="w-48 shrink-0 border-r border-white/10 bg-slate-950/50 p-4 flex items-center justify-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temps</span>
            </div>
            <div className="flex-1 relative h-12">
              {visibleTimeSlots.map((time) => {
                const i = parseInt(time.split(':')[0]);
                return (
                  <div 
                    key={time} 
                    className="absolute top-0 bottom-0 border-l border-white/5 flex flex-col justify-end pb-1 pl-1"
                    style={{ left: `${((i * 60 - visibleRange.start) / visibleDuration) * 100}%` }}
                  >
                    <span className="text-[9px] font-black text-slate-600">{time}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Affluence Row (Granular) */}
          <div className="flex border-b border-white/10 bg-slate-950/30">
            <div className="w-48 shrink-0 border-r border-white/10 p-4 flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Affluence</span>
            </div>
            <div className="flex-1 relative h-12">
              {visibleTimeSlots.map((time) => {
                const i = parseInt(time.split(':')[0]);
                const moment = activityMoments.find((momentItem: ActivityMoment) => {
                  const dayOfWeek = new Date(currentDayDate).getDay();
                  const [h, min] = time.split(':').map(Number);
                  const totalMinutes = h * 60 + min;
                  const [sh, sm] = momentItem.startTime.split(':').map(Number);
                  const [eh, em] = momentItem.endTime.split(':').map(Number);
                  return momentItem.dayOfWeek === dayOfWeek && totalMinutes >= (sh * 60 + sm) && totalMinutes < (eh * 60 + em);
                });
                const level = moment?.level || 'LOW';
                return (
                  <div 
                    key={time} 
                    className={`absolute top-0 bottom-0 border-l border-white/5 transition-colors ${getAffluenceColor(level)}`}
                    style={{ 
                      left: `${((i * 60 - visibleRange.start) / visibleDuration) * 100}%`, 
                      width: `${(60 / visibleDuration) * 100}%` 
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Weather Row */}
          <div className="flex border-b border-white/10 bg-slate-950/20">
            <div className="w-48 shrink-0 border-r border-white/10 p-4 flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Météo</span>
            </div>
            <div className="flex-1 relative h-12">
              {(() => {
                const weather = dailyWeather?.find(w => w.date === currentDayDate);
                if (!weather) return null;
                const morningVisible = 9 * 60 >= visibleRange.start && 9 * 60 < visibleRange.end;
                const afternoonVisible = 15 * 60 >= visibleRange.start && 15 * 60 < visibleRange.end;
                return (
                  <>
                    {morningVisible && (
                      <div 
                        className="absolute top-0 bottom-0 flex items-center justify-center border-r border-white/5"
                        style={{ 
                          left: `${((9 * 60 - visibleRange.start) / visibleDuration) * 100}%`,
                          width: `${(6 * 60 / visibleDuration) * 100}%`
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Matin</span>
                          <WeatherIcon type={weather.morning} />
                        </div>
                      </div>
                    )}
                    {afternoonVisible && (
                      <div 
                        className="absolute top-0 bottom-0 flex items-center justify-center"
                        style={{ 
                          left: `${((15 * 60 - visibleRange.start) / visibleDuration) * 100}%`,
                          width: `${(6 * 60 / visibleDuration) * 100}%`
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black text-slate-500 uppercase mb-1">A-M</span>
                          <WeatherIcon type={weather.afternoon} />
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Events Row */}
          <div className="flex border-b border-white/10 bg-slate-950/10">
            <div className="w-48 shrink-0 border-r border-white/10 p-4 flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Événements</span>
            </div>
            <div className="flex-1 relative h-12">
              {events.filter(e => e.startTime.split('T')[0] === currentDayDate).map(evt => {
                const [sh, sm] = evt.startTime.split('T')[1].split(':').map(Number);
                const [eh, em] = evt.endTime.split('T')[1].split(':').map(Number);
                const startPercent = ((sh * 60 + sm) / (24 * 60)) * 100;
                const endPercent = ((eh * 60 + em) / (24 * 60)) * 100;
                return (
                  <div 
                    key={evt.id}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setIsEventModalOpen(true);
                    }}
                    className="absolute top-2 bottom-2 bg-indigo-500/20 border border-indigo-500/40 rounded-lg px-2 flex items-center cursor-pointer hover:bg-indigo-500/30 transition-all overflow-hidden"
                    style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
                  >
                    <span className="text-[9px] font-black text-indigo-300 uppercase truncate">{evt.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agents Present Row */}
          <div className="flex border-b border-white/10 bg-slate-950/10">
            <div className="w-48 shrink-0 border-r border-white/10 p-4 flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agents Présents</span>
            </div>
            <div className="flex-1 relative h-12">
              {timeSlots.map((time) => {
                const i = parseInt(time.split(':')[0]);
                const count = calculateAgentsPresent(time);
                if (i * 60 < visibleRange.start || i * 60 >= visibleRange.end) return null;
                return (
                  <div 
                    key={time} 
                    className="absolute top-0 bottom-0 flex items-center justify-center border-l border-white/5"
                    style={{ 
                      left: `${((i * 60 - visibleRange.start) / visibleDuration) * 100}%`, 
                      width: `${(60 / visibleDuration) * 100}%` 
                    }}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                      count > 0 ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'text-slate-700'
                    }`}>
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Rows */}
          <div className="flex-1">
            {users.map((user) => {
              const userShifts = staffShifts.filter(s => s.userId === user.id && s.date === currentDayDate);
              const totalWorkTime = calculateTotalWorkTime(user.id, currentDayDate);
              const violations = checkViolations(user.id, currentDayDate);
              const hasViolations = violations.length > 0;
              const isAbsent = absenceRequests.some(a => a.userId === user.id && a.status === 'APPROVED' && currentDayDate >= a.startDate && currentDayDate <= a.endDate);

              return (
                <div key={user.id} className={`flex border-b border-white/5 hover:bg-white/[0.02] transition-colors group min-h-[80px] ${isAbsent ? 'bg-rose-500/5' : ''}`}>
                  <div className={`w-48 shrink-0 border-r border-white/10 p-4 flex flex-col justify-center ${isAbsent ? 'bg-rose-950/20' : 'bg-slate-950/20'}`}>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black text-white uppercase tracking-tight truncate">{user.name}</div>
                      {isAbsent && <div className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded uppercase tracking-tighter">Absent</div>}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${hasViolations ? 'text-rose-400' : 'text-slate-500'}`}>
                      <Clock className="w-3 h-3" />
                      {formatDuration(totalWorkTime)}
                      {hasViolations && (
                        <div className="group/alert relative">
                          <AlertTriangle className="w-3 h-3 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-64 bg-rose-900 border border-rose-500/50 rounded-xl p-3 text-[10px] text-rose-100 shadow-2xl opacity-0 group-hover/alert:opacity-100 pointer-events-none transition-opacity z-[100]">
                            <div className="font-black uppercase tracking-widest mb-2 border-b border-rose-500/30 pb-1">Alertes de conformité</div>
                            <ul className="space-y-1 list-disc pl-3">
                              {violations.map((v, i) => <li key={i}>{v}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div 
                    className="flex-1 relative cursor-crosshair"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percent = x / rect.width;
                      const totalMinutes = Math.floor(percent * visibleDuration) + visibleRange.start;
                      const hours = Math.floor(totalMinutes / 60);
                      const snap = config.planningScale || 15;
                      const minutes = Math.floor((totalMinutes % 60) / snap) * snap;
                      const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      handleAddShift(user.id, time);
                    }}
                  >
                    {/* Vertical Hour Lines */}
                    {visibleTimeSlots.map((time) => {
                      const i = parseInt(time.split(':')[0]);
                      return (
                        <div 
                          key={i} 
                          className="absolute top-0 bottom-0 border-l border-white/[0.03] pointer-events-none"
                          style={{ left: `${((i * 60 - visibleRange.start) / visibleDuration) * 100}%` }}
                        />
                      );
                    })}

                    {/* Absences (Repos with Lock) */}
                    {absenceRequests.filter(a => a.userId === user.id && a.status === 'APPROVED' && currentDayDate >= a.startDate && currentDayDate <= a.endDate).map(abs => {
                      let start = 0;
                      let end = 24 * 60;
                      if (abs.startDate === currentDayDate && abs.startTime) {
                        const [h, m] = abs.startTime.split(':').map(Number);
                        start = h * 60 + m;
                      }
                      if (abs.endDate === currentDayDate && abs.endTime) {
                        const [h, m] = abs.endTime.split(':').map(Number);
                        end = h * 60 + m;
                      }

                      if (end <= visibleRange.start || start >= visibleRange.end) return null;
                      
                      const displayStart = Math.max(start, visibleRange.start);
                      const displayEnd = Math.min(end, visibleRange.end);
                      const left = ((displayStart - visibleRange.start) / visibleDuration) * 100;
                      const width = ((displayEnd - displayStart) / visibleDuration) * 100;

                      return (
                        <div 
                          key={abs.id}
                          className="absolute top-1/2 -translate-y-1/2 h-10 bg-slate-600/50 border border-slate-500/50 rounded-lg flex items-center justify-center gap-2 z-10"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Repos</span>
                        </div>
                      );
                    })}

                    {/* Add Rest Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddRest(user.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-white/5 opacity-0 group-hover:opacity-100 transition-all z-20"
                      title="Ajouter Repos (35h/24h)"
                    >
                      <Plus className="w-3 h-3" />
                    </button>

                    {/* Opening Hours Overlay */}
                    {(() => {
                      const dayOfWeek = new Date(currentDayDate).getDay();
                      const hours = config.openingHours[dayOfWeek];
                      if (!hours || !hours.isOpen) return null;
                      
                      const [openH, openM] = hours.open.split(':').map(Number);
                      const [closeH, closeM] = hours.close.split(':').map(Number);
                      const openMin = openH * 60 + openM;
                      const closeMin = closeH * 60 + closeM;
                      
                      const prepStart = openMin - config.setupTimeMinutes;
                      const closingEnd = closeMin + config.closingTimeMinutes;
                      
                      const prepVisibleStart = Math.max(prepStart, visibleRange.start);
                      const prepVisibleEnd = Math.min(openMin, visibleRange.end);
                      
                      const openVisibleStart = Math.max(openMin, visibleRange.start);
                      const openVisibleEnd = Math.min(closeMin, visibleRange.end);
                      
                      const closeVisibleStart = Math.max(closeMin, visibleRange.start);
                      const closeVisibleEnd = Math.min(closingEnd, visibleRange.end);

                      return (
                        <>
                          {/* Prep Time */}
                          {prepVisibleEnd > prepVisibleStart && (
                            <div 
                              className="absolute top-0 bottom-0 bg-indigo-500/5 border-x border-indigo-500/20 pointer-events-none"
                              style={{ 
                                left: `${((prepVisibleStart - visibleRange.start) / visibleDuration) * 100}%`, 
                                width: `${((prepVisibleEnd - prepVisibleStart) / visibleDuration) * 100}%` 
                              }}
                            >
                              <div className="absolute top-0 left-0 text-[8px] font-black text-indigo-400/50 uppercase tracking-tighter -rotate-90 origin-top-left translate-y-8 ml-1">Prep</div>
                            </div>
                          )}
                          
                          {/* Opening Hours */}
                          {openVisibleEnd > openVisibleStart && (
                            <div 
                              className="absolute top-0 bottom-0 bg-emerald-500/[0.02] border-x border-emerald-500/10 pointer-events-none"
                              style={{ 
                                left: `${((openVisibleStart - visibleRange.start) / visibleDuration) * 100}%`, 
                                width: `${((openVisibleEnd - openVisibleStart) / visibleDuration) * 100}%` 
                              }}
                            />
                          )}
                          
                          {/* Closing Time */}
                          {closeVisibleEnd > closeVisibleStart && (
                            <div 
                              className="absolute top-0 bottom-0 bg-amber-500/5 border-x border-amber-500/20 pointer-events-none"
                              style={{ 
                                left: `${((closeVisibleStart - visibleRange.start) / visibleDuration) * 100}%`, 
                                width: `${((closeVisibleEnd - closeVisibleStart) / visibleDuration) * 100}%` 
                              }}
                            >
                              <div className="absolute top-0 left-0 text-[8px] font-black text-amber-400/50 uppercase tracking-tighter -rotate-90 origin-top-left translate-y-8 ml-1">Close</div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Shifts */}
                    {userShifts.map((shift) => {
                      const [sh, sm] = shift.startTime.split(':').map(Number);
                      const [eh, em] = shift.endTime.split(':').map(Number);
                      const startMin = sh * 60 + sm;
                      const endMin = (eh < sh ? eh + 24 : eh) * 60 + em;

                      if (endMin <= visibleRange.start || startMin >= visibleRange.end) return null;

                      const displayStart = Math.max(startMin, visibleRange.start);
                      const displayEnd = Math.min(endMin, visibleRange.end);
                      const left = ((displayStart - visibleRange.start) / visibleDuration) * 100;
                      const width = ((displayEnd - displayStart) / visibleDuration) * 100;

                      return (
                        <div
                          key={shift.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShift(shift);
                            setIsModalOpen(true);
                          }}
                          className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-lg border shadow-lg cursor-pointer transition-all hover:scale-[1.02] hover:z-50 flex flex-col justify-center px-2 overflow-hidden ${getShiftColor(shift.type)} ${shift.isValidated ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}`}
                          style={{ 
                            left: `${left}%`, 
                            width: `${width}%` 
                          }}
                        >
                          <div className="text-[10px] font-black text-white uppercase truncate leading-none flex items-center gap-1">
                            {shift.type === 'REST' && <Lock className="w-2 h-2" />}
                            {shift.type === 'SHIFT' ? 'Travail' : shift.type === 'PAUSE' ? 'Pause' : shift.type === 'SPLIT' ? 'Coupure' : shift.type === 'REST' ? 'Repos' : 'Absence'}
                            {shift.role && <span className="text-[8px] opacity-70">({shift.role})</span>}
                          </div>
                          <div className="text-[9px] font-bold text-white/70 leading-none mt-0.5">
                            {shift.startTime} - {shift.endTime}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isModalOpen && selectedShift && (
        <ShiftModal
          shift={selectedShift}
          users={users}
          onClose={() => setIsModalOpen(false)}
          onSave={(s: StaffShift) => {
            handleSaveShiftWithSplitting(s);
            setIsModalOpen(false);
          }}
          onDelete={(id: string) => {
            onDeleteShift(id);
            setIsModalOpen(false);
          }}
          checkViolations={checkViolations}
          staffShifts={staffShifts}
        />
      )}

      {isEventModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Détails de l'Événement</h3>
              <button onClick={() => setIsEventModalOpen(false)} className="text-slate-400 hover:text-white">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Titre</div>
                <div className="text-lg font-black text-white">{selectedEvent.title}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Début</div>
                  <div className="text-sm font-bold text-slate-300">{new Date(selectedEvent.startTime).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Fin</div>
                  <div className="text-sm font-bold text-slate-300">{new Date(selectedEvent.endTime).toLocaleString()}</div>
                </div>
              </div>
              {selectedEvent.location && (
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Lieu</div>
                  <div className="text-sm font-bold text-slate-300">{selectedEvent.location}</div>
                </div>
              )}
              {selectedEvent.description && (
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Description</div>
                  <div className="text-sm text-slate-400">{selectedEvent.description}</div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-800/50 border-t border-white/10">
              <button onClick={() => setIsEventModalOpen(false)} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black py-3 rounded-xl transition-all uppercase tracking-widest text-xs">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ShiftModal = ({ shift, users, onClose, onSave, onDelete, checkViolations, staffShifts }: {
  shift: StaffShift,
  users: User[],
  onClose: () => void,
  onSave: (s: StaffShift) => void,
  onDelete: (id: string) => void,
  checkViolations: (userId: string, date: string, currentShifts?: StaffShift[]) => string[],
  staffShifts: StaffShift[]
}) => {
  const [editedShift, setEditedShift] = useState<StaffShift>({ ...shift });

  const violations = useMemo(() => {
    // Simulate the shifts with the edited one
    const otherShifts = staffShifts.filter(s => s.id !== editedShift.id);
    return checkViolations(editedShift.userId, editedShift.date, [...otherShifts, editedShift]);
  }, [editedShift, staffShifts, checkViolations]);

  const hasCriticalViolation = violations.some(v => v.includes('< 10h30'));

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Détails du Shift</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {violations.length > 0 && (
            <div className={`p-4 rounded-2xl border ${hasCriticalViolation ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${hasCriticalViolation ? 'text-rose-400' : 'text-amber-400'}`} />
                <span className={`text-xs font-black uppercase tracking-widest ${hasCriticalViolation ? 'text-rose-400' : 'text-amber-400'}`}>
                  {hasCriticalViolation ? 'Violation Critique' : 'Avertissement'}
                </span>
              </div>
              <ul className="space-y-1">
                {violations.map((v, i) => (
                  <li key={i} className="text-[10px] text-slate-300 flex items-start gap-2">
                    <span className="mt-1 w-1 h-1 rounded-full bg-slate-500 shrink-0" />
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          )}
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

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Type de tuile</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'SHIFT', label: 'Travail', color: 'bg-indigo-600' },
                { id: 'PAUSE', label: 'Pause', color: 'bg-emerald-600' },
                { id: 'SPLIT', label: 'Coupure', color: 'bg-amber-600' },
                { id: 'REST', label: 'Repos', color: 'bg-slate-600' },
                { id: 'ABSENCE', label: 'Absence', color: 'bg-rose-600' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditedShift({ ...editedShift, type: t.id as any })}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                    editedShift.type === t.id 
                      ? `${t.color} text-white border-white/20 shadow-lg` 
                      : 'bg-slate-800 text-slate-400 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${t.color}`} />
                  {t.label}
                </button>
              ))}
            </div>
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

          {editedShift.type === 'SHIFT' && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Poste</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'BAR', label: 'Bar' },
                  { id: 'SALLE', label: 'Salle' },
                  { id: 'SOUTIEN', label: 'Soutien' }
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setEditedShift({ ...editedShift, role: r.id as any })}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      editedShift.role === r.id 
                        ? 'bg-indigo-600 text-white border-white/20' 
                        : 'bg-slate-800 text-slate-400 border-white/5'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validation</span>
              <span className="text-xs font-bold text-slate-500">Marquer comme validé</span>
            </div>
            <button
              onClick={() => setEditedShift({ ...editedShift, isValidated: !editedShift.isValidated })}
              className={`w-12 h-6 rounded-full transition-all relative ${editedShift.isValidated ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editedShift.isValidated ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-800/50 border-t border-white/10 flex gap-3">
          <button
            onClick={() => onDelete(editedShift.id)}
            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-black py-3 rounded-xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
          <button
            onClick={() => onSave(editedShift)}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/50 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
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
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  React.useEffect(() => {
    setEditedConfig({ ...config });
  }, [config]);

  React.useEffect(() => {
    const fetchSuggestions = async () => {
      if (editedConfig.location.length >= 3) {
        try {
          const res = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(editedConfig.location)}&limit=5&fields=nom,code,codesPostaux`);
          const data = await res.json();
          setCitySuggestions(data.map((c: any) => `${c.nom} (${c.codesPostaux[0]})`));
          setShowSuggestions(true);
        } catch (e) {
          console.error("City suggestion error", e);
        }
      } else {
        setCitySuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [editedConfig.location]);

  const handleLocationSearch = async () => {
    setIsSearchingLocation(true);
    try {
      const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY) as string;
      if (!apiKey) throw new Error('API Key missing');
      
      const ai = new GoogleGenAI({ apiKey });
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
    <div className="space-y-8 bg-slate-800/50 p-8 rounded-3xl border border-white/10 shadow-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Horaires d'ouverture */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Clock className="w-6 h-6 text-indigo-400" />
            Horaires d'Ouverture
          </h3>
          <div className="space-y-3">
            {Object.entries(editedConfig.openingHours).map(([day, hours]: [string, any]) => (
              <div key={day} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                <div className="w-24 text-xs font-black text-slate-400 uppercase tracking-widest">
                  {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][parseInt(day)]}
                </div>
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
                  className="w-5 h-5 rounded border-white/10 bg-slate-900 text-indigo-600"
                />
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={hours.open}
                    disabled={!hours.isOpen}
                    onChange={(e) => setEditedConfig({
                      ...editedConfig,
                      openingHours: {
                        ...editedConfig.openingHours,
                        [day]: { ...hours, open: e.target.value }
                      }
                    })}
                    className="bg-slate-800 border border-white/10 rounded-lg p-2 text-white text-xs disabled:opacity-30"
                  />
                  <span className="text-slate-600">à</span>
                  <input
                    type="time"
                    value={hours.close}
                    disabled={!hours.isOpen}
                    onChange={(e) => setEditedConfig({
                      ...editedConfig,
                      openingHours: {
                        ...editedConfig.openingHours,
                        [day]: { ...hours, close: e.target.value }
                      }
                    })}
                    className="bg-slate-800 border border-white/10 rounded-lg p-2 text-white text-xs disabled:opacity-30"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Paramètres de Planning */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Settings className="w-6 h-6 text-indigo-400" />
            Paramètres de Planning
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Durée du planning</label>
              <select
                value={editedConfig.planningWeeks}
                onChange={(e) => setEditedConfig({ ...editedConfig, planningWeeks: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              >
                <option value={1}>1 Semaine</option>
                <option value={2}>2 Semaines</option>
                <option value={3}>3 Semaines</option>
                <option value={4}>4 Semaines</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Échelle du planning</label>
              <select
                value={editedConfig.planningScale}
                onChange={(e) => setEditedConfig({ ...editedConfig, planningScale: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              >
                <option value={60}>1 Heure</option>
                <option value={30}>30 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={5}>5 Minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Préparation (min)</label>
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
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Amplitude Max (heures)</label>
              <input
                type="number"
                step="0.5"
                value={editedConfig.maxAmplitude ? editedConfig.maxAmplitude / 60 : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setEditedConfig({ ...editedConfig, maxAmplitude: isNaN(val) ? undefined : val * 60 });
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Travail Max / Jour (heures)</label>
              <input
                type="number"
                step="0.5"
                value={editedConfig.maxWorkedTime ? editedConfig.maxWorkedTime / 60 : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setEditedConfig({ ...editedConfig, maxWorkedTime: isNaN(val) ? undefined : val * 60 });
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Coupure Max (heures)</label>
              <input
                type="number"
                step="0.5"
                value={editedConfig.maxSplitTime ? editedConfig.maxSplitTime / 60 : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setEditedConfig({ ...editedConfig, maxSplitTime: isNaN(val) ? undefined : val * 60 });
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Travail Continu Max (heures)</label>
              <input
                type="number"
                step="0.5"
                value={editedConfig.maxContinuousWorkTime ? editedConfig.maxContinuousWorkTime / 60 : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setEditedConfig({ ...editedConfig, maxContinuousWorkTime: isNaN(val) ? undefined : val * 60 });
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Actualisation Météo</label>
              <select
                value={editedConfig.weatherRefreshMinutes || 30}
                onChange={(e) => setEditedConfig({ ...editedConfig, weatherRefreshMinutes: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white"
              >
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Heure</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ville (Météo)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={editedConfig.location}
                    onChange={(e) => setEditedConfig({ ...editedConfig, location: e.target.value })}
                    onFocus={() => editedConfig.location.length >= 3 && setShowSuggestions(true)}
                    placeholder="Ville, Pays..."
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 pl-10 text-white focus:ring-2 focus:ring-indigo-500"
                  />
                  {showSuggestions && citySuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                      {citySuggestions.map((city, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-indigo-600 transition-colors border-b border-white/5 last:border-0"
                          onClick={() => {
                            setEditedConfig({ ...editedConfig, location: city });
                            setShowSuggestions(false);
                          }}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
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
          
          {/* Règles IA Personnalisées */}
          <div className="mt-8 space-y-4">
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Règles d'Optimisation IA Personnalisées
            </h4>
            <textarea
              value={editedConfig.customAiRules || ''}
              onChange={(e) => setEditedConfig({ ...editedConfig, customAiRules: e.target.value })}
              placeholder="Ex: Privilégier 2 jours de repos consécutifs, mettre au minimum 2 agents en permanence, 4 agents en forte affluence et beau temps..."
              className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white text-sm min-h-[120px] focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
            />
            <p className="text-[10px] text-slate-500 italic">
              Ces instructions seront directement transmises à l'IA lors de la génération automatique du planning.
            </p>
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
