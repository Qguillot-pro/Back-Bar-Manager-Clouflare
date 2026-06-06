
import React, { useState, useMemo } from 'react';
import { StockItem, StorageSpace, StockLevel, StockConsigne, PendingOrder, ExternalStorageLocation } from '../types';
import { Search, MapPin, Warehouse, AlertTriangle, ShieldCheck, Map, Info, Package } from 'lucide-react';

interface QuickSearchProps {
    items: StockItem[];
    storages: StorageSpace[];
    stockLevels: StockLevel[];
    consignes: StockConsigne[];
    orders: PendingOrder[];
    externalLocations: ExternalStorageLocation[];
}

const QuickSearch: React.FC<QuickSearchProps> = ({ 
    items, storages, stockLevels, consignes, orders, externalLocations 
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = useMemo(() => {
        if (searchTerm.length < 2) return [];
        const term = searchTerm.toLowerCase();
        return items.filter(i => 
            i.name.toLowerCase().includes(term) || 
            i.category.toLowerCase().includes(term) ||
            i.articleCode?.toLowerCase().includes(term)
        ).slice(0, 20);
    }, [items, searchTerm]);

    const getStatus = (item: StockItem) => {
        const barLevels = stockLevels.filter(l => l.itemId === item.id && l.storageId !== 's0' && l.storageId !== 's_global');
        const totalBarStock = barLevels.reduce((sum, l) => sum + l.currentQuantity, 0);
        
        // Find if any pending order has a rupture date
        const isRestockImpossible = orders.some(o => o.itemId === item.id && o.status === 'PENDING' && !!o.ruptureDate);
        
        if (isRestockImpossible) {
            if (totalBarStock === 0) return { label: 'RUPTURE', color: 'bg-rose-600 text-white', icon: <AlertTriangle className="w-3 h-3" /> };
            return { label: 'TENDU', color: 'bg-amber-500 text-white', icon: <AlertTriangle className="w-3 h-3" /> };
        }
        
        const totalConsigne = consignes.filter(c => c.itemId === item.id && c.storageId !== 's0').reduce((sum, c) => sum + c.minQuantity, 0);
        if (totalConsigne > 0 && totalBarStock < totalConsigne) {
            return { label: 'LIMITE', color: 'bg-indigo-100 text-indigo-600', icon: <Info className="w-3 h-3" /> };
        }

        return { label: 'OK', color: 'bg-emerald-100 text-emerald-600', icon: <ShieldCheck className="w-3 h-3" /> };
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-xl text-white">
                        <Search className="w-6 h-6" />
                    </div>
                    Recherche Emplacements
                </h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Localiser rapidement un produit (Bar & Stockage Hors-Bar)</p>
            </header>

            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-indigo-500" />
                <input 
                    type="text"
                    autoFocus
                    placeholder="Tapez le nom du produit..."
                    className="w-full pl-16 pr-6 py-6 bg-white border-4 border-slate-100 rounded-[2.5rem] text-xl font-black text-slate-800 outline-none focus:border-indigo-500 transition-all shadow-xl shadow-slate-200/50"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map(item => {
                    const status = getStatus(item);
                    const barLocations = consignes
                        .filter(c => c.itemId === item.id && c.storageId !== 's0')
                        .map(c => {
                            const storage = storages.find(s => s.id === c.storageId);
                            const level = stockLevels.find(l => l.itemId === item.id && l.storageId === c.storageId)?.currentQuantity || 0;
                            return { name: storage?.name || '?', level, consigne: c.minQuantity };
                        });
                    
                    const surstockLevel = stockLevels.find(l => l.itemId === item.id && l.storageId === 's0')?.currentQuantity || 0;
                    const extLieu = externalLocations.find(l => l.id === item.externalLocationId);

                    return (
                        <div key={item.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden flex flex-col hover:border-indigo-300 transition-all group">
                            <div className="p-6 border-b border-slate-50 flex justify-between items-start bg-slate-50/50">
                                <div>
                                    <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase leading-none">{item.name}</h3>
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{item.category}</span>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${status.color} shadow-sm`}>
                                    {status.icon}
                                    {status.label}
                                </div>
                            </div>

                            <div className="p-6 space-y-6 flex-1">
                                {/* BAR LOCATIONS */}
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <MapPin className="w-3 h-3 text-indigo-500" />
                                        Emplacements Bar
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {barLocations.length > 0 ? barLocations.map((loc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <span className="font-bold text-slate-700 text-sm">{loc.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-black p-1.5 rounded-lg ${loc.level < loc.consigne ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {loc.level} / {loc.consigne}
                                                    </span>
                                                </div>
                                            </div>
                                        )) : (
                                            <p className="text-xs text-slate-400 italic">Aucun emplacement bar dédié</p>
                                        )}
                                    </div>
                                </div>

                                {/* EXTERNAL STORAGE */}
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Warehouse className="w-3 h-3 text-cyan-500" />
                                        Stockage hors bar
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-cyan-900 text-sm uppercase tracking-tight">{extLieu?.name || 'Lieu non défini'}</span>
                                                <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">
                                                    Emplacement : {item.externalLocation || '--'}
                                                </span>
                                            </div>
                                            <Package className="w-5 h-5 text-cyan-300" />
                                        </div>
                                        
                                        {surstockLevel > 0 && (
                                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
                                                <span className="text-xs font-black text-amber-700 uppercase tracking-widest italic">Surstock (Étagère s0)</span>
                                                <span className="font-black text-amber-600">{surstockLevel} unités</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {searchTerm.length >= 2 && filteredItems.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100">
                        <Package className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold">Aucun produit ne correspond à votre recherche.</p>
                    </div>
                )}
                
                {searchTerm.length < 2 && (
                    <div className="col-span-full py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-sm italic">
                        Tapez au moins 2 lettres pour lancer la recherche
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickSearch;
