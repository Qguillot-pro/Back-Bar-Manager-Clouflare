
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, PendingOrder, StockItem, StorageSpace, UnfulfilledOrder, Format, Loss, DailyStockAlert } from '../types';

interface HistoryProps {
  transactions: Transaction[];
  orders: PendingOrder[];
  items: StockItem[];
  storages: StorageSpace[];
  unfulfilledOrders: UnfulfilledOrder[];
  onUpdateOrderQuantity?: (orderIds: string[], newQuantity: number) => void;
  formats: Format[];
  losses?: Loss[];
  dailyStockAlerts?: DailyStockAlert[];
}

type PeriodFilter = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
type Tab = 'MOVEMENTS' | 'LOSSES' | 'CLIENT_RUPTURE' | 'STOCK_TENSION' | 'STOCK_RUPTURE' | 'RECEIVED';

const History: React.FC<HistoryProps> = ({ transactions = [], orders = [], items = [], storages = [], unfulfilledOrders = [], onUpdateOrderQuantity, formats = [], losses = [], dailyStockAlerts = [] }) => {
  const [activeTab, setActiveTab] = useState<Tab>('MOVEMENTS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('MONTH');
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); 
  const [selectedWeek, setSelectedWeek] = useState<string>(''); 
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); 

  // Set default filters based on active tab
  useEffect(() => {
      if (activeTab === 'LOSSES' || activeTab === 'CLIENT_RUPTURE') {
          setPeriodFilter('MONTH');
      } else if (activeTab === 'RECEIVED') {
          setPeriodFilter('WEEK');
      }
  }, [activeTab]);

  const availableWeeks = useMemo(() => {
      const weeks = [];
      const d = new Date(selectedYear, 0, 1);
      // Adjust to first Monday
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

  const checkDateInFilter = (dateStr: string) => {
      if (!dateStr) return false;
      const date = safeDate(dateStr);
      // Adjust for bar day (starts at 6AM)
      const barDate = new Date(date);
      if (barDate.getHours() < 6) {
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

  // --- DATA PREPARATION ---

  const filteredData = useMemo(() => {
      switch (activeTab) {
          case 'MOVEMENTS':
              return transactions.filter(t => checkDateInFilter(t.date)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          case 'LOSSES':
              return losses.filter(l => checkDateInFilter(l.discardedAt));
          case 'CLIENT_RUPTURE':
              return orders.filter(o => o.ruptureDate && checkDateInFilter(o.ruptureDate));
          case 'STOCK_TENSION':
              return dailyStockAlerts.filter(a => a.type === 'TENSION' && checkDateInFilter(a.date));
          case 'STOCK_RUPTURE':
              return dailyStockAlerts.filter(a => a.type === 'RUPTURE' && checkDateInFilter(a.date));
          case 'RECEIVED':
              return orders.filter(o => o.status === 'RECEIVED' && o.receivedAt && checkDateInFilter(o.receivedAt));
          default:
              return [];
      }
  }, [activeTab, transactions, losses, orders, dailyStockAlerts, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear]);

  const aggregatedData = useMemo(() => {
      if (activeTab === 'MOVEMENTS') return filteredData;

      const groups: Record<string, { item: StockItem, quantity: number, count: number, dates: string[] }> = {};

      filteredData.forEach((entry: any) => {
          const itemId = entry.itemId || entry.item_id; // Handle different shapes if needed
          const item = items.find(i => i.id === itemId);
          if (!item) return;

          if (!groups[itemId]) {
              groups[itemId] = { item, quantity: 0, count: 0, dates: [] };
          }

          let qty = 0;
          if (activeTab === 'LOSSES') qty = entry.quantity; 
          else if (activeTab === 'CLIENT_RUPTURE') qty = 1; 
          else if (activeTab === 'STOCK_TENSION' || activeTab === 'STOCK_RUPTURE') qty = 1; 
          else if (activeTab === 'RECEIVED') qty = entry.quantity;

          groups[itemId].quantity += qty;
          groups[itemId].count += 1;
          const date = entry.date || entry.discardedAt || entry.ruptureDate || entry.receivedAt;
          if (date) groups[itemId].dates.push(date);
      });

      return Object.values(groups).sort((a, b) => b.quantity - a.quantity);
  }, [filteredData, activeTab, items]);

  const handleExport = () => {
      let csvContent = "data:text/csv;charset=utf-8,";
      let filename = `export_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;

      if (activeTab === 'MOVEMENTS') {
          csvContent += "Date;Heure;Utilisateur;Produit;Type;Quantité;Note\n";
          (filteredData as Transaction[]).forEach(t => {
              const item = items.find(i => i.id === t.itemId);
              const d = safeDate(t.date);
              csvContent += `${d.toLocaleDateString()};${d.toLocaleTimeString()};${t.userName || ''};${item?.name || 'Inconnu'};${t.type};${t.quantity};${t.note || ''}\n`;
          });
      } else {
          csvContent += "Produit;Quantité Totale;Occurrences;Dates\n";
          (aggregatedData as any[]).forEach(g => {
              const datesStr = g.dates.map((d: string) => safeDate(d).toLocaleDateString()).join(', ');
              csvContent += `${g.item.name};${g.quantity.toFixed(2)};${g.count};"${datesStr}"\n`;
          });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
                      {activeTab === 'MOVEMENTS' && <option value="DAY">Par Jour</option>}
                      <option value="WEEK">Par Semaine</option>
                      <option value="MONTH">Par Mois</option>
                      <option value="YEAR">Par Année</option>
                  </select>

                  {periodFilter === 'DAY' && (
                      <input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none" />
                  )}
                  {periodFilter === 'WEEK' && (
                      <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none">
                          {availableWeeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                      </select>
                  )}
                  {periodFilter === 'MONTH' && (
                      <div className="flex gap-2">
                          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none">
                              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={i} value={i}>{m}</option>)}
                          </select>
                          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none">
                              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                      </div>
                  )}
                  {periodFilter === 'YEAR' && (
                      <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none">
                          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  )}
              </div>
              <button onClick={handleExport} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 shadow-lg flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export CSV
              </button>
          </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'MOVEMENTS' ? (
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
                        {(filteredData as Transaction[]).map((t, idx) => {
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
                        {filteredData.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic text-sm">Aucun mouvement pour cette période.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          ) : (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b">
                          <tr>
                              <th className="p-4">Produit</th>
                              <th className="p-4 text-right">
                                  {activeTab === 'LOSSES' ? 'Quantité Perdue (Btl)' : 
                                   activeTab === 'RECEIVED' ? 'Quantité Reçue' : 
                                   'Occurrences / Jours'}
                              </th>
                              <th className="p-4 text-right">Tags (Dates)</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {(aggregatedData as any[]).map((g, idx) => (
                              <tr key={`${g.item.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 font-black text-slate-900">
                                      {g.item.name}
                                      <span className="block text-[9px] text-slate-400 font-normal uppercase tracking-wider mt-0.5">{g.item.category}</span>
                                  </td>
                                  <td className="p-4 text-right font-black text-slate-800">
                                      {activeTab === 'LOSSES' ? g.quantity.toFixed(2) : g.quantity}
                                      {activeTab === 'LOSSES' && <span className="text-[9px] text-slate-400 font-normal ml-1">btl</span>}
                                  </td>
                                  <td className="p-4 text-right">
                                      <div className="flex flex-wrap justify-end gap-1">
                                          {g.dates.map((d: string, i: number) => (
                                              <span key={i} className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                  {safeDate(d).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'})}
                                              </span>
                                          ))}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {aggregatedData.length === 0 && (
                              <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic text-sm">Aucune donnée pour cette période.</td></tr>
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
