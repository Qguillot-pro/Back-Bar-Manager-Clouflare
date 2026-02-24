import React, { useState, useMemo } from 'react';
import { StockItem, ProductSheet, Format, AppConfig } from '../types';

interface AdminPricesProps {
    items: StockItem[];
    productSheets: ProductSheet[];
    formats: Format[];
    appConfig: AppConfig;
    onSync: (action: string, payload: any) => void;
    setProductSheets: React.Dispatch<React.SetStateAction<ProductSheet[]>>;
}

const AdminPrices: React.FC<AdminPricesProps> = ({ items, productSheets, formats, appConfig, onSync, setProductSheets }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

    const defaultMargin = appConfig.defaultMargin || 82;

    const data = useMemo(() => {
        return productSheets.map(sheet => {
            const item = items.find(i => i.id === sheet.itemId);
            if (!item) return null;

            const format = formats.find(f => f.id === item.formatId);
            const formatValue = format?.value || 1; // Avoid division by zero
            
            const marginRate = sheet.marginRate !== undefined ? sheet.marginRate : defaultMargin;
            const salesFormat = sheet.salesFormat || 0;
            const actualPrice = sheet.actualPrice || 0;

            // Cost calculation: (Unit Price / Reference Format Value) * Sales Format Value
            const cost = (item.pricePerUnit / formatValue) * salesFormat;
            
            // Recommended Price calculation: Cost / (1 - Margin Rate / 100)
            const recommendedPrice = marginRate < 100 ? cost / (1 - marginRate / 100) : 0;

            // Margin check
            // Actual Margin = (Actual Price - Cost) / Actual Price
            const actualMargin = actualPrice > 0 ? ((actualPrice - cost) / actualPrice) * 100 : 0;
            const isRespected = actualPrice >= recommendedPrice;

            return {
                sheet,
                item,
                format,
                cost,
                marginRate,
                salesFormat,
                actualPrice,
                recommendedPrice,
                actualMargin,
                isRespected
            };
        }).filter(Boolean) as any[];
    }, [productSheets, items, formats, defaultMargin]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesSearch = d.item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'ALL' || d.item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [data, searchTerm, categoryFilter]);

    const categories = Array.from(new Set(items.map(i => i.category)));

    const handleUpdateSheet = (sheetId: string, field: string, value: number) => {
        const sheet = productSheets.find(s => s.id === sheetId);
        if (!sheet) return;

        const updatedSheet = { ...sheet, [field]: value, updatedAt: new Date().toISOString() };
        
        setProductSheets(prev => prev.map(s => s.id === sheetId ? updatedSheet : s));
        onSync('SAVE_PRODUCT_SHEET', updatedSheet);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Prix Conseillés (Admin)</h2>
                    <p className="text-slate-500 text-sm mt-1">Surveillance des taux de marge et prix de vente</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Rechercher un produit..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="ALL">Toutes les catégories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                                <th className="p-4 font-bold">Produit</th>
                                <th className="p-4 font-bold text-right">Prix Achat (€HT)</th>
                                <th className="p-4 font-bold text-right">Format Réf.</th>
                                <th className="p-4 font-bold text-right">Format Vente</th>
                                <th className="p-4 font-bold text-right">Taux Marge (%)</th>
                                <th className="p-4 font-bold text-right">Prix Conseillé (€HT)</th>
                                <th className="p-4 font-bold text-right">Prix Actuel (€HT)</th>
                                <th className="p-4 font-bold text-center">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map((row) => (
                                <tr key={row.sheet.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-900">{row.item.name}</div>
                                        <div className="text-xs text-slate-500">{row.item.category}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-sm text-slate-600">
                                        {row.item.pricePerUnit.toFixed(2)} €
                                    </td>
                                    <td className="p-4 text-right font-mono text-sm text-slate-600">
                                        {row.format?.value || '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <input 
                                            type="number" 
                                            value={row.salesFormat || ''} 
                                            onChange={(e) => handleUpdateSheet(row.sheet.id, 'salesFormat', parseFloat(e.target.value) || 0)}
                                            className="w-20 text-right p-1 border border-slate-200 rounded bg-white text-sm font-mono"
                                            placeholder="ex: 4"
                                            step="0.1"
                                        />
                                    </td>
                                    <td className="p-4 text-right">
                                        <input 
                                            type="number" 
                                            value={row.sheet.marginRate !== undefined ? row.sheet.marginRate : ''} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                handleUpdateSheet(row.sheet.id, 'marginRate', val === '' ? defaultMargin : parseFloat(val));
                                            }}
                                            className="w-16 text-right p-1 border border-slate-200 rounded bg-white text-sm font-mono"
                                            placeholder={defaultMargin.toString()}
                                            step="1"
                                        />
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-900">
                                        {row.recommendedPrice > 0 ? `${row.recommendedPrice.toFixed(2)} €` : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <input 
                                            type="number" 
                                            value={row.actualPrice || ''} 
                                            onChange={(e) => handleUpdateSheet(row.sheet.id, 'actualPrice', parseFloat(e.target.value) || 0)}
                                            className={`w-24 text-right p-1 border rounded text-sm font-mono font-bold ${row.actualPrice > 0 ? (row.isRespected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700') : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="0.00"
                                            step="0.1"
                                        />
                                    </td>
                                    <td className="p-4 text-center">
                                        {row.actualPrice > 0 && row.recommendedPrice > 0 ? (
                                            row.isRespected ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                    OK ({row.actualMargin.toFixed(1)}%)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    Bas ({row.actualMargin.toFixed(1)}%)
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-xs text-slate-400 font-medium">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-500">
                                        Aucun produit trouvé.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminPrices;
