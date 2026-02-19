
import React, { useMemo, useState } from 'react';
import { StockItem, DLCHistory, DLCProfile, StorageSpace } from '../types';

interface DLCViewProps {
  items: StockItem[];
  dlcHistory: DLCHistory[];
  dlcProfiles: DLCProfile[];
  storages: StorageSpace[];
  onDelete: (id: string, qtyLostPercent?: number) => void;
}

const DLCView: React.FC<DLCViewProps> = ({ items, dlcHistory = [], dlcProfiles = [], storages = [], onDelete }) => {
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [selectedDlcId, setSelectedDlcId] = useState<string | null>(null);
  const [percentLost, setPercentLost] = useState<number>(0);

  const activeDlcs = useMemo(() => {
    if (!dlcHistory || !items) return [];
    
    return dlcHistory.map(entry => {
      const item = items.find(i => i.id === entry.itemId);
      if (!item) return null;

      const storage = storages.find(s => s.id === entry.storageId);
      const profile = item.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
      
      const durationHours = profile?.durationHours || 24;
      
      let openedDate = new Date(entry.openedAt);
      if (isNaN(openedDate.getTime())) {
          openedDate = new Date(); 
      }
      
      const expirationDate = new Date(openedDate.getTime() + durationHours * 3600000);
      const now = new Date();
      const timeLeft = expirationDate.getTime() - now.getTime();
      const isExpired = timeLeft < 0;

      return {
        id: entry.id,
        itemName: item.name,
        storageName: storage?.name || 'Stock Global',
        openedDate,
        expirationDate,
        timeLeft,
        isExpired,
        durationLabel: durationHours >= 24 ? `${Number((durationHours/24).toFixed(1))}j` : `${durationHours}h`,
        userName: entry.userName || 'N/A'
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.expirationDate.getTime() - b.expirationDate.getTime());
  }, [dlcHistory, items, storages, dlcProfiles]);

  const expiredCount = activeDlcs.filter(d => d.isExpired).length;

  const formatDuration = (ms: number) => {
    if (ms < 0) return "EXPIRÉ";
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}min`;
  };

  const handleConfirmLoss = () => {
      if (selectedDlcId) {
          onDelete(selectedDlcId, percentLost);
          setLossModalOpen(false);
          setSelectedDlcId(null);
      }
  };

  const safeDateString = (date: Date) => {
      return !isNaN(date.getTime()) 
        ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        : '-';
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[400px] animate-in fade-in duration-500">
      
      {/* BANNIÈRE ALERTE */}
      {expiredCount > 0 && (
          <div className="bg-rose-500 text-white p-4 text-center font-black uppercase text-xs tracking-widest animate-pulse flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Attention : {expiredCount} produit(s) expiré(s) détecté(s) !
          </div>
      )}

      {lossModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center space-y-6">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Jeter le produit</h3>
                  <p className="text-xs text-slate-500 font-bold">Quelle part du produit a été perdue ?</p>
                  
                  <div className="space-y-4 py-4">
                      <div className="text-center font-black text-3xl text-rose-500">
                          {percentLost}% <span className="text-sm text-slate-400 font-bold uppercase">Perdu</span>
                      </div>
                      <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="10" 
                          className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:bg-slate-200 transition-colors"
                          value={percentLost}
                          onChange={(e) => setPercentLost(parseInt(e.target.value))}
                      />
                      <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                          <span>Vide (0%)</span>
                          <span>Moitié (50%)</span>
                          <span>Plein (100%)</span>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => setLossModalOpen(false)} className="py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest">Annuler</button>
                      <button onClick={handleConfirmLoss} className="py-3 bg-rose-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-200">Valider</button>
                  </div>
              </div>
          </div>
      )}

      <div className="p-6 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
            Suivi des DLC en cours
        </h2>
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeDlcs.length} lots actifs</span>
            <div className={`w-3 h-3 rounded-full ${expiredCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b">
            <tr>
              <th className="p-6">Produit / Lieu</th>
              <th className="p-6 text-center">Ouverture</th>
              <th className="p-6 text-center">Échéance</th>
              <th className="p-6 text-center">Temps Restant</th>
              <th className="p-6 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeDlcs.map(dlc => (
              <tr key={dlc.id} className={`${dlc.isExpired ? 'bg-rose-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                <td className="p-6">
                  <span className="font-black text-slate-900 text-sm block">{dlc.itemName}</span>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase mt-1 bg-indigo-50 inline-block px-2 py-0.5 rounded border border-indigo-100">
                      📍 {dlc.storageName}
                  </div>
                  <span className="text-[9px] text-slate-400 ml-2">Par: {dlc.userName}</span>
                </td>
                <td className="p-6 text-xs text-center font-bold text-slate-500">{safeDateString(dlc.openedDate)}</td>
                <td className="p-6 text-xs text-center font-black text-slate-700">{safeDateString(dlc.expirationDate)}</td>
                <td className="p-6 text-center">
                   <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${dlc.isExpired ? 'bg-rose-500 text-white border-rose-600 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                       {formatDuration(dlc.timeLeft)}
                   </span>
                </td>
                <td className="p-6 text-center">
                    <button 
                        onClick={() => { setSelectedDlcId(dlc.id); setPercentLost(0); setLossModalOpen(true); }} 
                        className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-90"
                        title="Signaler la perte ou fin de vie"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </td>
              </tr>
            ))}
            {activeDlcs.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-32 text-center">
                        <div className="flex flex-col items-center gap-4 text-slate-400">
                            <svg className="w-16 h-16 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="font-bold italic">Aucun lot actif sous surveillance DLC.</p>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DLCView;
