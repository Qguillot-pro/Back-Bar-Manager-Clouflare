
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StockItem, Category, StorageSpace, Format, Transaction, StockLevel, StockConsigne, StockPriority, PendingOrder, DLCHistory, User, DLCProfile, UnfulfilledOrder, AppConfig, Message, Glassware, Recipe, Technique, Loss } from './types';
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

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [tempUser, setTempUser] = useState<User | null>(null);
  
  // États UI
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Sidebar réduite
  const [isGestionOpen, setIsGestionOpen] = useState(true); 
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0); // Timestamp dernière actualisation

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
  
  // New States for Recipes & Losses
  const [glassware, setGlassware] = useState<Glassware[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [losses, setLosses] = useState<Loss[]>([]);
  
  const [view, setView] = useState<'dashboard' | 'movements' | 'inventory' | 'articles' | 'restock' | 'config' | 'consignes' | 'orders' | 'dlc_tracking' | 'history' | 'messages' | 'recipes'>('dashboard');
  const [articlesFilter, setArticlesFilter] = useState<'ALL' | 'TEMPORARY'>('ALL'); 
  const [notification, setNotification] = useState<{ title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [manualOrderSearch, setManualOrderSearch] = useState('');
  const [manualOrderQty, setManualOrderQty] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  const syncData = async (action: string, payload: any) => {
    if (isOffline) return;
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

  const fetchData = async () => {
    setLoading(true);
    setConnectionError(null);
    try {
      const response = await fetch('/api/init');
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || (contentType && !contentType.includes("application/json"))) {
          throw new Error("Mode Preview (Backend non disponible)");
      }

      const data = await response.json();
      
      if (data && data.items) {
        setIsOffline(false);
        setConnectionError(null);
        setItems(data.items || []);
        
        let fetchedUsers: User[] = data.users || [];
        if (!fetchedUsers.find(u => u.id === 'admin')) {
           fetchedUsers.push({ id: 'admin', name: 'Administrateur', role: 'ADMIN', pin: '2159' });
        }
        fetchedUsers = fetchedUsers.filter(u => u.id !== 'admin_secours');
        fetchedUsers.push({ id: 'admin_secours', name: 'Admin Secours', role: 'ADMIN', pin: '0407' });

        setUsers(fetchedUsers);
        setStorages(data.storages || []);
        setStockLevels((data.stockLevels || []).map((l: any) => ({...l, currentQuantity: Number(l.currentQuantity)})));
        setConsignes((data.consignes || []).map((c: any) => ({...c, minQuantity: Number(c.minQuantity)})));
        setTransactions((data.transactions || []).map((t: any) => ({...t, quantity: Number(t.quantity)})));
        setOrders((data.orders || []).map((o: any) => ({...o, quantity: Number(o.quantity), initialQuantity: o.initialQuantity ? Number(o.initialQuantity) : undefined})));
        setDlcHistory(data.dlcHistory || []);
        setFormats(data.formats || []);
        setCategories(data.categories || []);
        setDlcProfiles(data.dlcProfiles || []);
        setPriorities((data.priorities || []).map((p: any) => ({...p, priority: Number(p.priority)})));
        setUnfulfilledOrders(data.unfulfilledOrders || []);
        setMessages(data.messages || []);
        setGlassware(data.glassware || []);
        setRecipes(data.recipes || []);
        setTechniques(data.techniques || []);
        setLosses(data.losses || []);
        if (data.appConfig) setAppConfig(data.appConfig);
      } else {
          throw new Error("Structure de données invalide reçue de l'API");
      }
    } catch (error: any) {
      console.warn("Passage en mode Hors Ligne:", error);
      setIsOffline(true);
      if (!error.message.includes("Mode Preview")) {
          setConnectionError(error.message || "Erreur inconnue");
      }
      loadLocalData();
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleManualRefresh = async () => {
      const now = Date.now();
      // Limite : 60000ms = 1 minute
      if (now - lastRefreshTime < 60000) {
          const remaining = Math.ceil((60000 - (now - lastRefreshTime)) / 1000);
          setNotification({ title: 'Patience', message: `Actualisation possible dans ${remaining} sec.`, type: 'info' });
          setTimeout(() => setNotification(null), 3000);
          return;
      }

      await fetchData();
      setLastRefreshTime(now);
      setNotification({ title: 'Succès', message: 'Données actualisées', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
  };

  const initDemoData = () => {
        console.log("Initialisation Demo");
        setCategories(['Spiritueux', 'Vins', 'Bières', 'Softs', 'Ingrédients Cocktail', 'Autre']);
        setStorages([{ id: 's1', name: 'Frigo Soft', order: 1 }, { id: 's0', name: 'Surstock', order: 99 }]);
        setItems([{ 
          id: 'demo_1', 
          name: 'Vodka Absolut', 
          category: 'Spiritueux', 
          formatId: 'f1', 
          pricePerUnit: 15, 
          order: 1, 
          isDraft: false,
          lastUpdated: new Date().toISOString()
        }]);
        setMessages([{ id: 'm1', content: 'Bienvenue sur la démo !', userName: 'Système', date: new Date().toISOString(), isArchived: false, readBy: [] }]);
  };

  const loadLocalData = () => {
    const local = localStorage.getItem('barstock_local_db');
    if (local) {
      try {
        const d = JSON.parse(local);
        if (!d.items || d.items.length === 0) { initDemoData(); return; }
        setItems(d.items || []); 
        setUsers(d.users || []); 
        setStorages(d.storages || []);
        setStockLevels(d.stockLevels || []);
        setConsignes(d.consignes || []);
        setTransactions(d.transactions || []);
        setOrders(d.orders || []);
        setDlcHistory(d.dlcHistory || []);
        setCategories(d.categories || []);
        setFormats(d.formats || []);
        setPriorities(d.priorities || []);
        setDlcProfiles(d.dlcProfiles || []);
        setUnfulfilledOrders(d.unfulfilledOrders || []);
        setMessages(d.messages || []);
        setGlassware(d.glassware || []);
        setRecipes(d.recipes || []);
        setTechniques(d.techniques || []);
        setLosses(d.losses || []);
        if (d.appConfig) setAppConfig(d.appConfig);
      } catch (e) { initDemoData(); }
    } else { initDemoData(); }
  };

  useEffect(() => {
    if (!loading && !isOffline) {
      const db = { items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, categories, formats, dlcProfiles, priorities, unfulfilledOrders, appConfig, messages, glassware, recipes, techniques, losses };
      localStorage.setItem('barstock_local_db', JSON.stringify(db));
    }
  }, [items, users, storages, stockLevels, consignes, transactions, orders, dlcHistory, loading, isOffline, unfulfilledOrders, appConfig, messages, glassware, recipes, techniques, losses]);

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

  const handleSendMessage = (text: string) => {
      if (!currentUser) return;
      const msg: Message = {
          id: Math.random().toString(36).substr(2, 9),
          content: text,
          userName: currentUser.name,
          date: new Date().toISOString(),
          isArchived: false,
          readBy: [currentUser.id]
      };
      setMessages(prev => [msg, ...prev]);
      syncData('SAVE_MESSAGE', msg);
  };

  const handleArchiveMessage = (id: string) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isArchived: true } : m));
      syncData('UPDATE_MESSAGE', { id, isArchived: true });
  };

  const handleMarkMessageRead = (messageId: string) => {
      if (!currentUser) return;
      setMessages(prev => prev.map(m => {
          if (m.id === messageId && !m.readBy?.includes(currentUser.id)) {
              return { ...m, readBy: [...(m.readBy || []), currentUser.id] };
          }
          return m;
      }));
      syncData('MARK_MESSAGE_READ', { messageId, userId: currentUser.id });
  };

  const handleRestockAction = (itemId: string, storageId: string, qtyToAdd: number, qtyToOrder: number = 0, isRupture: boolean = false) => {
      // 1. Mise à jour du stock (Remontée)
      if (qtyToAdd > 0) {
          // On cherche d'où ça vient (Surstock s0 ou autre)
          const sourceId = 's0';
          const sourceLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === sourceId);
          const currentSourceQty = sourceLevel?.currentQuantity || 0;
          
          // Mettre à jour la source (Surstock) - Décrémenter
          handleStockUpdate(itemId, sourceId, Math.max(0, currentSourceQty - qtyToAdd));

          // Mettre à jour la destination (Bar) - Incrémenter
          const destLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === storageId);
          const currentDestQty = destLevel?.currentQuantity || 0;
          handleStockUpdate(itemId, storageId, currentDestQty + qtyToAdd);

          // Enregistrer la transaction
          const trans: Transaction = {
              id: Math.random().toString(36).substr(2, 9),
              itemId,
              storageId,
              type: 'IN',
              quantity: qtyToAdd,
              date: new Date().toISOString(),
              isCaveTransfer: true,
              userName: currentUser?.name
          };
          setTransactions(prev => [trans, ...prev]);
          syncData('SAVE_TRANSACTION', trans);
      }

      // 2. Gestion Commande / Rupture
      if (qtyToOrder > 0 || isRupture) {
          // Vérifier si une commande existe déjà
          const existingOrder = orders.find(o => o.itemId === itemId && o.status === 'PENDING');
          
          if (existingOrder) {
              const newQty = existingOrder.quantity + qtyToOrder;
              const updated = { ...existingOrder, quantity: newQty, ruptureDate: isRupture ? new Date().toISOString() : existingOrder.ruptureDate };
              setOrders(prev => prev.map(o => o.id === existingOrder.id ? updated : o));
              syncData('SAVE_ORDER', updated);
          } else {
              const newOrder: PendingOrder = {
                  id: Math.random().toString(36).substr(2, 9),
                  itemId,
                  quantity: qtyToOrder > 0 ? qtyToOrder : 1, // Par défaut 1 si rupture sans qté précisée
                  date: new Date().toISOString(),
                  status: 'PENDING',
                  userName: currentUser?.name,
                  ruptureDate: isRupture ? new Date().toISOString() : undefined
              };
              setOrders(prev => [...prev, newOrder]);
              syncData('SAVE_ORDER', newOrder);
          }
      }
  };

  // NOUVEAU: Logique de transaction universelle (pour Mouvements.tsx)
  const handleTransaction = (itemId: string, type: 'IN' | 'OUT', qty: number) => {
      // Pour un mouvement rapide, on doit déterminer quel stockage impacter.
      const itemPriorities = priorities.filter(p => p.itemId === itemId && p.storageId !== 's0').sort((a,b) => b.priority - a.priority);
      let targetStorageId = 's0'; // Fallback Surstock
      
      if (itemPriorities.length > 0) {
          targetStorageId = itemPriorities[0].storageId;
      } else {
          const firstStorage = storages.find(s => s.id !== 's0');
          if (firstStorage) targetStorageId = firstStorage.id;
      }

      // --- LOGIQUE ENTRÉE (IN) ---
      if (type === 'IN') {
          const targetLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === targetStorageId);
          const currentTargetQty = targetLevel?.currentQuantity || 0;
          const targetConsigne = consignes.find(c => c.itemId === itemId && c.storageId === targetStorageId)?.minQuantity || 0;

          // Si le stock (arrondi au sup) est déjà >= consigne, on redirige vers la priorité suivante ou le surstock
          if (targetConsigne > 0 && Math.ceil(currentTargetQty) >= targetConsigne) {
              const nextPriorityStorage = itemPriorities.find(p => p.storageId !== targetStorageId);
              targetStorageId = nextPriorityStorage ? nextPriorityStorage.storageId : 's0';
          }
          
          const currentLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === targetStorageId);
          const currentQty = currentLevel?.currentQuantity || 0;
          const newQty = currentQty + qty;

          handleStockUpdate(itemId, targetStorageId, newQty);
          
          const trans: Transaction = {
              id: Math.random().toString(36).substr(2, 9),
              itemId, storageId: targetStorageId, type, quantity: qty,
              date: new Date().toISOString(), isCaveTransfer: false, userName: currentUser?.name
          };
          setTransactions(prev => [trans, ...prev]);
          syncData('SAVE_TRANSACTION', trans);
      } 
      
      // --- LOGIQUE SORTIE (OUT) ---
      else {
          const currentLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === targetStorageId);
          const currentQty = currentLevel?.currentQuantity || 0;

          // CAS SPÉCIAL : Sortie d'une bouteille entamée (décimale) -> Remplacement auto
          if (qty === 1 && currentQty % 1 !== 0) {
              // 1. On cherche une bouteille de remplacement (Surstock ou autre)
              let sourceStorageId: string | null = 's0';
              let sourceLevel = stockLevels.find(l => l.itemId === itemId && l.storageId === 's0');

              // Si pas de surstock, on cherche ailleurs (sauf le target actuel)
              if (!sourceLevel || sourceLevel.currentQuantity < 1) {
                  const otherSource = stockLevels.find(l => l.itemId === itemId && l.storageId !== targetStorageId && l.currentQuantity >= 1);
                  if (otherSource) {
                      sourceStorageId = otherSource.storageId;
                      sourceLevel = otherSource;
                  } else {
                      sourceStorageId = null;
                  }
              }

              if (sourceStorageId && sourceLevel) {
                  // A. On déduit la source
                  handleStockUpdate(itemId, sourceStorageId, sourceLevel.currentQuantity - 1);

                  // B. On met à jour la cible : Entier inférieur (bouteille finie) + 1 (nouvelle)
                  handleStockUpdate(itemId, targetStorageId, Math.floor(currentQty) + 1);

                  // C. Transaction de Sortie
                  const transOut: Transaction = {
                      id: Math.random().toString(36).substr(2, 9),
                      itemId, storageId: targetStorageId, type: 'OUT', quantity: 1,
                      date: new Date().toISOString(), userName: currentUser?.name,
                      note: 'Fin bouteille (Auto-Remplacement)'
                  };
                  setTransactions(prev => [transOut, ...prev]);
                  syncData('SAVE_TRANSACTION', transOut);

                  // D. Transaction de Transfert
                  const transTransfer: Transaction = {
                      id: Math.random().toString(36).substr(2, 9),
                      itemId, storageId: targetStorageId, type: 'IN', quantity: 1,
                      date: new Date().toISOString(), userName: 'Système',
                      isCaveTransfer: true,
                      note: `Transfert Auto depuis ${storages.find(s=>s.id===sourceStorageId)?.name}`
                  };
                  setTransactions(prev => [transTransfer, ...prev]); 
                  syncData('SAVE_TRANSACTION', transTransfer);
                  return; // Stop ici
              } else {
                  // Pas de stock pour remplacer -> On jette juste (Math.floor)
                  handleStockUpdate(itemId, targetStorageId, Math.floor(currentQty));
                  
                  const trans: Transaction = {
                      id: Math.random().toString(36).substr(2, 9),
                      itemId, storageId: targetStorageId, type: 'OUT', quantity: 1,
                      date: new Date().toISOString(), userName: currentUser?.name,
                      note: 'Fin bouteille (Pas de stock remplacement)'
                  };
                  setTransactions(prev => [trans, ...prev]);
                  syncData('SAVE_TRANSACTION', trans);
                  return;
              }
          } 
          
          // Sortie Classique
          else {
              const newQty = Math.max(0, currentQty - qty);
              handleStockUpdate(itemId, targetStorageId, newQty);
              
              const trans: Transaction = {
                  id: Math.random().toString(36).substr(2, 9),
                  itemId, storageId: targetStorageId, type, quantity: qty,
                  date: new Date().toISOString(), isCaveTransfer: false, userName: currentUser?.name
              };
              setTransactions(prev => [trans, ...prev]);
              syncData('SAVE_TRANSACTION', trans);
          }
      }
  };

  const handleUnfulfilledOrder = (itemId: string) => {
      const unf: UnfulfilledOrder = {
          id: Math.random().toString(36).substr(2, 9),
          itemId,
          date: new Date().toISOString(),
          userName: currentUser?.name
      };
      setUnfulfilledOrders(prev => [unf, ...prev]);
      syncData('SAVE_UNFULFILLED_ORDER', unf);

      // Créer automatiquement une commande "En attente" pour ce produit
      handleRestockAction(itemId, 's0', 0, 1, true); // 0 remontée, 1 commande, isRupture=true
  };

  const handleCreateTemporaryItem = (name: string, q: number) => {
      const newItem: StockItem = {
          id: 'temp_' + Date.now(),
          name,
          category: 'Produits Temporaires',
          formatId: 'f1', // Défaut 70cl ou autre
          pricePerUnit: 0,
          lastUpdated: new Date().toISOString(),
          isTemporary: true,
          order: 9999,
          createdAt: new Date().toISOString()
      };
      setItems(prev => [...prev, newItem]);
      syncData('SAVE_ITEM', newItem);

      // Si quantité cible > 0, on définit une consigne temporaire sur le Surstock
      if (q > 0) {
          setConsignes(prev => [...prev, { itemId: newItem.id, storageId: 's0', minQuantity: q }]);
          syncData('SAVE_CONSIGNE', { itemId: newItem.id, storageId: 's0', minQuantity: q });
      }
  };

  const handleDeleteItem = (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); syncData('DELETE_ITEM', {id}); };
  
  // Suppression DLC avec gestion de perte optionnelle
  const handleDeleteDlcHistory = (id: string, qtyLost: number = 0) => { 
      // 1. Si perte déclarée, on enregistre
      if (qtyLost > 0) {
          const dlcItem = dlcHistory.find(h => h.id === id);
          if (dlcItem) {
              const loss: Loss = {
                  id: 'loss_' + Date.now(),
                  itemId: dlcItem.itemId,
                  openedAt: dlcItem.openedAt,
                  discardedAt: new Date().toISOString(),
                  quantity: qtyLost,
                  userName: currentUser?.name
              };
              setLosses(prev => [loss, ...prev]);
              syncData('SAVE_LOSS', loss);
          }
      }

      // 2. Suppression de l'historique DLC
      setDlcHistory(prev => prev.filter(h => h.id !== id)); 
      syncData('DELETE_DLC_HISTORY', {id}); 
  };

  // Logique de mise à jour des commandes (pour le composant Order)
  const handleOrderUpdate = (orderId: string, quantity: number, status: 'PENDING' | 'ORDERED' | 'RECEIVED' = 'PENDING', ruptureDate?: string) => {
      setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
              const updated = { 
                  ...o, 
                  quantity, 
                  status,
                  ruptureDate: ruptureDate !== undefined ? ruptureDate : o.ruptureDate,
                  orderedAt: status === 'ORDERED' && o.status !== 'ORDERED' ? new Date().toISOString() : o.orderedAt,
                  receivedAt: status === 'RECEIVED' && o.status !== 'RECEIVED' ? new Date().toISOString() : o.receivedAt,
                  // Si on passe à RECEIVED, on garde la quantité initiale pour l'historique si pas déjà fait
                  initialQuantity: status === 'RECEIVED' && !o.initialQuantity ? o.quantity : o.initialQuantity
              };
              syncData('SAVE_ORDER', updated);
              
              // Si REÇU, on incrémente le stock (Surstock par défaut pour les réceptions)
              if (status === 'RECEIVED' && o.status !== 'RECEIVED') {
                  const targetStorageId = 's0';
                  const currentLevel = stockLevels.find(l => l.itemId === o.itemId && l.storageId === targetStorageId);
                  const currentQty = currentLevel?.currentQuantity || 0;
                  handleStockUpdate(o.itemId, targetStorageId, currentQty + quantity);
              }
              
              return updated;
          }
          return o;
      }));
  };

  const handleDeleteOrder = (orderId: string) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
  };
  
  const handleAddManualOrder = (itemId: string, qty: number) => {
      const newOrder: PendingOrder = {
          id: Math.random().toString(36).substr(2, 9),
          itemId,
          quantity: qty,
          date: new Date().toISOString(),
          status: 'PENDING',
          userName: currentUser?.name
      };
      setOrders(prev => [...prev, newOrder]);
      syncData('SAVE_ORDER', newOrder);
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">CHARGEMENT...</div>;

  if (!currentUser) {
     return (
       <div className="h-screen bg-slate-900 flex items-center justify-center p-4">
         <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-w-sm w-full">
           <div className="bg-indigo-600 p-8 text-center">
             <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center text-indigo-600 font-black text-2xl shadow-lg">B</div>
             <h1 className="text-white font-black text-xl tracking-widest uppercase">BarStock Pro</h1>
             <p className="text-indigo-200 text-xs font-bold mt-2">Identification Requise</p>
           </div>
           
           <div className="p-8">
             <div className="flex justify-center gap-4 mb-8">
               {[0, 1, 2, 3].map(i => (
                 <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${loginInput.length > i ? 'bg-indigo-600 scale-110' : 'bg-slate-200'}`}></div>
               ))}
             </div>

             <div className="grid grid-cols-3 gap-4 mb-6">
               {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                 <button 
                   key={n} 
                   onClick={() => handlePinInput(n.toString())} 
                   className="aspect-square rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-black text-2xl transition-all active:scale-95 shadow-sm border border-slate-100"
                 >
                   {n}
                 </button>
               ))}
               <div className="aspect-square"></div>
               <button 
                 onClick={() => handlePinInput("0")} 
                 className="aspect-square rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-black text-2xl transition-all active:scale-95 shadow-sm border border-slate-100"
               >
                 0
               </button>
               <button 
                 onClick={() => setLoginInput(prev => prev.slice(0, -1))} 
                 className="aspect-square rounded-full bg-rose-50 text-rose-500 font-black flex items-center justify-center active:scale-95 transition-all"
               >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>
               </button>
             </div>
             
             {loginStatus === 'error' && (
                <p className="text-center text-rose-500 text-xs font-black uppercase animate-bounce">Code PIN Incorrect</p>
             )}
           </div>
         </div>
       </div>
     );
  }

  // Calcul du nombre de messages non lus pour l'utilisateur actuel
  const unreadMessagesCount = messages.filter(m => !m.isArchived && (!m.readBy || !m.readBy.includes(currentUser.id))).length;
  // Calcul du nombre de recettes en attente
  const pendingRecipesCount = recipes.filter(r => r.status === 'DRAFT').length;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      
      {/* SIDEBAR */}
      <aside className={`bg-slate-950 text-white flex flex-col md:sticky top-0 md:h-screen z-50 transition-all duration-300 ${isSidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-black text-xs shrink-0">B</div>
            {!isSidebarCollapsed && <h1 className="font-black text-sm uppercase tracking-widest truncate">BARSTOCK</h1>}
          </div>
          {/* BOUTON COLLAPSE (Desktop Only) */}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className="hidden md:flex text-slate-500 hover:text-white transition-colors"
            title={isSidebarCollapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               {isSidebarCollapsed 
                 ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /> 
                 : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
               }
             </svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <NavItem collapsed={isSidebarCollapsed} active={view === 'dashboard'} onClick={() => setView('dashboard')} label="Tableau de Bord" icon="M4 6h16M4 12h16M4 18h16" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'restock'} onClick={() => setView('restock')} label="Préparation Cave" icon="M19 14l-7 7m0 0l-7-7m7 7V3" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'movements'} onClick={() => setView('movements')} label="Mouvements" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'inventory'} onClick={() => setView('inventory')} label="Stock Global" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'orders'} onClick={() => setView('orders')} label="À Commander" icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" badge={orders.filter(o => o && o.status === 'PENDING').length} />
          
          <div className="my-2 border-t border-white/5"></div>
          
          <NavItem collapsed={isSidebarCollapsed} active={view === 'recipes'} onClick={() => setView('recipes')} label="Fiches Techniques" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" badge={currentUser.role === 'ADMIN' ? pendingRecipesCount : 0} />
          
          <div className="my-2 border-t border-white/5"></div>

          <NavItem collapsed={isSidebarCollapsed} active={view === 'history'} onClick={() => setView('history')} label="Historique" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'dlc_tracking'} onClick={() => setView('dlc_tracking')} label="Suivi DLC" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <NavItem collapsed={isSidebarCollapsed} active={view === 'messages'} onClick={() => setView('messages')} label="Messagerie" icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" badge={unreadMessagesCount} />

          {/* GROUPE GESTION */}
          <div className="pt-4 mt-4 border-t border-white/5">
              <button 
                onClick={() => setIsGestionOpen(!isGestionOpen)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors`}
                title="Gestion"
              >
                  {!isSidebarCollapsed && <span>Gestion</span>}
                  {isSidebarCollapsed ? (
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                  ) : (
                      <svg className={`w-3 h-3 transition-transform ${isGestionOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  )}
              </button>
              
              {isGestionOpen && (
                  <div className={`space-y-1 mt-1 ${isSidebarCollapsed ? '' : 'pl-2'}`}>
                      <NavItem collapsed={isSidebarCollapsed} active={view === 'consignes'} onClick={() => setView('consignes')} label="Consignes" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" small />
                      <NavItem collapsed={isSidebarCollapsed} active={view === 'articles'} onClick={() => { setView('articles'); setArticlesFilter('ALL'); }} label="Base Articles" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" small />
                      {currentUser?.role === 'ADMIN' && <NavItem collapsed={isSidebarCollapsed} active={view === 'config'} onClick={() => setView('config')} label="Configuration" icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" small />}
                  </div>
              )}
          </div>
        </nav>
        
        {/* FOOTER USER & REFRESH */}
        <div className="p-4 border-t border-white/5 bg-slate-900">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'}`}>
            <div className="flex flex-col">
                {!isSidebarCollapsed && (
                    <>
                        <span className="text-xs font-bold truncate max-w-[120px]">{currentUser?.name || 'Profil'}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isOffline ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {isOffline ? 'Mode Démo' : 'Connecté'}
                        </span>
                    </>
                )}
                {isSidebarCollapsed && (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-black text-xs">
                        {currentUser?.name?.charAt(0) || 'U'}
                    </div>
                )}
            </div>
            
            <div className={`flex ${isSidebarCollapsed ? 'flex-col gap-2' : 'flex-row gap-2'}`}>
                {/* BOUTON ACTUALISER */}
                <button 
                    onClick={handleManualRefresh} 
                    className="text-slate-400 hover:text-white p-1" 
                    title="Actualiser (Max 1/min)"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                
                {/* BOUTON QUITTER */}
                <button onClick={() => setCurrentUser(null)} className="text-[10px] text-rose-400 font-black uppercase hover:text-rose-300 p-1" title="Se déconnecter">
                    {isSidebarCollapsed ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    ) : 'Quitter'}
                </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        {view === 'dashboard' && (
            <Dashboard 
                items={sortedItems} 
                stockLevels={stockLevels} 
                consignes={consignes} 
                categories={categories} 
                dlcHistory={dlcHistory} 
                dlcProfiles={dlcProfiles} 
                userRole={currentUser?.role || 'BARMAN'} 
                transactions={transactions}
                messages={messages}
                currentUserName={currentUser.name}
                onNavigate={(v) => {
                    if (v === 'articles') { setView('articles'); setArticlesFilter('ALL'); }
                    else setView(v as any);
                }}
                onSendMessage={handleSendMessage}
                onArchiveMessage={handleArchiveMessage}
            />
        )}
        {view === 'inventory' && <StockTable items={sortedItems} storages={sortedStorages} stockLevels={stockLevels} priorities={priorities} onUpdateStock={handleStockUpdate} consignes={consignes} />}
        {view === 'movements' && <Movements items={sortedItems} transactions={transactions} storages={sortedStorages} onTransaction={handleTransaction} onOpenKeypad={() => {}} unfulfilledOrders={unfulfilledOrders} onReportUnfulfilled={handleUnfulfilledOrder} onCreateTemporaryItem={handleCreateTemporaryItem} formats={formats} />}
        {view === 'restock' && <CaveRestock items={sortedItems} storages={sortedStorages} stockLevels={stockLevels} consignes={consignes} priorities={priorities} transactions={transactions} onAction={handleRestockAction} categories={categories} unfulfilledOrders={unfulfilledOrders} onCreateTemporaryItem={handleCreateTemporaryItem} orders={orders} />}
        {view === 'articles' && <ArticlesList items={sortedItems} setItems={setItems} formats={formats} categories={categories} userRole={currentUser?.role || 'BARMAN'} onDelete={handleDeleteItem} onSync={syncData} dlcProfiles={dlcProfiles} filter={articlesFilter} />}
        {view === 'consignes' && <Consignes items={sortedItems} storages={sortedStorages} consignes={consignes} priorities={priorities} setConsignes={setConsignes} onSync={syncData} />}
        {view === 'dlc_tracking' && <DLCView items={items} dlcHistory={dlcHistory} dlcProfiles={dlcProfiles} storages={sortedStorages} onDelete={handleDeleteDlcHistory} />}
        
        {view === 'config' && currentUser?.role === 'ADMIN' && (
            <Configuration 
                setItems={setItems} setStorages={setStorages} setFormats={setFormats} 
                storages={sortedStorages} formats={formats} priorities={priorities} 
                setPriorities={setPriorities} consignes={consignes} setConsignes={setConsignes} 
                items={items} categories={categories} setCategories={setCategories} 
                users={users} setUsers={setUsers} currentUser={currentUser} 
                dlcProfiles={dlcProfiles} setDlcProfiles={setDlcProfiles} onSync={syncData} 
                appConfig={appConfig} setAppConfig={setAppConfig}
                glassware={glassware} setGlassware={setGlassware}
                techniques={techniques} setTechniques={setTechniques}
            />
        )}
        
        {view === 'history' && <History transactions={transactions} orders={orders} items={items} storages={sortedStorages} unfulfilledOrders={unfulfilledOrders} onUpdateOrderQuantity={() => {}} formats={formats} losses={losses} />}
        {view === 'messages' && <MessagesView messages={messages} currentUserRole={currentUser.role} currentUserName={currentUser.name} onSync={syncData} setMessages={setMessages} />}
        
        {view === 'orders' && (
            <Order 
              orders={orders} 
              items={items} 
              storages={storages} 
              onUpdateOrder={handleOrderUpdate} 
              onDeleteOrder={handleDeleteOrder} 
              onAddManualOrder={handleAddManualOrder}
              formats={formats}
            />
        )}

        {view === 'recipes' && (
            <RecipesView 
                recipes={recipes} 
                items={items} 
                glassware={glassware} 
                currentUser={currentUser} 
                appConfig={appConfig} 
                onSync={syncData} 
                setRecipes={setRecipes}
                techniques={techniques} 
            />
        )}
      </main>
      {notification && <div className="fixed bottom-6 right-6 bg-white p-4 rounded-xl shadow-2xl border flex items-center gap-4 animate-in slide-in-from-right z-[100]"><span className="font-bold text-sm">{notification.message}</span><button onClick={() => setNotification(null)} className="text-indigo-600 font-black">OK</button></div>}
    </div>
  );
};

const NavItem = ({ active, onClick, label, icon, badge, small, collapsed }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} rounded-lg transition-all ${small ? 'px-3 py-2 text-[11px]' : 'px-3 py-2.5 text-xs'} ${active ? 'bg-indigo-600 text-white shadow-lg font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5 font-medium'}`}
    title={collapsed ? label : ''}
  >
    <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'}`}>
      <svg className={`${small ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
      {!collapsed && <span>{label}</span>}
    </div>
    {!collapsed && badge > 0 && <span className="bg-pink-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black">{badge}</span>}
    {collapsed && badge > 0 && <div className="absolute top-0 right-0 w-2 h-2 bg-pink-500 rounded-full"></div>}
  </button>
);

export default App;
