import React, { useState } from 'react';

interface SqlEditorProps {
    onSync: (action: string, payload: any) => void;
}

const SqlEditor: React.FC<SqlEditorProps> = ({ onSync }) => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExecute = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            // We use fetch directly because syncData doesn't return the response body
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'EXECUTE_SQL', payload: { query } })
            });
            const data = await response.json();
            if (data.success) {
                setResult(data);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900">Éditeur SQL Neon</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setQuery('SELECT * FROM items LIMIT 10;')}
                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Exemple: Items
                        </button>
                        <button 
                            onClick={() => setQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")}
                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Exemple: Tables
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Entrez votre requête SQL ici..."
                        className="w-full h-48 p-4 font-mono text-sm bg-slate-900 text-indigo-300 rounded-2xl border-2 border-slate-800 focus:border-indigo-500 focus:ring-0 transition-all resize-none"
                    />
                    <button
                        onClick={handleExecute}
                        disabled={loading || !query.trim()}
                        className={`absolute bottom-4 right-4 px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all ${loading || !query.trim() ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-900/20'}`}
                    >
                        {loading ? 'Exécution...' : 'Exécuter'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                    <div>
                        <p className="text-xs font-black text-rose-900 uppercase tracking-widest mb-1">Erreur SQL</p>
                        <p className="text-sm text-rose-700 font-medium">{error}</p>
                    </div>
                </div>
            )}

            {result && (
                <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Résultats</span>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">{result.rowCount} lignes</span>
                        </div>
                        <button 
                            onClick={() => setResult(null)}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                        >
                            Effacer
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    {result.fields.map((field: any) => (
                                        <th key={field.name} className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                                            {field.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.map((row: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                        {result.fields.map((field: any) => (
                                            <td key={field.name} className="p-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                                                {row[field.name] === null ? (
                                                    <span className="text-slate-300 italic">null</span>
                                                ) : typeof row[field.name] === 'object' ? (
                                                    <code className="text-[10px] bg-slate-100 px-1 rounded">{JSON.stringify(row[field.name])}</code>
                                                ) : (
                                                    String(row[field.name])
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SqlEditor;
