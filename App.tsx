
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [view, setView] = useState<string>('dashboard');

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
  const [dailyCocktails, setDailyCocktails] = useState<DailyCocktail[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [productSheets, setProductSheets] = useState<ProductSheet[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);

  const syncData = async (action: string, payload: any) => {
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
      try {
          const resS = await fetch('/api/data_sync?scope=static');
          const dS = await resS.json();
          if (dS.items) setItems(dS.items);
          if (dS.storages) setStorages(dS.storages);
          if (dS.formats) setFormats(dS.formats);
          if (dS.categories) setCategories(dS.categories);
          if (dS.dlcProfiles) setDlcProfiles(dS.dlcProfiles);
          if (dS.priorities) setPriorities(dS.priorities);
          if (dS.techniques) setTechniques(dS.techniques);
          if (dS.cocktailCategories) setCocktailCategories(dS.cocktailCategories);
          if (dS.glassware) setGlassware(dS.glassware);
          if (dS.recipes) setRecipes(dS.recipes);
          if (dS.productSheets) setProductSheets(dS.productSheets);
          if (dS.productTypes) setProductTypes(dS.productTypes);
          if (dS.emailTemplates) setEmailTemplates(dS.emailTemplates);

          const resSt = await fetch('/api/data_sync?scope=stock');
          const dSt = await resSt.json();
          if (dSt.stockLevels) setStockLevels(dSt.stockLevels);
          if (dSt.consignes) setConsignes(dSt.consignes);
          if (dSt.dailyCocktails) setDailyCocktails(dSt.dailyCocktails);
          if (dSt.events) setEvents(dSt.events);
          if (dSt.tasks) setTasks(dSt.tasks);
          if (dSt.unfulfilledOrders) setUnfulfilledOrders(dSt.unfulfilledOrders);
          if (dSt.orders) setOrders(dSt.orders);

          const resH = await fetch('/api/data_sync?scope=history');
          const dH = await resH.json();
          if (dH.transactions) setTransactions(dH.transactions);
          if (dH.dlcHistory) setDlcHistory(dH.dlcHistory);
          if (dH.messages) setMessages(dH.messages);
          if (dH.losses) setLosses(dH.losses);
          if (dH.userLogs) setUserLogs(dH.userLogs);
      } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAuthData(); }, []);

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

  const handleDlcEntry = (itemId: string, storageId: string) => {
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
      <aside className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
            {!isSidebarCollapsed && <h1 className="font-black text-sm uppercase tracking-widest">BARSTOCK</h1>}
            <button onClick={()=>setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-500 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <NavItem collapsed={isSidebarCollapsed} active={view === 'dashboard'} onClick={()=>setView('dashboard')} label="Tableau de Bord" icon="M4 6h16M4 12h16M4 18h16" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'bar_prep'} onClick={()=>setView('bar_prep')} label="Préparation Bar" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'restock'} onClick={()=>setView('restock')} label="Préparation Cave" icon="M19 14l-7 7m0 0l-7-7m7 7V3" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'movements'} onClick={()=>setView('movements')} label="Mouvements" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'inventory'} onClick={()=>setView('inventory')} label="Stock Global" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'global_inventory'} onClick={()=>setView('global_inventory')} label="Total Établissement" icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'orders'} onClick={()=>setView('orders')} label="À Commander" icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" badge={orders.filter(o=>o.status==='PENDING').length} />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'history'} onClick={()=>setView('history')} label="Historique" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'messages'} onClick={()=>setView('messages')} label="Messages" icon="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6" badge={messages.filter(m=>!m.isArchived).length} />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'dlc_tracking'} onClick={()=>setView('dlc_tracking')} label="Suivi DLC" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'articles'} onClick={()=>setView('articles')} label="Base Articles" icon="M4 6h16M4 10h16" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'recipes'} onClick={()=>setView('recipes')} label="Fiches Techniques" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
            <NavItem collapsed={isSidebarCollapsed} active={view === 'product_knowledge'} onClick={()=>setView('product_knowledge')} label="Fiches Produits" icon="M12 6.253v13m0-13" />
            {currentUser.role === 'ADMIN' && <NavItem collapsed={isSidebarCollapsed} active={view === 'connection_logs'} onClick={()=>setView('connection_logs')} label="Logs" icon="M9 12l2 2 4-4" />}
        </nav>
        <div className="p-4 border-t border-white/5"><button onClick={()=>setView('configuration')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066" /></svg>{!isSidebarCollapsed && <span className="font-bold text-xs">Config</span>}</button></div>
      </aside>
      <main className="flex-1 p-4 md:p-8 h-screen overflow-y-auto">
          {view === 'dashboard' && <Dashboard items={items} stockLevels={stockLevels} consignes={consignes} categories={categories} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} userRole={currentUser.role} transactions={transactions} messages={messages} events={events} currentUserName={currentUser.name} onNavigate={setView} onSendMessage={()=>{}} onArchiveMessage={()=>{}} appConfig={appConfig} />}
          {view === 'bar_prep' && <BarPrep items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={()=>{}} categories={categories} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory} />}
          {view === 'movements' && <Movements items={items} transactions={transactions} storages={storages} onTransaction={handleTransaction} onOpenKeypad={()=>{}} unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={()=>{}} formats={formats} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory} onDlcEntry={handleDlcEntry} onDlcConsumption={handleDlcConsumption} />}
          {view === 'inventory' && <StockTable items={items} storages={storages} stockLevels={stockLevels} priorities={priorities} onUpdateStock={()=>{}} onAdjustTransaction={handleAdjustTransaction} consignes={consignes} />}
          {view === 'global_inventory' && <GlobalInventory items={items} storages={storages} stockLevels={stockLevels} categories={categories} consignes={consignes} onSync={syncData} onUpdateStock={()=>{}} formats={formats} />}
          {view === 'history' && <History transactions={transactions} orders={orders} items={items} storages={storages} unfulfilledOrders={unfulfilledOrders} formats={formats} losses={losses} />}
          {view === 'dlc_tracking' && <DLCView items={items} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} storages={storages} onDelete={()=>{}} />}
          {view === 'articles' && <ArticlesList items={items} setItems={setItems} formats={formats} categories={categories} onDelete={()=>{}} userRole={currentUser.role} dlcProfiles={dlcProfiles} onSync={syncData} />}
          {view === 'recipes' && <RecipesView recipes={recipes} items={items} glassware={glassware} currentUser={currentUser} appConfig={appConfig} onSync={syncData} setRecipes={setRecipes} />}
          {view === 'product_knowledge' && <ProductKnowledge sheets={productSheets} items={items} currentUserRole={currentUser.role} onSync={syncData} productTypes={productTypes} />}
          {view === 'configuration' && <Configuration setItems={setItems} setStorages={setStorages} setFormats={setFormats} storages={storages} formats={formats} priorities={priorities} setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} items={items} categories={categories} setCategories={setCategories} users={users} setUsers={setUsers} currentUser={currentUser} dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} appConfig={appConfig} setAppConfig={setAppConfig} glassware={glassware} productTypes={productTypes} setProductTypes={setProductTypes} />}
          {view === 'connection_logs' && <ConnectionLogs logs={userLogs} />}
      </main>
    </div>
  );
};
export default App;
