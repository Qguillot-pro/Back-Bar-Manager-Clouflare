
import React, { useState } from 'react';
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
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('BARMAN');
  
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

  const handleConfigChange = (field: keyof AppConfig, value: any) => {
      setAppConfig(prev => ({ ...prev, [field]: value }));
      const key = field === 'tempItemDuration' ? 'temp_item_duration' : 'default_margin';
      onSync('SAVE_CONFIG', { key, value });
  };

  const addProduct = () => { if (!itemName) return; const newItem: StockItem = { id: Math.random().toString(36).substr(2, 9), articleCode: itemArticleCode, name: itemName, category: itemCat, formatId: itemFormat, pricePerUnit: 0, lastUpdated: new Date().toISOString(), isDLC: itemIsDlc, dlcProfileId: itemIsDlc ? itemDlcProfile : undefined, isConsigne: itemIsConsigne, order: items.length, isDraft: true }; setItems(prev => [...prev, newItem]); onSync('SAVE_ITEM', newItem); setItemName(''); setItemArticleCode(''); setItemIsDlc(false); };
  const addFormat = () => { if (!formatName) return; const newFormat: Format = { id: 'f' + Date.now(), name: formatName, value: formatValue, order: formats.length + 1 }; setFormats(prev => [...prev, newFormat]); onSync('SAVE_FORMAT', newFormat); setFormatName(''); setFormatValue(0); };
  const deleteFormat = (id: string) => { setFormats(prev => prev.filter(f => f.id !== id)); onSync('DELETE_FORMAT', { id }); };
  const addCategory = () => { if (!newCatName) return; setCategories(prev => [...prev, newCatName]); onSync('SAVE_CATEGORY', { name: newCatName }); setNewCatName(''); };
  const deleteCategory = (cat: Category) => { setCategories(prev => prev.filter(c => c !== cat)); onSync('DELETE_CATEGORY', { name: cat }); };
  const addStorage = () => { if (!storageName) return; const newStorage = { id: 's' + Date.now(), name: storageName }; setStorages(prev => [...prev, newStorage]); onSync('SAVE_STORAGE', newStorage); setStorageName(''); };
  const deleteStorage = (id: string) => { setStorages(prev => prev.filter(st => st.id !== id)); onSync('DELETE_STORAGE', { id }); };
  const addUser = () => { if (!newUserName) return; const newUser: User = { id: 'u' + Date.now(), name: newUserName, role: newUserRole, pin: newUserPin }; setUsers(prev => [...prev, newUser]); onSync('SAVE_USER', newUser); setNewUserName(''); setNewUserPin(''); };
  
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
      <div className="flex border-b border-slate-200 overflow-x-auto">
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
                        {formats.map((f, i) => f && (<div key={f.id} className="flex justify-between bg-slate-50 px-5 py-3 rounded-2xl border"><span className="font-black text-[10px] uppercase tracking-widest">{f.name}</span><button onClick={() => deleteFormat(f.id)} className="text-rose-400 hover:text-rose-600">✕</button></div>))}
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
                        {categories.map((c, i) => c && (<div key={c} className="flex justify-between bg-slate-50 px-5 py-3 rounded-2xl border"><span className="font-black text-[10px] uppercase tracking-widest">{c}</span><button onClick={() => deleteCategory(c)} className="text-rose-400 hover:text-rose-600">✕</button></div>))}
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                    <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-800 rounded-full"></span>Espaces de Stockage</h3>
                    <div className="flex gap-2">
                        <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom..." value={storageName} onChange={e => setStorageName(e.target.value)} />
                        <button onClick={addStorage} className="bg-slate-800 text-white px-6 rounded-2xl font-black uppercase tracking-widest">OK</button>
                    </div>
                    <div className="space-y-2">
                        {storages.map(s => s && s.id !== 's_global' && (<div key={s.id} className="flex items-center justify-between bg-slate-50 px-5 py-3 rounded-2xl border group"><span className="font-black text-[10px] uppercase tracking-widest">{s.name}</span>{s.id !== 's0' && <button onClick={() => deleteStorage(s.id)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}</div>))}
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {activeSubTab === 'priorities' && (
        <PriorityConfig items={items} storages={storages} priorities={priorities} setPriorities={setPriorities} categories={categories} onSync={onSync} />
      )}
      {activeSubTab === 'glassware' && setGlassware && (
          <GlasswareConfig glassware={glassware} setGlassware={setGlassware} onSync={onSync} />
      )}
      {activeSubTab === 'techniques' && setTechniques && (
          <TechniquesConfig techniques={techniques} setTechniques={setTechniques} onSync={onSync} />
      )}
      {activeSubTab === 'cocktail_cats' && setCocktailCategories && (
          <CocktailCategoriesConfig categories={cocktailCategories} setCategories={setCocktailCategories} onSync={onSync} appConfig={appConfig} setAppConfig={setAppConfig} />
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
    </div>
  );
};

export default Configuration;
