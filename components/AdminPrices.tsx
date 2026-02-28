import React, { useState, useMemo } from 'react';
import { StockItem, ProductSheet, Format, AppConfig, Recipe } from '../types';

interface AdminPricesProps {
    items: StockItem[];
    productSheets: ProductSheet[];
    formats: Format[];
    appConfig: AppConfig;
    onSync: (action: string, payload: any) => void;
    setProductSheets: React.Dispatch<React.SetStateAction<ProductSheet[]>>;
    recipes: Recipe[];
    setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
}

const AdminPrices: React.FC<AdminPricesProps> = ({ items, productSheets, formats, appConfig, onSync, setProductSheets, recipes, setRecipes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

    const defaultMargin = appConfig.defaultMargin || 82;

    const data = useMemo(() => {
        const productData = productSheets.map(sheet => {
            const item = items.find(i => i.id === sheet.itemId);
            if (!item) return null;

            const format = formats.find(f => f.id === item.formatId);
            const formatValue = format?.value || 1;
            
            const marginRate = sheet.marginRate !== undefined ? sheet.marginRate : defaultMargin;
            const salesFormat = sheet.salesFormat || 0;
            const actualPrice = sheet.actualPrice || 0;

            const cost = (item.pricePerUnit / formatValue) * salesFormat;
            const recommendedPrice = marginRate < 100 ? cost / (1 - marginRate / 100) : 0;
            const actualMargin = actualPrice > 0 ? ((actualPrice - cost) / actualPrice) * 100 : 0;
            const isRespected = actualPrice >= recommendedPrice;

            return {
                type: 'PRODUCT',
                id: sheet.id,
                name: item.name,
                category: item.category,
                buyPrice: item.pricePerUnit,
                refFormat: formatValue,
                salesFormat,
                marginRate,
                recommendedPrice,
                actualPrice,
                actualMargin,
                isRespected,
                cost
            };
        }).filter(Boolean);

        const cocktailData = recipes.map(recipe => {
            // Calculate cost from ingredients
            const cost = recipe.ingredients.reduce((acc, ing) => {
                if (!ing.itemId) return acc;
                const item = items.find(i => i.id === ing.itemId);
                if (!item || !item.pricePerUnit) return acc;
                const format = formats.find(f => f.id === item.formatId);
                const divider = format?.value || 70;
                let qtyInCl = ing.quantity;
                if (ing.unit === 'ml') qtyInCl = ing.quantity / 10;
                if (ing.unit === 'dash') qtyInCl = ing.quantity * 0.1;
                if (ing.unit === 'piece') qtyInCl = 1;
                return acc + (item.pricePerUnit / divider) * qtyInCl;
            }, 0);

            const actualPrice = recipe.sellingPrice || 0;
            const marginRate = defaultMargin; // Cocktails use default margin for recommendation
            const recommendedPrice = marginRate < 100 ? cost / (1 - marginRate / 100) : 0;
            const actualMargin = actualPrice > 0 ? ((actualPrice - cost) / actualPrice) * 100 : 0;
            const isRespected = actualPrice >= recommendedPrice;

            return {
                type: 'COCKTAIL',
                id: recipe.id,
                name: recipe.name,
                category: 'Cocktail',
                buyPrice: cost, // For cocktails, buyPrice is the total cost
                refFormat: 1,
                salesFormat: 1,
                marginRate,
                recommendedPrice,
                actualPrice,
                actualMargin,
                isRespected,
                cost
            };
        });

        return [...productData, ...cocktailData] as any[];
    }, [productSheets, items, formats, defaultMargin, recipes]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'ALL' || d.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [data, searchTerm, categoryFilter]);

    const categories = Array.from(new Set(data.map(d => d.category)));

    const handleUpdate = (id: string, type: string, field: string, value: number) => {
        if (type === 'PRODUCT') {
            const sheet = productSheets.find(s => s.id === id);
            if (!sheet) return;
            const updatedSheet = { ...sheet, [field]: value, updatedAt: new Date().toISOString() };
            setProductSheets(prev => prev.map(s => s.id === id ? updatedSheet : s));
            onSync('SAVE_PRODUCT_SHEET', updatedSheet);
        } else {
            const recipe = recipes.find(r => r.id === id);
            if (!recipe) return;
            const updatedRecipe = { ...recipe, [field === 'actualPrice' ? 'sellingPrice' : field]: value };
            setRecipes(prev => prev.map(r => r.id === id ? updatedRecipe : r));
            onSync('SAVE_RECIPE', updatedRecipe);
        }
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
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-900">{row.name}</div>
                                        <div className="text-xs text-slate-500">{row.category}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-sm text-slate-600">
                                        {row.buyPrice.toFixed(2)} €
                                    </td>
                                    <td className="p-4 text-right font-mono text-sm text-slate-600">
                                        {row.refFormat || '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <input 
                                            type="number" 
                                            value={row.salesFormat || ''} 
                                            onChange={(e) => handleUpdate(row.id, row.type, 'salesFormat', parseFloat(e.target.value) || 0)}
                                            className="w-20 text-right p-1 border border-slate-200 rounded bg-white text-sm font-mono disabled:opacity-50"
                                            placeholder="ex: 4"
                                            step="0.1"
                                            disabled={row.type === 'COCKTAIL'}
                                        />
                                    </td>
                                    <td className="p-4 text-right">
                                        <input 
                                            type="number" 
                                            value={row.marginRate !== undefined ? row.marginRate : ''} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                handleUpdate(row.id, row.type, 'marginRate', val === '' ? defaultMargin : parseFloat(val));
                                            }}
                                            className="w-16 text-right p-1 border border-slate-200 rounded bg-white text-sm font-mono disabled:opacity-50"
                                            placeholder={defaultMargin.toString()}
                                            step="1"
                                            disabled={row.type === 'COCKTAIL'}
                                        />
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-900">
                                        {row.recommendedPrice > 0 ? `${row.recommendedPrice.toFixed(2)} €` : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <input 
                                            type="number" 
                                            value={row.actualPrice || ''} 
                                            onChange={(e) => handleUpdate(row.id, row.type, 'actualPrice', parseFloat(e.target.value) || 0)}
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
