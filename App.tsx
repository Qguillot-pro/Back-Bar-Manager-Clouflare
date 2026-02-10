
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StockItem, Category, StorageSpace, Format, Transaction, StockLevel, StockConsigne, StockPriority, PendingOrder, DLCHistory, User, DLCProfile, UnfulfilledOrder, AppConfig, Message, Glassware, Recipe, Technique, Loss, UserLog, Task, Event, EventComment, DailyCocktail, CocktailCategory } from './types';
import Dashboard from './components/Dashboard';
import StockTable from './components/StockTable';
import Movements from './components/Movements';
import ArticlesList from './components/ArticlesList';
import CaveRestock from './components/CaveRestock';
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

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
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
  
  const [view, setView] = useState<'dashboard' | 'movements' | 'inventory' | 'articles' | 'restock' | 'config' | 'consignes' | 'orders' | 'dlc_tracking' | 'history' | 'messages' | 'recipes' | 'daily_life' | 'logs' | 'global_inventory'>('dashboard');
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
        if (data.appConfig) setAppConfig(data.appConfig);
        setIsOffline(false);
        
        // Lance le chargement lourd en arrière-plan
        fetchFullData();

    } catch (error: any) {
        console.warn("Passage en mode Hors Ligne:", error);
        setIsOffline(true);
        setConnectionError(error.message);
        loadLocalData();
    } finally {
        setLoading(false);
    }
  };

  // Phase 2: Full Data Sync (En arrière-plan)
  const fetchFullData = async () => {
      setDataSyncing(true);
      try {
          const response = await fetch('/api/data_sync');
          if (!response.ok) throw new Error("Erreur Chargement Données");
          
          const data = await response.json();
          if (data && data.items) {
              setItems(data.items || []);
              setStorages(data.storages || []);
              setStockLevels((data.stockLevels || []).map((l: any) => ({...l, currentQuantity: Number(l.currentQuantity)})));
              setConsignes((data.consignes || []).map((c: any) => ({...c, minQuantity: Number(c.minQuantity), maxCapacity: c.maxCapacity ? Number(c.maxCapacity) : undefined})));
              setTransactions((data.transactions || []).map((t: any) => ({...t, quantity: Number(t.quantity)})));
              setOrders((data.orders || []).map((o: any) => ({...o, quantity: Number(o.quantity), initialQuantity: o.initialQuantity ? Number(o.initialQuantity) : undefined})));
              setDlcHistory(data.dlcHistory || []);
              setFormats(data.formats || []);
              setCategories(data.categories || []);
              setDlcProfiles(data.dlcProfiles || []);
              setPriorities((data.priorities || []).map((p: any) => ({...p, priority: Number(p.priority)})));
              setUnfulfilledOrders((data.unfulfilledOrders || []).map((u: any) => ({...u, quantity: u.quantity ? Number(u.quantity) : 1})));
              setMessages(data.messages || []);
              setGlassware(data.glassware || []);
              setRecipes(data.recipes || []);
              setTechniques(data.techniques || []);
              setLosses(data.losses || []);
              setUserLogs(data.userLogs || []);
              setTasks(data.tasks || []);
              setEvents(data.events || []);
              setEventComments(data.eventComments || []);
              
              if (data.cocktailCategories && data.cocktailCategories.length > 0) {
                  setCocktailCategories(data.cocktailCategories);
              } else {
                  setCocktailCategories([
                      { id: 'cc1', name: 'Signature' },
                      { id: 'cc2', name: 'Classique' },
                      { id: 'cc3', name: 'Mocktail' },
                      { id: 'cc4', name: 'Tiki' },
                      { id: 'cc5', name: 'After Dinner' }
                  ]);
              }
              setDailyCocktails(data.dailyCocktails || []);
          }
      } catch (e) {
          console.error("Échec chargement background", e);
          // On ne passe pas hors ligne, on garde les données locales si dispo
          // setNotification({ title: 'Attention', message: 'Sync données incomplète', type: 'error' });
      } finally {
          setDataSyncing(false);
      }
  };

  useEffect(() => { fetchAuthData(); }, []);

  // Check notifications (Events today)
  useEffect(() => {
      const todayEvents = events.filter(e => {
          const eDate = new Date(e.startTime);
          const now = new Date();
          return eDate.toDateString() === now.toDateString();
      });
      if (todayEvents.length > 0 && !notification) {
          // setNotification({ title: 'Agenda', message: `${todayEvents.length} événement(s) prévu(s) aujourd'hui !`, type: 'info' });
      }
  }, [events]);

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

  const initDemoData = () => { /* ... */ };
  
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
      const db = { items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, categories, formats, dlcProfiles, priorities, unfulfilledOrders, appConfig, messages, glassware, recipes, techniques, losses, tasks, events, eventComments, cocktailCategories, dailyCocktails };
      localStorage.setItem('barstock_local_db', JSON.stringify(db));
    }
  }, [items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, loading, dataSyncing, unfulfilledOrders, appConfig, messages, glassware, recipes, techniques, losses, tasks, events, eventComments, cocktailCategories, dailyCocktails]);

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

  const handleStockUpdate = (itemId: string, storageId: string, newQty: number) => {
    setStockLevels(prev => {
      const exists = prev.find(l => l.itemId === itemId && l.storageId === storageId);
      if (exists) return prev.map(l => (l.itemId === itemId && l.storageId === storageId) ? { ...l, currentQuantity: newQty } : l);
      return [...prev, { itemId, storageId, currentQuantity: newQty }];
    });
    syncData('SAVE_STOCK', { itemId, storageId, currentQuantity: newQty });
  };

  // --- LOGIQUE DLC AVANCÉE ---
  const handleDlcEntry = (itemId: string, storageId: string, type: 'OPENING' | 'PRODUCTION') => {
      const newEntry: DLCHistory = {
          id: 'dlc_' + Date.now() + Math.random().toString(36).substr(2,5),
          itemId,
          storageId,
          openedAt: new Date().toISOString(),
          userName: currentUser?.name
      };

      if (type === 'OPENING') {
          // Règle : Une seule bouteille ouverte par article
          // On supprime les anciennes entrées avant d'ajouter la nouvelle (mise à jour date)
          const itemsToRemove = dlcHistory.filter(h => h.itemId === itemId);
          setDlcHistory(prev => [...prev.filter(h => h.itemId !== itemId), newEntry]);
          
          itemsToRemove.forEach(h => syncData('DELETE_DLC_HISTORY', { id: h.id }));
          syncData('SAVE_DLC_HISTORY', newEntry);
      } else {
          // Règle : Production (plusieurs lots possibles) -> On ajoute simplement
          setDlcHistory(prev => [...prev, newEntry]);
          syncData('SAVE_DLC_HISTORY', newEntry);
      }
  };

  const handleDlcConsumption = (itemId: string) => {
      // Pour la production frais : on consomme (supprime) le plus vieux lot
      const relevantDlcs = dlcHistory.filter(h => h.itemId === itemId).sort((a,b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
      
      if (relevantDlcs.length > 0) {
          const oldest = relevantDlcs[0];
          setDlcHistory(prev => prev.filter(h => h.id !== oldest.id));
          syncData('DELETE_DLC_HISTORY', { id: oldest.id });
      }
  };

  const handleDlcLoss = (id: string, qtyLostPercent: number) => {
      const dlc = dlcHistory.find(h => h.id === id);
      if (!dlc) return;

      const item = items.find(i => i.id === dlc.itemId);
      const profile = dlcProfiles.find(p => p.id === item?.dlcProfileId);
      
      const qtyLost = parseFloat((qtyLostPercent / 100).toFixed(2));
      
      // 1. Enregistrer la perte (SEULEMENT SI > 0%)
      if (qtyLost > 0) {
          const newLoss: Loss = {
              id: 'loss_' + Date.now(),
              itemId: dlc.itemId,
              openedAt: dlc.openedAt,
              discardedAt: new Date().toISOString(),
              quantity: qtyLost,
              userName: currentUser?.name
          };
          setLosses(prev => [newLoss, ...prev]);
          syncData('SAVE_LOSS', newLoss);
      }

      // 2. Déduire du stock (PRODUCTION SEULEMENT)
      // Car "Ouverture" a déjà été déduit du stock lors de l'ouverture (OUT)
      if (profile?.type === 'PRODUCTION') {
          // On déduit la quantité totale du lot (qui est jeté ou fini)
          const currentLevel = stockLevels.find(l => l.itemId === dlc.itemId && l.storageId === dlc.storageId);
          if (currentLevel) {
              const newQty = Math.max(0, currentLevel.currentQuantity - 1);
              handleStockUpdate(dlc.itemId, dlc.storageId, newQty);
              
              // Log transaction
              const trans: Transaction = {
                  id: 't_loss_' + Date.now(),
                  itemId: dlc.itemId,
                  storageId: dlc.storageId,
                  type: 'OUT',
                  quantity: 1, // On sort 1 unité complète du stock car elle part à la poubelle ou est finie
                  date: new Date().toISOString(),
                  userName: currentUser?.name,
                  // Si 0% perdu, c'est une fin normale de lot, sinon c'est une perte
                  note: qtyLost > 0 ? `Perte DLC (Reste: ${qtyLostPercent}%)` : `Fin Lot DLC (Vide)`
              };
              setTransactions(prev => [trans, ...prev]);
              syncData('SAVE_TRANSACTION', trans);
          }
      }

      // 3. Supprimer de la liste DLC
      setDlcHistory(prev => prev.filter(h => h.id !== id));
      syncData('DELETE_DLC_HISTORY', { id });
  };

  // --- REFACTOR LOGIQUE TRANSACTION ---
  const handleTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number) => {
      // Cette fonction est appelée par Movements.tsx pour les mouvements standards
      // Les logiques spécifiques DLC sont gérées en amont dans Movements ou via les nouveaux handlers DLC
      
      const itemPriorities = priorities.filter(p => p.itemId === itemId).sort((a,b) => b.priority - a.priority);
      const getStorageQty = (sId: string) => stockLevels.find(l => l.itemId === itemId && l.storageId === sId)?.currentQuantity || 0;

      if (type === 'OUT') {
          let remaining = qty;
          
          // 1. PRIORITÉ SURSTOCK (S0)
          const s0Qty = getStorageQty('s0');
          if (s0Qty > 0) {
              const deduction = Math.min(s0Qty, remaining);
              handleStockUpdate(itemId, 's0', s0Qty - deduction);
              const trans: Transaction = { id: Math.random().toString(36).substr(2, 9), itemId, storageId: 's0', type: 'OUT', quantity: deduction, date: new Date().toISOString(), userName: currentUser?.name, note: 'Sortie Prioritaire Surstock' };
              setTransactions(prev => [trans, ...prev]); syncData('SAVE_TRANSACTION', trans);
              return; 
          }

          // 2. SORTIE STANDARD
          for (const prio of itemPriorities) {
              if (remaining <= 0) break;
              const q = getStorageQty(prio.storageId);
              if (q > 0) {
                  const take = Math.min(q, remaining);
                  handleStockUpdate(itemId, prio.storageId, q - take);
                  const trans: Transaction = { id: Math.random().toString(36).substr(2,9), itemId, storageId: prio.storageId, type: 'OUT', quantity: take, date: new Date().toISOString(), userName: currentUser?.name };
                  setTransactions(p=>[trans, ...p]); syncData('SAVE_TRANSACTION', trans);
                  remaining -= take;
              }
          }
          if (remaining > 0) {
              // Si pas de stock prioritaire, on tape dans le dernier dispo ou s0
              const fallbackStorage = itemPriorities.length > 0 ? itemPriorities[0].storageId : 's0';
              const q = getStorageQty(fallbackStorage);
              handleStockUpdate(itemId, fallbackStorage, q - remaining); // Allow negative for s0/fallback
              const trans: Transaction = { id: Math.random().toString(36).substr(2,9), itemId, storageId: fallbackStorage, type: 'OUT', quantity: remaining, date: new Date().toISOString(), userName: currentUser?.name };
              setTransactions(p=>[trans, ...p]); syncData('SAVE_TRANSACTION', trans);
          }
      } 
      else { // IN
          let remaining = qty;
          for (const prio of itemPriorities) {
              if (remaining <= 0) break;
              if (prio.storageId === 's0') continue;
              const current = getStorageQty(prio.storageId);
              if (current > 0 && current % 1 !== 0) continue; // Pas de remplissage bouteille entamée
              const consigne = consignes.find(c => c.itemId === itemId && c.storageId === prio.storageId);
              const target = consigne?.maxCapacity ?? consigne?.minQuantity ?? 0;
              if (target > 0 && current < target) {
                  const space = Math.floor(target - current); 
                  const fill = Math.min(space, remaining);
                  if (fill > 0) {
                      handleStockUpdate(itemId, prio.storageId, current + fill);
                      const trans: Transaction = { id: Math.random().toString(36).substr(2,9), itemId, storageId: prio.storageId, type: 'IN', quantity: fill, date: new Date().toISOString(), userName: currentUser?.name };
                      setTransactions(p=>[trans, ...p]); syncData('SAVE_TRANSACTION', trans);
                      remaining -= fill;
                  }
              }
          }
          if (remaining > 0) {
              const qS0 = getStorageQty('s0');
              handleStockUpdate(itemId, 's0', qS0 + remaining);
              const trans: Transaction = { id: Math.random().toString(36).substr(2,9), itemId, storageId: 's0', type: 'IN', quantity: remaining, date: new Date().toISOString(), userName: currentUser?.name };
              setTransactions(p=>[trans, ...p]); syncData('SAVE_TRANSACTION', trans);
          }
      }
  };

  const handleRestockAction = (itemId: string, storageId: string, qtyToAdd: number, qtyToOrder: number = 0, isRupture: boolean = false) => {
      if (qtyToAdd > 0) {
          const s0Qty = stockLevels.find(l => l.itemId === itemId && l.storageId === 's0')?.currentQuantity || 0;
          handleStockUpdate(itemId, 's0', Math.max(0, s0Qty - qtyToAdd));
          const destQty = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId)?.currentQuantity || 0;
          handleStockUpdate(itemId, storageId, destQty + qtyToAdd);
          const trans: Transaction = { id: Math.random().toString(36).substr(2,9), itemId, storageId, type: 'IN', quantity: qtyToAdd, date: new Date().toISOString(), isCaveTransfer: true, userName: currentUser?.name };
          setTransactions(p => [trans, ...p]); syncData('SAVE_TRANSACTION', trans);
      }
      if (qtyToOrder > 0 || isRupture) {
          const existing = orders.find(o => o.itemId === itemId && o.status === 'PENDING');
          if (existing) {
              const updated = { ...existing, quantity: existing.quantity + qtyToOrder, ruptureDate: isRupture ? new Date().toISOString() : existing.ruptureDate };
              setOrders(p => p.map(o => o.id === existing.id ? updated : o)); syncData('SAVE_ORDER', updated);
          } else {
              const newOrder: PendingOrder = { id: Math.random().toString(36).substr(2,9), itemId, quantity: qtyToOrder > 0 ? qtyToOrder : 1, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name, ruptureDate: isRupture ? new Date().toISOString() : undefined };
              setOrders(p => [...p, newOrder]); syncData('SAVE_ORDER', newOrder);
          }
      }
  };

  const handleUnfulfilledOrder = (itemId: string, quantity: number = 1) => {
      const unf: UnfulfilledOrder = { id: Math.random().toString(36).substr(2, 9), itemId, date: new Date().toISOString(), userName: currentUser?.name, quantity };
      setUnfulfilledOrders(prev => [unf, ...prev]); syncData('SAVE_UNFULFILLED_ORDER', unf);
      handleRestockAction(itemId, 's0', 0, quantity, true);
  };
  const handleCreateTemporaryItem = (name: string, q: number) => {
      const newItem: StockItem = { id: 'temp_' + Date.now(), name, category: 'Produits Temporaires', formatId: 'f1', pricePerUnit: 0, lastUpdated: new Date().toISOString(), isTemporary: true, order: 9999, createdAt: new Date().toISOString() };
      setItems(prev => [...prev, newItem]); syncData('SAVE_ITEM', newItem);
      if (q > 0) { setConsignes(prev => [...prev, { itemId: newItem.id, storageId: 's0', minQuantity: q }]); syncData('SAVE_CONSIGNE', { itemId: newItem.id, storageId: 's0', minQuantity: q }); }
  };
  const handleDeleteItem = (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); syncData('DELETE_ITEM', {id}); };
  const handleDeleteDlcHistory = (id: string, qtyLostPercent?: number) => { 
      // Cette fonction est appelée par DLCView pour la poubelle/perte
      handleDlcLoss(id, qtyLostPercent || 0);
  };
  const handleOrderUpdate = (orderId: string, quantity: number, status: any = 'PENDING', ruptureDate?: string) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, quantity, status, ruptureDate: ruptureDate !== undefined ? ruptureDate : o.ruptureDate } : o));
      const order = orders.find(o => o.id === orderId);
      if (order) syncData('SAVE_ORDER', { ...order, quantity, status, ruptureDate: ruptureDate !== undefined ? ruptureDate : order.ruptureDate });
  };
  const handleDeleteOrder = (orderId: string) => { setOrders(prev => prev.filter(o => o.id !== orderId)); };
  const handleAddManualOrder = (itemId: string, qty: number) => { 
      const newOrder: PendingOrder = { id: Math.random().toString(36).substr(2, 9), itemId, quantity: qty, date: new Date().toISOString(), status: 'PENDING', userName: currentUser?.name };
      setOrders(prev => [...prev, newOrder]); syncData('SAVE_ORDER', newOrder);
  };
  
  const handleUndoLastTransaction = () => {
      if (transactions.length === 0) return;
      const last = transactions[0]; 
      
      if (!window.confirm(`Annuler le mouvement : ${last.type} ${last.quantity} (${items.find(i=>i.id===last.itemId)?.name}) ?`)) return;

      const currentLevel = stockLevels.find(l => l.itemId === last.itemId && l.storageId === last.storageId);
      const currentQty = currentLevel?.currentQuantity || 0;
      let newQty = currentQty;

      if (last.type === 'IN') {
          newQty = Math.max(0, currentQty - last.quantity);
      } else {
          newQty = currentQty + last.quantity;
      }

      handleStockUpdate(last.itemId, last.storageId, newQty);
      setTransactions(prev => prev.filter(t => t.id !== last.id));
      syncData('DELETE_TRANSACTION', { id: last.id });
  };

  const handleSendMessage = (text: string) => {
    if (!currentUser) return;
    const newMessage: Message = { id: 'msg_' + Date.now(), content: text, userName: currentUser.name, date: new Date().toISOString(), isArchived: false, readBy: [currentUser.id] };
    setMessages(prev => [newMessage, ...prev]); syncData('SAVE_MESSAGE', newMessage);
  };

  const handleArchiveMessage = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isArchived: true } : m)); syncData('UPDATE_MESSAGE', { id, isArchived: true });
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">CHARGEMENT...</div>;
  
  if (!currentUser) {
     return (
       <div className="h-screen bg-slate-900 flex items-center justify-center p-4">
         <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-w-sm w-full relative">
           {connectionError && (
               <div className="absolute top-0 left-0 w-full bg-rose-500 text-white text-[10px] font-bold p-3 text-center z-10 animate-in slide-in-from-top flex items-center justify-center gap-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
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
      {isTestMode && <div className="fixed top-0 left-0 right-0 h-2 bg-rose-500 z-[1000]"></div>}
      
      {/* SIDEBAR */}
      <aside className={`bg-slate-950 text-white flex flex-col md:sticky top-0 md:h-screen z-50 transition-all duration-300 ${isSidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'}`}>
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
          <NavItem collapsed={isSidebarCollapsed} active={view === 'restock'} onClick={() => setView('restock')} label="Préparation Cave" icon="M19 14l-7 7m0 0l-7-7m7 7V3" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'movements'} onClick={() => setView('movements')} label="Mouvements" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'inventory'} onClick={() => setView('inventory')} label="Stock Global" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'global_inventory'} onClick={() => setView('global_inventory')} label="Stock Total Établissement" icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'orders'} onClick={() => setView('orders')} label="À Commander" icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" badge={orders.filter(o => o && o.status === 'PENDING').length} />
          
          <div className="my-2 border-t border-white/5"></div>
          
          <NavItem collapsed={isSidebarCollapsed} active={view === 'recipes'} onClick={() => setView('recipes')} label="Fiches Techniques" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          <div className="my-2 border-t border-white/5"></div>
          <NavItem collapsed={isSidebarCollapsed} active={view === 'history'} onClick={() => setView('history')} label="Historique" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'dlc_tracking'} onClick={() => setView('dlc_tracking')} label="Suivi DLC" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'messages'} onClick={() => setView('messages')} label="Messagerie" icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" badge={unreadMessagesCount} />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'daily_life'} onClick={() => setView('daily_life')} label="Vie Quotidienne" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" badge={activeTasksCount + todayEventsCount} />

          <div className="pt-4 mt-4 border-t border-white/5">
              <button onClick={() => setIsGestionOpen(!isGestionOpen)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors`} title="Gestion">
                  {!isSidebarCollapsed && <span>Gestion</span>}
                  {isSidebarCollapsed ? <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg> : <svg className={`w-3 h-3 transition-transform ${isGestionOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
              </button>
              
              {isGestionOpen && (
                  <div className={`space-y-1 mt-1 ${isSidebarCollapsed ? '' : 'pl-2'}`}>
                      <NavItem collapsed={isSidebarCollapsed} active={view === 'consignes'} onClick={() => setView('consignes')} label="Consignes" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" small />
                      <NavItem collapsed={isSidebarCollapsed} active={view === 'articles'} onClick={() => { setView('articles'); setArticlesFilter('ALL'); }} label="Base Articles" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" small />
                      {currentUser?.role === 'ADMIN' && (
                          <>
                            <NavItem collapsed={isSidebarCollapsed} active={view === 'config'} onClick={() => setView('config')} label="Configuration" icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" small />
                            <NavItem collapsed={isSidebarCollapsed} active={view === 'logs'} onClick={() => setView('logs')} label="Logs Connexion" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" small />
                          </>
                      )}
                  </div>
              )}
          </div>
        </nav>
        
        <div className="p-4 border-t border-white/5 bg-slate-900">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'}`}>
            <div className="flex flex-col">
                {!isSidebarCollapsed && (
                    <>
                        <span className="text-xs font-bold truncate max-w-[120px]">{currentUser?.name || 'Profil'}</span>
                        <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500' : (dataSyncing ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500')}`}></span>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isOffline ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {isOffline ? 'Mode Local' : (dataSyncing ? 'Sync...' : 'Connecté')}
                            </span>
                        </div>
                        {currentUser?.role === 'ADMIN' && (
                            <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                <div className={`w-6 h-3 rounded-full relative transition-colors ${isTestMode ? 'bg-rose-500' : 'bg-slate-600'}`}>
                                    <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${isTestMode ? 'left-3.5' : 'left-0.5'}`}></div>
                                </div>
                                <input type="checkbox" className="hidden" checked={isTestMode} onChange={(e) => setIsTestMode(e.target.checked)} />
                                <span className="text-[9px] uppercase font-bold text-rose-400">Test Mode</span>
                            </label>
                        )}
                    </>
                )}
            </div>
            
            <div className={`flex ${isSidebarCollapsed ? 'flex-col gap-2' : 'flex-row gap-2'}`}>
                <button onClick={handleManualRefresh} className="text-slate-400 hover:text-white p-1" title="Actualiser (Max 1/min)">
                    <svg className={`w-4 h-4 ${dataSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                <button onClick={() => setCurrentUser(null)} className="text-[10px] text-rose-400 font-black uppercase hover:text-rose-300 p-1" title="Se déconnecter">
                    {isSidebarCollapsed ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg> : 'Quitter'}
                </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        {view === 'dashboard' && (
            <Dashboard 
                items={sortedItems} stockLevels={stockLevels} consignes={consignes} categories={categories} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} userRole={currentUser?.role || 'BARMAN'} transactions={transactions} messages={messages} currentUserName={currentUser.name}
                events={events} tasks={tasks} dailyCocktails={dailyCocktails} recipes={recipes}
                onNavigate={(v) => { if (v === 'articles') { setView('articles'); setArticlesFilter('ALL'); } else setView(v as any); }}
                onSendMessage={handleSendMessage} onArchiveMessage={handleArchiveMessage}
            />
        )}
        {view === 'inventory' && <StockTable items={sortedItems} storages={sortedStorages} stockLevels={stockLevels} priorities={priorities} onUpdateStock={handleStockUpdate} consignes={consignes} />}
        
        {view === 'movements' && (
            <Movements 
                items={sortedItems} transactions={transactions} storages={sortedStorages} 
                onTransaction={handleTransaction} onOpenKeypad={() => {}} 
                unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={handleUnfulfilledOrder} 
                onCreateTemporaryItem={handleCreateTemporaryItem} formats={formats} 
                dlcProfiles={dlcProfiles} onUndo={handleUndoLastTransaction} 
                dlcHistory={dlcHistory} // NEW
                onDlcEntry={handleDlcEntry} // NEW
                onDlcConsumption={handleDlcConsumption} // NEW
            />
        )}
        
        {view === 'restock' && <CaveRestock items={sortedItems} storages={sortedStorages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} unfulfilledOrders={unfulfilledOrders} onCreateTemporaryItem={handleCreateTemporaryItem} orders={orders} currentUser={currentUser} events={events} />}
        {view === 'articles' && <ArticlesList items={sortedItems} setItems={setItems} formats={formats} categories={categories} userRole={currentUser?.role || 'BARMAN'} onDelete={handleDeleteItem} onSync={syncData} dlcProfiles={dlcProfiles} filter={articlesFilter} />}
        {view === 'consignes' && <Consignes items={sortedItems} storages={sortedStorages} consignes={consignes} priorities={priorities} setConsignes={setConsignes} onSync={syncData} />}
        {view === 'dlc_tracking' && <DLCView items={items} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} storages={sortedStorages} onDelete={handleDeleteDlcHistory} />}
        
        {view === 'config' && currentUser?.role === 'ADMIN' && (
            <Configuration setItems={setItems} setStorages={setStorages} setFormats={setFormats} storages={sortedStorages} formats={formats} priorities={priorities} setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} items={items} categories={categories} setCategories={setCategories} users={users} setUsers={setUsers} currentUser={currentUser} dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} appConfig={appConfig} setAppConfig={setAppConfig} glassware={glassware} setGlassware={setGlassware} techniques={techniques} setTechniques={setTechniques} cocktailCategories={cocktailCategories} setCocktailCategories={setCocktailCategories} />
        )}
        
        {view === 'history' && <History transactions={transactions} orders={orders} items={items} storages={sortedStorages} unfulfilledOrders={unfulfilledOrders} onUpdateOrderQuantity={() => {}} formats={formats} losses={losses} />}
        {view === 'messages' && <MessagesView messages={messages} currentUserRole={currentUser.role} currentUserName={currentUser.name} onSync={syncData} setMessages={setMessages} />}
        {view === 'orders' && <Order orders={orders} items={items} storages={storages} onUpdateOrder={handleOrderUpdate} onDeleteOrder={handleDeleteOrder} onAddManualOrder={handleAddManualOrder} formats={formats} />}
        {view === 'recipes' && <RecipesView recipes={recipes} items={items} glassware={glassware} currentUser={currentUser} appConfig={appConfig} onSync={syncData} setRecipes={setRecipes} techniques={techniques} cocktailCategories={cocktailCategories} />}
        
        {view === 'daily_life' && (
            <DailyLife tasks={tasks} events={events} eventComments={eventComments} currentUser={currentUser} items={items} onSync={syncData} setTasks={setTasks} setEvents={setEvents} setEventComments={setEventComments} dailyCocktails={dailyCocktails} setDailyCocktails={setDailyCocktails} recipes={recipes} />
        )}

        {view === 'logs' && currentUser?.role === 'ADMIN' && (
            <ConnectionLogs logs={userLogs} />
        )}

        {view === 'global_inventory' && (
            <GlobalInventory 
                items={items} 
                storages={storages} 
                stockLevels={stockLevels} 
                categories={categories} 
                consignes={consignes} 
                onSync={syncData} 
                onUpdateStock={handleStockUpdate} 
            />
        )}
      </main>
      {notification && <div className="fixed bottom-6 right-6 bg-white p-4 rounded-xl shadow-2xl border flex items-center gap-4 animate-in slide-in-from-right z-[100]"><span className="font-bold text-sm">{notification.message}</span><button onClick={() => setNotification(null)} className="text-indigo-600 font-black">OK</button></div>}
    </div>
  );
};

const NavItem = ({ active, onClick, label, icon, badge, small, collapsed }: any) => (
  <button onClick={onClick} className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} rounded-lg transition-all ${small ? 'px-3 py-2 text-[11px]' : 'px-3 py-2.5 text-xs'} ${active ? 'bg-indigo-600 text-white shadow-lg font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5 font-medium'}`} title={collapsed ? label : ''}>
    <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'}`}>
      <svg className={`${small ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
      {!collapsed && <span>{label}</span>}
    </div>
    {!collapsed && badge > 0 && <span className="bg-pink-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black">{badge}</span>}
    {collapsed && badge > 0 && <div className="absolute top-0 right-0 w-2 h-2 bg-pink-500 rounded-full"></div>}
  </button>
);

export default App;
