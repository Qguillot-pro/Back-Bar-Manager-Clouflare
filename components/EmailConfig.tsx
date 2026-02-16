
import React, { useState } from 'react';
import { AppConfig, EmailTemplate } from '../types';

interface EmailConfigProps {
  appConfig: AppConfig;
  setAppConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  templates: EmailTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<EmailTemplate[]>>;
  onSync: (action: string, payload: any) => void;
}

const EmailConfig: React.FC<EmailConfigProps> = ({ appConfig, setAppConfig, templates, setTemplates, onSync }) => {
  const [senderEmail, setSenderEmail] = useState(appConfig.emailSender || '');
  
  // Template State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');

  const handleSaveSender = () => {
      setAppConfig(prev => ({ ...prev, emailSender: senderEmail }));
      onSync('SAVE_CONFIG', { key: 'email_sender', value: senderEmail });
      alert('Adresse expéditeur sauvegardée.');
  };

  const handleSaveTemplate = () => {
      if (!tplName || !tplSubject) return;
      
      const newTpl: EmailTemplate = {
          id: editingId || 'tpl_' + Date.now(),
          name: tplName,
          subject: tplSubject,
          body: tplBody
      };

      if (editingId) {
          setTemplates(prev => prev.map(t => t.id === editingId ? newTpl : t));
      } else {
          setTemplates(prev => [...prev, newTpl]);
      }
      
      onSync('SAVE_EMAIL_TEMPLATE', newTpl);
      resetForm();
  };

  const handleEdit = (tpl: EmailTemplate) => {
      setEditingId(tpl.id);
      setTplName(tpl.name);
      setTplSubject(tpl.subject);
      setTplBody(tpl.body);
  };

  const handleDelete = (id: string) => {
      if (window.confirm('Supprimer ce modèle ?')) {
          setTemplates(prev => prev.filter(t => t.id !== id));
          onSync('DELETE_EMAIL_TEMPLATE', { id });
      }
  };

  const resetForm = () => {
      setEditingId(null);
      setTplName('');
      setTplSubject('');
      setTplBody('');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>Configuration E-mail</h3>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Adresse Expéditeur (Pour info)</label>
                    <div className="flex gap-2">
                        <input 
                            type="email" 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 outline-none"
                            placeholder="commandes@monbar.com"
                            value={senderEmail}
                            onChange={e => setSenderEmail(e.target.value)}
                        />
                        <button onClick={handleSaveSender} className="bg-indigo-600 text-white px-6 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700">Sauver</button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 ml-1">Cette adresse sera utilisée comme référence. L'envoi réel se fera via votre client mail par défaut.</p>
                </div>
            </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>Modèles de Mail (Templates)</h3>
            
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" placeholder="Nom du modèle (ex: Fournisseur Vin)" value={tplName} onChange={e => setTplName(e.target.value)} />
                    <input className="bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" placeholder="Sujet du mail" value={tplSubject} onChange={e => setTplSubject(e.target.value)} />
                </div>
                <div className="relative">
                    <textarea 
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none h-40 resize-none"
                        placeholder="Bonjour,&#10;&#10;Veuillez trouver ci-joint notre commande de la semaine.&#10;&#10;{TABLEAU_COMMANDE}&#10;&#10;Cordialement,"
                        value={tplBody}
                        onChange={e => setTplBody(e.target.value)}
                    />
                    <div className="absolute bottom-4 right-4 text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold border border-slate-200">
                        Utilisez {`{TABLEAU_COMMANDE}`} pour insérer la liste.
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    {editingId && <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 font-bold uppercase text-xs px-4">Annuler</button>}
                    <button onClick={handleSaveTemplate} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-purple-700 shadow-lg">
                        {editingId ? 'Mettre à jour' : 'Créer le modèle'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(tpl => (
                    <div key={tpl.id} className="p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors group relative">
                        <div className="pr-8">
                            <h4 className="font-bold text-slate-800">{tpl.name}</h4>
                            <p className="text-xs text-slate-500 italic mt-1">Sujet: {tpl.subject}</p>
                        </div>
                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(tpl)} className="p-2 bg-white text-indigo-500 rounded-lg hover:bg-indigo-50 border border-slate-200"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button onClick={() => handleDelete(tpl.id)} className="p-2 bg-white text-rose-500 rounded-lg hover:bg-rose-50 border border-slate-200"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default EmailConfig;
