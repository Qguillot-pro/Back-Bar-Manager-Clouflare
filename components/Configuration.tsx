
import React, { useState, useEffect } from 'react';
import { Category, StockItem, StorageSpace, Format, StockPriority, StockConsigne, User, DLCProfile, UserRole, AppConfig, Glassware, Technique, CocktailCategory, EmailTemplate, ProductType } from '../types';
import PriorityConfig from './PriorityConfig';
import GlasswareConfig from './GlasswareConfig';
import TechniquesConfig from './TechniquesConfig';
import CocktailCategoriesConfig from './CocktailCategoriesConfig';
import ImportData from './ImportData';
import EmailConfig from './EmailConfig';
import ProductTypesConfig from './ProductTypesConfig';

interface ConfigProps {
  setItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setStorages: React.Dispatch<React.SetStateAction<StorageSpace[]>>;
  setFormats: React.Dispatch<React.SetStateAction<Format[]>>;
  storages: StorageSpace[];
  formats: Format[];
  priorities: StockPriority[];
  setPriorities: React.Dispatch<React.SetStateAction<StockPriority[]>>;
  consignes: StockConsigne[];
  setConsignes: React.Dispatch<React.SetStateAction<StockConsigne[]>>;
  items: StockItem[];
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
  dlcProfiles: DLCProfile[];
  setDlcProfiles: React.Dispatch<React.SetStateAction<DLCProfile[]>>;
  onSync: (action: string, payload: any) => void;
  appConfig: AppConfig;
  setAppConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  glassware?: Glassware[];
  setGlassware?: React.Dispatch<React.SetStateAction<Glassware[]>>;
  techniques?: Technique[];
  setTechniques?: React.Dispatch<React.SetStateAction<Technique[]>>;
  cocktailCategories?: CocktailCategory[];
  setCocktailCategories?: React.Dispatch<React.SetStateAction<CocktailCategory[]>>;
  fullData?: any; // For Backup
  emailTemplates?: EmailTemplate[];
  setEmailTemplates?: React.Dispatch<React.SetStateAction<EmailTemplate[]>>;
  productTypes?: ProductType[];
  setProductTypes?: React.Dispatch<React.SetStateAction<ProductType[]>>;
}

const Configuration: React.FC<ConfigProps> = ({ 
  setItems, setStorages, setFormats, storages, formats, priorities, setPriorities, consignes, setConsignes, items,
  categories, setCategories, users, setUsers, currentUser, dlcProfiles, setDlcProfiles, onSync, appConfig, setAppConfig,
  glassware = [], setGlassware, techniques = [], setTechniques, cocktailCategories = [], setCocktailCategories, fullData,
  emailTemplates = [], setEmailTemplates, productTypes = [], setProductTypes
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'priorities' | 'users' | 'dlc' | 'glassware' | 'techniques' | 'cocktail_cats' | 'product_types' | 'email' | 'backup' | 'credits' | 'import'>('general');
  const [authorizedSubTabs, setAuthorizedSubTabs] = useState<Set<string>>(new Set());
  const [authPinInput, setAuthPinInput] = useState('');
  
  // Item States
  const [itemName, setItemName] = useState('');
  const [itemArticleCode, setItemArticleCode] = useState(''); 
  const [itemCat, setItemCat] = useState('');
  const [itemFormat, setItemFormat] = useState('');
  const [itemIsDlc, setItemIsDlc] = useState(false);
  const [itemDlcProfile, setItemDlcProfile] = useState('');
  const [itemIsConsigne, setItemIsConsigne] = useState(false);

  const [storageName, setStorageName] = useState('');
  const [formatName, setFormatName] = useState('');
  const [formatValue, setFormatValue] = useState<number>(0); 
  const [newCatName, setNewCatName] = useState('');
  
  // User Management State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('BARMAN');
  const [newUserShowInMeal, setNewUserShowInMeal] = useState(true);
  const [visiblePins, setVisiblePins] = useState<Set<string>>(new Set());

  // DLC Profile State
  const [newDlcName, setNewDlcName] = useState('');
  const [newDlcDuration, setNewDlcDuration] = useState<number>(24);
  const [newDlcType, setNewDlcType] = useState<'OPENING' | 'PRODUCTION'>('OPENING');
  
  React.useEffect(() => {
      if (!itemCat && categories && categories.length > 0) setItemCat(categories[0]);
      if (!itemFormat && formats && formats.length > 0) setItemFormat(formats[0]?.id || '');
  }, [categories, formats]);

  const handleTabChange = (tab: typeof activeSubTab) => {
      if (tab === 'users' && !authorizedSubTabs.has('users')) {
          setAuthPinInput('');
      }
      setActiveSubTab(tab);
  };

  const checkAuth = (targetTab: string) => {
      if (authPinInput === currentUser.pin) {
          setAuthorizedSubTabs(prev => new Set(prev).add(targetTab));
      } else {
          alert("Code PIN incorrect");
          setAuthPinInput('');
      }
  };

  const handleConfigChange = (field: keyof AppConfig, value: any) => {
      setAppConfig(prev => ({ ...prev, [field]: value }));
      const key = field === 'tempItemDuration' ? 'temp_item_duration' : 'default_margin';
      onSync('SAVE_CONFIG', { key, value });
  };

  const addProduct = () => { if (!itemName) return; const newItem: StockItem = { id: Math.random().toString(36).substr(2, 9), articleCode: itemArticleCode, name: itemName, category: itemCat, formatId: itemFormat, pricePerUnit: 0, lastUpdated: new Date().toISOString(), isDLC: itemIsDlc, dlcProfileId: itemIsDlc ? itemDlcProfile : undefined, isConsigne: itemIsConsigne, order: items.length, isDraft: true }; setItems(prev => [...prev, newItem]); onSync('SAVE_ITEM', newItem); setItemName(''); setItemArticleCode(''); setItemIsDlc(false); };
  
  const addFormat = () => { if (!formatName) return; const newFormat: Format = { id: 'f' + Date.now(), name: formatName, value: formatValue, order: formats.length + 1 }; setFormats(prev => [...prev, newFormat]); onSync('SAVE_FORMAT', newFormat); setFormatName(''); setFormatValue(0); };
  const deleteFormat = (id: string) => { setFormats(prev => prev.filter(f => f.id !== id)); onSync('DELETE_FORMAT', { id }); };
  const moveFormat = (idx: number, dir: 'up'|'down') => {
      if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === formats.length - 1)) return;
      const c = [...formats];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      [c[idx], c[swapIdx]] = [c[swapIdx], c[idx]];
      setFormats(c);
      onSync('REORDER_FORMATS', { formats: c.map(f => f.id) });
  };

  const addCategory = () => { if (!newCatName) return; setCategories(prev => [...prev, newCatName]); onSync('SAVE_CATEGORY', { name: newCatName }); setNewCatName(''); };
  const deleteCategory = (cat: Category) => { setCategories(prev => prev.filter(c => c !== cat)); onSync('DELETE_CATEGORY', { name: cat }); };
  const moveCategory = (idx: number, dir: 'up'|'down') => {
      if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === categories.length - 1)) return;
      const c = [...categories];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      [c[idx], c[swapIdx]] = [c[swapIdx], c[idx]];
      setCategories(c);
      onSync('REORDER_CATEGORIES', { categories: c });
  };

  const addStorage = () => { if (!storageName) return; const newStorage = { id: 's' + Date.now(), name: storageName }; setStorages(prev => [...prev, newStorage]); onSync('SAVE_STORAGE', newStorage); setStorageName(''); };
  const deleteStorage = (id: string) => { setStorages(prev => prev.filter(st => st.id !== id)); onSync('DELETE_STORAGE', { id }); };
  const moveStorage = (idx: number, dir: 'up'|'down') => {
      if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === storages.length - 1)) return;
      const c = [...storages];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      [c[idx], c[swapIdx]] = [c[swapIdx], c[idx]];
      
      // Update order property locally
      c.forEach((s, i) => s.order = i);
      setStorages(c);
      
      // Sync each position
      c.forEach((s, i) => onSync('SAVE_STORAGE_ORDER', { id: s.id, order: i }));
  };
  
  const handleSaveUser = () => { 
      if (!newUserName || !newUserPin) return; 
      const userToSave: User = { 
          id: editingUserId || 'u' + Date.now(), 
          name: newUserName, 
          role: newUserRole, 
          pin: newUserPin,
          showInMealPlanning: newUserShowInMeal
      }; 
      
      if (editingUserId) {
          setUsers(prev => prev.map(u => u.id === editingUserId ? userToSave : u));
      } else {
          setUsers(prev => [...prev, userToSave]); 
      }
      
      onSync('SAVE_USER', userToSave); 
      setNewUserName(''); setNewUserPin(''); setEditingUserId(null); setNewUserRole('BARMAN'); setNewUserShowInMeal(true);
  };

  const startEditUser = (u: User) => {
      setEditingUserId(u.id);
      setNewUserName(u.name);
      setNewUserPin(u.pin);
      setNewUserRole(u.role);
      setNewUserShowInMeal(u.showInMealPlanning !== false);
  };

  const cancelEditUser = () => {
      setEditingUserId(null);
      setNewUserName('');
      setNewUserPin('');
      setNewUserRole('BARMAN');
      setNewUserShowInMeal(true);
  };
  
  const deleteUser = (id: string) => {
      if (id === currentUser.id) { alert("Vous ne pouvez pas vous supprimer vous-même."); return; }
      if (window.confirm("Supprimer cet utilisateur ?")) {
          setUsers(prev => prev.filter(u => u.id !== id));
      }
  };

  const revealPin = (userId: string) => {
      setVisiblePins(prev => new Set(prev).add(userId));
      setTimeout(() => {
          setVisiblePins(prev => {
              const newSet = new Set(prev);
              newSet.delete(userId);
              return newSet;
          });
      }, 60000); // 1 minute
  };

  const handleAddDlcProfile = () => {
      if (!newDlcName) return;
      const newProfile: DLCProfile = {
          id: 'dlc_' + Date.now(),
          name: newDlcName,
          durationHours: newDlcDuration,
          type: newDlcType
      };
      setDlcProfiles(prev => [...prev, newProfile]);
      onSync('SAVE_DLC_PROFILE', newProfile);
      setNewDlcName('');
      setNewDlcDuration(24);
  };

  const handleDeleteDlcProfile = (id: string) => {
      if (window.confirm("Supprimer ce profil DLC ?")) {
          setDlcProfiles(prev => prev.filter(p => p.id !== id));
          onSync('DELETE_DLC_PROFILE', { id });
      }
  };
  
  const handleExportBackup = () => {
      if (!fullData) return;
      const json = JSON.stringify(fullData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_barstock_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              JSON.parse(content);
              if (window.confirm("ATTENTION : Cette action va tenter de restaurer les données.\nContinuer ?")) {
                  alert("Fonctionnalité en cours de finalisation.");
              }
          } catch (err) { alert("Format invalide."); }
      };
      reader.readAsText(file);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => handleTabChange('general')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Paramètres Généraux</button>
        <button onClick={() => handleTabChange('priorities')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'priorities' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Priorités Stock</button>
        {currentUser?.role === 'ADMIN' && (
          <>
            <button onClick={() => handleTabChange('product_types')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'product_types' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Types Produits</button>
            <button onClick={() => handleTabChange('glassware')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'glassware' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Verrerie</button>
            <button onClick={() => handleTabChange('techniques')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'techniques' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Techniques</button>
            <button onClick={() => handleTabChange('cocktail_cats')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'cocktail_cats' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Catégories Cocktails</button>
            <button onClick={() => handleTabChange('users')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Utilisateurs</button>
            <button onClick={() => handleTabChange('dlc')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'dlc' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Configuration DLC</button>
            <button onClick={() => handleTabChange('email')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'email' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Emails & Commandes</button>
            <button onClick={() => handleTabChange('backup')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'backup' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Sauvegarde</button>
            <button onClick={() => handleTabChange('credits')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest border-b-2 whitespace-nowrap ${activeSubTab === 'credits' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Crédits</button>
          </>
        )}
      </div>

      {activeSubTab === 'email' && setEmailTemplates && (
          <EmailConfig appConfig={appConfig} setAppConfig={setAppConfig} templates={emailTemplates} setTemplates={setEmailTemplates} onSync={onSync} />
      )}

      {activeSubTab === 'product_types' && setProductTypes && (
          <ProductTypesConfig types={productTypes} setTypes={setProductTypes} onSync={onSync} />
      )}

      {activeSubTab === 'general' && (
        <div className="space-y-8">
            {/* GLOBAL SETTINGS */}
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-800 rounded-full"></span>Réglages Globaux Application</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Durée Produits Temporaires</label>
                        <select 
                            className="w-full bg-slate-50 p-4 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                            value={appConfig.tempItemDuration}
                            onChange={e => handleConfigChange('tempItemDuration', e.target.value)}
                        >
                            <option value="3_DAYS">3 Jours</option>
                            <option value="7_DAYS">7 Jours</option>
                            <option value="14_DAYS">14 Jours</option>
                            <option value="1_MONTH">1 Mois</option>
                            <option value="3_MONTHS">3 Mois</option>
                            <option value="INFINITE">Infini</option>
                        </select>
                        <p className="text-[9px] text-slate-400 ml-1">Les produits temporaires seront masqués après cette période.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Taux de Marge par Défaut (%)</label>
                        <input 
                            type="number"
                            className="w-full bg-slate-50 p-4 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                            value={appConfig.defaultMargin || 82}
                            onChange={e => handleConfigChange('defaultMargin', parseFloat(e.target.value))}
                        />
                        <p className="text-[9px] text-slate-400 ml-1">Utilisé pour calculer le prix de vente suggéré des recettes.</p>
                    </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="font-black text-xs uppercase text-slate-500 tracking-widest mb-4">Rappels Repas Personnel</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rappel 1 (Matin)</label>
                            <input 
                                type="time" 
                                className="w-full bg-slate-50 p-4 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                                value={appConfig.mealReminderTimes?.[0] || ''}
                                onChange={e => {
                                    const times = [...(appConfig.mealReminderTimes || ['', ''])];
                                    times[0] = e.target.value;
                                    handleConfigChange('mealReminderTimes', times);
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rappel 2 (Après-midi)</label>
                            <input 
                                type="time" 
                                className="w-full bg-slate-50 p-4 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                                value={appConfig.mealReminderTimes?.[1] || ''}
                                onChange={e => {
                                    const times = [...(appConfig.mealReminderTimes || ['', ''])];
                                    times[1] = e.target.value;
                                    handleConfigChange('mealReminderTimes', times);
                                }}
                            />
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 ml-1">Une notification sera envoyée aux heures programmées pour rappeler de réserver les repas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                        <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>Nouveau Produit</h3>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom..." value={itemName} onChange={e => setItemName(e.target.value)} />
                            </div>
                            <input className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-sm" placeholder="Code Article (Optionnel)" value={itemArticleCode} onChange={e => setItemArticleCode(e.target.value)} />
                            <div className="grid grid-cols-2 gap-4">
                                <select className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none" value={itemCat} onChange={e => setItemCat(e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <select className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none" value={itemFormat} onChange={e => setItemFormat(e.target.value)}>{formats.map(f => f && <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                            </div>
                        </div>
                        <button onClick={addProduct} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700">Ajouter</button>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                        <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-amber-600 rounded-full"></span>Formats</h3>
                        <div className="flex gap-2">
                            <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom..." value={formatName} onChange={e => setFormatName(e.target.value)} />
                            <input type="number" className="w-24 bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-center" placeholder="Val" value={formatValue || ''} onChange={e => setFormatValue(parseFloat(e.target.value))} />
                            <button onClick={addFormat} className="bg-amber-600 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-700">OK</button>
                        </div>
                        <div className="space-y-2">
                            {formats.map((f, i) => f && (
                                <div key={f.id} className="flex justify-between items-center bg-slate-50 px-5 py-3 rounded-2xl border group">
                                    <span className="font-black text-[10px] uppercase tracking-widest">{f.name}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveFormat(i, 'up')} className="text-slate-400 hover:text-indigo-600">▲</button>
                                        <button onClick={() => moveFormat(i, 'down')} className="text-slate-400 hover:text-indigo-600">▼</button>
                                        <button onClick={() => deleteFormat(f.id)} className="text-rose-400 hover:text-rose-600 ml-1">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                        <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>Catégories</h3>
                        <div className="flex gap-2">
                            <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nouvelle..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                            <button onClick={addCategory} className="bg-emerald-500 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600">OK</button>
                        </div>
                        <div className="space-y-2">
                            {categories.map((c, i) => c && (
                                <div key={c} className="flex justify-between items-center bg-slate-50 px-5 py-3 rounded-2xl border group">
                                    <span className="font-black text-[10px] uppercase tracking-widest">{c}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveCategory(i, 'up')} className="text-slate-400 hover:text-indigo-600">▲</button>
                                        <button onClick={() => moveCategory(i, 'down')} className="text-slate-400 hover:text-indigo-600">▼</button>
                                        <button onClick={() => deleteCategory(c)} className="text-rose-400 hover:text-rose-600 ml-1">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                        <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-800 rounded-full"></span>Espaces de Stockage</h3>
                        <div className="flex gap-2">
                            <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom..." value={storageName} onChange={e => setStorageName(e.target.value)} />
                            <button onClick={addStorage} className="bg-slate-800 text-white px-6 rounded-2xl font-black uppercase tracking-widest">OK</button>
                        </div>
                        <div className="space-y-2">
                            {storages.map((s, i) => s && s.id !== 's_global' && (
                                <div key={s.id} className="flex items-center justify-between bg-slate-50 px-5 py-3 rounded-2xl border group">
                                    <span className="font-black text-[10px] uppercase tracking-widest">{s.name}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveStorage(i, 'up')} className="text-slate-400 hover:text-indigo-600">▲</button>
                                        <button onClick={() => moveStorage(i, 'down')} className="text-slate-400 hover:text-indigo-600">▼</button>
                                        {s.id !== 's0' && <button onClick={() => deleteStorage(s.id)} className="text-rose-400 hover:text-rose-600 ml-1">✕</button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {activeSubTab === 'priorities' && (
        <PriorityConfig items={items} storages={storages} priorities={priorities} setPriorities={setPriorities} categories={categories} onSync={onSync} />
      )}
      {/* ... (Other Tabs Unchanged) ... */}
      {activeSubTab === 'glassware' && setGlassware && (
          <GlasswareConfig glassware={glassware} setGlassware={setGlassware} onSync={onSync} />
      )}
      {activeSubTab === 'techniques' && setTechniques && (
          <TechniquesConfig techniques={techniques} setTechniques={setTechniques} onSync={onSync} />
      )}
      {activeSubTab === 'cocktail_cats' && setCocktailCategories && (
          <CocktailCategoriesConfig categories={cocktailCategories} setCategories={setCocktailCategories} onSync={onSync} appConfig={appConfig} setAppConfig={setAppConfig} />
      )}
      {activeSubTab === 'users' && (
          <div className="max-w-3xl mx-auto space-y-8">
              {!authorizedSubTabs.has('users') ? (
                  <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm text-center space-y-6">
                      <h3 className="font-black text-lg uppercase tracking-tight">Accès Sécurisé</h3>
                      <input 
                          type="password" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-center font-black text-2xl tracking-[1em] outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Code PIN"
                          maxLength={4}
                          value={authPinInput}
                          onChange={e => setAuthPinInput(e.target.value)}
                      />
                      <button onClick={() => checkAuth('users')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700">Déverrouiller</button>
                  </div>
              ) : (
                  <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                      <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>Gestion Utilisateurs</h3>
                      
                      <div className="flex gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 items-end">
                          <div className="flex-1 space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom</label>
                              <input className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold outline-none text-sm" placeholder="Nom..." value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                          </div>
                          <div className="w-24 space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">PIN</label>
                              <input className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold outline-none text-center text-sm" placeholder="PIN" maxLength={4} value={newUserPin} onChange={e => setNewUserPin(e.target.value)} />
                          </div>
                          <div className="w-32 space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle</label>
                              <select className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold outline-none text-sm" value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}>
                                  <option value="BARMAN">Barman</option>
                                  <option value="ADMIN">Admin</option>
                              </select>
                          </div>
                          <div className="flex items-center h-[46px] px-2">
                              <label className="flex items-center gap-2 cursor-pointer" title="Afficher dans le planning repas">
                                  <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={newUserShowInMeal} onChange={e => setNewUserShowInMeal(e.target.checked)} />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Repas</span>
                              </label>
                          </div>
                          <div className="flex flex-col gap-1">
                              <button onClick={handleSaveUser} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs hover:bg-indigo-700 shadow-lg">{editingUserId ? 'Modifier' : 'Ajouter'}</button>
                              {editingUserId && <button onClick={cancelEditUser} className="text-[10px] text-slate-400 font-bold uppercase hover:text-slate-600">Annuler</button>}
                          </div>
                      </div>

                      <div className="space-y-3">
                          {users.map(u => (
                              <div key={u.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${u.role === 'ADMIN' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                          {u.name.charAt(0)}
                                      </div>
                                      <div>
                                          <p className="font-bold text-slate-900 text-sm">{u.name}</p>
                                          <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-2 py-0.5 rounded uppercase tracking-widest">{u.role}</span>
                                              <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded">
                                                  <span className="text-[10px] font-mono font-bold text-slate-500">PIN: {visiblePins.has(u.id) ? u.pin : '••••'}</span>
                                                  <button onClick={() => revealPin(u.id)} className="text-slate-300 hover:text-indigo-500">
                                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                  </button>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => startEditUser(u)} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                      </button>
                                      {u.id !== currentUser.id && (
                                          <button onClick={() => deleteUser(u.id)} className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                          </button>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* DLC CONFIGURATION */}
      {activeSubTab === 'dlc' && (
          <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                  <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>Profils DLC</h3>
                  
                  <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex-1 w-full space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du Profil</label>
                          <input className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" placeholder="Ex: Jus Frais..." value={newDlcName} onChange={e => setNewDlcName(e.target.value)} />
                      </div>
                      <div className="w-32 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Durée (Heures)</label>
                          <input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none text-center" placeholder="24" value={newDlcDuration} onChange={e => setNewDlcDuration(parseInt(e.target.value))} />
                      </div>
                      <div className="w-40 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                          <select className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none" value={newDlcType} onChange={e => setNewDlcType(e.target.value as any)}>
                              <option value="OPENING">Ouverture Bouteille</option>
                              <option value="PRODUCTION">Production Maison</option>
                          </select>
                      </div>
                      <button onClick={handleAddDlcProfile} className="bg-amber-500 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-amber-600 shadow-md">Ajouter</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dlcProfiles.map(p => (
                          <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                              <div>
                                  <p className="font-bold text-slate-800">{p.name}</p>
                                  <div className="flex gap-2 mt-1">
                                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">{p.durationHours}h</span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${p.type === 'PRODUCTION' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                          {p.type === 'PRODUCTION' ? 'Production' : 'Ouverture'}
                                      </span>
                                  </div>
                              </div>
                              <button onClick={() => handleDeleteDlcProfile(p.id)} className="text-rose-300 hover:text-rose-500 p-2">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeSubTab === 'backup' && (
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
              <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-500 rounded-full"></span>Sauvegarde & Restauration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={handleExportBackup} className="bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700">Télécharger Sauvegarde (JSON)</button>
                  <label className="bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 cursor-pointer flex items-center justify-center">
                      Restaurer (Upload)
                      <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
                  </label>
              </div>
          </div>
      )}

      {/* CREDITS PAGE */}
      {activeSubTab === 'credits' && (
          <div className="max-w-2xl mx-auto bg-white p-12 rounded-[2.5rem] border shadow-sm text-center space-y-8">
              <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">BarStock Pro</h2>
                  <p className="text-indigo-500 font-bold uppercase tracking-widest text-xs mt-2">v1.2 (Beta)</p>
              </div>
              
              <div className="space-y-4">
                  <p className="text-slate-600 text-sm font-medium leading-relaxed">
                      Développé pour simplifier la gestion quotidienne des bars d'hôtels et restaurants.
                      Cette application permet la gestion des stocks, le suivi des DLC, la création de fiches techniques et la communication d'équipe.
                  </p>
                  <div className="inline-block bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 mb-1">Développeur</p>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-widest">M. GUILLOT Quentin</p>
                  </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2024 BarStock Pro</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default Configuration;
