
import React, { useState } from 'react';
import { StockItem, Category } from '../types';
import { Warehouse, Search, Save, Printer, FileText, CheckSquare } from 'lucide-react';

interface ExternalStorageConfigProps {
    items: StockItem[];
    categories: Category[];
    onSync: (action: string, payload: any) => void;
}

const ExternalStorageConfig: React.FC<ExternalStorageConfigProps> = ({ items, categories, onSync }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingLocations, setEditingLocations] = useState<Record<string, string>>({});

    const filteredItems = items.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    const handleLocationChange = (id: string, value: string) => {
        if (value.length > 8) return; // Constraint: 8 chars max
        setEditingLocations(prev => ({ ...prev, [id]: value.toUpperCase() }));
    };

    const handleSave = (item: StockItem) => {
        const newLoc = editingLocations[item.id];
        if (newLoc === undefined) return;
        onSync('SAVE_ITEM', { ...item, externalLocation: newLoc });
    };

    const handlePrintList = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const productsByLoc = items
            .filter(i => i.externalLocation)
            .sort((a, b) => (a.externalLocation || '').localeCompare(b.externalLocation || ''));

        printWindow.document.write(`
            <html>
                <head>
                    <title>Plan de Stockage Cave</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        h1 { text-transform: uppercase; font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background: #f8fafc; font-weight: 800; text-transform: uppercase; font-size: 12px; }
                        td { font-size: 14px; }
                        .loc { font-family: monospace; font-weight: 800; color: #0891b2; }
                    </style>
                </head>
                <body>
                    <h1>Plan de Stockage - Cave Restaurant</h1>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 150px;">Emplacement</th>
                                <th>Produit</th>
                                <th>Catégorie</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productsByLoc.map(p => `
                                <tr>
                                    <td class="loc">${p.externalLocation}</td>
                                    <td><strong>${p.name}</strong></td>
                                    <td>${p.category}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <script>window.print();</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                        <Warehouse className="w-6 h-6 text-cyan-600" />
                        Organisation Cave (Stock Extérieur)
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Gestion des emplacements produits hors-bar</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={handlePrintList}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-600 transition-all shadow-lg"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimer Plan Cave
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Rechercher un produit ou s'il est déjà en cave..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-cyan-500 transition-colors"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 italic">
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produit</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Emplacement (8 CAR.)</th>
                                <th className="p-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[10px] font-black px-2 py-1 bg-slate-100 text-slate-500 rounded-lg uppercase tracking-wider">
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <input 
                                            type="text"
                                            maxLength={8}
                                            className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-cyan-700 uppercase outline-none focus:border-cyan-500 focus:bg-white transition-all"
                                            placeholder="Ex: A-01"
                                            value={editingLocations[item.id] !== undefined ? editingLocations[item.id] : (item.externalLocation || '')}
                                            onChange={e => handleLocationChange(item.id, e.target.value)}
                                        />
                                    </td>
                                    <td className="p-4 text-right">
                                        {editingLocations[item.id] !== undefined && editingLocations[item.id] !== (item.externalLocation || '') && (
                                            <button 
                                                onClick={() => handleSave(item)}
                                                className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ExternalStorageConfig;
