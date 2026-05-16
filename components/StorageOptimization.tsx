
import React, { useMemo, useState } from 'react';
import { StockItem, StorageSpace, StockLevel, StockConsigne, Transaction, Format } from '../types';
import { LayoutDashboard, TrendingDown, Clock, MoveHorizontal, ChevronRight, CheckCircle2, History as HistoryIcon, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react';

interface StorageOptimizationProps {
    items: StockItem[];
    storages: StorageSpace[];
    stockLevels: StockLevel[];
    consignes: StockConsigne[];
    transactions: Transaction[];
    formats: Format[];
    onSync: (action: string, payload: any) => void;
}

type Period = '7_DAYS' | '14_DAYS' | '1_MONTH' | '3_MONTHS' | '1_YEAR';

const PERIODS: { label: string, value: Period, days: number }[] = [
    { label: '1 Semaine', value: '7_DAYS', days: 7 },
    { label: '2 Semaines', value: '14_DAYS', days: 14 },
    { label: '1 Mois', value: '1_MONTH', days: 30 },
    { label: '3 Mois', value: '3_MONTHS', days: 90 },
    { label: '1 An', value: '1_YEAR', days: 365 },
];

const StorageOptimization: React.FC<StorageOptimizationProps> = ({ items, storages, stockLevels, consignes, transactions, formats, onSync }) => {
    const [selectedStorageIds, setSelectedStorageIds] = useState<Set<string>>(new Set(storages.map(s => s.id)));
    const [appliedOptimizations, setAppliedOptimizations] = useState<Set<string>>(new Set());

    // Helper to get day of week in French
    const getDayName = (date: Date) => {
        return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    };

    const analysis = useMemo(() => {
        const now = new Date();
        const results = {
            tension: [] as any[],
            stable: [] as any[],
            dormant: [] as any[],
        };

        const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));

        sortedItems.forEach(item => {
            const itemConsignes = consignes.filter(c => c.itemId === item.id && selectedStorageIds.has(c.storageId));
            
            itemConsignes.forEach(consigne => {
                const storage = storages.find(s => s.id === consigne.storageId);
                if (!storage) return;

                const itemTransactions = transactions
                    .filter(t => t.itemId === item.id && t.storageId === consigne.storageId)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // Analysis of Flow (Flux Tendu / Stable)
                // We need to group by bar days to see the "remaining percentage"
                const barDayStats: Record<string, { minRatio: number, maxRatio: number, dayOfWeek: number }> = {};
                
                // Reconstruct history
                let currentQty = stockLevels.find(l => l.itemId === item.id && l.storageId === consigne.storageId)?.currentQuantity || 0;
                
                // Work backwards from now to 30 days ago
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                // Transaction history for mapping levels per day
                let levelAtDate = currentQty;
                const dailyLevels: Record<string, number> = {};
                
                // Start with current
                let tempDate = new Date();
                for (let i = 0; i < 30; i++) {
                    const dateStr = tempDate.toISOString().split('T')[0];
                    dailyLevels[dateStr] = levelAtDate;
                    
                    // Subtract transactions that happened on this day
                    const dayTrans = itemTransactions.filter(t => t.date.startsWith(dateStr));
                    dayTrans.forEach(t => {
                        if (t.type === 'IN') levelAtDate -= t.quantity;
                        else levelAtDate += t.quantity;
                    });
                    
                    tempDate.setDate(tempDate.getDate() - 1);
                }

                const tensionDays = new Set<number>();
                let isStable = true;
                let hasHistory = false;

                Object.entries(dailyLevels).forEach(([dateStr, qty]) => {
                    if (consigne.minQuantity <= 0) return;
                    hasHistory = true;
                    const ratio = qty / consigne.minQuantity;
                    const date = new Date(dateStr);
                    
                    if (ratio <= 0.2) {
                        tensionDays.add(date.getDay());
                    }
                    
                    if (ratio < 0.2 || ratio > 0.8) {
                        isStable = false;
                    }
                });

                if (tensionDays.size > 0) {
                    results.tension.push({
                        item,
                        storage,
                        consigne,
                        days: Array.from(tensionDays).sort(),
                    });
                } else if (isStable && hasHistory && consigne.minQuantity > 0) {
                    results.stable.push({
                        item,
                        storage,
                        consigne
                    });
                }

                // Dormant
                const lastTrans = itemTransactions[itemTransactions.length - 1];
                const lastDate = lastTrans ? new Date(lastTrans.date) : (item.createdAt ? new Date(item.createdAt) : new Date(0));
                const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays >= 7) {
                    let periodLabel = '1 Semaine';
                    if (diffDays >= 365) periodLabel = '1 An';
                    else if (diffDays >= 90) periodLabel = '3 Mois';
                    else if (diffDays >= 30) periodLabel = '1 Mois';
                    else if (diffDays >= 14) periodLabel = '2 Semaines';

                    // Only add if it hasn't moved at all in ALL selected storages (optional? User said " flux de produits stockés dans mes différents espaces")
                    // Actually let's do it per consigne as requested per space
                    results.dormant.push({
                        item,
                        storage,
                        consigne,
                        days: diffDays,
                        periodLabel
                    });
                }
            });
        });

        return results;
    }, [items, storages, stockLevels, consignes, transactions, selectedStorageIds]);

    const optimizations = useMemo(() => {
        const proposals: any[] = [];

        // Group analyses by storage & format
        selectedStorageIds.forEach(storageId => {
            const storageItems = analysis.tension.concat(analysis.stable).concat(analysis.dormant)
                .filter(a => a.storage.id === storageId);
            
            const byFormat: Record<string, typeof storageItems> = {};
            storageItems.forEach(a => {
                const fId = a.item.formatId;
                if (!byFormat[fId]) byFormat[fId] = [];
                byFormat[fId].push(a);
            });

            Object.entries(byFormat).forEach(([formatId, analysisList]) => {
                // Rule 1: Tension products - Suggest increase consigne
                const tensionList = analysisList.filter(a => analysis.tension.includes(a));
                tensionList.forEach(t => {
                    proposals.push({
                        id: `opt-up-${t.item.id}-${t.storage.id}`,
                        type: 'INCREASE',
                        item: t.item,
                        storage: t.storage,
                        currentConsigne: t.consigne.minQuantity,
                        suggestedConsigne: Math.ceil(t.consigne.minQuantity * 1.5),
                        reason: 'Flux tendu (>80% de consommation régulière entre deux remontées)'
                    });
                });

                // Rule 2: Dormant products - Suggest decrease or swap
                const dormantList = analysisList.filter(a => analysis.dormant.includes(a));
                const tensionItemsInFormat = tensionList.map(t => t.item);

                dormantList.forEach(d => {
                    // If there's a tension product in the same format, suggest a swap of space (prioritize tension)
                    const tensionMatch = tensionList[0]; // Simple match for now
                    if (tensionMatch && tensionMatch.item.id !== d.item.id) {
                         // Proposals for swapping quantities if applicable
                         // But more likely: Reduce dormant to give space to tension
                         proposals.push({
                            id: `opt-swap-${d.item.id}-${tensionMatch.item.id}-${d.storage.id}`,
                            type: 'SWAP',
                            item: d.item,
                            targetItem: tensionMatch.item,
                            storage: d.storage,
                            currentConsigne: d.consigne.minQuantity,
                            suggestedConsigne: Math.floor(d.consigne.minQuantity / 2),
                            reason: `Produit dormant (${d.periodLabel}). Libérer de l'espace pour ${tensionMatch.item.name} qui est en flux tendu.`
                        });
                    } else if (d.days >= 30) {
                        proposals.push({
                            id: `opt-down-${d.item.id}-${d.storage.id}`,
                            type: 'DECREASE',
                            item: d.item,
                            storage: d.storage,
                            currentConsigne: d.consigne.minQuantity,
                            suggestedConsigne: Math.max(0, Math.floor(d.consigne.minQuantity * 0.5)),
                            reason: `Produit dormant (${d.periodLabel}).`
                        });
                    }
                });
            });
        });

        return proposals;
    }, [analysis, selectedStorageIds]);

    const handleApplyOptimization = (opt: any) => {
        if (appliedOptimizations.has(opt.id)) return;

        const updatedConsigne = {
            ...opt.consigne,
            minQuantity: opt.suggestedConsigne
        };

        // Note: The opt object above was constructed manually, it might not have the actual consigne object ref
        // Let's find it in the props
        const realConsigne = consignes.find(c => c.itemId === opt.item.id && c.storageId === opt.storage.id);
        if (realConsigne) {
            onSync('SAVE_CONSIGNE', { ...realConsigne, minQuantity: opt.suggestedConsigne });
        }

        setAppliedOptimizations(prev => new Set(prev).add(opt.id));
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <header className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-white flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-cyan-400" />
                        Analyse de Flux & Optimisation
                    </h1>
                    <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Optimisez votre espace de stockage limité</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                    {storages.map(s => (
                        <button 
                            key={s.id}
                            onClick={() => {
                                const newSet = new Set(selectedStorageIds);
                                if (newSet.has(s.id)) newSet.delete(s.id);
                                else newSet.add(s.id);
                                setSelectedStorageIds(newSet);
                            }}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${selectedStorageIds.has(s.id) ? 'bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-900/40' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FLUX TENDU */}
                <div className="space-y-4">
                    <h2 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-tight">
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                        Produits à Flux Tendu
                    </h2>
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-rose-50 border-b border-rose-100">
                            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Moins de 20% du stock théorique restant</p>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                            {analysis.tension.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic text-sm">Aucun produit en tension</div>
                            ) : (
                                analysis.tension.map((a, idx) => (
                                    <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm">{a.item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{a.storage.name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase">Consigne</p>
                                                <p className="font-black text-slate-900">{a.consigne.minQuantity}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 flex-wrap">
                                            {[1, 2, 3, 4, 5, 6, 0].map(d => (
                                                <span 
                                                    key={d} 
                                                    className={`w-6 h-6 flex items-center justify-center rounded-lg text-[9px] font-black uppercase ${a.days.includes(d) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-300'}`}
                                                >
                                                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'][d]}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* PRODUIT STABLE */}
                <div className="space-y-4">
                    <h2 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-tight">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Produits Stables
                    </h2>
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-emerald-50 border-b border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Entre 20% et 80% du stock consommé</p>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                            {analysis.stable.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic text-sm">Aucun produit stable analysé</div>
                            ) : (
                                analysis.stable.map((a, idx) => (
                                    <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">{a.item.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{a.storage.name}</p>
                                        </div>
                                        <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                            Stable
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* PRODUIT DORMANT */}
                <div className="space-y-4">
                    <h2 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-tight">
                        <Clock className="w-5 h-5 text-indigo-500" />
                        Produits Dormants
                    </h2>
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Aucun mouvement depuis +7 jours</p>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                            {analysis.dormant.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic text-sm">Aucun produit dormant</div>
                            ) : (
                                analysis.dormant.sort((a, b) => b.days - a.days).map((a, idx) => (
                                    <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">{a.item.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{a.storage.name}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${a.days >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {a.periodLabel}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* OPTIMIZATIONS */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <MoveHorizontal className="w-6 h-6 text-cyan-500" />
                        Propositions d'Optimisation
                    </h2>
                    <div className="bg-cyan-50 text-cyan-700 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-cyan-100 shadow-sm">
                        {optimizations.length} Propositions
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {optimizations.map((opt, idx) => (
                        <div key={idx} className={`bg-white rounded-3xl border transition-all ${appliedOptimizations.has(opt.id) ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:shadow-xl hover:border-cyan-200'}`}>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-2xl ${
                                            opt.type === 'INCREASE' ? 'bg-rose-100 text-rose-600' : 
                                            opt.type === 'DECREASE' ? 'bg-amber-100 text-amber-600' : 
                                            'bg-indigo-100 text-indigo-600'
                                        }`}>
                                            {opt.type === 'INCREASE' ? <ArrowUpCircle className="w-5 h-5" /> : 
                                             opt.type === 'DECREASE' ? <ArrowDownCircle className="w-5 h-5" /> : 
                                             <MoveHorizontal className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 leading-tight">{opt.item.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{opt.storage.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                                            opt.type === 'INCREASE' ? 'bg-rose-500 text-white' : 
                                            opt.type === 'DECREASE' ? 'bg-amber-500 text-white' : 
                                            'bg-indigo-500 text-white'
                                        }`}>
                                            {opt.type === 'INCREASE' ? 'Augmentation' : opt.type === 'DECREASE' ? 'Réduction' : 'Libération Espace'}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-sm font-medium text-slate-500 bg-slate-50 p-3 rounded-xl mb-6 border border-slate-100 flex items-start gap-2 italic leading-relaxed">
                                    <AlertCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                                    {opt.reason}
                                </p>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className="flex-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Actuel</p>
                                        <p className="text-xl font-black text-slate-700">{opt.currentConsigne}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300" />
                                    <div className="flex-1 bg-cyan-50 p-3 rounded-2xl border border-cyan-100">
                                        <p className="text-[9px] font-black text-cyan-600 uppercase mb-1">Cible</p>
                                        <p className="text-xl font-black text-cyan-700">{opt.suggestedConsigne}</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleApplyOptimization(opt)}
                                    disabled={appliedOptimizations.has(opt.id)}
                                    className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
                                        appliedOptimizations.has(opt.id) 
                                        ? 'bg-emerald-500 text-white' 
                                        : 'bg-slate-900 hover:bg-cyan-600 text-white shadow-lg active:scale-95'
                                    }`}
                                >
                                    {appliedOptimizations.has(opt.id) ? 'Cible appliquée avec succès ✓' : 'Appliquer la proposition'}
                                </button>
                            </div>
                        </div>
                    ))}

                    {optimizations.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                            <HistoryIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="font-bold text-slate-400 uppercase tracking-widest text-sm">Aucune proposition d'optimisation pour le moment</p>
                            <p className="text-slate-300 text-[10px] mt-1">L'analyse s'affine avec le temps et les mouvements de stock.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StorageOptimization;
