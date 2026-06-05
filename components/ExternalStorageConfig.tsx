
import React, { useState } from 'react';
import { StockItem, Category, ExternalStorageLocation, StockConsigne } from '../types';
import { Warehouse, Search, Save, Printer, FileText, CheckSquare, Plus, Trash2, MapPin, Settings2, X, AlertCircle } from 'lucide-react';

interface ExternalStorageConfigProps {
    items: StockItem[];
    categories: Category[];
    externalLocations: ExternalStorageLocation[];
    setExternalLocations: React.Dispatch<React.SetStateAction<ExternalStorageLocation[]>>;
    onSync: (action: string, payload: any) => void;
    setItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
    consignes: StockConsigne[];
}

const ExternalStorageConfig: React.FC<ExternalStorageConfigProps> = ({ 
    items, categories, externalLocations, setExternalLocations, onSync, setItems, consignes 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingLocations, setEditingLocations] = useState<Record<string, string>>({});
    const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [newLocationName, setNewLocationName] = useState('');
    
    // Print options
    const [printLieuId, setPrintLieuId] = useState<string>('ALL');
    const [printCategoryId, setPrintCategoryId] = useState<string>('ALL');
    const [printSort, setPrintSort] = useState<'NAME' | 'LOCATION'>('LOCATION');

    const filteredItems = items.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    const handleLocationChange = (id: string, value: string) => {
        if (value.length > 8) return;
        setEditingLocations(prev => ({ ...prev, [id]: value.toUpperCase() }));
    };

    const handleSave = (item: StockItem, lieuId?: string) => {
        const newLoc = editingLocations[item.id] !== undefined ? editingLocations[item.id] : item.externalLocation;
        const finalLieuId = lieuId !== undefined ? (lieuId === '' ? null : lieuId) : item.externalLocationId;
        
        onSync('SAVE_ITEM', { ...item, externalLocation: newLoc, externalLocationId: finalLieuId });
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, externalLocation: newLoc, externalLocationId: finalLieuId || undefined } : i));
        // Reset only if it was a manual location change
        if (editingLocations[item.id] !== undefined) {
            setEditingLocations(prev => {
                const copy = { ...prev };
                delete copy[item.id];
                return copy;
            });
        }
    };

    const handleAddLieu = () => {
        if (!newLocationName.trim()) return;
        const newLieu: ExternalStorageLocation = {
            id: 'el_' + Date.now(),
            name: newLocationName.trim(),
            order: externalLocations.length
        };
        setExternalLocations(p => [...p, newLieu]);
        onSync('SAVE_EXTERNAL_LOCATION', newLieu);
        setNewLocationName('');
    };

    const handleDeleteLieu = (id: string) => {
        if (!confirm("Supprimer ce lieu ? Les produits rattachés ne seront plus liés à ce lieu (mais garderont leur emplacement texte).")) return;
        setExternalLocations(p => p.filter(l => l.id !== id));
        onSync('DELETE_EXTERNAL_LOCATION', { id });
    };

    const handlePrintList = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let products = items.filter(i => i.externalLocation || i.externalLocationId);
        
        if (printLieuId !== 'ALL') {
            products = products.filter(i => i.externalLocationId === printLieuId);
        }
        if (printCategoryId !== 'ALL') {
            products = products.filter(i => i.category === printCategoryId);
        }

        if (printSort === 'NAME') {
            products.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            products.sort((a, b) => (a.externalLocation || '').localeCompare(b.externalLocation || ''));
        }

        const lieuName = printLieuId === 'ALL' ? 'Tous les lieux' : externalLocations.find(l => l.id === printLieuId)?.name || '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Plan de Stockage Cave</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                        h1 { text-transform: uppercase; font-size: 24px; margin: 0; }
                        .info { font-size: 12px; font-weight: bold; color: #666; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #000; padding: 12px; text-align: left; }
                        th { background: #f0f0f0; font-weight: 800; text-transform: uppercase; font-size: 10px; }
                        td { font-size: 14px; }
                        .loc { font-family: monospace; font-weight: 800; background: #eee; padding: 2px 6px; border-radius: 4px; }
                        .lieu { color: #0891b2; font-weight: bold; font-size: 11px; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1>PLAN DE STOCKAGE - ${lieuName}</h1>
                            <p class="info">Dernière mise à jour: ${new Date().toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 120px;">Lieu</th>
                                <th style="width: 120px;">Emplacement</th>
                                <th>Produit</th>
                                <th>Catégorie</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(p => {
                                const lieu = externalLocations.find(l => l.id === p.externalLocationId);
                                return `
                                    <tr>
                                        <td class="lieu">${lieu?.name || '--'}</td>
                                        <td><span class="loc">${p.externalLocation || '--'}</span></td>
                                        <td><strong>${p.name}</strong></td>
                                        <td>${p.category}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    <script>window.print();</script>
                </body>
            </html>
        `);
        printWindow.document.close();
        setIsPrintModalOpen(false);
    };

    return (
        <div className="space-y-6">
            {/* Manage Locations Modal */}
            {isManageLocationsOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-indigo-600" />
                                Gérer les Lieux
                            </h3>
                            <button onClick={() => setIsManageLocationsOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    placeholder="Nouveau lieu (ex: Cave A, Réserve...)"
                                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                                    value={newLocationName}
                                    onChange={e => setNewLocationName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddLieu()}
                                />
                                <button 
                                    onClick={handleAddLieu}
                                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-black"
                                >
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {externalLocations.map(lieu => (
                                    <div key={lieu.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="font-bold text-slate-700">{lieu.name}</span>
                                        <button onClick={() => handleDeleteLieu(lieu.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {externalLocations.length === 0 && <p className="text-center py-4 text-slate-400 font-medium text-sm">Aucun lieu créé.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Options Modal */}
            {isPrintModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <Printer className="w-5 h-5 text-indigo-600" />
                                Options Impression
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Lieu</label>
                                <select 
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                    value={printLieuId}
                                    onChange={e => setPrintLieuId(e.target.value)}
                                >
                                    <option value="ALL">Tous les lieux</option>
                                    {externalLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Catégorie</label>
                                <select 
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                    value={printCategoryId}
                                    onChange={e => setPrintCategoryId(e.target.value)}
                                >
                                    <option value="ALL">Toutes les catégories</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Trier par</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setPrintSort('LOCATION')} className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${printSort === 'LOCATION' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}>Emplacement</button>
                                    <button onClick={() => setPrintSort('NAME')} className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${printSort === 'NAME' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}>Nom Produit</button>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setIsPrintModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest">Annuler</button>
                                <button onClick={handlePrintList} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">Imprimer</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                        <Warehouse className="w-6 h-6 text-cyan-600" />
                        Stockage hors Bar
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Gestion des lieux et emplacements cave/réserve</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => setIsManageLocationsOpen(true)}
                        className="items-center justify-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
                    >
                        <Settings2 className="w-4 h-4 inline mr-2" />
                        Gérer lieux
                    </button>
                    <button 
                        onClick={() => setIsPrintModalOpen(true)}
                        className="items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-100"
                    >
                        <Printer className="w-4 h-4 inline mr-2" />
                        Imprimer Plan Cave
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
                <div className="p-6 bg-slate-50/80 backdrop-blur-md border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Rechercher par nom ou catégorie..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-cyan-500 transition-all shadow-sm focus:shadow-md"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 italic">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produit</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">État Stock</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lieu</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Emplacement</th>
                                <th className="p-6 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 overflow-y-visible">
                            {filteredItems.map(item => {
                                const hasBarLocation = consignes.some(c => c.itemId === item.id);
                                const isExternalOnly = !hasBarLocation;
                                
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <p className="font-black text-slate-900 text-sm group-hover:text-cyan-700 transition-colors">{item.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md uppercase tracking-wider border border-slate-200">
                                                        {item.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            {isExternalOnly ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200 shadow-sm animate-pulse">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Hors Bar Uniquement
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Stock Bar Actif</span>
                                            )}
                                        </td>
                                        <td className="p-6">
                                            <select 
                                                className="bg-transparent border-none text-slate-500 text-xs font-bold uppercase tracking-widest focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors"
                                                value={item.externalLocationId || ''}
                                                onChange={e => handleSave(item, e.target.value)}
                                            >
                                                <option value="">Aucun lieu</option>
                                                {externalLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-6">
                                            <input 
                                                type="text"
                                                maxLength={8}
                                                className="w-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-cyan-700 uppercase outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-inner"
                                                placeholder="A-01"
                                                value={editingLocations[item.id] !== undefined ? editingLocations[item.id] : (item.externalLocation || '')}
                                                onChange={e => handleLocationChange(item.id, e.target.value)}
                                            />
                                        </td>
                                        <td className="p-6 text-right">
                                            {(editingLocations[item.id] !== undefined && editingLocations[item.id] !== (item.externalLocation || '')) && (
                                                <button 
                                                    onClick={() => handleSave(item)}
                                                    className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ExternalStorageConfig;
