
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, PendingOrder, StockItem, StorageSpace, UnfulfilledOrder, Format, Loss } from '../types';

interface HistoryProps {
  transactions: Transaction[];
  orders: PendingOrder[];
  items: StockItem[];
  storages: StorageSpace[];
  unfulfilledOrders: UnfulfilledOrder[];
  onUpdateOrderQuantity?: (orderIds: string[], newQuantity: number) => void;
  formats: Format[];
  losses?: Loss[];
}

type PeriodFilter = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

const History: React.FC<HistoryProps> = ({ transactions = [], orders = [], items = [], storages = [], unfulfilledOrders = [], onUpdateOrderQuantity, formats = [], losses = [] }) => {
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'CLIENT_RUPTURE' | 'STOCK_RUPTURE' | 'RECEIVED' | 'LOSSES'>('MOVEMENTS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('DAY');
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); 
  const [selectedWeek, setSelectedWeek] = useState<string>(''); 
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); 

  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [validatedGroups, setValidatedGroups] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('barstock_validated_receipts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
      localStorage.setItem('barstock_validated_receipts', JSON.stringify(Array.from(validatedGroups)));
  }, [validatedGroups]);

  const availableWeeks = useMemo(() => {
      const weeks = [];
      const d = new Date(selectedYear, 0, 1);
      while (d.getDay() !== 1) {
          d.setDate(d.getDate() + 1);
      }
      let weekNum = 1;
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      while (d.getFullYear() === selectedYear) {
          const weekStart = new Date(d);
          const weekEnd = new Date(d);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const label = `S${weekNum} (${monthNames[weekStart.getMonth()]})`;
          const value = weekNum.toString();
          weeks.push({ value, label, start: weekStart, end: weekEnd });
          d.setDate(d.getDate() + 7);
          weekNum++;
      }
      return weeks;
  }, [selectedYear]);

  useEffect(() => {
      if (availableWeeks.length > 0 && !selectedWeek) {
         const now = new Date();
         const current = availableWeeks.find(w => now >= w.start && now <= w.end);
         setSelectedWeek(current ? current.value : availableWeeks[0].value);
      }
  }, [availableWeeks, selectedWeek]);

  // Helper date sécurisé
  const safeDate = (dateStr: string | undefined): Date => {
      if (!dateStr) return new Date();
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date() : d;
  };

  const getBarDate = (date: Date) => {
    const d = new Date(date);
    if (d.getHours() < 4) {
      d.setDate(d.getDate() - 1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const checkDateInFilter = (dateStr: string) => {
      if (!dateStr) return false;
      const date = safeDate(dateStr);
      const barDate = new Date(date);
      if (barDate.getHours() < 4) {
          barDate.setDate(barDate.getDate() - 1);
      }

      if (periodFilter === 'DAY') {
          const target = safeDate(selectedDay);
          return barDate.getFullYear() === target.getFullYear() &&
                 barDate.getMonth() === target.getMonth() &&
                 barDate.getDate() === target.getDate();
      }

      if (periodFilter === 'WEEK') {
          const weekObj = availableWeeks.find(w => w.value === selectedWeek);
          if (!weekObj) return false;
          return date >= weekObj.start && date <= weekObj.end;
      }

      if (periodFilter === 'MONTH') {
          return barDate.getFullYear() === selectedYear && barDate.getMonth() === selectedMonth;
      }

      if (periodFilter === 'YEAR') {
          return barDate.getFullYear() === selectedYear;
      }

      return true;
  };

  const filteredTransactions = useMemo(() => {
    return transactions
        .filter(t => checkDateInFilter(t.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);

  const filteredUnfulfilled = useMemo(() => {
      return unfulfilledOrders
        .filter(u => checkDateInFilter(u.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [unfulfilledOrders, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);
  
  const filteredReceived = useMemo(() => {
      return orders.filter(o => o.status === 'RECEIVED' && o.receivedAt && checkDateInFilter(o.receivedAt));
  }, [orders, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);

  const filteredPending = useMemo(() => {
      return orders.filter(o => o.status !== 'RECEIVED' && o.ruptureDate && checkDateInFilter(o.ruptureDate));
  }, [orders, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);

  const filteredLosses = useMemo(() => {
      return losses
        .filter(l => checkDateInFilter(l.discardedAt))
        .sort((a, b) => new Date(b.discardedAt).getTime() - new Date(a.discardedAt).getTime());
  }, [losses, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, availableWeeks]);

  const displayTransactions = useMemo(() => {
    const grouped: Transaction[] = [];
    filteredTransactions.forEach((current) => {
        const currentQty = Number(current.quantity);
        if (grouped.length === 0) {
            grouped.push({ ...current, quantity: currentQty });
            return;
        }
        const last = grouped[grouped.length - 1];
        const currentDate = safeDate(current.date);
        const lastDate = safeDate(last.date);
        const isSameTime = Math.abs(currentDate.getTime() - lastDate.getTime()) < 60000; 
        const isSameItem = current.itemId === last.itemId;
        const isSameType = current.type === last.type;
        const isSameUser = current.userName === last.userName;
        if (isSameTime && isSameItem && isSameType && isSameUser && !current.note) {
            last.quantity = Number(last.quantity) + currentQty;
        } else {
            grouped.push({ ...current, quantity: currentQty });
        }
    });
    return grouped;
  }, [filteredTransactions]);

  const groupedReceivedOrders = useMemo(() => {
    const dayGroups: Record<string, { date: Date, items: Record<string, { item: StockItem, orders: PendingOrder[], totalQty: number, initialQty: number }> }> = {};

    filteredReceived.forEach(o => {
        if (!o.receivedAt) return;
        const item = items.find(i => i.id === o.itemId);
        if (!item) return;

        const date = safeDate(o.receivedAt);
        const barDate = getBarDate(date);
        const dateKey = barDate.toISOString().split('T')[0];

        if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = { date: barDate, items: {} };
        }

        if (!dayGroups[dateKey].items[item.id]) {
            dayGroups[dateKey].items[item.id] = { item, orders: [], totalQty: 0, initialQty: 0 };
        }

        dayGroups[dateKey].items[item.id].orders.push(o);
        dayGroups[dateKey].items[item.id].totalQty += o.quantity;
        dayGroups[dateKey].items[item.id].initialQty += (o.initialQuantity ?? o.quantity);
    });
    
    return Object.entries(dayGroups)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, data]) => ({
            key,
            dateLabel: data.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
            items: Object.values(data.items)
        }));

  }, [filteredReceived, items]);

  const handleQuantityChange = (groupKey: string, val: string) => {
      if (/^\d*$/.test(val)) {
          setEditedQuantities(prev => ({ ...prev, [groupKey]: parseInt(val) || 0 }));
      }
  };

  const handleValidateReceipt = (groupKey: string, ids: string[], qty: number) => {
      if (onUpdateOrderQuantity) {
          onUpdateOrderQuantity(ids, qty);
          setValidatedGroups(prev => new Set(prev).add(groupKey));
      }
  };

  const getFormatName = (formatId?: string) => {
      return formats.find(f => f.id === formatId)?.name || 'N/A';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
              <button onClick={() => setActiveTab('MOVEMENTS')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Mouvements</button>
              <button onClick={() => setActiveTab('LOSSES')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'LOSSES' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Pertes & Gaspillage</button>
              <button onClick={() => setActiveTab('CLIENT_RUPTURE')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'CLIENT_RUPTURE' ? 'bg-rose-400 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Ruptures Clients</button>
              <button onClick={() => setActiveTab('STOCK_RUPTURE')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'STOCK_RUPTURE' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Art. Sous Tension</button>
              <button onClick={() => setActiveTab('RECEIVED')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'RECEIVED' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Art. Reçus</button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                  <select 
                    value={periodFilter} 
                    onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                    className="bg-slate-100 border-none rounded-lg px-3 py-2 text-xs font-black uppercase text-slate-700 outline-none cursor-pointer"
                  >
                      <option value="DAY">Par Jour</option>
                      <option value="WEEK">Par Semaine</option>
                      <option value="MONTH">Par Mois</option>
                      <option value="YEAR">Par Année</option>
                  </select>

                  {periodFilter === 'DAY' && (
                      <input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none" />
                  )}
              </div>
          </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'MOVEMENTS' && (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b">
                        <tr>
                            <th className="p-4">Date/Heure</th>
                            <th className="p-4">Utilisateur</th>
                            <th className="p-4">Produit</th>
                            <th className="p-4">Type</th>
                            <th className="p-4 text-right">Quantité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayTransactions.map((t, idx) => {
                            const item = items.find(i => i.id === t.itemId);
                            const d = safeDate(t.date);
                            return (
                                <tr key={`${t.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-xs font-bold text-slate-600">
                                        {d.toLocaleDateString('fr-FR')} <span className="text-slate-400 text-[10px]">{d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-slate-800">{t.userName || '-'}</td>
                                    <td className="p-4 font-black text-slate-900">
                                        {item?.name || 'Inconnu'}
                                        {t.note && <span className="block text-[9px] text-slate-400 font-normal italic mt-0.5">{t.note}</span>}
                                        {t.isServiceTransfer && <span className="block text-[9px] text-purple-500 font-bold uppercase tracking-wider mt-0.5">Transfert Interservice</span>}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${t.type === 'IN' ? (t.isCaveTransfer ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600') : 'bg-rose-100 text-rose-600'}`}>
                                            {t.type === 'IN' ? (t.isCaveTransfer ? 'Cave' : 'Entrée') : 'Sortie'}
                                        </span>
                                    </td>
                                    <td className={`p-4 text-right font-black ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.type === 'IN' ? '+' : '-'}{parseFloat(Number(t.quantity).toFixed(3))}
                                    </td>
                                </tr>
                            );
                        })}
                        {displayTransactions.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic text-sm">Aucun mouvement pour cette période.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          )}
          
          {activeTab === 'LOSSES' && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b">
                          <tr>
                              <th className="p-4">Date</th>
                              <th className="p-4">Utilisateur</th>
                              <th className="p-4">Produit</th>
                              <th className="p-4 text-right">Quantité Perdue</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredLosses.filter(l => l.quantity > 0).map((l, idx) => {
                              const item = items.find(i => i.id === l.itemId);
                              const d = safeDate(l.discardedAt);
                              return (
                                  <tr key={`${l.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4 text-xs font-bold text-slate-600">
                                          {d.toLocaleDateString('fr-FR')} <span className="text-slate-400 text-[10px]">{d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span>
                                      </td>
                                      <td className="p-4 text-xs font-bold text-slate-800">{l.userName || '-'}</td>
                                      <td className="p-4 font-black text-slate-900">{item?.name || 'Inconnu'}</td>
                                      <td className="p-4 text-right font-black text-rose-600">
                                          -{l.quantity}%
                                      </td>
                                  </tr>
                              );
                          })}
                          {filteredLosses.filter(l => l.quantity > 0).length === 0 && (
                              <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic text-sm">Aucune perte enregistrée.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}
      </div>
    </div>
  );
};

export default History;
