
import React, { useMemo, useState } from 'react';
import { StockItem, DLCHistory, DLCProfile, StorageSpace } from '../types';

interface DLCViewProps {
  items: StockItem[];
  dlcHistory: DLCHistory[];
  dlcProfiles: DLCProfile[];
  storages: StorageSpace[];
  onDelete: (id: string, qtyLost?: number) => void;
}

const DLCView: React.FC<DLCViewProps> = ({ items, dlcHistory, dlcProfiles, storages, onDelete }) => {
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [selectedDlcId, setSelectedDlcId] = useState<string | null>(null);
  const [quantityLost, setQuantityLost] = useState<number>(0);

  const activeDlcs = useMemo(() => {
    // 1. Trier l'historique par date d'ouverture décroissante (le plus récent en premier)
    const sortedHistory = [...dlcHistory].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

    // 2. Map pour dédoublonner par clé unique (ItemId + StorageId)
    const uniqueMap = new Map<string, DLCHistory>();

    sortedHistory.forEach(entry => {
        const key = `${entry.itemId}-${entry.storageId}`;
        // Comme on a trié par date décroissante, la première occurrence est la plus récente
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, entry);
        }
    });

    // 3. Convertir en tableau et enrichir les données
    return Array.from(uniqueMap.values()).map(entry => {
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

  const handleOpenLossModal = (id: string) => {
      setSelectedDlcId(id);
      setQuantityLost(0);
      setLossModalOpen(true);
  };

  const handleConfirmLoss = () => {
      if (selectedDlcId) {
          onDelete(selectedDlcId, quantityLost);
          setLossModalOpen(false);
          setSelectedDlcId(null);
          setQuantityLost(0);
      }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
      
      {/* MODAL PERTE */}
      {lossModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 relative overflow-hidden text-center">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Sortie de Stock</h3>
                  <p className="text-slate-500 text-xs font-bold mb-6">Quelle quantité restait-il dans la bouteille jetée ?</p>
                  
                  <div className="flex justify-center mb-6">
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        className="w-32 bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-center font-black text-3xl outline-none focus:border-rose-500 focus:bg-white transition-all text-slate-900"
                        value={quantityLost}
                        onChange={(e) => setQuantityLost(parseFloat(e.target.value) || 0)}
                      />
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
                          Confirmer
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
            Suivi des DLC en cours
        </h2>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeDlcs.length} produits ouverts</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="p-6">Produit</th>
              <th className="p-6">Espace</th>
              <th className="p-6">Ouvert le (Dernier)</th>
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
                <td className="p-6 text-xs font-bold text-slate-600">{dlc.storageName}</td>
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
                        className="text-slate-300 hover:text-slate-500 hover:bg-white p-2 rounded-xl transition-all border border-transparent hover:border-slate-200"
                        title="Archiver / Jeter"
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
