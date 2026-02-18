
import React from 'react';
import { UserLog } from '../types';

interface ConnectionLogsProps {
  logs: UserLog[];
}

const ConnectionLogs: React.FC<ConnectionLogsProps> = ({ logs }) => {
  const loginLogs = logs.filter(l => l.action === 'LOGIN').sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 h-full flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 shrink-0">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
                <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">Journal de Connexion</h2>
                <p className="text-xs text-slate-400 font-bold">Historique des accès à l'application.</p>
            </div>
        </div>

        <div className="bg-white rounded-3xl border shadow-sm flex-1 overflow-hidden flex flex-col">
            <div className="overflow-y-auto flex-1 h-full">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 bg-slate-50">Date & Heure</th>
                            <th className="p-4 bg-slate-50">Utilisateur</th>
                            <th className="p-4 bg-slate-50">Détails</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loginLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-xs font-bold text-slate-600">
                                    {new Date(log.timestamp).toLocaleDateString()} <span className="text-slate-400 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </td>
                                <td className="p-4">
                                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{log.userName}</span>
                                </td>
                                <td className="p-4 text-xs text-slate-500 font-medium">
                                    {log.details}
                                </td>
                            </tr>
                        ))}
                        {loginLogs.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-12 text-center text-slate-400 italic">Aucun historique de connexion disponible.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default ConnectionLogs;
