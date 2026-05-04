
import React, { useState } from 'react';
import { Glassware } from '../types';
import { Printer, CheckCircle2, Circle } from 'lucide-react';

interface GlasswareConfigProps {
  glassware: Glassware[];
  setGlassware: React.Dispatch<React.SetStateAction<Glassware[]>>;
  onSync: (action: string, payload: any) => void;
}

const GlasswareConfig: React.FC<GlasswareConfigProps> = ({ glassware, setGlassware, onSync }) => {
  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState(0);
  const [newQuantity, setNewQuantity] = useState(0);
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());

  const handleAdd = () => {
      if (!newName) return;
      const newItem: Glassware = {
          id: 'g' + Date.now(),
          name: newName,
          capacity: newCapacity,
          imageUrl: '', // Placeholder
          quantity: newQuantity,
          lastUpdated: new Date().toISOString()
      };
      setGlassware(prev => [...prev, newItem]);
      onSync('SAVE_GLASSWARE', newItem);
      setNewName('');
      setNewCapacity(0);
      setNewQuantity(0);
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
      const now = new Date().toISOString();
      setGlassware(prev => prev.map(g => g.id === id ? { ...g, quantity: qty, lastUpdated: now } : g));
      
      const item = glassware.find(g => g.id === id);
      if (item) {
          onSync('SAVE_GLASSWARE', { ...item, quantity: qty, lastUpdated: now });
      }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsToPrint = selectedForPrint.size > 0 
        ? glassware.filter(g => selectedForPrint.has(g.id))
        : glassware;

    let html = `
      <html>
        <head>
          <title>Inventaire Verrerie</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
            }
            body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; margin: 0; padding: 20px; }
            .header { 
              border-bottom: 3px solid #06b6d4; 
              padding-bottom: 15px; 
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em; color: #0891b2; }
            .date { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f8fafc; padding: 12px 15px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
            td { padding: 15px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
            .qty { font-weight: 900; color: #0891b2; text-align: center; font-size: 18px; }
            .item-name { color: #0f172a; font-weight: 700; }
            .item-cap { color: #94a3b8; font-size: 11px; font-weight: 600; }
            .item-updated { color: #94a3b8; font-size: 9px; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="date">Inventaire de Verrerie • ${new Date().toLocaleDateString('fr-FR')}</div>
              <div class="title">Stock Verrerie Disponible</div>
            </div>
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8;">BACK BAR MANAGER</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 50%">Désignation Verre</th>
                <th style="width: 20%">Dernière MàJ</th>
                <th style="width: 30%; text-align: center;">Stock Reel</th>
              </tr>
            </thead>
            <tbody>
              ${itemsToPrint.map(g => `
                <tr>
                  <td>
                    <div class="item-name">${g.name}</div>
                    <div class="item-cap">${g.capacity} cl</div>
                  </td>
                  <td class="item-updated">${g.lastUpdated ? new Date(g.lastUpdated).toLocaleDateString() : '-'}</td>
                  <td class="qty">${g.quantity || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 100);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const togglePrintSelection = (id: string) => {
    const newSet = new Set(selectedForPrint);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedForPrint(newSet);
  };

  const toggleAllPrint = () => {
    if (selectedForPrint.size === glassware.length) setSelectedForPrint(new Set());
    else setSelectedForPrint(new Set(glassware.map(g => g.id)));
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Supprimer ce verre ?")) {
          setGlassware(prev => prev.filter(g => g.id !== id));
          onSync('DELETE_GLASSWARE', { id });
      }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
        <div className="flex justify-between items-center">
            <h3 className="font-black text-sm uppercase flex items-center gap-2"><span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>Verrerie Disponible</h3>
            <div className="flex gap-2">
                <button 
                    onClick={toggleAllPrint}
                    className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                    {selectedForPrint.size === glassware.length && glassware.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
                <button 
                    onClick={handlePrint}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-100 hover:bg-cyan-600 transition-all flex items-center gap-2"
                >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer {selectedForPrint.size > 0 ? `(${selectedForPrint.size})` : ''}
                </button>
            </div>
        </div>
        
        <div className="flex gap-2">
            <input className="flex-1 bg-slate-50 p-4 border rounded-2xl font-bold outline-none" placeholder="Nom (ex: Coupette)..." value={newName} onChange={e => setNewName(e.target.value)} />
            <div className="flex flex-col w-24">
                <input type="number" className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-center" placeholder="Cl" value={newCapacity || ''} onChange={e => setNewCapacity(parseFloat(e.target.value))} />
                <label className="text-[8px] font-black text-slate-400 text-center uppercase">Capacité</label>
            </div>
            <div className="flex flex-col w-24">
                <input type="number" className="w-full bg-slate-50 p-4 border rounded-2xl font-bold outline-none text-center" placeholder="Qté" value={newQuantity || ''} onChange={e => setNewQuantity(parseInt(e.target.value))} />
                <label className="text-[8px] font-black text-slate-400 text-center uppercase">Stock</label>
            </div>
            <button onClick={handleAdd} className="bg-cyan-500 text-white px-6 rounded-2xl font-black uppercase tracking-widest hover:bg-cyan-600 h-[58px]">Ajouter</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {glassware.map(g => (
                <div 
                    key={g.id} 
                    onClick={() => togglePrintSelection(g.id)}
                    className={`p-4 rounded-2xl border transition-all group relative cursor-pointer ${selectedForPrint.has(g.id) ? 'bg-cyan-50 border-cyan-200 shadow-sm shadow-cyan-100' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3">
                            <div className={`mt-1 transition-colors ${selectedForPrint.has(g.id) ? 'text-cyan-500' : 'text-slate-300'}`}>
                                {selectedForPrint.has(g.id) ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{g.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{g.capacity} cl</p>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }} 
                            className="text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-4 bg-white p-2 rounded-xl border border-slate-200" onClick={e => e.stopPropagation()}>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Stock :</span>
                        <input 
                            type="number" 
                            className="w-16 font-black text-slate-900 outline-none text-center bg-transparent" 
                            value={g.quantity || 0} 
                            onChange={(e) => handleUpdateQuantity(g.id, parseInt(e.target.value))}
                        />
                    </div>
                    {g.lastUpdated && (
                        <p className="text-[8px] font-bold text-slate-400 mt-2 text-right">
                            MàJ: {new Date(g.lastUpdated).toLocaleDateString()}
                        </p>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

export default GlasswareConfig;
