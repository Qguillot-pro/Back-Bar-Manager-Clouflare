
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StockItem, Category, StorageSpace, Format, Transaction, StockLevel, StockConsigne, StockPriority, PendingOrder, DLCHistory, User, DLCProfile, UnfulfilledOrder, AppConfig, Message, Glassware, Recipe, Technique, Loss, UserLog, Task, Event, EventComment, DailyCocktail, CocktailCategory, DailyCocktailType, EmailTemplate, AdminNote, ProductSheet, ProductType } from './types';
import Dashboard from './components/Dashboard';
import StockTable from './components/StockTable';
import Movements from './components/Movements';
import ArticlesList from './components/ArticlesList';
import CaveRestock from './components/CaveRestock';
import BarPrep from './components/BarPrep';
import Configuration from './components/Configuration';
import Consignes from './components/Consignes';
import DLCView from './components/DLCView';
import History from './components/History';
import MessagesView from './components/MessagesView';
import Order from './components/Order';
import RecipesView from './components/RecipesView';
import DailyLife from './components/DailyLife';
import ConnectionLogs from './components/ConnectionLogs';
import GlobalInventory from './components/GlobalInventory';
import ProductKnowledge from './components/ProductKnowledge';
import AdminLogbook from './components/AdminLogbook';

const NavItem = ({ collapsed, active, onClick, label, icon, badge }: { collapsed: boolean, active: boolean, onClick: () => void, label: string, icon: string, badge?: number }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-1 group relative ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
    <div className="relative shrink-0">
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
        {badge !== undefined && badge > 0 && <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-slate-900">{badge}</span>}
    </div>
    {!collapsed && <span className="font-bold text-xs uppercase tracking-wider truncate">{label}</span>}
  </button>
);

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('');
  const [dataSyncing, setDataSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [isTestMode, setIsTestMode] = useState(false); // Mode Test State
  const [view, setView] = useState<string>('dashboard');
  const [showAdminLogbook, setShowAdminLogbook] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [storages, setStorages] = useState<StorageSpace[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [consignes, setConsignes] = useState<StockConsigne[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [dlcHistory, setDlcHistory] = useState<DLCHistory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [dlcProfiles, setDlcProfiles] = useState<DLCProfile[]>([]);
  const [priorities, setPriorities] = useState<StockPriority[]>([]);
  const [unfulfilledOrders, setUnfulfilledOrders] = useState<UnfulfilledOrder[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({ tempItemDuration: '14_DAYS', defaultMargin: 82 });
  const [glassware, setGlassware] = useState<Glassware[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [cocktailCategories, setCocktailCategories] = useState<CocktailCategory[]>([]);
  const [losses, setLosses] = useState<Loss[]>([]);
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventComments, setEventComments] = useState<EventComment[]>([]);
  const [dailyCocktails, setDailyCocktails] = useState<DailyCocktail[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [productSheets, setProductSheets] = useState<ProductSheet[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);

  const syncData = async (action: string, payload: any) => {
    // BLOCK SYNC IN TEST MODE
    if (isTestMode) { 
        console.log("[MODE TEST] Action simulée (Non enregistrée en DB):", action, payload); 
        return; 
    }
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
    } catch (e) { console.error("Sync Error:", e); }
  };

  const fetchAuthData = async () => {
    setLoading(true);
    try {
        const response = await fetch('/api/init');
        const data = await response.json();
        setUsers(data.users || []);
        if (data.appConfig) setAppConfig(prev => ({...prev, ...data.appConfig}));
        fetchFullData();
    } catch (error) { setLoading(false); }
  };

  const fetchFullData = async () => {
      setDataSyncing(true);
      try {
          const [resS, resSt, resH] = await Promise.all([
              fetch('/api/data_sync?scope=static'),
              fetch('/api/data_sync?scope=stock'),
              fetch('/api/data_sync?scope=history')
          ]);
          const dataS = await resS.json();
          const dataSt = await resSt.json();
          const dataH = await resH.json();

          if (dataS.items) setItems(dataS.items);
          if (dataS.storages) setStorages(dataS.storages);
          if (dataS.formats) setFormats(dataS.formats);
          if (dataS.categories) setCategories(dataS.categories);
          if (dataS.dlcProfiles) setDlcProfiles(dataS.dlcProfiles);
          if (dataS.priorities) setPriorities(dataS.priorities);
          if (dataS.techniques) setTechniques(dataS.techniques);
          if (dataS.cocktailCategories) setCocktailCategories(dataS.cocktailCategories);
          if (dataS.glassware) setGlassware(dataS.glassware);
          if (dataS.recipes) setRecipes(dataS.recipes);
          if (dataS.productSheets) setProductSheets(dataS.productSheets);
          if (dataS.productTypes) setProductTypes(dataS.productTypes);
          if (dataS.emailTemplates) setEmailTemplates(dataS.emailTemplates);

          if (dataSt.stockLevels) setStockLevels(dataSt.stockLevels);
          if (dataSt.consignes) setConsignes(dataSt.consignes);
          if (dataSt.dailyCocktails) setDailyCocktails(dataSt.dailyCocktails);
          if (dataSt.events) setEvents(dataSt.events);
          if (dataSt.tasks) setTasks(dataSt.tasks);
          if (dataSt.unfulfilledOrders) setUnfulfilledOrders(dataSt.unfulfilledOrders);
          if (dataSt.orders) setOrders(dataSt.orders);

          if (dataH.transactions) setTransactions(dataH.transactions);
          if (dataH.dlcHistory) setDlcHistory(dataH.dlcHistory);
          if (dataH.messages) setMessages(dataH.messages);
          if (dataH.losses) setLosses(dataH.losses);
          if (dataH.userLogs) setUserLogs(dataH.userLogs);
      } catch (e) {} finally {
          setDataSyncing(false);
          setLoading(false);
      }
  };

  useEffect(() => { fetchAuthData(); }, []);

  const handleUndoLastTransaction = () => {
    if (transactions.length === 0) return;
    const last = transactions[0];
    if (window.confirm(`Annuler le dernier mouvement : ${last.type} ${last.quantity} de l'article ID ${last.itemId} ?`)) {
        setTransactions(prev => prev.filter(t => t.id !== last.id));
        setStockLevels(prev => {
            return prev.map(l => {
                if (l.itemId === last.itemId && l.storageId === last.storageId) {
                    const adj = last.type === 'IN' ? -last.quantity : last.quantity;
                    const newQty = Math.max(0, l.currentQuantity + adj);
                    syncData('SAVE_STOCK', { itemId: last.itemId, storageId: last.storageId, currentQuantity: newQty });
                    return { ...l, currentQuantity: newQty };
                }
                return l;
            });
        });
        syncData('DELETE_TRANSACTION', { id: last.id });
    }
  };

  // LOGIQUE DE MOUVEMENT INTELLIGENT (Priorités + Règles Spécifiques)
  const handleSmartTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer: boolean = false) => {
      const itemLevels = stockLevels.filter(l => l.itemId === itemId);
      const itemPriorities = priorities.filter(p => p.itemId === itemId);
      
      const getPrio = (sid: string) => {
          if (sid === 's0') return -1;
          return itemPriorities.find(p => p.storageId === sid)?.priority || 0;
      };

      const commitTrans = (sid: string, amount: number, tType: 'IN' | 'OUT', newQ: number) => {
          const trans: Transaction = { id: 't_' + Date.now() + Math.random(), itemId, storageId: sid, type: tType, quantity: amount, date: new Date().toISOString(), userName: currentUser?.name, isServiceTransfer };
          setTransactions(p => [trans, ...p]);
          syncData('SAVE_TRANSACTION', trans);
          
          setStockLevels(prev => {
              const exists = prev.find(l => l.itemId === itemId && l.storageId === sid);
              if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === sid) ? { ...l, currentQuantity: newQ } : l);
              return [...prev, { itemId, storageId: sid, currentQuantity: newQ }];
          });
          syncData('SAVE_STOCK', { itemId, storageId: sid, currentQuantity: newQ });
      };

      if (type === 'IN') {
          const targets = storages
              .filter(s => s.id !== 's_global')
              .map(s => {
                  const level = itemLevels.find(l => l.storageId === s.id)?.currentQuantity || 0;
                  const consigne = consignes.find(c => c.itemId === itemId && c.storageId === s.id);
                  const max = consigne?.maxCapacity || 9999;
                  const prio = getPrio(s.id);
                  return { ...s, current: level, max, prio, availableSpace: Math.max(0, Math.floor(max - level)) };
              })
              .sort((a, b) => {
                  if (a.id === 's0') return 1;
                  if (b.id === 's0') return -1;
                  return a.prio - b.prio; // Priorité croissante
              });

          let remainingQty = qty;

          for (const target of targets) {
              if (remainingQty <= 0) break;
              if (target.id === 's0') {
                  commitTrans(target.id, remainingQty, 'IN', target.current + remainingQty);
                  remainingQty = 0;
              } else {
                  const toAdd = Math.min(remainingQty, target.availableSpace);
                  if (toAdd > 0) {
                      commitTrans(target.id, toAdd, 'IN', target.current + toAdd);
                      remainingQty -= toAdd;
                  }
              }
          }
          if (remainingQty > 0) {
              const fallback = targets.find(t => t.id === 's0') || targets[targets.length - 1];
              if (fallback) commitTrans(fallback.id, remainingQty, 'IN', fallback.current + remainingQty);
          }

      } else {
          const decimalStorage = itemLevels.find(l => l.currentQuantity % 1 !== 0);
          
          if (decimalStorage) {
              const integerStocks = itemLevels
                  .filter(l => l.storageId !== decimalStorage.storageId && l.currentQuantity >= 1)
                  .map(l => ({ ...l, prio: getPrio(l.storageId) }))
                  .sort((a, b) => b.prio - a.prio); 

              if (integerStocks.length > 0) {
                  const gapToFull = Math.ceil(decimalStorage.currentQuantity) - decimalStorage.currentQuantity;
                  commitTrans(decimalStorage.storageId, gapToFull, 'IN', Math.ceil(decimalStorage.currentQuantity)); 
                  const source = integerStocks[0];
                  commitTrans(source.storageId, 1, 'OUT', source.currentQuantity - 1);
              } else {
                  const qtyToTake = Math.min(decimalStorage.currentQuantity, qty);
                  commitTrans(decimalStorage.storageId, qtyToTake, 'OUT', decimalStorage.currentQuantity - qtyToTake);
              }

          } else {
              let remainingQty = qty;
              const s0Level = itemLevels.find(l => l.storageId === 's0');
              if (s0Level && s0Level.currentQuantity > 0) {
                  const take = Math.min(remainingQty, s0Level.currentQuantity);
                  commitTrans('s0', take, 'OUT', s0Level.currentQuantity - take);
                  remainingQty -= take;
              }

              if (remainingQty > 0) {
                  const targets = itemLevels
                      .filter(l => l.storageId !== 's0' && l.currentQuantity > 0)
                      .map(l => ({ ...l, prio: getPrio(l.storageId) }))
                      .sort((a, b) => b.prio - a.prio);

                  for (const target of targets) {
                      if (remainingQty <= 0) break;
                      const take = Math.min(remainingQty, target.currentQuantity);
                      commitTrans(target.storageId, take, 'OUT', target.currentQuantity - take);
                      remainingQty -= take;
                  }
              }
          }
      }
  };

  const handleTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer: boolean = false) => {
    handleSmartTransaction(itemId, type, qty, isServiceTransfer);
  };

  const handleUpdateStock = (itemId: string, storageId: string, newQuantity: number, note?: string) => {
      syncData('SAVE_STOCK', {itemId, storageId, currentQuantity: newQuantity});
      
      const previousLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId);
      const previousQty = previousLevel?.currentQuantity || 0;
      
      setStockLevels(prev => {
          const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
          if (exists) return prev.map(l => l.itemId === itemId && l.storageId === storageId ? { ...l, currentQuantity: newQuantity } : l);
          return [...prev, { itemId, storageId, currentQuantity: newQuantity }];
      });

      if (note && newQuantity !== previousQty) {
          const diff = newQuantity - previousQty;
          const type = diff > 0 ? 'IN' : 'OUT';
          const qty = Math.abs(diff);
          
          const trans: Transaction = { 
              id: 'reg_' + Date.now(), 
              itemId, 
              storageId, 
              type, 
              quantity: parseFloat(qty.toFixed(3)), 
              date: new Date().toISOString(), 
              userName: currentUser?.name, 
              note: note 
          };
          
          setTransactions(p => [trans, ...p]);
          syncData('SAVE_TRANSACTION', trans);
      }
  };

  // Nouvelle fonction pour le StockTable : Gestion +/- avec annulation intelligente
  const handleQuickAdjust = (itemId: string, storageId: string, delta: number) => {
      const level = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId);
      const currentQty = level?.currentQuantity || 0;
      const newQty = Math.max(0, parseFloat((currentQty + delta).toFixed(3)));

      // LOGIQUE D'ANNULATION : Si on fait (+) et que la dernière transaction était une sortie (-) de même valeur
      // On supprime la transaction précédente au lieu d'en créer une nouvelle (Undo).
      if (delta > 0 && transactions.length > 0) {
          const lastTrans = transactions[0]; // La plus récente (triée dans fetchFullData)
          const txTime = new Date(lastTrans.date).getTime();
          const now = new Date().getTime();
          const isRecent = (now - txTime) < 5 * 60 * 1000; // Moins de 5 min

          if (isRecent && lastTrans.itemId === itemId && lastTrans.storageId === storageId && lastTrans.type === 'OUT' && lastTrans.quantity === delta) {
              // On supprime la transaction de sortie "erreur"
              setTransactions(prev => prev.filter(t => t.id !== lastTrans.id));
              syncData('DELETE_TRANSACTION', { id: lastTrans.id });
              
              // On met à jour le stock (le remet au niveau d'avant l'erreur)
              setStockLevels(prev => {
                  const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
                  if (exists) return prev.map(l => l.itemId === itemId && l.storageId === storageId ? { ...l, currentQuantity: newQty } : l);
                  return [...prev, { itemId, storageId, currentQuantity: newQty }];
              });
              syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
              return; // STOP ICI
          }
      }

      // Cas standard : Mise à jour avec note "Régulation"
      handleUpdateStock(itemId, storageId, newQty, "Régulation");
  };

  const handleRestockAction = (itemId: string, storageId: string, qtyNeeded: number, qtyToOrder?: number, isRupture?: boolean) => {
      if (qtyNeeded > 0) {
          const trans: Transaction = { id: 't_' + Date.now(), itemId, storageId, type: 'IN', quantity: qtyNeeded, date: new Date().toISOString(), userName: currentUser?.name, isCaveTransfer: true };
          setTransactions(p => [trans, ...p]);
          syncData('SAVE_TRANSACTION', trans);
          setStockLevels(prev => {
              const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
              const newQty = (exists?.currentQuantity || 0) + qtyNeeded;
              if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l);
              return [...prev, { itemId, storageId, currentQuantity: newQty }];
          });
          const currentQty = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId)?.currentQuantity || 0;
          syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: currentQty + qtyNeeded });
      }
      if ((qtyToOrder && qtyToOrder > 0) || isRupture) {
          const order: PendingOrder = { id: 'ord_' + Date.now(), itemId, quantity: qtyToOrder || 0, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name, ruptureDate: isRupture ? new Date().toISOString() : undefined };
          setOrders(prev => [...prev, order]);
          syncData('SAVE_ORDER', order);
      }
  };

  const handlePinInput = useCallback((num: string) => {
    if (loginStatus !== 'idle' || loginInput.length >= 4) return;
    const newPin = loginInput + num;
    setLoginInput(newPin);
    if (newPin.length === 4) {
      const found = users.find(u => u.pin === newPin);
      if (found) { setLoginStatus('success'); setTimeout(() => { setCurrentUser(found); setLoginStatus('idle'); setLoginInput(''); }, 600); }
      else { setLoginStatus('error'); setTimeout(() => { setLoginStatus('idle'); setLoginInput(''); }, 1000); }
    }
  }, [loginInput, loginStatus, users]);

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">CHARGEMENT...</div>;
  
  if (!currentUser) return (
    <div className="h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-w-sm w-full">
        <div className="bg-indigo-600 p-8 text-center text-white"><h1 className="font-black text-xl uppercase tracking-widest">BarStock Pro</h1></div>
        <div className="p-8">
            <div className="flex justify-center gap-4 mb-8">{[0,1,2,3].map(i=>(<div key={i} className={`w-4 h-4 rounded-full transition-all ${loginInput.length > i ? 'bg-indigo-600 scale-110' : 'bg-slate-200'}`}></div>))}</div>
            <div className="grid grid-cols-3 gap-4">{[1,2,3,4,5,6,7,8,9, 'C', 0, '←'].map(n=>(<button key={n.toString()} onClick={()=> n === '←' ? setLoginInput(p=>p.slice(0,-1)) : n==='C' ? setLoginInput('') : handlePinInput(n.toString())} className="aspect-square rounded-full bg-slate-50 text-slate-700 font-black text-2xl shadow-sm border">{n}</button>))}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`h-screen flex bg-slate-50 overflow-hidden ${isTestMode ? 'border-4 border-rose-600 box-border' : ''}`}>
      {/* TEST MODE INDICATOR */}
      {isTestMode && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-rose-600 z-[9999] pointer-events-none"></div>
      )}

      <aside className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} h-full flex-shrink-0 z-50`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
            {!isSidebarCollapsed && <h1 className="font-black text-sm uppercase tracking-widest text-indigo-400">BarStock</h1>}
            <button onClick={()=>setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-500 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
            <NavItem collapsed={isSidebarCollapsed} active={view === 'dashboard'} onClick={()=>setView('dashboard')} label="Tableau de Bord" icon="M4 6h16M4 12h16M4 18h16" />
            <NavItem collapsed={isSidebarCollapsed} active={view.startsWith('daily_life')} onClick={()=>setView('daily_life:TASKS')} label="Vie Quotidienne" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'bar_prep'} onClick={()=>setView('bar_prep')} label="Préparation Bar" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'restock'} onClick={()=>setView('restock')} label="Préparation Cave" icon="M19 14l-7 7m0 0l-7-7m7 7V3" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'movements'} onClick={()=>setView('movements')} label="Mouvements" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'stock_table'} onClick={()=>setView('stock_table')} label="Stock Bar" icon="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'inventory'} onClick={()=>setView('inventory')} label="Inventaire Général" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'consignes'} onClick={()=>setView('consignes')} label="Consignes Stock" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'orders'} onClick={()=>setView('orders')} label="À Commander" icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" badge={orders.filter(o=>o.status==='PENDING').length} />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'history'} onClick={()=>setView('history')} label="Historique" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'dlc_tracking'} onClick={()=>setView('dlc_tracking')} label="Suivi DLC" icon="M12 8v4l3 3" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'articles'} onClick={()=>setView('articles')} label="Base Articles" icon="M4 6h16M4 10h16M4 14h16M4 18h16" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'recipes'} onClick={()=>setView('recipes')} label="Recette cocktails" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'product_knowledge'} onClick={()=>setView('product_knowledge')} label="Fiches produits" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
            {currentUser.role === 'ADMIN' && <NavItem collapsed={isSidebarCollapsed} active={view === 'connection_logs'} onClick={()=>setView('connection_logs')} label="Logs" icon="M9 12l2 2 4-4" />}
        </nav>

        <div className="p-4 border-t border-white/5 bg-slate-900 space-y-3 shrink-0">
            {currentUser.role === 'ADMIN' && !isSidebarCollapsed && (
                <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg mb-2 border border-white/10">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isTestMode ? 'text-rose-400' : 'text-slate-400'}`}>Mode Test</span>
                    <button 
                        onClick={() => setIsTestMode(!isTestMode)} 
                        className={`w-8 h-4 rounded-full relative transition-colors ${isTestMode ? 'bg-rose-500' : 'bg-slate-600'}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isTestMode ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                </div>
            )}

            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm text-white shrink-0">{currentUser.name.charAt(0).toUpperCase()}</div>
                {!isSidebarCollapsed && <div className="overflow-hidden"><p className="text-sm font-bold text-white truncate">{currentUser.name}</p><p className="text-[10px] text-slate-400 truncate">{currentUser.role}</p></div>}
            </div>
            <div className="flex gap-2">
                <button onClick={() => fetchFullData()} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg flex items-center justify-center transition-all"><svg className={`w-4 h-4 ${dataSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                {currentUser.role === 'ADMIN' && <button onClick={() => setShowAdminLogbook(true)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg flex items-center justify-center transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" /></svg></button>}
                <button onClick={() => setView('configuration')} className={`flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'configuration' ? 'bg-indigo-600 text-white' : ''}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066" /></svg></button>
            </div>
            <button onClick={() => {setCurrentUser(null); setView('dashboard');}} className="w-full bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-rose-900/20">{!isSidebarCollapsed && "Déconnexion"}<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg></button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 relative">
          {isTestMode && <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black uppercase px-2 py-1 z-[100] rounded-bl-lg">Mode Test Actif - Aucune Sauvegarde</div>}
          {view === 'dashboard' && <Dashboard items={items} stockLevels={stockLevels} consignes={consignes} categories={categories} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} userRole={currentUser.role} transactions={transactions} messages={messages} events={events} currentUserName={currentUser.name} onNavigate={setView} onSendMessage={(text) => { const m: Message = { id: 'msg_'+Date.now(), content: text, userName: currentUser.name, date: new Date().toISOString(), isArchived: false, readBy: [] }; setMessages(p=>[m, ...p]); syncData('SAVE_MESSAGE', m); }} onArchiveMessage={(id) => { setMessages(p=>p.map(m=>m.id===id?{...m, isArchived:true}:m)); syncData('UPDATE_MESSAGE', {id, isArchived:true}); }} appConfig={appConfig} dailyCocktails={dailyCocktails} recipes={recipes} glassware={glassware} onUpdateDailyCocktail={(dc) => { setDailyCocktails(prev => { const idx = prev.findIndex(c => c.id === dc.id); if (idx >= 0) { const copy = [...prev]; copy[idx] = dc; return copy; } return [...prev, dc]; }); syncData('SAVE_DAILY_COCKTAIL', dc); }} />}
          {view.startsWith('daily_life') && <DailyLife tasks={tasks} events={events} eventComments={eventComments} currentUser={currentUser} items={items} onSync={syncData} setTasks={setTasks} setEvents={setEvents} setEventComments={setEventComments} dailyCocktails={dailyCocktails} setDailyCocktails={setDailyCocktails} recipes={recipes} onCreateTemporaryItem={(n,q)=> { const it: StockItem = {id:'t_'+Date.now(), name:n, category:'Autre', formatId:'f1', pricePerUnit:0, lastUpdated:new Date().toISOString(), isTemporary:true, order:items.length }; setItems(p=>[...p, it]); syncData('SAVE_ITEM', it); if(q>0){ const c={itemId:it.id, storageId:'s0', minQuantity:q}; setConsignes(p=>[...p, c]); syncData('SAVE_CONSIGNE', c); } }} stockLevels={stockLevels} orders={orders} glassware={glassware} appConfig={appConfig} saveConfig={(k, v) => { setAppConfig(p => ({...p, [k]: v})); syncData('SAVE_CONFIG', {key: k, value: JSON.stringify(v)}); }} initialTab={view.includes(':') ? view.split(':')[1] : 'TASKS'} cocktailCategories={cocktailCategories} />}
          {view === 'bar_prep' && <BarPrep items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory} />}
          {view === 'restock' && <CaveRestock items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} unfulfilledOrders={unfulfilledOrders} onCreateTemporaryItem={(n,q)=> { const it: StockItem = {id:'t_'+Date.now(), name:n, category:'Autre', formatId:'f1', pricePerUnit:0, lastUpdated:new Date().toISOString(), isTemporary:true, order:items.length }; setItems(p=>[...p, it]); syncData('SAVE_ITEM', it); if(q>0){ const c={itemId:it.id, storageId:'s0', minQuantity:q}; setConsignes(p=>[...p, c]); syncData('SAVE_CONSIGNE', c); } }} orders={orders} currentUser={currentUser} events={events} dlcProfiles={dlcProfiles} />}
          {view === 'movements' && <Movements items={items} transactions={transactions} storages={storages} onTransaction={handleTransaction} onOpenKeypad={()=>{}} unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={(id, q) => { const unf = { id: 'unf_'+Date.now(), itemId:id, date:new Date().toISOString(), userName:currentUser.name, quantity:q }; setUnfulfilledOrders(p=>[unf, ...p]); syncData('SAVE_UNFULFILLED_ORDER', unf); }} formats={formats} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory} onDlcEntry={(id, s, t) => { const d = { id:'dlc_'+Date.now(), itemId:id, storageId:s, openedAt:new Date().toISOString(), userName:currentUser.name }; setDlcHistory(p=>[d, ...p]); syncData('SAVE_DLC_HISTORY', d); }} onDlcConsumption={(id) => { const old = dlcHistory.filter(h=>h.itemId===id).sort((a,b)=>new Date(a.openedAt).getTime()-new Date(b.openedAt).getTime())[0]; if(old){ setDlcHistory(p=>p.filter(h=>h.id!==old.id)); syncData('DELETE_DLC_HISTORY', {id: old.id}); } }} onCreateTemporaryItem={(n,q)=> { const it: StockItem = {id:'t_'+Date.now(), name:n, category:'Autre', formatId:'f1', pricePerUnit:0, lastUpdated:new Date().toISOString(), isTemporary:true, order:items.length }; setItems(p=>[...p, it]); syncData('SAVE_ITEM', it); if(q>0){ const c={itemId:it.id, storageId:'s0', minQuantity:q}; setConsignes(p=>[...p, c]); syncData('SAVE_CONSIGNE', c); } }} onUndo={handleUndoLastTransaction} />}
          {view === 'stock_table' && <StockTable items={items} storages={storages} stockLevels={stockLevels} priorities={priorities} onUpdateStock={handleUpdateStock} consignes={consignes} onAdjustTransaction={handleQuickAdjust} />}
          {view === 'inventory' && <GlobalInventory items={items} storages={storages} stockLevels={stockLevels} categories={categories} consignes={consignes} onSync={syncData} onUpdateStock={handleUpdateStock} formats={formats} />}
          {view === 'consignes' && <Consignes items={items} storages={storages} consignes={consignes} priorities={priorities} setConsignes={setConsignes} onSync={syncData} />}
          {view === 'orders' && <Order orders={orders} items={items} storages={storages} onUpdateOrder={(id, q, s, r) => { setOrders(prev => prev.map(o => o.id === id ? { ...o, quantity: q, status: s || o.status, ruptureDate: r } : o)); syncData('SAVE_ORDER', { id, quantity: q, status: s, ruptureDate: r }); }} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); syncData('DELETE_ORDER', { id }); }} onAddManualOrder={(itemId, qty) => { const order: PendingOrder = { id: 'ord_' + Date.now(), itemId, quantity: qty, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name }; setOrders(prev => [...prev, order]); syncData('SAVE_ORDER', order); }} formats={formats} events={events} emailTemplates={emailTemplates} />}
          {view === 'history' && <History transactions={transactions} orders={orders} items={items} storages={storages} unfulfilledOrders={unfulfilledOrders} formats={formats} losses={losses} onUpdateOrderQuantity={(ids, q) => { ids.forEach(id => { const o = orders.find(ord => ord.id === id); if (o) { const updated = { ...o, status: 'RECEIVED' as const, receivedAt: new Date().toISOString(), quantity: q }; setOrders(p => p.map(x => x.id === id ? updated : x)); syncData('SAVE_ORDER', updated); } }); }} />}
          {view === 'dlc_tracking' && <DLCView items={items} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} storages={storages} onDelete={(id, qty) => { const target = dlcHistory.find(h => h.id === id); if(target) { const loss: Loss = { id: 'loss_'+Date.now(), itemId: target.itemId, openedAt: target.openedAt, discardedAt: new Date().toISOString(), quantity: qty || 0, userName: currentUser?.name }; setLosses(p=>[loss,...p]); syncData('SAVE_LOSS', loss); setDlcHistory(p => p.filter(h => h.id !== id)); syncData('DELETE_DLC_HISTORY', { id }); } }} />}
          {view === 'articles' && <ArticlesList items={items} setItems={setItems} formats={formats} categories={categories} onDelete={(id) => { setItems(p => p.filter(i => i.id !== id)); syncData('DELETE_ITEM', {id}); }} userRole={currentUser.role} dlcProfiles={dlcProfiles} onSync={syncData} events={events} recipes={recipes} />}
          {view === 'recipes' && <RecipesView recipes={recipes} items={items} glassware={glassware} currentUser={currentUser} appConfig={appConfig} onSync={syncData} setRecipes={setRecipes} techniques={techniques} cocktailCategories={cocktailCategories} />}
          {view === 'product_knowledge' && <ProductKnowledge sheets={productSheets} items={items} currentUserRole={currentUser.role} onSync={syncData} productTypes={productTypes} />}
          {view === 'configuration' && <Configuration setItems={setItems} setStorages={setStorages} setFormats={setFormats} storages={storages} formats={formats} priorities={priorities} setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} items={items} categories={categories} setCategories={setCategories} users={users} setUsers={setUsers} currentUser={currentUser} dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} appConfig={appConfig} setAppConfig={setAppConfig} glassware={glassware} setGlassware={setGlassware} techniques={techniques} setTechniques={setTechniques} cocktailCategories={cocktailCategories} setCocktailCategories={setCocktailCategories} productTypes={productTypes} setProductTypes={setProductTypes} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} fullData={{items, storages, stockLevels}} />}
          {view === 'connection_logs' && <ConnectionLogs logs={userLogs} />}
      </main>

      {showAdminLogbook && currentUser && <AdminLogbook currentUser={currentUser} onSync={syncData} onClose={() => setShowAdminLogbook(false)} />}
    </div>
  );
};
export default App;
