
import React, { useState, useMemo } from 'react';
import { Message, UserRole } from '../types';

interface MessagesViewProps {
  messages: Message[];
  currentUserRole: UserRole;
  currentUserName: string;
  onSync: (action: string, payload: any) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const MessagesView: React.FC<MessagesViewProps> = ({ messages, currentUserRole, currentUserName, onSync, setMessages }) => {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [filterDate, setFilterDate] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const filteredMessages = useMemo(() => {
    return messages
      .filter(m => {
          if (activeTab === 'ACTIVE') return !m.isArchived;
          return m.isArchived;
      })
      .filter(m => {
          if (!filterDate) return true;
          const msgDate = new Date(m.date).toISOString().split('T')[0];
          return msgDate === filterDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [messages, activeTab, filterDate]);

  const handleReply = (msgId: string) => {
      if (!replyText.trim()) return;
      
      const now = new Date().toISOString();
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, adminReply: replyText, replyDate: now } : m));
      
      onSync('UPDATE_MESSAGE', { id: msgId, adminReply: replyText, replyDate: now });
      setReplyText('');
      setReplyingTo(null);
  };

  const handleArchive = (msgId: string, archive: boolean) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isArchived: archive } : m));
      onSync('UPDATE_MESSAGE', { id: msgId, isArchived: archive });
  };

  const handleDelete = (msgId: string) => {
      if (window.confirm("Supprimer définitivement ce message ?")) {
          setMessages(prev => prev.filter(m => m.id !== msgId));
          onSync('DELETE_MESSAGE', { id: msgId });
      }
  };

  const handleExportCSV = () => {
    let csv = "\uFEFFDate,Heure,Auteur,Message,Réponse Admin,Date Réponse,Statut\n";
    filteredMessages.forEach(m => {
        const d = new Date(m.date);
        const rd = m.replyDate ? new Date(m.replyDate) : null;
        csv += `"${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${m.userName}","${m.content.replace(/"/g, '""')}","${(m.adminReply || '').replace(/"/g, '""')}","${rd ? rd.toLocaleString() : '-'}","${m.isArchived ? 'Archivé' : 'Actif'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `messages_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
             <button 
                onClick={() => setActiveTab('ACTIVE')} 
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ACTIVE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
             >
                 Actifs
             </button>
             <button 
                onClick={() => setActiveTab('ARCHIVED')} 
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ARCHIVED' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-400'}`}
             >
                 Archivés
             </button>
        </div>
        
        <div className="flex gap-4 items-center">
            <input 
                type="date" 
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
            />
            <button onClick={handleExportCSV} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800">
                Export CSV
            </button>
        </div>
      </div>

      <div className="space-y-4">
          {filteredMessages.map(msg => (
              <div key={msg.id} className={`bg-white p-6 rounded-3xl border shadow-sm transition-all ${msg.isArchived ? 'opacity-70 border-slate-100' : 'border-indigo-50'}`}>
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${msg.userName === 'Administrateur' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {msg.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                              <p className="font-bold text-slate-900">{msg.userName}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {new Date(msg.date).toLocaleDateString()} à {new Date(msg.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          {currentUserRole === 'ADMIN' && (
                              <>
                                <button 
                                    onClick={() => handleArchive(msg.id, !msg.isArchived)} 
                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                    title={msg.isArchived ? "Désarchiver" : "Archiver"}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                </button>
                                <button 
                                    onClick={() => handleDelete(msg.id)} 
                                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                    title="Supprimer"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </>
                          )}
                      </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 font-medium text-sm leading-relaxed mb-4">
                      {msg.content}
                  </div>

                  {msg.adminReply && (
                      <div className="ml-8 mt-2 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 relative">
                          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl"></div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Réponse Admin • {new Date(msg.replyDate!).toLocaleDateString()}</p>
                          <p className="text-indigo-900 font-medium text-sm">{msg.adminReply}</p>
                      </div>
                  )}

                  {currentUserRole === 'ADMIN' && !msg.adminReply && !msg.isArchived && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                          {replyingTo === msg.id ? (
                              <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                  <input 
                                    type="text" 
                                    className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-medium"
                                    placeholder="Votre réponse..."
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value.slice(0, 200))}
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleReply(msg.id)}
                                  />
                                  <button onClick={() => handleReply(msg.id)} disabled={!replyText.trim()} className="bg-indigo-600 text-white px-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700">Envoyer</button>
                                  <button onClick={() => setReplyingTo(null)} className="bg-slate-100 text-slate-500 px-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200">X</button>
                              </div>
                          ) : (
                              <button onClick={() => setReplyingTo(msg.id)} className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline">
                                  Répondre
                              </button>
                          )}
                      </div>
                  )}
              </div>
          ))}

          {filteredMessages.length === 0 && (
              <div className="text-center py-20 text-slate-400 italic">Aucun message trouvé.</div>
          )}
      </div>
    </div>
  );
};

export default MessagesView;