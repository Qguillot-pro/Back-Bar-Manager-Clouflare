
import React, { useState, useEffect, useRef } from 'react';
import { AdminNote, User } from '../types';

interface AdminLogbookProps {
  note?: AdminNote;
  currentUser: User;
  onSync: (action: string, payload: any) => void;
  onClose: () => void;
}

const AdminLogbook: React.FC<AdminLogbookProps> = ({ note, currentUser, onSync, onClose }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [content, setContent] = useState('');
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load
  useEffect(() => {
      if (note) setContent(note.content);
  }, [note]);

  // Activity Tracker & Auto-Close
  useEffect(() => {
      const handleActivity = () => setLastActivity(Date.now());
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('click', handleActivity);

      const checkInterval = setInterval(() => {
          if (isUnlocked && Date.now() - lastActivity > 60000) { // 1 Minute
              handleSave();
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

  const handleUnlock = () => {
      if (pinInput === currentUser.pin) {
          setIsUnlocked(true);
      } else {
          alert("Code PIN Incorrect");
          setPinInput('');
      }
  };

  const handleSave = () => {
      onSync('SAVE_NOTE', { id: 'admin_log_main', content });
  };

  const handleExport = () => {
      if (prompt("Confirmer le code PIN pour exporter") === currentUser.pin) {
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `journal_admin_${new Date().toISOString().slice(0,10)}.txt`;
          link.click();
      } else {
          alert("Code incorrect");
      }
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
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
            <h2 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Journal de Bord
            </h2>
            <div className="flex gap-2">
                <button onClick={handleExport} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">Export TXT</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">Sauvegarder</button>
                <button onClick={onClose} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ml-4">Fermer</button>
            </div>
        </div>
        <div className="flex-1 bg-slate-50 p-4 md:p-8 overflow-hidden">
            <textarea 
                className="w-full h-full bg-white border border-slate-200 rounded-2xl p-6 font-mono text-sm text-slate-800 outline-none resize-none shadow-inner leading-relaxed focus:ring-2 focus:ring-indigo-100"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Notes confidentielles, incidents, rappels..."
            />
        </div>
        <div className="bg-white p-2 border-t border-slate-200 text-center">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Dernière sauvegarde : {new Date().toLocaleTimeString()}</p>
        </div>
    </div>
  );
};

export default AdminLogbook;
