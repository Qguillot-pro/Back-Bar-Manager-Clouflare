
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
import AdminLogbook from './components/AdminLogbook';
import ProductKnowledge from './components/ProductKnowledge';

// Helper Component for Sidebar
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
  const [tempUser, setTempUser] = useState<User | null>(null);
  
  // États UI
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [isGestionOpen, setIsGestionOpen] = useState(true); 
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0); 
  const [isTestMode, setIsTestMode] = useState(false); 
  const [isAdminLogbookOpen, setIsAdminLogbookOpen] = useState(false); 

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
  
  // New States
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventComments, setEventComments] = useState<EventComment[]>([]);
  const [dailyCocktails, setDailyCocktails] = useState<DailyCocktail[]>([]);
  
  // V1.2+ States
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [productSheets, setProductSheets] = useState<ProductSheet[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);

  const [view, setView] = useState<string>('dashboard');
  const [articlesFilter, setArticlesFilter] = useState<'ALL' | 'TEMPORARY'>('ALL'); 
  const [notification, setNotification] = useState<{ title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Sync Wrapper
  const syncData = async (action: string, payload: any) => {
    if (isOffline) return;
    if (isTestMode) {
        console.log(`[MODE TEST] Action ignorée vers DB : ${action}`, payload);
        return;
    }
    
    // Auto-Log actions importantes
    if (['SAVE_TRANSACTION', 'SAVE_ORDER', 'SAVE_TASK', 'SAVE_EVENT', 'SAVE_ITEM'].includes(action) && currentUser) {
        const logId = 'log_' + Date.now() + Math.random().toString(36).substr(2,5);
        const logDetails = typeof payload === 'object' ? JSON.stringify(payload).slice(0, 100) : String(payload);
        
        fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SAVE_LOG', payload: { id: logId, userName: currentUser.name, action, details: logDetails } })
        }).catch(e => console.error("Log error", e));
    }

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      if (!res.ok) {
          console.warn("Erreur synchro:", action);
          setNotification({ title: 'Erreur Synchro', message: 'Action non sauvegardée sur le serveur.', type: 'error' });
          setTimeout(() => setNotification(null), 4000);
      }
    } catch (e) { console.error("Sync Error:", e); }
  };

  // Phase 1: Auth Init (Ultra rapide)
  const fetchAuthData = async () => {
    setLoading(true);
    setLoadingStep('Connexion au serveur...');
    setConnectionError(null);
    try {
        const response = await fetch('/api/init');
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Erreur Connexion (${response.status})`);
        }
        
        const data = await response.json();
        
        // Setup minimal users for login
        let fetchedUsers: User[] = data.users || [];
        fetchedUsers = fetchedUsers.map(u => {
            if (u.id === 'admin' && !u.pin) return { ...u, pin: '2159' };
            if (u.id === 'b1' && !u.pin) return { ...u, pin: '0000' };
            return u;
        });
        if (!fetchedUsers.find(u => u.id === 'admin')) fetchedUsers.push({ id: 'admin', name: 'Administrateur', role: 'ADMIN', pin: '2159' });
        if (!fetchedUsers.find(u => u.id === 'admin_secours')) fetchedUsers.push({ id: 'admin_secours', name: 'Admin Secours', role: 'ADMIN', pin: '0407' });
        
        setUsers(fetchedUsers);
        
        // Merge DB config with default
        if (data.appConfig) {
            setAppConfig(prev => ({...prev, ...data.appConfig}));
        }
        
        setIsOffline(false);
        
        // Lance le chargement lourd en arrière-plan
        fetchFullData();

    } catch (error: any) {
        console.warn("Passage en mode Hors Ligne:", error);
        setIsOffline(true);
        setConnectionError(error.message);
        loadLocalData();
        setLoading(false);
    }
  };

  // Phase 2: Full Data Sync (SEQUENTIAL / WATERFALL)
  const fetchFullData = async () => {
      setDataSyncing(true);
      try {
          // --- ÉTAPE 1 : Configuration Statique (Items, Recettes...) ---
          setLoadingStep('Chargement de la configuration...');
          const resStatic = await fetch('/api/data_sync?scope=static');
          if (!resStatic.ok) throw new Error("Erreur Static");
          const dataStatic = await resStatic.json();
          
          if (dataStatic.items) setItems(dataStatic.items);
          if (dataStatic.storages) setStorages(dataStatic.storages);
          if (dataStatic.formats) setFormats(dataStatic.formats);
          if (dataStatic.categories) setCategories(dataStatic.categories);
          if (dataStatic.dlcProfiles) setDlcProfiles(dataStatic.dlcProfiles);
          if (dataStatic.priorities) setPriorities(dataStatic.priorities);
          if (dataStatic.techniques) setTechniques(dataStatic.techniques);
          if (dataStatic.cocktailCategories) setCocktailCategories(dataStatic.cocktailCategories);
          if (dataStatic.glassware) setGlassware(dataStatic.glassware);
          if (dataStatic.recipes) setRecipes(dataStatic.recipes);
          if (dataStatic.productSheets) setProductSheets(dataStatic.productSheets);
          if (dataStatic.productTypes) setProductTypes(dataStatic.productTypes);
          if (dataStatic.emailTemplates) setEmailTemplates(dataStatic.emailTemplates);

          // --- ÉTAPE 2 : État des Stocks (Actif) ---
          setLoadingStep('Récupération des stocks...');
          const resStock = await fetch('/api/data_sync?scope=stock');
          if (!resStock.ok) throw new Error("Erreur Stock");
          const dataStock = await resStock.json();

          if (dataStock.stockLevels) setStockLevels(dataStock.stockLevels);
          if (dataStock.consignes) setConsignes(dataStock.consignes);
          if (dataStock.dailyCocktails) setDailyCocktails(dataStock.dailyCocktails);
          if (dataStock.events) setEvents(dataStock.events);
          if (dataStock.tasks) setTasks(dataStock.tasks);
          if (dataStock.unfulfilledOrders) setUnfulfilledOrders(dataStock.unfulfilledOrders);
          
          // --- ÉTAPE 3 : Historique (Lourd) ---
          setLoadingStep('Finalisation...');
          const resHistory = await fetch('/api/data_sync?scope=history');
          if (!resHistory.ok) throw new Error("Erreur History");
          const dataHistory = await resHistory.json();

          if (dataHistory.transactions) setTransactions(dataHistory.transactions);
          if (dataHistory.dlcHistory) setDlcHistory(dataHistory.dlcHistory);
          if (dataHistory.messages) setMessages(dataHistory.messages);
          if (dataHistory.losses) setLosses(dataHistory.losses);
          if (dataHistory.eventComments) setEventComments(dataHistory.eventComments);
          if (dataHistory.userLogs) setUserLogs(dataHistory.userLogs);

          // Orders are special (split across stock and history)
          const activeOrders = dataStock.orders || [];
          const historyOrders = dataHistory.orders || []; 
          setOrders([...activeOrders, ...historyOrders]);

      } catch (e) {
          console.error("Échec chargement background", e);
          setNotification({ title: 'Erreur Chargement', message: 'Impossible de récupérer les données complètes.', type: 'error' });
      } finally {
          setDataSyncing(false);
          setLoading(false);
      }
  };

  useEffect(() => { fetchAuthData(); }, []);

  // --- AUTO SYNC LOGIC (10:00 - 00:30) ---
  useEffect(() => {
      const interval = setInterval(() => {
          if (isOffline || dataSyncing) return;

          const now = new Date();
          const hours = now.getHours();
          const minutes = now.getMinutes();
          
          const isRange1 = hours >= 10; // 10:00 - 23:59
          const isRange2 = hours === 0 && minutes <= 30; // 00:00 - 00:30

          if (isRange1 || isRange2) {
              console.log("Auto-Sync Triggered (30min Interval)");
              fetchFullData();
          }
      }, 30 * 60 * 1000); // 30 minutes in milliseconds

      return () => clearInterval(interval);
  }, [isOffline, dataSyncing]);

  const handleManualRefresh = async () => {
      const now = Date.now();
      if (now - lastRefreshTime < 60000) {
          const remaining = Math.ceil((60000 - (now - lastRefreshTime)) / 1000);
          setNotification({ title: 'Patience', message: `Actualisation possible dans ${remaining} sec.`, type: 'info' });
          setTimeout(() => setNotification(null), 3000);
          return;
      }
      await fetchFullData();
      setLastRefreshTime(now);
      setNotification({ title: 'Succès', message: 'Données actualisées', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
  };

  const loadLocalData = () => {
      const saved = localStorage.getItem('barstock_local_db');
      if (saved) {
          try {
              const db = JSON.parse(saved);
              setItems(db.items || []);
              setUsers(db.users || []);
              setStorages(db.storages || []);
              setStockLevels(db.stockLevels || []);
              setConsignes(db.consignes || []);
              setTransactions(db.transactions || []);
              setOrders(db.orders || []);
              setDlcHistory(db.dlcHistory || []);
              setCategories(db.categories || []);
              setFormats(db.formats || []);
              setDlcProfiles(db.dlcProfiles || []);
              setPriorities(db.priorities || []);
              setUnfulfilledOrders(db.unfulfilledOrders || []);
              setAppConfig(db.appConfig || { tempItemDuration: '14_DAYS', defaultMargin: 82 });
              setMessages(db.messages || []);
              setGlassware(db.glassware || []);
              setRecipes(db.recipes || []);
              setTechniques(db.techniques || []);
              setLosses(db.losses || []);
              setTasks(db.tasks || []);
              setEvents(db.events || []);
              setEventComments(db.eventComments || []);
              setCocktailCategories(db.cocktailCategories || []);
              setDailyCocktails(db.dailyCocktails || []);
              setEmailTemplates(db.emailTemplates || []);
              setProductSheets(db.productSheets || []);
              setProductTypes(db.productTypes || []);
          } catch (e) {
              console.error("Erreur lecture sauvegarde locale", e);
          }
      }
      
      // Ensure admin exists even in offline/local mode
      setUsers(prev => {
          let current = [...prev];
          // Patch offline users too
          current = current.map(u => {
            if (u.id === 'admin' && !u.pin) return { ...u, pin: '2159' };
            if (u.id === 'b1' && !u.pin) return { ...u, pin: '0000' };
            return u;
          });
          
          if (!current.find(u => u.id === 'admin')) current.push({ id: 'admin', name: 'Administrateur', role: 'ADMIN', pin: '2159' });
          if (!current.find(u => u.id === 'admin_secours')) current.push({ id: 'admin_secours', name: 'Admin Secours', role: 'ADMIN', pin: '0407' });
          return current;
      });
  };

  useEffect(() => {
    if (!loading && !dataSyncing) {
      // Sauvegarde systématique dans le localStorage
      const db = { items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, categories, formats, dlcProfiles, priorities, unfulfilledOrders, appConfig, messages, glassware, recipes, techniques, losses, tasks, events, eventComments, cocktailCategories, dailyCocktails, emailTemplates, productSheets, productTypes };
      localStorage.setItem('barstock_local_db', JSON.stringify(db));
    }
  }, [items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, loading, dataSyncing, unfulfilledOrders, appConfig, messages, glassware, recipes, techniques, losses, tasks, events, eventComments, cocktailCategories, dailyCocktails, emailTemplates, productSheets, productTypes]);

  const sortedItems = useMemo(() => [...items].filter(i => !!i).sort((a, b) => (a.order || 0) - (b.order || 0)), [items]);
  const sortedStorages = useMemo(() => [...storages].filter(s => !!s).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)), [storages]);

  const handlePinInput = useCallback((num: string) => {
    if (loginStatus !== 'idle') return;
    if (loginInput.length >= 4) return;
    const newPin = loginInput + num;
    setLoginInput(newPin);
    if (newPin.length === 4) {
      const found = users.find(u => (u.pin || '').toString().trim() === newPin);
      if (found) {
        setTempUser(found); 
        setLoginStatus('success');
        
        // LOG LOGIN
        fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SAVE_LOG', payload: { id: 'log_' + Date.now(), userName: found.name, action: 'LOGIN', details: 'Connexion réussie', timestamp: new Date().toISOString() } })
        }).catch(console.error);

        setTimeout(() => { setCurrentUser(found); setLoginStatus('idle'); setLoginInput(''); }, 800);
      } else {
        setLoginStatus('error'); 
        setTimeout(() => { setLoginStatus('idle'); setLoginInput(''); }, 1000);
      }
    }
  }, [loginInput, loginStatus, users]);

  useEffect(() => {
    if (currentUser) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handlePinInput(e.key);
      else if (e.key === 'Backspace') setLoginInput(prev => prev.slice(0, -1));
      else if (e.key === 'Escape') setLoginInput('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser, handlePinInput]);

  const handleStockUpdate = (itemId: string, storageId: string, newQty: number, isTransfer: boolean = false, isCorrection: boolean = false) => {
    setStockLevels(prev => {
      const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
      if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l);
      return [...prev, { itemId, storageId, currentQuantity: newQty }];
    });
    syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
    
    if (isCorrection) {
        const trans: Transaction = { id: Math.random().toString(36).substr(2, 9), itemId, storageId, type: 'IN', quantity: 0, date: new Date().toISOString(), userName: currentUser?.name, note: 'Régulation Stock Global' };
        setTransactions(prev => [trans, ...prev]);
        syncData('SAVE_TRANSACTION', trans);
    }
  };

  const handleDlcEntry = (itemId: string, storageId: string, type: 'OPENING' | 'PRODUCTION') => {
      const newEntry: DLCHistory = { id: 'dlc_' + Date.now(), itemId, storageId, openedAt: new Date().toISOString(), userName: currentUser?.name };
      if (type === 'OPENING') {
          const itemsToRemove = dlcHistory.filter(h => h.itemId === itemId);
          setDlcHistory(prev => [...prev.filter(h => h.itemId !== itemId), newEntry]);
          itemsToRemove.forEach(h => syncData('DELETE_DLC_HISTORY', { id: h.id }));
          syncData('SAVE_DLC_HISTORY', newEntry);
      } else {
          setDlcHistory(prev => [...prev, newEntry]);
          syncData('SAVE_DLC_HISTORY', newEntry);
      }
  };
  const handleDlcConsumption = (itemId: string) => {
      const relevantDlcs = dlcHistory.filter(h => h.itemId === itemId).sort((a,b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
      if (relevantDlcs.length > 0) {
          const oldest = relevantDlcs[0];
          setDlcHistory(prev => prev.filter(h => h.id !== oldest.id));
          syncData('DELETE_DLC_HISTORY', { id: oldest.id });
      }
  };
  const handleTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer?: boolean) => {
      const trans: Transaction = { id: Math.random().toString(36).substr(2,9), itemId, storageId: 's_global', type, quantity: qty, date: new Date().toISOString(), userName: currentUser?.name, isServiceTransfer };
      setTransactions(p=>[trans, ...p]); syncData('SAVE_TRANSACTION', trans);
  };
  const handleRestockAction = (itemId: string, storageId: string, qtyToAdd: number, qtyToOrder: number = 0, isRupture: boolean = false) => {
      if (qtyToOrder > 0) {
          const newOrder: PendingOrder = { id: Math.random().toString(36).substr(2,9), itemId, quantity: qtyToOrder, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name };
          setOrders(p => [...p, newOrder]); syncData('SAVE_ORDER', newOrder);
      }
  };
  const handleUnfulfilledOrder = (itemId: string, quantity: number = 1) => {
      const unf: UnfulfilledOrder = { id: Math.random().toString(36).substr(2, 9), itemId, date: new Date().toISOString(), userName: currentUser?.name, quantity };
      setUnfulfilledOrders(prev => [unf, ...prev]); syncData('SAVE_UNFULFILLED_ORDER', unf);
  };
  const handleCreateTemporaryItem = (name: string, q: number) => {
      const newItem: StockItem = { id: 'temp_' + Date.now(), name, category: 'Produits Temporaires', formatId: 'f1', pricePerUnit: 0, lastUpdated: new Date().toISOString(), isTemporary: true, order: 9999, createdAt: new Date().toISOString() };
      setItems(prev => [...prev, newItem]); syncData('SAVE_ITEM', newItem);
  };
  const handleDeleteItem = (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); syncData('DELETE_ITEM', {id}); };
  const handleDeleteDlcHistory = (id: string) => { setDlcHistory(prev => prev.filter(h => h.id !== id)); syncData('DELETE_DLC_HISTORY', { id }); };
  const handleOrderUpdate = (orderId: string, quantity: number, status: any = 'PENDING') => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, quantity, status } : o));
      const order = orders.find(o => o.id === orderId);
      if (order) syncData('SAVE_ORDER', { ...order, quantity, status });
  };
  const handleDeleteOrder = (orderId: string) => { setOrders(prev => prev.filter(o => o.id !== orderId)); };
  const handleAddManualOrder = (itemId: string, qty: number) => { 
      const newOrder: PendingOrder = { id: Math.random().toString(36).substr(2, 9), itemId, quantity: qty, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name };
      setOrders(prev => [...prev, newOrder]); syncData('SAVE_ORDER', newOrder);
  };
  const handleSendMessage = (text: string) => {
    if (!currentUser) return;
    const newMessage: Message = { id: 'msg_' + Date.now(), content: text, userName: currentUser.name, date: new Date().toISOString(), isArchived: false, readBy: [currentUser.id] };
    setMessages(prev => [newMessage, ...prev]); syncData('SAVE_MESSAGE', newMessage);
  };
  const handleArchiveMessage = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isArchived: true } : m)); syncData('UPDATE_MESSAGE', { id, isArchived: true });
  };
  const handleSaveConfig = (key: string, value: any) => {
      setAppConfig(prev => ({...prev, [key]: value}));
      syncData('SAVE_CONFIG', { key, value: typeof value === 'object' ? JSON.stringify(value) : value });
  };
  const handleSaveDailyCocktail = (cocktail: DailyCocktail) => {
      setDailyCocktails(prev => {
          const idx = prev.findIndex(c => c.id === cocktail.id);
          if (idx >= 0) { const copy = [...prev]; copy[idx] = cocktail; return copy; }
          return [...prev, cocktail];
      });
      syncData('SAVE_DAILY_COCKTAIL', cocktail);
  };

  if (loading) return <div className="h-screen flex flex-col gap-4 items-center justify-center font-black animate-pulse">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">B</div>
        <p className="text-indigo-900 text-xl tracking-widest uppercase">CHARGEMENT...</p>
        {loadingStep && <p className="text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{loadingStep}</p>}
  </div>;
  
  if (!currentUser) {
     return (
       <div className="h-screen bg-slate-900 flex items-center justify-center p-4">
         <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-w-sm w-full relative">
           {connectionError && (
               <div className="absolute top-0 left-0 w-full bg-rose-500 text-white text-[10px] font-bold p-3 text-center z-10">
                   <span>{connectionError}</span>
               </div>
           )}
           <div className="bg-indigo-600 p-8 text-center">
             <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center text-indigo-600 font-black text-2xl shadow-lg">B</div>
             <h1 className="text-white font-black text-xl tracking-widest uppercase">BarStock Pro</h1>
             <p className="text-indigo-200 text-xs font-bold mt-2">Identification Requise</p>
           </div>
           
           <div className="p-8">
             <div className="flex justify-center gap-4 mb-8">
               {[0, 1, 2, 3].map(i => (<div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${loginInput.length > i ? 'bg-indigo-600 scale-110' : 'bg-slate-200'}`}></div>))}
             </div>
             <div className="grid grid-cols-3 gap-4 mb-6">
               {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (<button key={n} onClick={() => handlePinInput(n.toString())} className="aspect-square rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-black text-2xl transition-all active:scale-95 shadow-sm border border-slate-100">{n}</button>))}
               <div className="aspect-square"></div>
               <button onClick={() => handlePinInput("0")} className="aspect-square rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-black text-2xl transition-all active:scale-95 shadow-sm border border-slate-100">0</button>
               <button onClick={() => setLoginInput(prev => prev.slice(0, -1))} className="aspect-square rounded-full bg-rose-50 text-rose-500 font-black flex items-center justify-center active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg></button>
             </div>
             {loginStatus === 'error' && (<p className="text-center text-rose-500 text-xs font-black uppercase animate-bounce">Code PIN Incorrect</p>)}
           </div>
         </div>
       </div>
     );
  }

  const unreadMessagesCount = messages.filter(m => !m.isArchived && (!m.readBy || !m.readBy.includes(currentUser.id))).length;
  const activeTasksCount = tasks.filter(t => !t.isDone).length;
  const todayEventsCount = events.filter(e => new Date(e.startTime).toDateString() === new Date().toDateString()).length;

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-slate-50 ${isTestMode ? 'border-4 border-rose-500' : ''}`}>
      {/* ADMIN LOGBOOK OVERLAY */}
      {isAdminLogbookOpen && currentUser.role === 'ADMIN' && (
          <AdminLogbook 
              currentUser={currentUser} 
              onSync={syncData} 
              onClose={() => setIsAdminLogbookOpen(false)} 
          />
      )}

      <aside className={`bg-slate-900 text-white flex flex-col md:sticky top-0 md:h-screen z-50 transition-all duration-300 ${isSidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-black text-xs shrink-0">B</div>
            {!isSidebarCollapsed && <h1 className="font-black text-sm uppercase tracking-widest truncate">BARSTOCK</h1>}
          </div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex text-slate-500 hover:text-white transition-colors">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{isSidebarCollapsed ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />}</svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <NavItem collapsed={isSidebarCollapsed} active={view === 'dashboard'} onClick={() => setView('dashboard')} label="Tableau de Bord" icon="M4 6h16M4 12h16M4 18h16" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'bar_prep'} onClick={() => setView('bar_prep')} label="Préparation Bar" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'restock'} onClick={() => setView('restock')} label="Préparation Cave" icon="M19 14l-7 7m0 0l-7-7m7 7V3" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'movements'} onClick={() => setView('movements')} label="Mouvements" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'inventory'} onClick={() => setView('inventory')} label="Stock Global" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'global_inventory'} onClick={() => setView('global_inventory')} label="Stock Total Établissement" icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'orders'} onClick={() => setView('orders')} label="À Commander" icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" badge={orders.filter(o => o && o.status === 'PENDING').length} />
          
          <div className="my-2 border-t border-white/5"></div>
          
          <NavItem collapsed={isSidebarCollapsed} active={view === 'recipes'} onClick={() => setView('recipes')} label="Fiches Techniques" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'product_knowledge'} onClick={() => setView('product_knowledge')} label="Fiches Produits" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </nav>

        <div className="p-4 mt-auto">
            <button onClick={() => setView('configuration')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${view === 'configuration' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {!isSidebarCollapsed && <span className="font-bold text-xs uppercase tracking-wider">Configuration</span>}
            </button>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-black text-xs">{currentUser.name.charAt(0)}</div>
                {!isSidebarCollapsed && (
                    <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold truncate">{currentUser.name}</p>
                        <button onClick={() => { setCurrentUser(null); setLoginInput(''); setView('dashboard'); }} className="text-[10px] text-slate-500 uppercase hover:text-white transition-colors">Déconnexion</button>
                    </div>
                )}
            </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 h-screen overflow-y-auto scrollbar-thin relative">
        <div className="max-w-7xl mx-auto">
            {view === 'dashboard' && (
                <Dashboard 
                    items={items} stockLevels={stockLevels} consignes={consignes} categories={categories} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} 
                    userRole={currentUser.role} transactions={transactions} messages={messages} events={events} tasks={tasks} 
                    currentUserName={currentUser.name} onNavigate={(v) => { if(v.startsWith('daily_life:')) { setView('daily_life'); setTimeout(() => document.dispatchEvent(new CustomEvent('switch-tab', {detail: v.split(':')[1]})), 100); } else setView(v); }} 
                    onSendMessage={handleSendMessage} onArchiveMessage={handleArchiveMessage} dailyCocktails={dailyCocktails} recipes={recipes} glassware={glassware}
                    onUpdateDailyCocktail={handleSaveDailyCocktail} appConfig={appConfig}
                />
            )}
            {view === 'bar_prep' && (
                <BarPrep 
                    items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} 
                    onAction={handleRestockAction} categories={categories} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory}
                />
            )}
            {view === 'restock' && (
                <CaveRestock 
                    items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} 
                    onAction={handleRestockAction} categories={categories} unfulfilledOrders={unfulfilledOrders} onCreateTemporaryItem={handleCreateTemporaryItem}
                    orders={orders} currentUser={currentUser} events={events} dlcProfiles={dlcProfiles}
                />
            )}
            {view === 'movements' && (
                <Movements 
                    items={items} transactions={transactions} storages={storages} onTransaction={handleTransaction} onOpenKeypad={() => {}}
                    unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={handleUnfulfilledOrder} onCreateTemporaryItem={handleCreateTemporaryItem} formats={formats}
                    dlcProfiles={dlcProfiles} onUndo={() => {}} dlcHistory={dlcHistory} onDlcEntry={handleDlcEntry} onDlcConsumption={handleDlcConsumption}
                />
            )}
            {view === 'inventory' && (
                <StockTable 
                    items={items.filter(i => !i.isInventoryOnly)} storages={storages.filter(s => s.id !== 's_global')} stockLevels={stockLevels} consignes={consignes} priorities={priorities} onUpdateStock={handleStockUpdate} 
                />
            )}
            {view === 'global_inventory' && (
                <GlobalInventory 
                    items={items} storages={storages} stockLevels={stockLevels} categories={categories} consignes={consignes} onSync={syncData} onUpdateStock={handleStockUpdate} formats={formats}
                />
            )}
            {view === 'orders' && (
                <Order 
                    orders={orders} items={items} storages={storages} onUpdateOrder={handleOrderUpdate} onDeleteOrder={handleDeleteOrder} 
                    onAddManualOrder={handleAddManualOrder} formats={formats} events={events} emailTemplates={emailTemplates}
                />
            )}
            {view === 'articles' && (
                <ArticlesList 
                    items={items} setItems={setItems} formats={formats} categories={categories} onDelete={handleDeleteItem} userRole={currentUser.role} dlcProfiles={dlcProfiles} onSync={syncData}
                    events={events} recipes={recipes}
                />
            )}
            {view === 'configuration' && currentUser.role === 'ADMIN' && (
                <Configuration 
                    setItems={setItems} setStorages={setStorages} setFormats={setFormats} storages={storages} formats={formats} 
                    priorities={priorities} setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} items={items} 
                    categories={categories} setCategories={setCategories} users={users} setUsers={setUsers} currentUser={currentUser} 
                    dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} appConfig={appConfig} setAppConfig={setAppConfig}
                    glassware={glassware} setGlassware={setGlassware} techniques={techniques} setTechniques={setTechniques} cocktailCategories={cocktailCategories} setCocktailCategories={setCocktailCategories}
                    fullData={{items, stockLevels}} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} productTypes={productTypes} setProductTypes={setProductTypes}
                />
            )}
            {view === 'dlc_tracking' && (
                <DLCView items={items} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} storages={storages} onDelete={handleDeleteDlcHistory} />
            )}
            {view === 'messages' && (
                <MessagesView messages={messages} currentUserRole={currentUser.role} currentUserName={currentUser.name} onSync={syncData} setMessages={setMessages} />
            )}
            {view === 'recipes' && (
                <RecipesView recipes={recipes} items={items} glassware={glassware} currentUser={currentUser} appConfig={appConfig} onSync={syncData} setRecipes={setRecipes} techniques={techniques} cocktailCategories={cocktailCategories} />
            )}
            {view === 'product_knowledge' && (
                <ProductKnowledge sheets={productSheets} items={items} currentUserRole={currentUser.role} onSync={syncData} productTypes={productTypes} />
            )}
            {view === 'daily_life' && (
                <DailyLife 
                    tasks={tasks} events={events} eventComments={eventComments} currentUser={currentUser} items={items} onSync={syncData} setTasks={setTasks} setEvents={setEvents} setEventComments={setEventComments}
                    dailyCocktails={dailyCocktails} setDailyCocktails={setDailyCocktails} recipes={recipes} onCreateTemporaryItem={handleCreateTemporaryItem}
                    stockLevels={stockLevels} orders={orders} glassware={glassware} appConfig={appConfig} saveConfig={handleSaveConfig}
                    initialTab={view.includes(':') ? view.split(':')[1] : undefined}
                />
            )}
            {view === 'connection_logs' && currentUser.role === 'ADMIN' && (
                <ConnectionLogs logs={userLogs} />
            )}
        </div>
      </main>
    </div>
  );
};

export default App;
