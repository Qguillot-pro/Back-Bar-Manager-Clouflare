
import React, { useState, useEffect, useRef } from 'react';
import { AdminNote, User } from '../types';

interface AdminLogbookProps {
  currentUser: User;
  onSync: (action: string, payload: any) => void;
  onClose: () => void;
}

const AdminLogbook: React.FC<AdminLogbookProps> = ({ currentUser, onSync, onClose }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newNote, setNewNote] = useState('');
  const [history, setHistory] = useState<AdminNote[]>([]); // Local history state
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  // Fetch history directly from API when unlocked
  const fetchNotes = async () => {
      try {
          const res = await fetch('/api/data_sync?scope=stock');
          const data = await res.json();
          if (data.adminNotes) {
              setHistory(data.adminNotes);
          }
      } catch (e) { console.error('Failed to fetch notes', e); }
  };

  // Activity Tracker & Auto-Close
  useEffect(() => {
      const handleActivity = () => setLastActivity(Date.now());
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('click', handleActivity);

      const checkInterval = setInterval(() => {
          if (isUnlocked && Date.now() - lastActivity > 60000) { // 1 Minute
              setIsUnlocked(false);
              setPinInput('');
              alert("Fermeture automatique du journal pour confidentialité.");
              onClose();
          }
      }, 5000);

      return () => {
          window.removeEventListener('mousemove', handleActivity);
          window.removeEventListener('keydown', handleActivity);
          window.removeEventListener('click', handleActivity);
          clearInterval(checkInterval);
      };
  }, [isUnlocked, lastActivity]);

  useEffect(() => {
      if (isUnlocked) fetchNotes();
  }, [isUnlocked]);

  const handleUnlock = () => {
      if (pinInput === currentUser.pin) {
          setIsUnlocked(true);
      } else {
          alert("Code PIN Incorrect");
          setPinInput('');
      }
  };

  const handleSave = () => {
      if (!newNote.trim()) return;
      const note: AdminNote = {
          id: 'note_' + Date.now(),
          content: newNote,
          createdAt: new Date().toISOString(),
          userName: currentUser.name
      };
      // Optimistic Update
      setHistory(prev => [note, ...prev]);
      onSync('SAVE_NOTE', note);
      setNewNote('');
  };

  const handleExport = () => {
      const txt = history.map(n => `[${new Date(n.createdAt).toLocaleString()} - ${n.userName || 'Admin'}]\n${n.content}\n-------------------`).join('\n\n');
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `journal_admin_historique.txt`;
      link.click();
  };

  if (!isUnlocked) {
      return (
          <div className="fixed inset-0 z-[2000] bg-slate-900 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Journal de Bord Admin</h3>
                  <p className="text-xs text-slate-500">Zone confidentielle. Fermeture auto 1 min.</p>
                  <input 
                    type="password" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-center font-black text-2xl tracking-[1em] outline-none focus:ring-2 focus:ring-indigo-500"
                    maxLength={4}
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    placeholder="••••"
                    autoFocus
                  />
                  <div className="flex gap-2">
                      <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-xs tracking-widest">Annuler</button>
                      <button onClick={handleUnlock} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800">Accéder</button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-white flex flex-col">
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg shrink-0">
            <h2 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Journal de Bord
            </h2>
            <div className="flex gap-2">
                <button onClick={handleExport} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">Export TXT</button>
                <button onClick={onClose} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ml-4">Fermer</button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* NEW NOTE INPUT */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <textarea 
                        className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-sm text-slate-800 outline-none resize-none mb-4 focus:ring-2 focus:ring-indigo-100"
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Nouvelle entrée (incidents, personnel, stock...)"
                        autoFocus
                    />
                    <div className="flex justify-end">
                        <button onClick={handleSave} disabled={!newNote.trim()} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 disabled:opacity-50">Ajouter au Journal</button>
                    </div>
                </div>

                {/* HISTORY FEED */}
                <div className="space-y-4">
                    {history.map(note => (
                        <div key={note.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    {new Date(note.createdAt).toLocaleDateString()} à {new Date(note.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </span>
                                <span className="text-xs font-bold text-indigo-600">{note.userName || 'Admin'}</span>
                            </div>
                            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{note.content}</p>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-center text-slate-400 text-sm italic">Aucune entrée historique.</p>}
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminLogbook;
