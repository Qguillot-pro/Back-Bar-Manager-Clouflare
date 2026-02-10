
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
  const [sortBy, setSortBy] = useState<'DATE' | 'PRODUCT'>('DATE');

  const activeDlcs = useMemo(() => {
    return dlcHistory.map(entry => {
      const item = items.find(i => i.id === entry.itemId);
      const storage = storages.find(s => s.id === entry.storageId);
      const profile = item?.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
      
      if (!item || !profile) return null;

      const openedDate = new Date(entry.openedAt);
      const expirationDate = new Date(openedDate.getTime() + profile.durationHours * 3600000);
      const now = new Date();
      const timeLeft = expirationDate.getTime() - now.getTime();
      const isExpired = timeLeft < 0;

      return {
        id: entry.id,
        itemName: item.name,
        storageName: storage?.name || 'Inconnu',
        openedDate,
        expirationDate,
        timeLeft,
        isExpired,
        durationLabel: profile.durationHours >= 24 ? `${Number((profile.durationHours/24).toFixed(1))}j` : `${profile.durationHours}h`,
        userName: entry.userName || 'N/A',
        type: profile.type || 'OPENING' // 'OPENING' ou 'PRODUCTION'
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => {
        if (sortBy === 'PRODUCT') {
            return a.itemName.localeCompare(b.itemName);
        }
        return a.expirationDate.getTime() - b.expirationDate.getTime();
    });
  }, [dlcHistory, items, storages, dlcProfiles, sortBy]);

  const formatDuration = (ms: number) => {
    if (ms < 0) return "EXPIRÉ";
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j ${hours % 24}h`;
    return `${hours}h ${Math.floor((ms % 3600000) / 60000)}min`;
  };

  const handleOpenLossModal = (id: string) => {
      setSelectedDlcId(id);
      setPercentLost(0);
      setLossModalOpen(true);
  };

  const handleConfirmLoss = () => {
      if (selectedDlcId) {
          onDelete(selectedDlcId, percentLost);
          setLossModalOpen(false);
          setSelectedDlcId(null);
          setPercentLost(0);
      }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
      
      {/* MODAL PERTE */}
      {lossModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 relative overflow-hidden text-center">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Jeter le produit</h3>
                  <p className="text-slate-500 text-xs font-bold mb-6">Quelle quantité restait-il (environ) ?</p>
                  
                  <div className="grid grid-cols-3 gap-2 mb-6">
                      {[0, 25, 50, 75, 100].map(p => (
                          <button 
                            key={p} 
                            onClick={() => setPercentLost(p)}
                            className={`py-3 rounded-xl font-black text-sm transition-all ${percentLost === p ? 'bg-rose-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                              {p === 0 ? 'Vide' : `${p}%`}
                          </button>
                      ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button 
                          onClick={() => setLossModalOpen(false)}
                          className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                      >
                          Annuler
                      </button>
                      <button 
                          onClick={handleConfirmLoss}
                          className="py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-200 active:scale-95 transition-all"
                      >
                          Confirmer & Jeter
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="p-6 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
            Suivi des DLC en cours
        </h2>
        <div className="flex items-center gap-4">
            <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                <button onClick={() => setSortBy('DATE')} className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === 'DATE' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}>Par Date</button>
                <button onClick={() => setSortBy('PRODUCT')} className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === 'PRODUCT' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}>Par Produit</button>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeDlcs.length} lots actifs</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="p-6">Produit</th>
              <th className="p-6">Type</th>
              <th className="p-6">Début</th>
              <th className="p-6">Échéance</th>
              <th className="p-6">Temps Restant</th>
              <th className="p-6 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeDlcs.map(dlc => (
              <tr key={dlc.id} className={`transition-colors ${dlc.isExpired ? 'bg-rose-50' : 'hover:bg-slate-50'}`}>
                <td className="p-6">
                  <span className={`font-black text-sm ${dlc.isExpired ? 'text-rose-900' : 'text-slate-900'}`}>{dlc.itemName}</span>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                     Durée: {dlc.durationLabel} • Par: {dlc.userName}
                  </div>
                </td>
                <td className="p-6">
                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider ${dlc.type === 'PRODUCTION' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                        {dlc.type === 'PRODUCTION' ? 'Prod. Frais' : 'Ouverture'}
                    </span>
                </td>
                <td className="p-6 text-xs font-bold text-slate-600">
                    {dlc.openedDate.toLocaleDateString()} <span className="text-[10px] text-slate-400">{dlc.openedDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </td>
                <td className="p-6 text-xs font-black text-slate-800">
                    {dlc.expirationDate.toLocaleDateString()} <span className="text-[10px] text-slate-400">{dlc.expirationDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </td>
                <td className="p-6">
                   <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                       dlc.isExpired 
                       ? 'bg-rose-500 text-white animate-pulse' 
                       : (dlc.timeLeft < 3600000 * 4 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')
                   }`}>
                       {formatDuration(dlc.timeLeft)}
                   </span>
                </td>
                <td className="p-6 text-center">
                    <button 
                        onClick={() => handleOpenLossModal(dlc.id)}
                        className="text-slate-300 hover:text-rose-500 hover:bg-white p-2 rounded-xl transition-all border border-transparent hover:border-slate-200"
                        title="Jeter (Poubelle)"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </td>
              </tr>
            ))}
            {activeDlcs.length === 0 && (
                <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 italic font-medium">Aucun produit sous surveillance DLC actuellement.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DLCView;
