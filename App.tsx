
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

const NavItem = ({ collapsed, active, onClick, label, icon, badge }: { collapsed: boolean, active: boolean, onClick: () => void, label: string, icon: string, badge?: number }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-1 group relative ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
    <div className="relative">
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
        {badge !== undefined && badge > 0 && <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-slate-900">{badge}</span>}
    </div>
    {!collapsed && <span className="font-bold text-xs uppercase tracking-wider">{label}</span>}
    {collapsed && active && <div className="absolute left-full ml-4 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">{label}</div>}
  </button>
);

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('');
  const [dataSyncing, setDataSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // UI States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [isTestMode, setIsTestMode] = useState(false);
  const [view, setView] = useState<string>('dashboard');

  // Data States
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
    if (isTestMode) { console.log("[TEST MODE] Action simulated:", action, payload); return; }
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
    setLoadingStep('Chargement...');
    try {
        const response = await fetch('/api/init');
        const data = await response.json();
        setUsers(data.users || []);
        if (data.appConfig) setAppConfig(prev => ({...prev, ...data.appConfig}));
        fetchFullData();
    } catch (error) {
        setLoading(false);
    }
  };

  const fetchFullData = async () => {
      setDataSyncing(true);
      try {
          const resStatic = await fetch('/api/data_sync?scope=static');
          const dataS = await resStatic.json();
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

          const resStock = await fetch('/api/data_sync?scope=stock');
          const dataSt = await resStock.json();
          if (dataSt.stockLevels) setStockLevels(dataSt.stockLevels);
          if (dataSt.consignes) setConsignes(dataSt.consignes);
          if (dataSt.dailyCocktails) setDailyCocktails(dataSt.dailyCocktails);
          if (dataSt.events) setEvents(dataSt.events);
          if (dataSt.tasks) setTasks(dataSt.tasks);
          if (dataSt.unfulfilledOrders) setUnfulfilledOrders(dataSt.unfulfilledOrders);
          if (dataSt.orders) setOrders(dataSt.orders);

          const resHistory = await fetch('/api/data_sync?scope=history');
          const dataH = await resHistory.json();
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

  // --- HANDLERS ---

  const handleLogout = () => {
      setCurrentUser(null);
      setLoginInput('');
      setLoginStatus('idle');
      setView('dashboard');
  };

  const handleAdjustTransaction = (itemId: string, storageId: string, delta: number) => {
      const currentLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId);
      const currentQty = currentLevel?.currentQuantity || 0;

      if (delta < 0) {
          const qty = Math.abs(delta);
          const trans: Transaction = { id: 't_' + Date.now(), itemId, storageId, type: 'OUT', quantity: qty, date: new Date().toISOString(), userName: currentUser?.name, note: 'Régulation Inventaire' };
          setTransactions(p => [trans, ...p]);
          const newQty = Math.max(0, currentQty - qty);
          setStockLevels(prev => {
              const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
              if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l);
              return [...prev, { itemId, storageId, currentQuantity: newQty }];
          });
          syncData('SAVE_TRANSACTION', trans);
          syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
      } else {
          const lastOut = transactions.find(t => t.itemId === itemId && t.storageId === storageId && t.type === 'OUT');
          if (lastOut) {
              setTransactions(p => p.filter(t => t.id !== lastOut.id));
              const newQty = currentQty + lastOut.quantity;
              setStockLevels(prev => prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l));
              syncData('DELETE_TRANSACTION', { id: lastOut.id });
              syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
          } else {
              const trans: Transaction = { id: 't_' + Date.now(), itemId, storageId, type: 'IN', quantity: 1, date: new Date().toISOString(), userName: currentUser?.name };
              setTransactions(p => [trans, ...p]);
              const newQty = currentQty + 1;
              setStockLevels(prev => {
                  const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
                  if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l);
                  return [...prev, { itemId, storageId, currentQuantity: newQty }];
              });
              syncData('SAVE_TRANSACTION', trans);
              syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
          }
      }
  };

  const handleTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer: boolean = false) => {
    const storageId = 's_global';
    const trans: Transaction = { id: 't_' + Date.now(), itemId, storageId, type, quantity: qty, date: new Date().toISOString(), userName: currentUser?.name, isServiceTransfer };
    setTransactions(p => [trans, ...p]);
    const currentQty = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId)?.currentQuantity || 0;
    const newQty = type === 'IN' ? currentQty + qty : Math.max(0, currentQty - qty);
    setStockLevels(prev => {
      const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
      if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l);
      return [...prev, { itemId, storageId, currentQuantity: newQty }];
    });
    syncData('SAVE_TRANSACTION', trans);
    syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
  };

  const handleDlcEntry = (itemId: string, storageId: string, type: 'OPENING' | 'PRODUCTION') => {
    const dlc: DLCHistory = { id: 'dlc_' + Date.now(), itemId, storageId, openedAt: new Date().toISOString(), userName: currentUser?.name };
    setDlcHistory(p => [dlc, ...p]);
    syncData('SAVE_DLC_HISTORY', dlc);
  };

  const handleDlcConsumption = (itemId: string) => {
    const entries = dlcHistory.filter(h => h.itemId === itemId).sort((a,b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
    if (entries.length > 0) {
      const oldest = entries[0];
      setDlcHistory(p => p.filter(h => h.id !== oldest.id));
      syncData('DELETE_DLC_HISTORY', { id: oldest.id });
    }
  };

  const handleReportUnfulfilled = (itemId: string, quantity: number) => {
      const unf: UnfulfilledOrder = {
          id: 'unf_' + Date.now(),
          itemId,
          date: new Date().toISOString(),
          userName: currentUser?.name,
          quantity
      };
      setUnfulfilledOrders(prev => [unf, ...prev]);
      syncData('SAVE_UNFULFILLED_ORDER', unf);
  };

  const handleCreateTemporaryItem = (name: string, quantity: number) => {
      const newItem: StockItem = {
          id: 'temp_' + Date.now(),
          name,
          category: 'Autre',
          formatId: formats[0]?.id || 'f1',
          pricePerUnit: 0,
          lastUpdated: new Date().toISOString(),
          isTemporary: true,
          order: items.length,
          isDraft: true
      };
      setItems(prev => [...prev, newItem]);
      syncData('SAVE_ITEM', newItem);
      
      if (quantity > 0) {
          const consigne: StockConsigne = { itemId: newItem.id, storageId: 's_global', minQuantity: quantity };
          setConsignes(prev => [...prev, consigne]);
          syncData('SAVE_CONSIGNE', consigne);
      }
  };

  // Restock Action Handler
  const handleRestockAction = (itemId: string, storageId: string, qtyNeeded: number, qtyToOrder?: number, isRupture?: boolean) => {
      if (qtyNeeded > 0) {
          const trans: Transaction = {
              id: 't_' + Date.now(),
              itemId,
              storageId,
              type: 'IN',
              quantity: qtyNeeded,
              date: new Date().toISOString(),
              userName: currentUser?.name,
              isCaveTransfer: true
          };
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
          const order: PendingOrder = {
              id: 'ord_' + Date.now(),
              itemId,
              quantity: qtyToOrder || 0,
              date: new Date().toISOString(),
              status: 'PENDING',
              userName: currentUser?.name,
              ruptureDate: isRupture ? new Date().toISOString() : undefined
          };
          setOrders(prev => [...prev, order]);
          syncData('SAVE_ORDER', order);
      }
  };

  const handleUpdateOrder = (orderId: string, quantity: number, status?: 'PENDING' | 'ORDERED' | 'RECEIVED', ruptureDate?: string) => {
      setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
              const updated = { ...o, quantity, status: status || o.status, ruptureDate: ruptureDate || o.ruptureDate };
              if (status === 'ORDERED' && !o.orderedAt) updated.orderedAt = new Date().toISOString();
              if (status === 'RECEIVED' && !o.receivedAt) updated.receivedAt = new Date().toISOString();
              syncData('SAVE_ORDER', updated);
              return updated;
          }
          return o;
      }));
  };

  const handleDeleteOrder = (orderId: string) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      const o = orders.find(x => x.id === orderId);
      if (o) {
          const updated = { ...o, status: 'ARCHIVED' as const };
          syncData('SAVE_ORDER', updated);
      }
  };

  const handleAddManualOrder = (itemId: string, qty: number) => {
      const order: PendingOrder = {
          id: 'ord_man_' + Date.now(),
          itemId,
          quantity: qty,
          date: new Date().toISOString(),
          status: 'PENDING',
          userName: currentUser?.name
      };
      setOrders(prev => [...prev, order]);
      syncData('SAVE_ORDER', order);
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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} z-50`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
            {!isSidebarCollapsed && <h1 className="font-black text-sm uppercase tracking-widest">BARSTOCK</h1>}
            <button onClick={()=>setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-500 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <NavItem collapsed={isSidebarCollapsed} active={view === 'dashboard'} onClick={()=>setView('dashboard')} label="Tableau de Bord" icon="M4 6h16M4 12h16M4 18h16" />
            <NavItem collapsed={isSidebarCollapsed} active={view.startsWith('daily_life')} onClick={()=>setView('daily_life')} label="Vie Quotidienne" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'bar_prep'} onClick={()=>setView('bar_prep')} label="Préparation Bar" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'restock'} onClick={()=>setView('restock')} label="Préparation Cave" icon="M19 14l-7 7m0 0l-7-7m7 7V3" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'movements'} onClick={()=>setView('movements')} label="Mouvements" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'inventory'} onClick={()=>setView('inventory')} label="Stock Global" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'consignes'} onClick={()=>setView('consignes')} label="Consignes Stock" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'global_inventory'} onClick={()=>setView('global_inventory')} label="Total Établissement" icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'orders'} onClick={()=>setView('orders')} label="À Commander" icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" badge={orders.filter(o=>o.status==='PENDING').length} />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'history'} onClick={()=>setView('history')} label="Historique" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'messages'} onClick={()=>setView('messages')} label="Messages" icon="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6" badge={messages.filter(m=>!m.isArchived).length} />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'dlc_tracking'} onClick={()=>setView('dlc_tracking')} label="Suivi DLC" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'articles'} onClick={()=>setView('articles')} label="Base Articles" icon="M4 6h16M4 10h16M4 14h16M4 18h16" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'recipes'} onClick={()=>setView('recipes')} label="Fiches Techniques" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'product_knowledge'} onClick={()=>setView('product_knowledge')} label="Fiches Produits" icon="M12 6.253v13m0-13" />
            {currentUser.role === 'ADMIN' && <NavItem collapsed={isSidebarCollapsed} active={view === 'connection_logs'} onClick={()=>setView('connection_logs')} label="Logs" icon="M9 12l2 2 4-4" />}
        </nav>

        <div className="p-4 border-t border-white/5 bg-slate-900 space-y-3">
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                </div>
                {!isSidebarCollapsed && (
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{currentUser.role}</p>
                    </div>
                )}
            </div>

            {!isSidebarCollapsed && (
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Test Mode</span>
                    <button 
                        onClick={() => setIsTestMode(!isTestMode)} 
                        className={`w-8 h-4 rounded-full transition-colors relative ${isTestMode ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isTestMode ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                </div>
            )}

            <div className="flex gap-2">
                <button 
                    onClick={() => fetchFullData()} 
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                    title="Actualiser les données"
                >
                    <svg className={`w-4 h-4 ${dataSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                <button 
                    onClick={() => setView('configuration')} 
                    className={`flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${view === 'configuration' ? 'bg-indigo-600 text-white' : ''}`}
                    title="Configuration"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                </button>
            </div>

            <button 
                onClick={handleLogout} 
                className="w-full bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-rose-900/20"
            >
                {!isSidebarCollapsed && "Déconnexion"}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 h-screen overflow-y-auto">
          {view === 'dashboard' && <Dashboard items={items} stockLevels={stockLevels} consignes={consignes} categories={categories} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} userRole={currentUser.role} transactions={transactions} messages={messages} events={events} currentUserName={currentUser.name} onNavigate={setView} onSendMessage={(text) => { const m: Message = { id: 'msg_'+Date.now(), content: text, userName: currentUser.name, date: new Date().toISOString(), isArchived: false, readBy: [] }; setMessages(p=>[m, ...p]); syncData('SAVE_MESSAGE', m); }} onArchiveMessage={(id) => { setMessages(p=>p.map(m=>m.id===id?{...m, isArchived:true}:m)); syncData('UPDATE_MESSAGE', {id, isArchived:true}); }} appConfig={appConfig} dailyCocktails={dailyCocktails} recipes={recipes} glassware={glassware} onUpdateDailyCocktail={(dc) => { setDailyCocktails(prev => { const idx = prev.findIndex(c => c.id === dc.id); if (idx >= 0) { const copy = [...prev]; copy[idx] = dc; return copy; } return [...prev, dc]; }); syncData('SAVE_DAILY_COCKTAIL', dc); }} />}
          {view.startsWith('daily_life') && <DailyLife tasks={tasks} events={events} eventComments={eventComments} currentUser={currentUser} items={items} onSync={syncData} setTasks={setTasks} setEvents={setEvents} setEventComments={setEventComments} dailyCocktails={dailyCocktails} setDailyCocktails={setDailyCocktails} recipes={recipes} onCreateTemporaryItem={handleCreateTemporaryItem} stockLevels={stockLevels} orders={orders} glassware={glassware} appConfig={appConfig} saveConfig={(k, v) => { setAppConfig(p => ({...p, [k]: v})); syncData('SAVE_CONFIG', {key: k, value: JSON.stringify(v)}); }} initialTab={view.includes(':') ? view.split(':')[1] : 'TASKS'} />}
          {view === 'bar_prep' && <BarPrep items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory} />}
          {view === 'restock' && <CaveRestock items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} unfulfilledOrders={unfulfilledOrders} onCreateTemporaryItem={handleCreateTemporaryItem} orders={orders} currentUser={currentUser} events={events} dlcProfiles={dlcProfiles} />}
          {view === 'movements' && <Movements items={items} transactions={transactions} storages={storages} onTransaction={handleTransaction} onOpenKeypad={()=>{}} unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={handleReportUnfulfilled} formats={formats} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory} onDlcEntry={handleDlcEntry} onDlcConsumption={handleDlcConsumption} onCreateTemporaryItem={handleCreateTemporaryItem} />}
          {view === 'inventory' && <StockTable items={items} storages={storages} stockLevels={stockLevels} priorities={priorities} onUpdateStock={(id, s, q) => { syncData('SAVE_STOCK', {itemId: id, storageId: s, currentQuantity: q}); setStockLevels(p => { const exists = p.find(l => l.itemId === id && l.storageId === s); if(exists) return p.map(l => l.itemId === id && l.storageId === s ? {...l, currentQuantity: q} : l); return [...p, {itemId: id, storageId: s, currentQuantity: q}]; }); }} onAdjustTransaction={handleAdjustTransaction} consignes={consignes} />}
          {view === 'global_inventory' && <GlobalInventory items={items} storages={storages} stockLevels={stockLevels} categories={categories} consignes={consignes} onSync={syncData} onUpdateStock={(id, s, q) => { syncData('SAVE_STOCK', {itemId: id, storageId: s, currentQuantity: q}); setStockLevels(p => { const exists = p.find(l => l.itemId === id && l.storageId === s); if(exists) return p.map(l => l.itemId === id && l.storageId === s ? {...l, currentQuantity: q} : l); return [...p, {itemId: id, storageId: s, currentQuantity: q}]; }); }} formats={formats} />}
          {view === 'consignes' && <Consignes items={items} storages={storages} consignes={consignes} priorities={priorities} setConsignes={setConsignes} onSync={syncData} />}
          {view === 'orders' && <Order orders={orders} items={items} storages={storages} onUpdateOrder={handleUpdateOrder} onDeleteOrder={handleDeleteOrder} onAddManualOrder={handleAddManualOrder} formats={formats} events={events} emailTemplates={emailTemplates} />}
          {view === 'history' && <History transactions={transactions} orders={orders} items={items} storages={storages} unfulfilledOrders={unfulfilledOrders} formats={formats} losses={losses} />}
          {view === 'dlc_tracking' && <DLCView items={items} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} storages={storages} onDelete={(id) => { setDlcHistory(p => p.filter(h => h.id !== id)); syncData('DELETE_DLC_HISTORY', {id}); }} />}
          {view === 'articles' && <ArticlesList items={items} setItems={setItems} formats={formats} categories={categories} onDelete={(id) => { setItems(p => p.filter(i => i.id !== id)); syncData('DELETE_ITEM', {id}); }} userRole={currentUser.role} dlcProfiles={dlcProfiles} onSync={syncData} events={events} recipes={recipes} />}
          {view === 'recipes' && <RecipesView recipes={recipes} items={items} glassware={glassware} currentUser={currentUser} appConfig={appConfig} onSync={syncData} setRecipes={setRecipes} techniques={techniques} cocktailCategories={cocktailCategories} />}
          {view === 'product_knowledge' && <ProductKnowledge sheets={productSheets} items={items} currentUserRole={currentUser.role} onSync={syncData} productTypes={productTypes} />}
          {view === 'messages' && <MessagesView messages={messages} currentUserRole={currentUser.role} currentUserName={currentUser.name} onSync={syncData} setMessages={setMessages} />}
          {view === 'configuration' && <Configuration setItems={setItems} setStorages={setStorages} setFormats={setFormats} storages={storages} formats={formats} priorities={priorities} setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} items={items} categories={categories} setCategories={setCategories} users={users} setUsers={setUsers} currentUser={currentUser} dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} appConfig={appConfig} setAppConfig={setAppConfig} glassware={glassware} setGlassware={setGlassware} techniques={techniques} setTechniques={setTechniques} cocktailCategories={cocktailCategories} setCocktailCategories={setCocktailCategories} productTypes={productTypes} setProductTypes={setProductTypes} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} fullData={{items, storages, stockLevels}} />}
          {view === 'connection_logs' && <ConnectionLogs logs={userLogs} />}
      </main>
    </div>
  );
};
export default App;
