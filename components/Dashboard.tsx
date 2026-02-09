
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StockItem, Category, StockLevel, StockConsigne, DLCHistory, DLCProfile, UserRole, Transaction, Message, Event, Task } from '../types';

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
}

const Dashboard: React.FC<DashboardProps> = ({ items, stockLevels, consignes, categories, dlcHistory = [], dlcProfiles = [], userRole, transactions = [], messages, events = [], tasks = [], currentUserName, onNavigate, onSendMessage, onArchiveMessage }) => {
  const [newMessageText, setNewMessageText] = useState('');

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
  const pendingTasksCount = useMemo(() => tasks.filter(t => !t.isDone).length, [tasks]);

  const handlePostMessage = () => {
      if (newMessageText.length > 0 && newMessageText.length <= 300) {
          onSendMessage(newMessageText);
          setNewMessageText('');
      }
  };

  return (
    <div className="space-y-6">
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
          <div onClick={() => onNavigate('daily_life')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all relative overflow-hidden group">
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

          <div onClick={() => onNavigate('daily_life')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-amber-300 transition-all relative overflow-hidden group">
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
