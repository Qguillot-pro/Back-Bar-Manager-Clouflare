
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StockItem, Category, StorageSpace, Format, Transaction, StockLevel, StockConsigne, StockPriority, PendingOrder, DLCHistory, User, DLCProfile, UnfulfilledOrder, AppConfig, Message, Glassware, Recipe, Technique, Loss, UserLog, Task, Event, EventComment, DailyCocktail, CocktailCategory, DailyCocktailType, EmailTemplate, AdminNote, ProductSheet, ProductType, MealReservation, DailyAlert } from './types';
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
import AdminPrices from './components/AdminPrices';

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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutDurationIndex, setLockoutDurationIndex] = useState(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  const LOCKOUT_DURATIONS = [30, 60, 300, 600, 1800, 3600];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutUntil) {
      timer = setInterval(() => {
        const now = Date.now();
        const diff = Math.ceil((lockoutUntil - now) / 1000);
        if (diff <= 0) {
          setLockoutUntil(null);
          setLockoutTimeLeft(0);
          setLoginStatus('idle');
        } else {
          setLockoutTimeLeft(diff);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutUntil]);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [isTestMode, setIsTestMode] = useState(false); // Mode Test State
  const [view, setView] = useState<string>('dashboard');
  const [showAdminLogbook, setShowAdminLogbook] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [roleProfiles, setRoleProfiles] = useState<any[]>([]);
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
  const [mealReservations, setMealReservations] = useState<MealReservation[]>([]);
  const [dailyAlerts, setDailyAlerts] = useState<DailyAlert[]>([]);

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
        setRoleProfiles(data.roleProfiles || []);
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
          if (dataSt.mealReservations) setMealReservations(dataSt.mealReservations);

          if (dataH.transactions) setTransactions(dataH.transactions);
          if (dataH.dlcHistory) setDlcHistory(dataH.dlcHistory);
          if (dataH.messages) setMessages(dataH.messages);
          if (dataH.losses) setLosses(dataH.losses);
          if (dataH.userLogs) setUserLogs(dataH.userLogs);
          if (dataH.dailyAlerts) setDailyAlerts(dataH.dailyAlerts);
          if (dataH.eventComments) setEventComments(dataH.eventComments);
      } catch (e) { console.error("Fetch Error", e); } finally {
          setDataSyncing(false);
          setLoading(false);
      }
  };

  const saveConfig = (k: string, v: any) => {
    setAppConfig(p => ({...p, [k]: v}));
    const mapping: Record<string, string> = {
      'programThresholds': 'program_thresholds',
      'tempItemDuration': 'temp_item_duration',
      'defaultMargin': 'default_margin',
      'programMapping': 'program_mapping',
      'mealReminderTimes': 'meal_reminder_times',
      'barDayStart': 'bar_day_start',
      'emailSender': 'email_sender'
    };
    const dbKey = mapping[k] || k;
    syncData('SAVE_CONFIG', {key: dbKey, value: JSON.stringify(v)});
  };

  const userPermissions = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === 'ADMIN') return null; // Admin has all permissions
    const profile = roleProfiles.find(p => p.id === currentUser.profileId);
    return profile?.permissions || null;
  }, [currentUser, roleProfiles]);

  const canView = (resource: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (!userPermissions) return false;
    return userPermissions[resource]?.view || false;
  };

  const canEdit = (resource: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (!userPermissions) return false;
    return userPermissions[resource]?.edit || false;
  };

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', resource: 'dashboard' },
    { id: 'messages', label: 'Messages', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', resource: 'messages', badge: messages.filter(m => !m.isArchived && !m.readBy?.includes(currentUser?.id || '')).length },
    { id: 'daily_life', label: 'Vie Quotidienne', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', resource: 'daily_life' },
    { id: 'bar_prep', label: 'Mise en Place Bar', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.673.337a4 4 0 01-2.574.345l-2.387-.477a2 2 0 00-1.022.547l-1.168 1.168a2 2 0 00-.547 1.022l-.477 2.387a6 6 0 00.517 3.86l.337.673a4 4 0 01.345 2.574l-.477 2.387a2 2 0 00.547 1.022l1.168 1.168a2 2 0 001.022.547l2.387.477a6 6 0 003.86-.517l.673-.337a4 4 0 012.574-.345l2.387.477a2 2 0 001.022-.547l1.168-1.168a2 2 0 00.547-1.022l.477-2.387a6 6 0 00-.517-3.86l-.337-.673a4 4 0 01-.345-2.574l.477-2.387a2 2 0 00-.547-1.022l-1.168-1.168z M12 15a3 3 0 100-6 3 3 0 000 6z', resource: 'bar_prep' },
    { id: 'restock', label: 'Réappro Cave', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', resource: 'restock' },
    { id: 'movements', label: 'Mouvements Stock', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', resource: 'movements' },
    { id: 'stock_table', label: 'Stock-Bar', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', resource: 'inventory' },
    { id: 'inventory', label: 'Inventaire Général', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', resource: 'global_inventory' },
    { id: 'product_knowledge', label: 'Fiches Produits', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', resource: 'product_knowledge' },
    { id: 'recipes', label: 'Recettes', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', resource: 'recipes' },
    { id: 'articles', label: 'Articles & Prix', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', resource: 'articles' },
    { id: 'orders', label: 'Commandes', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z', resource: 'order' },
    { id: 'dlc_tracking', label: 'DLC & Ouvertures', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', resource: 'dlc' },
    { id: 'admin_prices', label: 'Vérif. Prix & Marges', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', resource: 'admin_prices' },
    { id: 'consignes', label: 'Consignes Stock', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', resource: 'consignes' },
    { id: 'history', label: 'Historique', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', resource: 'history' },
  ];

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => canView(item.resource));
  }, [currentUser, userPermissions]);

  const checkDailyAlerts = useCallback(() => {
      if (!items.length || !stockLevels.length) return;

      const now = new Date();
      const barDayStart = appConfig.barDayStart || '04:00';
      const [startHour, startMin] = barDayStart.split(':').map(Number);
      
      // Calculate "Bar Date" for yesterday (the day that just finished)
      // If now is 05:00 and start is 04:00, we are in a new bar day.
      // We want to record stats for the *previous* bar day if not already done.
      
      const currentBarDate = new Date(now);
      if (now.getHours() < startHour || (now.getHours() === startHour && now.getMinutes() < startMin)) {
          currentBarDate.setDate(currentBarDate.getDate() - 1);
      }
      
      // We want to check if alerts exist for YESTERDAY's bar date (relative to current bar date)
      // Actually, the user says: "Les produits qui sont présents dans cette liste au moment du changement de 'jour bar', sont enregistrés dans l'historique à la date J-1."
      // This means at the START of Day X (e.g. 04:01 on Day X), we record the state of Day X-1.
      // So we check if we have data for (CurrentBarDate - 1 day).
      
      const previousBarDate = new Date(currentBarDate);
      previousBarDate.setDate(previousBarDate.getDate() - 1);
      const y = previousBarDate.getFullYear();
      const mm = String(previousBarDate.getMonth() + 1).padStart(2, '0');
      const dd = String(previousBarDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${mm}-${dd}`;

      // Check if alerts already exist for this date
      const exists = dailyAlerts.some(a => a.date === dateStr);
      if (exists) return;

      // Generate alerts
      const newAlerts: DailyAlert[] = [];

      items.forEach(item => {
          // 1. Rupture: Total stock across all storages is 0
          const itemLevels = stockLevels.filter(l => l.itemId === item.id);
          const totalQty = itemLevels.reduce((sum, l) => sum + l.currentQuantity, 0);
          
          if (totalQty === 0) {
              newAlerts.push({
                  id: `alert_${dateStr}_${item.id}_RUPTURE`,
                  date: dateStr,
                  type: 'RUPTURE',
                  itemId: item.id,
                  quantity: 0,
                  consigne: 0
              });
          }

          // 2. Tension: Stock < Consigne for ALL storages where consigne exists
          const itemConsignes = consignes.filter(c => c.itemId === item.id);
          if (itemConsignes.length > 0) {
              const isUnderTension = itemConsignes.every(c => {
                  const level = itemLevels.find(l => l.storageId === c.storageId)?.currentQuantity || 0;
                  return level < c.minQuantity;
              });

              if (isUnderTension) {
                  const totalConsigne = itemConsignes.reduce((sum, c) => sum + c.minQuantity, 0);
                  newAlerts.push({
                      id: `alert_${dateStr}_${item.id}_TENSION`,
                      date: dateStr,
                      type: 'TENSION',
                      itemId: item.id,
                      quantity: totalQty,
                      consigne: totalConsigne
                  });
              }
          }
      });

      if (newAlerts.length > 0) {
          // Save all
          // Use Promise.all to ensure all are sent, but syncData is async void.
          // We update state locally first.
          setDailyAlerts(prev => [...prev, ...newAlerts]);
          newAlerts.forEach(a => syncData('SAVE_DAILY_STOCK_ALERT', a));
      }

  }, [items, stockLevels, consignes, dailyAlerts, appConfig.barDayStart]);

  useEffect(() => {
      if (!loading && !dataSyncing && items.length > 0) {
          checkDailyAlerts();
      }
  }, [loading, dataSyncing, checkDailyAlerts]);

  useEffect(() => { fetchAuthData(); }, []);

  // SESSION TIMEOUT LOGIC (3 HOURS)
  useEffect(() => {
      let timeout: NodeJS.Timeout;
      const resetTimer = () => {
          clearTimeout(timeout);
          if (currentUser) {
              timeout = setTimeout(() => {
                  setCurrentUser(null);
                  setView('dashboard');
                  alert("Session expirée (3h d'inactivité). Veuillez vous reconnecter.");
              }, 3 * 60 * 60 * 1000); // 3 heures
          }
      };

      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('touchstart', resetTimer);

      resetTimer(); // Init

      return () => {
          clearTimeout(timeout);
          window.removeEventListener('mousemove', resetTimer);
          window.removeEventListener('keydown', resetTimer);
          window.removeEventListener('click', resetTimer);
          window.removeEventListener('touchstart', resetTimer);
      };
  }, [currentUser]);

  // MEAL REMINDER NOTIFICATIONS
  useEffect(() => {
      if (!appConfig.mealReminderTimes || appConfig.mealReminderTimes.length === 0) return;
      
      const checkReminders = () => {
          const now = new Date();
          const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          
          if (appConfig.mealReminderTimes?.includes(currentTime)) {
              // Check if notification already shown this minute to prevent spam
              const lastShown = sessionStorage.getItem('lastMealReminder');
              if (lastShown !== currentTime) {
                  if (Notification.permission === 'granted') {
                      new Notification("Rappel Repas", { body: "N'oubliez pas de réserver votre repas pour aujourd'hui !" });
                  } else if (Notification.permission !== 'denied') {
                      Notification.requestPermission().then(permission => {
                          if (permission === 'granted') {
                              new Notification("Rappel Repas", { body: "N'oubliez pas de réserver votre repas pour aujourd'hui !" });
                          }
                      });
                  }
                  sessionStorage.setItem('lastMealReminder', currentTime);
              }
          }
      };

      const interval = setInterval(checkReminders, 30000); // Check every 30s
      return () => clearInterval(interval);
  }, [appConfig.mealReminderTimes]);

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

  const handleDlcConsumption = (itemId: string, storageId?: string, qty: number = 1) => {
    setDlcHistory(prev => {
      // Find entries for this item, optionally filtered by storage
      let entries = prev.filter(h => h.itemId === itemId);
      if (storageId) {
        entries = entries.filter(h => h.storageId === storageId);
      }
      
      if (entries.length === 0) return prev;

      // Sort by openedAt (oldest first) to consume the oldest ones
      const sorted = [...entries].sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
      
      let remainingToConsume = qty;
      let newHistory = [...prev];

      for (const entry of sorted) {
        if (remainingToConsume <= 0) break;
        
        const entryQty = entry.quantity || 1;
        if (entryQty <= remainingToConsume) {
          // Remove this entry
          newHistory = newHistory.filter(h => h.id !== entry.id);
          syncData('DELETE_DLC_HISTORY', { id: entry.id });
          remainingToConsume -= entryQty;
        } else {
          // Decrease quantity
          const updated = { ...entry, quantity: parseFloat((entryQty - remainingToConsume).toFixed(3)) };
          newHistory = newHistory.map(h => h.id === entry.id ? updated : h);
          syncData('SAVE_DLC_HISTORY', updated);
          remainingToConsume = 0;
        }
      }
      return newHistory;
    });
  };

  const [regulationDlcModal, setRegulationDlcModal] = useState<{
    itemId: string;
    storageId: string;
    newQty: number;
    currentQty: number;
    itemName: string;
    note?: string;
  } | null>(null);

  // LOGIQUE DE MOUVEMENT INTELLIGENT (Priorités + Règles Spécifiques)
  const handleSmartTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer: boolean = false, note?: string) => {
      const itemLevels = stockLevels.filter(l => l.itemId === itemId);
      const itemPriorities = priorities.filter(p => p.itemId === itemId);
      
      const getPrio = (sid: string) => {
          if (sid === 's0') return -1;
          return itemPriorities.find(p => p.storageId === sid)?.priority || 0;
      };

      const commitTrans = (sid: string, amount: number, tType: 'IN' | 'OUT', newQ: number) => {
          const trans: Transaction = { id: 't_' + Date.now() + Math.random(), itemId, storageId: sid, type: tType, quantity: amount, date: new Date().toISOString(), userName: currentUser?.name, isServiceTransfer, note };
          setTransactions(p => [trans, ...p]);
          syncData('SAVE_TRANSACTION', trans);
          
          setStockLevels(prev => {
              const exists = prev.find(l => l.itemId === itemId && l.storageId === sid);
              if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === sid) ? { ...l, currentQuantity: newQ } : l);
              return [...prev, { itemId, storageId: sid, currentQuantity: newQ }];
          });
          syncData('SAVE_STOCK', { itemId, storageId: sid, currentQuantity: newQ });

          // DLC Consumption on OUT
          if (tType === 'OUT') {
              handleDlcConsumption(itemId, sid, amount);
          }
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
              .filter(t => t.prio > 0 || t.id === 's0')
              .sort((a, b) => {
                  if (a.id === 's0') return 1;
                  if (b.id === 's0') return -1;
                  return a.prio - b.prio; // Priorité croissante
              });

          let remainingQty = qty;

          for (const target of targets) {
              if (remainingQty <= 0) break;
              
              // Règle spéciale : ne pas ajouter si un stock est en décimale (sauf si c'est le seul espace possible ?)
              // L'utilisateur dit : "ne pas ajouter si un stock est en décimale, ajouter à l'espace de stockage suivant dans ce cas"
              if (target.current % 1 !== 0) continue;

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
              // Si on a encore de la quantité et qu'on a sauté les décimaux, on force sur s0 ou le dernier
              const fallback = targets.find(t => t.id === 's0') || targets[targets.length - 1];
              if (fallback) commitTrans(fallback.id, remainingQty, 'IN', fallback.current + remainingQty);
          }

      } else {
          let remainingQty = qty;
          
          // 1. D'abord vider les stocks décimaux (bouteilles ouvertes)
          const decimalStorages = itemLevels
              .filter(l => l.currentQuantity % 1 !== 0)
              .map(l => ({ ...l, prio: getPrio(l.storageId) }))
              .filter(t => t.prio > 0 || t.storageId === 's0')
              .sort((a, b) => {
                  if (a.storageId === 's0') return 1;
                  if (b.storageId === 's0') return -1;
                  return a.prio - b.prio;
              });

          for (const ds of decimalStorages) {
              if (remainingQty <= 0) break;
              const take = Math.min(remainingQty, ds.currentQuantity);
              commitTrans(ds.storageId, take, 'OUT', ds.currentQuantity - take);
              remainingQty -= take;
          }

          // 2. Ensuite vider les stocks pleins par priorité
          if (remainingQty > 0) {
              const targets = itemLevels
                  .filter(l => l.currentQuantity > 0)
                  .map(l => ({ ...l, prio: getPrio(l.storageId) }))
                  .filter(t => t.prio > 0 || t.storageId === 's0')
                  .sort((a, b) => {
                      if (a.storageId === 's0') return 1;
                      if (b.storageId === 's0') return -1;
                      return a.prio - b.prio;
                  });

              for (const target of targets) {
                  if (remainingQty <= 0) break;
                  const take = Math.min(remainingQty, target.currentQuantity);
                  commitTrans(target.storageId, take, 'OUT', target.currentQuantity - take);
                  remainingQty -= take;

                  // NEW: If Bar Prep item, transfer a batch from highest priority to this storage
                  const item = items.find(i => i.id === itemId);
                  const profile = item?.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
                  if (profile && profile.type === 'PRODUCTION' && take >= 1) {
                      const sourceStocks = itemLevels
                          .filter(l => l.storageId !== target.storageId && l.currentQuantity >= 1)
                          .map(l => ({ ...l, prio: getPrio(l.storageId) }))
                          .filter(t => t.prio > 0 || t.storageId === 's0')
                          .sort((a, b) => {
                              if (a.storageId === 's0') return 1;
                              if (b.storageId === 's0') return -1;
                              return a.prio - b.prio;
                          });
                      
                      if (sourceStocks.length > 0) {
                          const source = sourceStocks[0];
                          const sourceBatches = dlcHistory.filter(h => h.itemId === itemId && h.storageId === source.storageId);
                          if (sourceBatches.length > 0) {
                              const furthestBatch = [...sourceBatches].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
                              handleUpdateDlc({ ...furthestBatch, storageId: target.storageId });
                              commitTrans(source.storageId, 1, 'OUT', source.currentQuantity - 1);
                              commitTrans(target.storageId, 1, 'IN', target.currentQuantity + 1);
                          }
                      }
                  }
              }
          }
      }
  };

  const handleTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number, isServiceTransfer: boolean = false, note?: string) => {
    handleSmartTransaction(itemId, type, qty, isServiceTransfer, note);
  };

  const handleUpdateLoss = (updatedLoss: Loss) => {
    setLosses(prev => prev.map(l => l.id === updatedLoss.id ? updatedLoss : l));
    syncData('SAVE_LOSS', updatedLoss);
  };

  const handleUpdateStock = (itemId: string, storageId: string, newQuantity: number, note?: string) => {
      const previousLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId);
      const previousQty = previousLevel?.currentQuantity || 0;
      const item = items.find(i => i.id === itemId);

      // If it's an OUT regulation and item has DLC, ask if it's open/finished
      if (newQuantity < previousQty && item?.dlcProfileId) {
          setRegulationDlcModal({
              itemId,
              storageId,
              newQty: newQuantity,
              currentQty: previousQty,
              itemName: item.name,
              note
          });
          return;
      }

      syncData('SAVE_STOCK', {itemId, storageId, currentQuantity: newQuantity});
      
      setStockLevels(prev => {
          const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
          if (exists) return prev.map(l => l.itemId === itemId && l.storageId === storageId ? { ...l, currentQuantity: newQuantity } : l);
          return [...prev, { itemId, storageId, currentQuantity: newQuantity }];
      });

      if (newQuantity !== previousQty) {
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
              note: note || 'Régulation'
          };
          
          setTransactions(p => [trans, ...p]);
          syncData('SAVE_TRANSACTION', trans);

          // Consume DLC if OUT
          if (type === 'OUT') {
              handleDlcConsumption(itemId, storageId, qty);
          }
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

      if (delta < 0) {
          handleDlcConsumption(itemId, storageId, Math.abs(delta));
      }
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

          // DLC LOGIC: If item has DLC profile, create entry (Production or Opening)
          const item = items.find(i => i.id === itemId);
          if (item?.isDLC || item?.dlcProfileId) {
              const profile = dlcProfiles.find(p => p.id === item.dlcProfileId);
              const type = profile?.type || 'OPENING';
              handleAddDlc(itemId, storageId, type, true, qtyNeeded);
          }
      }
      if ((qtyToOrder && qtyToOrder > 0) || isRupture) {
          // MERGE LOGIC: Check if pending order exists
          const existingOrder = orders.find(o => o.itemId === itemId && o.status === 'PENDING');
          if (existingOrder) {
              const newOrderQty = (existingOrder.quantity || 0) + (qtyToOrder || 0);
              const updatedOrder = { ...existingOrder, quantity: newOrderQty, ruptureDate: isRupture ? new Date().toISOString() : existingOrder.ruptureDate };
              setOrders(prev => prev.map(o => o.id === existingOrder.id ? updatedOrder : o));
              syncData('SAVE_ORDER', updatedOrder);
          } else {
              const order: PendingOrder = { id: 'ord_' + Date.now(), itemId, quantity: qtyToOrder || 0, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name, ruptureDate: isRupture ? new Date().toISOString() : undefined };
              setOrders(prev => [...prev, order]);
              syncData('SAVE_ORDER', order);
          }
      }
  };

  const handleEditTask = (task: Task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      syncData('SAVE_TASK', task);
  };

  const handleUpdateDlc = (dlc: DLCHistory) => {
      setDlcHistory(prev => prev.map(d => d.id === dlc.id ? dlc : d));
      syncData('SAVE_DLC_HISTORY', dlc);
  };

  const handleAddDlc = (itemId: string, storageId: string, type: 'OPENING' | 'PRODUCTION', isOpen: boolean = true, quantity: number = 1) => {
      const item = items.find(i => i.id === itemId);
      const profile = item?.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
      
      const now = new Date().toISOString();

      // Check for existing entry to merge
      // For OPENING: always merge if same item/storage
      // For PRODUCTION: merge if same item/storage AND created very recently (within 5 mins) to avoid accidental duplicates
      const existing = dlcHistory.find(h => {
          if (h.itemId !== itemId || h.storageId !== storageId) return false;
          if (type === 'OPENING') return true;
          
          // For PRODUCTION, check if it's recent (within 5 mins)
          const hTime = new Date(h.openedAt).getTime();
          const nowTime = new Date(now).getTime();
          return Math.abs(nowTime - hTime) < 5 * 60 * 1000;
      });

      if (existing) {
          const updated: DLCHistory = { 
              ...existing, 
              openedAt: (type === 'OPENING' && isOpen) ? now : existing.openedAt,
              userName: currentUser?.name,
              isNotOpened: type === 'OPENING' ? !isOpen : existing.isNotOpened,
              quantity: parseFloat(((existing.quantity || 1) + quantity).toFixed(3))
          };
          setDlcHistory(prev => prev.map(h => h.id === existing.id ? updated : h));
          syncData('SAVE_DLC_HISTORY', updated);
      } else {
          const dlc: DLCHistory = {
              id: 'dlc_' + Date.now() + Math.random(),
              itemId,
              storageId,
              openedAt: now,
              userName: currentUser?.name,
              isNotOpened: type === 'OPENING' ? !isOpen : false,
              quantity: parseFloat(quantity.toFixed(3))
          };
          setDlcHistory(prev => [dlc, ...prev]);
          syncData('SAVE_DLC_HISTORY', dlc);
      }
  };

  const handlePinInput = useCallback((num: string) => {
    if (loginStatus !== 'idle' || loginInput.length >= 4 || lockoutUntil) return;
    const newPin = loginInput + num;
    setLoginInput(newPin);
    if (newPin.length === 4) {
      const found = users.find(u => u.pin === newPin);
      if (found) { 
          setLoginStatus('success'); 
          setFailedAttempts(0);
          setLockoutDurationIndex(0);
          
          // ENREGISTREMENT DU LOG DE CONNEXION ICI
          const logEntry = {
              id: 'log_' + Date.now(),
              userName: found.name,
              action: 'LOGIN',
              details: 'Connexion réussie',
              timestamp: new Date().toISOString()
          };
          syncData('SAVE_LOG', logEntry);
          setUserLogs(prev => [logEntry, ...prev]);

          setTimeout(() => { 
              setCurrentUser(found); 
              setLoginStatus('idle'); 
              setLoginInput(''); 
              
              let firstAllowedView = 'dashboard';
              if (found.role !== 'ADMIN') {
                  const profile = roleProfiles.find(p => p.id === found.profileId);
                  const perms = profile?.permissions;
                  const allowedItem = menuItems.find(item => perms?.[item.resource]?.view);
                  if (allowedItem) {
                      firstAllowedView = allowedItem.id;
                  }
              }
              setView(firstAllowedView);
          }, 600); 
      }
      else { 
          setLoginStatus('error'); 
          const newFailedAttempts = failedAttempts + 1;
          setFailedAttempts(newFailedAttempts);

          if (newFailedAttempts >= 3) {
              const duration = LOCKOUT_DURATIONS[Math.min(lockoutDurationIndex, LOCKOUT_DURATIONS.length - 1)];
              setLockoutUntil(Date.now() + duration * 1000);
              setLockoutTimeLeft(duration);
              setLockoutDurationIndex(prev => prev + 1);
              setFailedAttempts(0); // Reset attempts after lockout starts
          }

          setTimeout(() => { 
              if (!lockoutUntil) {
                  setLoginStatus('idle'); 
              }
              setLoginInput(''); 
          }, 1000); 
      }
    }
  }, [loginInput, loginStatus, users, failedAttempts, lockoutUntil, lockoutDurationIndex]);

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">CHARGEMENT...</div>;
  
  if (!currentUser) return (
    <div className="h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-w-sm w-full">
        <div className="bg-indigo-600 p-8 text-center text-white">
            <h1 className="font-black text-xl uppercase tracking-widest">BarStock Pro</h1>
            {lockoutUntil && (
                <div className="mt-2 bg-rose-500/20 text-rose-200 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">
                    Sécurité : Réessayez dans {lockoutTimeLeft}s
                </div>
            )}
        </div>
        <div className={`p-8 transition-opacity duration-300 ${lockoutUntil ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex justify-center gap-4 mb-8">
                {[0,1,2,3].map(i=>(
                    <div key={i} className={`w-4 h-4 rounded-full transition-all ${loginInput.length > i ? 'bg-indigo-600 scale-110' : 'bg-slate-200'} ${loginStatus === 'error' ? 'bg-rose-500 animate-bounce' : ''}`}></div>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
                {[1,2,3,4,5,6,7,8,9, 'C', 0, '←'].map(n=>(
                    <button 
                        key={n.toString()} 
                        disabled={!!lockoutUntil}
                        onClick={()=> n === '←' ? setLoginInput(p=>p.slice(0,-1)) : n==='C' ? setLoginInput('') : handlePinInput(n.toString())} 
                        className="aspect-square rounded-full bg-slate-50 text-slate-700 font-black text-2xl shadow-sm border hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {n}
                    </button>
                ))}
            </div>
            {failedAttempts > 0 && !lockoutUntil && (
                <p className="text-center mt-4 text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                    {failedAttempts} essai{failedAttempts > 1 ? 's' : ''} infructueux
                </p>
            )}
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
            {filteredMenuItems.map(item => (
                <NavItem 
                    key={item.id}
                    collapsed={isSidebarCollapsed} 
                    active={view.startsWith(item.id)} 
                    onClick={() => setView(item.id)} 
                    label={item.label} 
                    icon={item.icon}
                    badge={item.badge}
                />
            ))}
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
                <button onClick={() => setView('configuration')} className={`flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'configuration' ? 'bg-indigo-600 text-white' : ''}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066" /></svg></button>
            </div>
            <button onClick={() => {setCurrentUser(null); setView('dashboard');}} className="w-full bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-rose-900/20">{!isSidebarCollapsed && "Déconnexion"}<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg></button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 relative">
          {isTestMode && <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black uppercase px-2 py-1 z-[100] rounded-bl-lg">Mode Test Actif - Aucune Sauvegarde</div>}
          {view === 'dashboard' && <Dashboard items={items} stockLevels={stockLevels} consignes={consignes} categories={categories} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} userRole={currentUser.role} transactions={transactions} messages={messages} events={events} tasks={tasks} currentUserName={currentUser.name} onNavigate={setView} onSendMessage={(text) => { const m: Message = { id: 'msg_'+Date.now(), content: text, userName: currentUser.name, date: new Date().toISOString(), isArchived: false, readBy: [] }; setMessages(p=>[m, ...p]); syncData('SAVE_MESSAGE', m); }} onArchiveMessage={(id) => { setMessages(p=>p.map(m=>m.id===id?{...m, isArchived:true}:m)); syncData('UPDATE_MESSAGE', {id, isArchived:true}); }} appConfig={appConfig} dailyCocktails={dailyCocktails} recipes={recipes} glassware={glassware} onUpdateDailyCocktail={(dc) => { setDailyCocktails(prev => { const idx = prev.findIndex(c => c.id === dc.id); if (idx >= 0) { const copy = [...prev]; copy[idx] = dc; return copy; } return [...prev, dc]; }); syncData('SAVE_DAILY_COCKTAIL', dc); }} mealReservations={mealReservations} users={users} />}
          {view === 'messages' && <MessagesView messages={messages} currentUserRole={currentUser.role} currentUserName={currentUser.name} onSync={syncData} setMessages={setMessages} />}
          {view.startsWith('daily_life') && <DailyLife tasks={tasks} events={events} eventComments={eventComments} currentUser={currentUser} items={items} onSync={syncData} setTasks={setTasks} setEvents={setEvents} setEventComments={setEventComments} dailyCocktails={dailyCocktails} setDailyCocktails={setDailyCocktails} recipes={recipes} onCreateTemporaryItem={(n,q)=> { const it: StockItem = {id:'t_'+Date.now(), name:n, category:'Autre', formatId:'f1', pricePerUnit:0, lastUpdated:new Date().toISOString(), isTemporary:true, order:items.length }; setItems(p=>[...p, it]); syncData('SAVE_ITEM', it); if(q>0){ const c={itemId:it.id, storageId:'s0', minQuantity:q}; setConsignes(p=>[...p, c]); syncData('SAVE_CONSIGNE', c); } return it.id; }} stockLevels={stockLevels} orders={orders} glassware={glassware} appConfig={appConfig} saveConfig={saveConfig} initialTab={view.includes(':') ? view.split(':')[1] : 'TASKS'} cocktailCategories={cocktailCategories} onEditTask={handleEditTask} mealReservations={mealReservations} setMealReservations={setMealReservations} users={users} />}
          {view === 'bar_prep' && (
            <BarPrep 
              items={items} 
              storages={storages} 
              stockLevels={stockLevels} 
              consignes={consignes} 
              priorities={priorities} 
              transactions={transactions} 
              onAction={handleRestockAction} 
              categories={categories} 
              dlcProfiles={dlcProfiles} 
              dlcHistory={dlcHistory} 
              onUpdateDlc={handleUpdateDlc} 
              onAddDlc={handleAddDlc}
              onDeleteDlc={(id, qtyLostPercent) => {
                const target = dlcHistory.find(h => h.id === id); 
                if(target) { 
                    const item = items.find(i => i.id === target.itemId);
                    const profile = item?.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
                    const durationHours = profile?.durationHours || 24;
                    const expirationDate = new Date(new Date(target.openedAt).getTime() + durationHours * 3600000);
                    const isExpired = new Date() > expirationDate;

                    if (qtyLostPercent && qtyLostPercent > 0) {
                        const lossQty = qtyLostPercent / 100;
                        const loss: Loss = { 
                            id: 'loss_'+Date.now(), 
                            itemId: target.itemId, 
                            openedAt: target.openedAt, 
                            discardedAt: new Date().toISOString(), 
                            quantity: lossQty, 
                            userName: currentUser?.name 
                        }; 
                        setLosses(p=>[loss,...p]); 
                        syncData('SAVE_LOSS', loss); 
                    }

                    if (isExpired) {
                        if (qtyLostPercent && qtyLostPercent > 0) {
                            handleTransaction(target.itemId, 'OUT', 1, false, "Produit expiré jeté");
                        }
                    } else {
                        if (qtyLostPercent && qtyLostPercent > 0) {
                            handleTransaction(target.itemId, 'OUT', 1, false, "Produit jeté");
                        }
                    }

                    setDlcHistory(p => p.filter(h => h.id !== id)); 
                    syncData('DELETE_DLC_HISTORY', { id }); 
                }
              }}
              userRole={currentUser.role} 
            />
          )}
          {view === 'restock' && <CaveRestock items={items} storages={storages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} unfulfilledOrders={unfulfilledOrders} onCreateTemporaryItem={(n,q)=> { const it: StockItem = {id:'t_'+Date.now(), name:n, category:'Autre', formatId:'f1', pricePerUnit:0, lastUpdated:new Date().toISOString(), isTemporary:true, order:items.length }; setItems(p=>[...p, it]); syncData('SAVE_ITEM', it); if(q>0){ const c={itemId:it.id, storageId:'s0', minQuantity:q}; setConsignes(p=>[...p, c]); syncData('SAVE_CONSIGNE', c); } return it.id; }} orders={orders} currentUser={currentUser} events={events} dlcProfiles={dlcProfiles} />}
          {view === 'movements' && <Movements items={items} transactions={transactions} storages={storages} onTransaction={handleTransaction} onOpenKeypad={()=>{}} unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={(id, q) => { const unf = { id: 'unf_'+Date.now(), itemId:id, date:new Date().toISOString(), userName:currentUser.name, quantity:q }; setUnfulfilledOrders(p=>[unf, ...p]); syncData('SAVE_UNFULFILLED_ORDER', unf); }} formats={formats} dlcProfiles={dlcProfiles} dlcHistory={dlcHistory} onDlcEntry={handleAddDlc} onDlcConsumption={(id) => handleDlcConsumption(id)} onCreateTemporaryItem={(n,q)=> { const it: StockItem = {id:'t_'+Date.now(), name:n, category:'Autre', formatId:'f1', pricePerUnit:0, lastUpdated:new Date().toISOString(), isTemporary:true, order:items.length }; setItems(p=>[...p, it]); syncData('SAVE_ITEM', it); if(q>0){ const c={itemId:it.id, storageId:'s0', minQuantity:q}; setConsignes(p=>[...p, c]); syncData('SAVE_CONSIGNE', c); } return it.id; }} onUndo={handleUndoLastTransaction} />}
          {view === 'stock_table' && <StockTable items={items} storages={storages} stockLevels={stockLevels} setStockLevels={setStockLevels} priorities={priorities} onUpdateStock={handleUpdateStock} consignes={consignes} onAdjustTransaction={handleQuickAdjust} currentUser={currentUser} onSync={syncData} canEdit={canEdit('inventory')} />}
          {view === 'inventory' && <GlobalInventory items={items} setItems={setItems} storages={storages} stockLevels={stockLevels} categories={categories} consignes={consignes} onSync={syncData} onUpdateStock={handleUpdateStock} formats={formats} canEdit={canEdit('global_inventory')} />}
          {view === 'consignes' && <Consignes items={items} storages={storages} consignes={consignes} priorities={priorities} setConsignes={setConsignes} onSync={syncData} canEdit={canEdit('consignes')} />}
          {view === 'orders' && <Order orders={orders} items={items} storages={storages} onUpdateOrder={(id, q, s, r) => { setOrders(prev => prev.map(o => o.id === id ? { ...o, quantity: q, status: s || o.status, ruptureDate: r } : o)); syncData('SAVE_ORDER', { id, quantity: q, status: s, ruptureDate: r }); }} onDeleteOrder={(id) => { setOrders(prev => prev.filter(o => o.id !== id)); syncData('DELETE_ORDER', { id }); }} onAddManualOrder={(itemId, qty) => { 
              const existing = orders.find(o => o.itemId === itemId && o.status === 'PENDING');
              if (existing) {
                  const updated = { ...existing, quantity: (existing.quantity || 0) + qty };
                  setOrders(prev => prev.map(o => o.id === existing.id ? updated : o));
                  syncData('SAVE_ORDER', updated);
              } else {
                  const order: PendingOrder = { id: 'ord_' + Date.now(), itemId, quantity: qty, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name }; 
                  setOrders(prev => [...prev, order]); 
                  syncData('SAVE_ORDER', order); 
              }
          }} formats={formats} events={events} emailTemplates={emailTemplates} />}
          {view === 'history' && (
            <History 
              transactions={transactions} 
              orders={orders} 
              items={items} 
              storages={storages} 
              unfulfilledOrders={unfulfilledOrders} 
              formats={formats} 
              losses={losses} 
              dailyStockAlerts={dailyAlerts} 
              appConfig={appConfig} 
              userRole={currentUser.role}
              onUpdateLoss={handleUpdateLoss}
              onDeleteDailyAlert={(id) => { 
                setDailyAlerts(prev => prev.filter(a => a.id !== id)); 
                syncData('DELETE_DAILY_STOCK_ALERT', { id }); 
              }} 
              onUpdateOrderQuantity={(ids: string[], q: number) => { 
                ids.forEach(id => { 
                  const o = orders.find(ord => ord.id === id); 
                  if (o) { 
                    const updated = { ...o, status: 'RECEIVED' as const, receivedAt: new Date().toISOString(), quantity: q }; 
                    setOrders(p => p.map(x => x.id === id ? updated : x)); 
                    syncData('SAVE_ORDER', updated); 
                  } 
                }); 
              }} 
            />
          )}
          {view === 'dlc_tracking' && (
            <DLCView 
              items={items} 
              dlcHistory={dlcHistory} 
              dlcProfiles={dlcProfiles} 
              storages={storages} 
              transactions={transactions}
              onDelete={(id, qtyLostPercent) => { 
                const target = dlcHistory.find(h => h.id === id); 
                if(target) { 
                    const item = items.find(i => i.id === target.itemId);
                    const profile = item?.dlcProfileId ? dlcProfiles.find(p => p.id === item.dlcProfileId) : null;
                    const durationHours = profile?.durationHours || 24;
                    const expirationDate = new Date(new Date(target.openedAt).getTime() + durationHours * 3600000);
                    const isExpired = new Date() > expirationDate;

                    // Loss recording logic: 10% = 0.1, 50% = 0.5, 100% = 1.0
                    // Ne pas enregistrer dans perte et gaspillage les produits jetés à 0 %
                    if (qtyLostPercent && qtyLostPercent > 0) {
                        const lossQty = qtyLostPercent / 100;
                        const loss: Loss = { 
                            id: 'loss_'+Date.now(), 
                            itemId: target.itemId, 
                            openedAt: target.openedAt, 
                            discardedAt: new Date().toISOString(), 
                            quantity: lossQty, 
                            userName: currentUser?.name 
                        }; 
                        setLosses(p=>[loss,...p]); 
                        syncData('SAVE_LOSS', loss); 
                    }

                    // Stock deduction logic:
                    // Si on jette un produit DLC expiré, ne pas déduire des stocks si 0 % de perte. 
                    // Déduire 1 des stocks si supérieur à 0 % de perte.
                    if (isExpired) {
                        if (qtyLostPercent && qtyLostPercent > 0) {
                            handleTransaction(target.itemId, 'OUT', 1, false, "Produit expiré jeté");
                        }
                    } else {
                        // Si pas encore expiré mais jeté, on déduit 1 (sauf si 0% ?)
                        // On suit la même logique par cohérence
                        if (qtyLostPercent && qtyLostPercent > 0) {
                            handleTransaction(target.itemId, 'OUT', 1, false, "Produit jeté");
                        }
                    }

                    setDlcHistory(p => p.filter(h => h.id !== id)); 
                    syncData('DELETE_DLC_HISTORY', { id }); 
                } 
              }} 
              onUpdateDlc={handleUpdateDlc} 
              userRole={currentUser.role} 
              onAddDlc={handleAddDlc} 
            />
          )}
          {view === 'articles' && <ArticlesList items={items} setItems={setItems} formats={formats} categories={categories} onDelete={(id) => { setItems(p => p.filter(i => i.id !== id)); syncData('DELETE_ITEM', {id}); }} userRole={currentUser.role} dlcProfiles={dlcProfiles} onSync={syncData} events={events} recipes={recipes} />}
          {view === 'recipes' && <RecipesView recipes={recipes} items={items} glassware={glassware} currentUser={currentUser} appConfig={appConfig} onSync={syncData} setRecipes={setRecipes} techniques={techniques} cocktailCategories={cocktailCategories} stockLevels={stockLevels} formats={formats} />}
          {view === 'product_knowledge' && <ProductKnowledge sheets={productSheets} items={items} currentUserRole={currentUser.role} onSync={syncData} productTypes={productTypes} glassware={glassware} formats={formats} stockLevels={stockLevels} consignes={consignes} />}
          {view === 'admin_prices' && currentUser.role === 'ADMIN' && <AdminPrices items={items} productSheets={productSheets} formats={formats} appConfig={appConfig} onSync={syncData} setProductSheets={setProductSheets} recipes={recipes} setRecipes={setRecipes} />}
          {view === 'configuration' && <Configuration setItems={setItems} setStorages={setStorages} setFormats={setFormats} storages={storages} formats={formats} priorities={priorities} setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} items={items} categories={categories} setCategories={setCategories} users={users} setUsers={setUsers} currentUser={currentUser} dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} appConfig={appConfig} setAppConfig={setAppConfig} glassware={glassware} setGlassware={setGlassware} techniques={techniques} setTechniques={setTechniques} cocktailCategories={cocktailCategories} setCocktailCategories={setCocktailCategories} productTypes={productTypes} setProductTypes={setProductTypes} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} fullData={{items, storages, stockLevels}} roleProfiles={roleProfiles} setRoleProfiles={setRoleProfiles} userLogs={userLogs} />}
      </main>

      {/* MODAL RÉGULATION DLC */}
      {regulationDlcModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Régulation DLC</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                Vous diminuez le stock de <strong className="text-slate-900">{regulationDlcModal.itemName}</strong>.<br/>
                Est-ce parce qu'un produit <strong className="text-indigo-600">OUVERT</strong> a été terminé ou jeté ?
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    const { itemId, storageId, newQty, currentQty, note } = regulationDlcModal;
                    const delta = newQty - currentQty;
                    
                    syncData('SAVE_STOCK', {itemId, storageId, currentQuantity: newQty});
                    setStockLevels(prev => {
                      const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
                      if (exists) return prev.map(l => l.itemId === itemId && l.storageId === storageId ? { ...l, currentQuantity: newQty } : l);
                      return [...prev, { itemId, storageId, currentQuantity: newQty }];
                    });

                    const transaction: Transaction = {
                      id: 'reg_' + Date.now(),
                      itemId,
                      storageId,
                      type: 'OUT',
                      quantity: Math.abs(delta),
                      date: new Date().toISOString(),
                      userName: currentUser?.name,
                      note: note || 'Régulation (Produit Ouvert)'
                    };
                    setTransactions(prev => [transaction, ...prev]);
                    syncData('SAVE_TRANSACTION', transaction);
                    
                    // Consume DLC
                    handleDlcConsumption(itemId, storageId, Math.abs(delta));
                    setRegulationDlcModal(null);
                  }}
                  className="bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Oui, Ouvert
                </button>
                <button 
                  onClick={() => {
                    const { itemId, storageId, newQty, currentQty, note } = regulationDlcModal;
                    const delta = newQty - currentQty;

                    syncData('SAVE_STOCK', {itemId, storageId, currentQuantity: newQty});
                    setStockLevels(prev => {
                      const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
                      if (exists) return prev.map(l => l.itemId === itemId && l.storageId === storageId ? { ...l, currentQuantity: newQty } : l);
                      return [...prev, { itemId, storageId, currentQuantity: newQty }];
                    });

                    const transaction: Transaction = {
                      id: 'reg_' + Date.now(),
                      itemId,
                      storageId,
                      type: 'OUT',
                      quantity: Math.abs(delta),
                      date: new Date().toISOString(),
                      userName: currentUser?.name,
                      note: note || 'Régulation (Fermé/Perte)'
                    };
                    setTransactions(prev => [transaction, ...prev]);
                    syncData('SAVE_TRANSACTION', transaction);
                    
                    setRegulationDlcModal(null);
                  }}
                  className="bg-slate-100 text-slate-600 p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                >
                  Non, Fermé
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdminLogbook && currentUser && <AdminLogbook currentUser={currentUser} onSync={syncData} onClose={() => setShowAdminLogbook(false)} />}
    </div>
  );
};
export default App;
