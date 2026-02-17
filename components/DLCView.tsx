
import React, { useMemo, useState } from 'react';
import { StockItem, DLCHistory, DLCProfile, StorageSpace } from '../types';

interface DLCViewProps {
  items: StockItem[];
  dlcHistory: DLCHistory[];
  dlcProfiles: DLCProfile[];
  storages: StorageSpace[];
  onDelete: (id: string, qtyLostPercent?: number) => void;
}

const DLCView: React.FC<DLCViewProps> = ({ items, dlcHistory, dlcProfiles, storages, onDelete }) => {
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [selectedDlcId, setSelectedDlcId] = useState<string | null>(null);
  const [percentLost, setPercentLost] = useState<number>(0);

  const activeDlcs = useMemo(() => {
    if (!dlcHistory) return [];
    return dlcHistory.map(entry => {
      const item = items.find(i => i.id === entry.itemId);
      const storage = storages.find(s => s.id === entry.storageId);
      const profile = item?.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
      
      if (!item) return null;

      // Durée par défaut 24h si pas de profil trouvé
      const durationHours = profile?.durationHours || 24;
      const openedDate = new Date(entry.openedAt);
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

  const formatDuration = (ms: number) => {
    if (ms < 0) return "EXPIRÉ";
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j ${hours % 24}h`;
    return `${hours}h ${Math.floor((ms % 3600000) / 60000)}min`;
  };

  const handleConfirmLoss = () => {
      if (selectedDlcId) {
          onDelete(selectedDlcId, percentLost);
          setLossModalOpen(false);
          setSelectedDlcId(null);
      }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[400px]">
      
      {lossModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center space-y-6">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Jeter le produit</h3>
                  <div className="grid grid-cols-3 gap-2">
                      {[0, 50, 100].map(p => (
                          <button key={p} onClick={() => setPercentLost(p)} className={`py-3 rounded-xl font-black ${percentLost === p ? 'bg-rose-500 text-white' : 'bg-slate-100'}`}>{p === 0 ? 'Vide' : p+'%'}</button>
                      ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setLossModalOpen(false)} className="py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px]">Annuler</button>
                      <button onClick={handleConfirmLoss} className="py-3 bg-rose-500 text-white rounded-xl font-black uppercase text-[10px]">Valider</button>
                  </div>
              </div>
          </div>
      )}

      <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
            Suivi des DLC en cours
        </h2>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeDlcs.length} lots sous surveillance</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="p-6">Produit</th>
              <th className="p-6 text-center">Ouverture</th>
              <th className="p-6 text-center">Échéance</th>
              <th className="p-6 text-center">Temps Restant</th>
              <th className="p-6 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeDlcs.map(dlc => (
              <tr key={dlc.id} className={dlc.isExpired ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                <td className="p-6">
                  <span className="font-black text-slate-900 text-sm">{dlc.itemName}</span>
                  <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Lieu: {dlc.storageName} • Par: {dlc.userName}</div>
                </td>
                <td className="p-6 text-xs text-center font-bold text-slate-500">{dlc.openedDate.toLocaleDateString()} {dlc.openedDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td className="p-6 text-xs text-center font-black text-slate-700">{dlc.expirationDate.toLocaleDateString()} {dlc.expirationDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td className="p-6 text-center">
                   <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${dlc.isExpired ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                       {formatDuration(dlc.timeLeft)}
                   </span>
                </td>
                <td className="p-6 text-center">
                    <button onClick={() => { setSelectedDlcId(dlc.id); setLossModalOpen(true); }} className="text-slate-300 hover:text-rose-500 p-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </td>
              </tr>
            ))}
            {activeDlcs.length === 0 && (
                <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic font-medium">Aucun lot actif à surveiller.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DLCView;
