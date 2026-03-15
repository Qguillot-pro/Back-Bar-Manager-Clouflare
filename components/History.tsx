
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, PendingOrder, StockItem, StorageSpace, UnfulfilledOrder, Format, Loss, DailyAlert, AppConfig, UserRole } from '../types';

interface HistoryProps {
  transactions: Transaction[];
  orders: PendingOrder[];
  items: StockItem[];
  storages: StorageSpace[];
  unfulfilledOrders: UnfulfilledOrder[];
  onUpdateOrderQuantity?: (orderIds: string[], newQuantity: number) => void;
  onDeleteDailyAlert?: (id: string) => void;
  onUpdateLoss?: (updatedLoss: Loss) => void;
  formats: Format[];
  losses?: Loss[];
  dailyStockAlerts?: DailyAlert[];
  appConfig?: AppConfig;
  userRole?: UserRole;
}

type PeriodFilter = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
type Tab = 'MOVEMENTS' | 'LOSSES' | 'CLIENT_RUPTURE' | 'STOCK_TENSION' | 'STOCK_RUPTURE' | 'RECEIVED';

const History: React.FC<HistoryProps> = ({ transactions = [], orders = [], items = [], storages = [], unfulfilledOrders = [], onUpdateOrderQuantity, onDeleteDailyAlert, onUpdateLoss, formats = [], losses = [], dailyStockAlerts = [], appConfig, userRole }) => {
  const [activeTab, setActiveTab] = useState<Tab>('MOVEMENTS');
  const [validatedGroups, setValidatedGroups] = useState<Set<string>>(new Set());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('MONTH');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingLossId, setEditingLossId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('');
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); 
  const [selectedWeek, setSelectedWeek] = useState<string>(''); 
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); 

  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | 'IN' | 'OUT' | 'CAVE_IN'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Set default filters based on active tab
  useEffect(() => {
      if (activeTab === 'LOSSES' || activeTab === 'CLIENT_RUPTURE' || activeTab === 'RECEIVED') {
          setPeriodFilter('MONTH');
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

  const checkDateInFilter = (dateStr: string, isPreCalculatedBarDate = false) => {
      if (!dateStr) return false;
      const date = safeDate(dateStr);
      // Adjust for bar day
      const barDate = new Date(date);
      
      if (!isPreCalculatedBarDate) {
          const barDayStart = appConfig?.barDayStart || '04:00';
          const [startHour, startMin] = barDayStart.split(':').map(Number);
          
          if (barDate.getHours() < startHour || (barDate.getHours() === startHour && barDate.getMinutes() < startMin)) {
              barDate.setDate(barDate.getDate() - 1);
          }
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
              return transactions.filter(t => {
                  if (!checkDateInFilter(t.date)) return false;
                  if (movementTypeFilter === 'IN' && t.type !== 'IN') return false;
                  if (movementTypeFilter === 'OUT' && t.type !== 'OUT') return false;
                  if (movementTypeFilter === 'CAVE_IN' && (!t.isCaveTransfer || t.type !== 'IN')) return false;
                  if (categoryFilter !== 'ALL') {
                      const item = items.find(i => i.id === t.itemId);
                      if (item?.category !== categoryFilter) return false;
                  }
                  return true;
              }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          case 'LOSSES':
              return losses.filter(l => l.quantity > 0 && checkDateInFilter(l.discardedAt));
          case 'CLIENT_RUPTURE':
              return unfulfilledOrders.filter(u => checkDateInFilter(u.date));
          case 'STOCK_TENSION':
              return dailyStockAlerts.filter(a => a.type === 'TENSION' && checkDateInFilter(a.date, true));
          case 'STOCK_RUPTURE':
              return dailyStockAlerts.filter(a => a.type === 'RUPTURE' && checkDateInFilter(a.date, true));
          case 'RECEIVED':
              return orders.filter(o => o.status === 'RECEIVED' && o.receivedAt && checkDateInFilter(o.receivedAt));
          default:
              return [];
      }
  }, [activeTab, transactions, losses, orders, dailyStockAlerts, periodFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, movementTypeFilter, categoryFilter, items]);

  const aggregatedData = useMemo(() => {
      if (activeTab === 'MOVEMENTS' && periodFilter === 'DAY') return filteredData;

      const groups: Record<string, { item: StockItem, quantity: number, count: number, dates: string[], type?: string }> = {};

      filteredData.forEach((entry: any) => {
          const itemId = entry.itemId || entry.item_id; // Handle different shapes if needed
          const item = items.find(i => i.id === itemId);
          if (!item) return;

          const groupKey = activeTab === 'MOVEMENTS' ? `${itemId}_${entry.type}_${entry.isCaveTransfer ? 'cave' : ''}` : itemId;

          if (!groups[groupKey]) {
              groups[groupKey] = { item, quantity: 0, count: 0, dates: [], type: entry.type };
          }

          let qty = 0;
          if (activeTab === 'LOSSES') qty = entry.quantity; 
          else if (activeTab === 'CLIENT_RUPTURE') qty = entry.quantity || 1; 
          else if (activeTab === 'STOCK_TENSION' || activeTab === 'STOCK_RUPTURE') qty = 1; 
          else if (activeTab === 'RECEIVED') qty = entry.quantity;
          else if (activeTab === 'MOVEMENTS') qty = entry.quantity;

          groups[groupKey].quantity += qty;
          groups[groupKey].count += 1;
          const date = entry.date || entry.discardedAt || entry.ruptureDate || entry.receivedAt;
          if (date) groups[groupKey].dates.push(date);
      });

      return Object.values(groups).sort((a, b) => b.quantity - a.quantity);
  }, [filteredData, activeTab, items, periodFilter]);

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
              const qtyDisplay = g.quantity.toFixed(2);
              csvContent += `${g.item.name};${qtyDisplay};${g.count};"${datesStr}"\n`;
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

  const handleSaveLossEdit = (loss: Loss) => {
      if (onUpdateLoss && editQty !== '') {
          const newQty = parseFloat(editQty);
          if (!isNaN(newQty)) {
              onUpdateLoss({ ...loss, quantity: newQty });
          }
      }
      setEditingLossId(null);
      setEditQty('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-100">
              <div className="flex flex-wrap gap-2">
                  <button onClick={() => setActiveTab('MOVEMENTS')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'MOVEMENTS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Mouvements</button>
                  <button onClick={() => setActiveTab('LOSSES')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'LOSSES' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Pertes & Gaspillage</button>
                  <button onClick={() => setActiveTab('CLIENT_RUPTURE')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'CLIENT_RUPTURE' ? 'bg-rose-400 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Ruptures Clients</button>
                  <button onClick={() => setActiveTab('STOCK_TENSION')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'STOCK_TENSION' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Art. Sous Tension</button>
                  <button onClick={() => setActiveTab('STOCK_RUPTURE')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'STOCK_RUPTURE' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Rupture Produit</button>
                  <button onClick={() => setActiveTab('RECEIVED')} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'RECEIVED' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Art. Reçus</button>
              </div>

              {activeTab === 'LOSSES' && userRole === 'ADMIN' && (
                  <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isEditMode ? 'text-rose-600' : 'text-slate-400'}`}>Mode Édition</span>
                      <button 
                          onClick={() => {
                              setIsEditMode(!isEditMode);
                              setEditingLossId(null);
                          }} 
                          className={`w-8 h-4 rounded-full relative transition-colors ${isEditMode ? 'bg-rose-500' : 'bg-slate-300'}`}
                      >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isEditMode ? 'left-4.5' : 'left-0.5'}`}></div>
                      </button>
                  </div>
              )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                  {activeTab === 'MOVEMENTS' && (
                      <>
                          <select 
                              value={movementTypeFilter} 
                              onChange={(e) => setMovementTypeFilter(e.target.value as 'ALL' | 'IN' | 'OUT' | 'CAVE_IN')}
                              className="bg-slate-100 border-none rounded-lg px-3 py-2 text-xs font-black uppercase text-slate-700 outline-none cursor-pointer"
                          >
                              <option value="ALL">Tous les types</option>
                              <option value="IN">Entrées</option>
                              <option value="OUT">Sorties</option>
                              <option value="CAVE_IN">Entrées Cave</option>
                          </select>
                          <select 
                              value={categoryFilter} 
                              onChange={(e) => setCategoryFilter(e.target.value)}
                              className="bg-slate-100 border-none rounded-lg px-3 py-2 text-xs font-black uppercase text-slate-700 outline-none cursor-pointer"
                          >
                              <option value="ALL">Toutes les catégories</option>
                              {Array.from(new Set(items.map(i => i.category))).map(c => (
                                  <option key={c} value={c}>{c}</option>
                              ))}
                          </select>
                      </>
                  )}
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
          {activeTab === 'MOVEMENTS' && periodFilter === 'DAY' ? (
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
          ) : activeTab === 'LOSSES' && isEditMode ? (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b">
                        <tr>
                            <th className="p-4">Date/Heure</th>
                            <th className="p-4">Utilisateur</th>
                            <th className="p-4">Produit</th>
                            <th className="p-4 text-right">Quantité</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(filteredData as Loss[]).map((l, idx) => {
                            const item = items.find(i => i.id === l.itemId);
                            const d = safeDate(l.discardedAt);
                            const isEditing = editingLossId === l.id;
                            return (
                                <tr key={`${l.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-xs font-bold text-slate-600">
                                        {d.toLocaleDateString('fr-FR')} <span className="text-slate-400 text-[10px]">{d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-slate-800">{l.userName || '-'}</td>
                                    <td className="p-4 font-black text-slate-900">{item?.name || 'Inconnu'}</td>
                                    <td className="p-4 text-right">
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                className="w-24 bg-white border border-rose-200 rounded px-2 py-1 text-right font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-100"
                                                value={editQty}
                                                onChange={e => setEditQty(e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="font-black text-rose-600">{l.quantity.toFixed(2)}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setEditingLossId(null); setEditQty(''); }} className="text-slate-400 hover:text-slate-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                                <button onClick={() => handleSaveLossEdit(l)} className="text-emerald-500 hover:text-emerald-700"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => { setEditingLossId(l.id); setEditQty(l.quantity.toString()); }} 
                                                className="text-slate-300 hover:text-indigo-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredData.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic text-sm">Aucune perte pour cette période.</td></tr>
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
                              {activeTab === 'MOVEMENTS' && <th className="p-4">Type</th>}
                              <th className="p-4 text-right">
                                  {activeTab === 'LOSSES' ? 'Quantité Perdue (Unit)' : 
                                   activeTab === 'RECEIVED' ? 'Quantité Reçue' : 
                                   activeTab === 'MOVEMENTS' ? 'Quantité Totale' :
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
                                  {activeTab === 'MOVEMENTS' && (
                                      <td className="p-4">
                                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${g.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                              {g.type === 'IN' ? 'Entrée' : 'Sortie'}
                                          </span>
                                      </td>
                                  )}
                                  <td className="p-4 text-right font-black text-slate-800">
                                      {(activeTab === 'STOCK_TENSION' || activeTab === 'STOCK_RUPTURE' || activeTab === 'CLIENT_RUPTURE') ? g.quantity.toFixed(0) : g.quantity.toFixed(2)}
                                      {activeTab === 'LOSSES' && <span className="text-[9px] text-slate-400 font-normal ml-1">Unit</span>}
                                  </td>
                                  <td className="p-4 text-right">
                                      <div className="flex flex-wrap justify-end items-center gap-1">
                                          {g.dates.map((d: string, i: number) => (
                                              <span key={i} className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                  {safeDate(d).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'})}
                                              </span>
                                          ))}
                                          {(activeTab === 'STOCK_TENSION' || activeTab === 'STOCK_RUPTURE') && onDeleteDailyAlert && (
                                              <button 
                                                  onClick={() => {
                                                      if (window.confirm("Supprimer cet historique d'alerte ?")) {
                                                          const itemAlerts = dailyStockAlerts.filter(a => a.itemId === g.item.id && a.type === (activeTab === 'STOCK_TENSION' ? 'TENSION' : 'RUPTURE') && checkDateInFilter(a.date, true));
                                                          itemAlerts.forEach(a => onDeleteDailyAlert(a.id));
                                                      }
                                                  }}
                                                  className="ml-2 p-1 text-rose-400 hover:text-rose-600 transition-colors"
                                                  title="Supprimer l'historique de cet article"
                                              >
                                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                              </button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {aggregatedData.length === 0 && (
                              <tr><td colSpan={activeTab === 'MOVEMENTS' ? 4 : 3} className="p-8 text-center text-slate-400 italic text-sm">Aucune donnée pour cette période.</td></tr>
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
