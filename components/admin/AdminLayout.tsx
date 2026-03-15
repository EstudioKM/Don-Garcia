import React, { useState, useEffect } from 'react';
import { getLayout, saveLayout } from '../../services/layoutRepository';
import { Layout, Environment, Table } from '../../types';
import { produce } from 'immer';
import { Plus, Trash2, Calculator, X, Link } from 'lucide-react';

const AdminLayout: React.FC = () => {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [envToDelete, setEnvToDelete] = useState<number | null>(null);
  const [editingTableJoin, setEditingTableJoin] = useState<{ envIndex: number, tableIndex: number } | null>(null);

  useEffect(() => {
    const fetchLayout = async () => {
      const layoutData = await getLayout();
      setLayout(layoutData);
      setLoading(false);
    };
    fetchLayout();
  }, []);

  const handleSave = async () => {
    if (!layout) return;
    setIsSaving(true);
    setStatus('idle');
    try {
      await saveLayout(layout);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnvironmentChange = (envIndex: number, field: 'name' | 'maxCapacity' | 'image' | 'description', value: string | number) => {
    if (!layout) return;
    const nextState = produce(layout, draftState => {
      if (field === 'maxCapacity') {
        const newMaxCapacity = Number(value);
        draftState.environments[envIndex].maxCapacity = newMaxCapacity;
        // Also update tables if their capacity is now too high
        draftState.environments[envIndex].tables.forEach(table => {
          if (table.capacity > newMaxCapacity) {
            table.capacity = newMaxCapacity;
          }
        });
      } else {
        (draftState.environments[envIndex] as any)[field] = value;
      }
    });
    setLayout(nextState);
  };
  
  const handleTableChange = (envIndex: number, tableIndex: number, field: 'name' | 'capacity', value: string | number) => {
    if (!layout) return;
    const nextState = produce(layout, draftState => {
      const table = draftState.environments[envIndex].tables[tableIndex];
      if (field === 'capacity') {
        table.capacity = Number(value);
      } else {
        (table as any)[field] = value;
      }
    });
    setLayout(nextState);
  };

  const calculateTotalCapacity = (envIndex: number) => {
    if (!layout) return;
    const total = layout.environments[envIndex].tables.reduce((sum, t) => sum + t.capacity, 0);
    handleEnvironmentChange(envIndex, 'maxCapacity', total);
  };

  const addEnvironment = () => {
    const newEnv: Environment = { id: `env-${Date.now()}`, name: "Nuevo Ambiente", maxCapacity: 20, tables: [] };
    const nextState = produce(layout, draftState => {
        draftState?.environments.push(newEnv);
    });
    setLayout(nextState!);
  };
  
  const addTable = (envIndex: number) => {
    const newTable: Table = { id: `table-${Date.now()}`, name: "Mesa X", capacity: 2 };
    const nextState = produce(layout, draftState => {
        draftState?.environments[envIndex].tables.push(newTable);
    });
    setLayout(nextState!);
  };

  const confirmDeleteEnvironment = () => {
    if (envToDelete === null || !layout) return;
    const nextState = produce(layout, draftState => {
      draftState?.environments.splice(envToDelete, 1);
    });
    setLayout(nextState!);
    setEnvToDelete(null);
  };
  
  const deleteTable = (envIndex: number, tableIndex: number) => {
      const nextState = produce(layout, draftState => {
        const env = draftState?.environments[envIndex];
        if (!env) return;
        
        const tableIdToDelete = env.tables[tableIndex].id;
        
        // Remove from other tables' joinableWith arrays
        env.tables.forEach(table => {
          if (table.joinableWith) {
            table.joinableWith = table.joinableWith.filter(id => id !== tableIdToDelete);
          }
        });
        
        env.tables.splice(tableIndex, 1);
      });
      setLayout(nextState!);
  };

  const toggleTableJoin = (envIndex: number, targetTableId: string) => {
    if (!layout || !editingTableJoin) return;
    const { tableIndex } = editingTableJoin;
    
    const nextState = produce(layout, draftState => {
      const currentTable = draftState.environments[envIndex].tables[tableIndex];
      const targetTable = draftState.environments[envIndex].tables.find(t => t.id === targetTableId);
      
      if (!currentTable || !targetTable) return;
      
      if (!currentTable.joinableWith) currentTable.joinableWith = [];
      if (!targetTable.joinableWith) targetTable.joinableWith = [];

      const currentHasTarget = currentTable.joinableWith.includes(targetTableId);
      
      if (currentHasTarget) {
        // Remove bidirectional link
        currentTable.joinableWith = currentTable.joinableWith.filter(id => id !== targetTableId);
        targetTable.joinableWith = targetTable.joinableWith.filter(id => id !== currentTable.id);
      } else {
        // Add bidirectional link
        currentTable.joinableWith.push(targetTableId);
        targetTable.joinableWith.push(currentTable.id);
      }
    });
    setLayout(nextState);
  };

  if (loading) return <div className="text-white text-center p-10">Cargando diseño del salón...</div>;

  return (
    <div className="space-y-8">
      {/* Confirmation Modal */}
      {envToDelete !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 p-8 rounded-2xl max-w-sm w-full shadow-2xl animate-scaleIn">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-red-500" size={32} />
            </div>
            <h4 className="text-xl font-serif text-white text-center mb-2">¿Eliminar Ambiente?</h4>
            <p className="text-stone-400 text-center text-sm mb-8">
              Esta acción eliminará el ambiente "{layout?.environments[envToDelete]?.name}" y todas sus mesas de forma permanente.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setEnvToDelete(null)}
                className="flex-1 py-3 px-4 bg-stone-800 text-stone-300 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-stone-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteEnvironment}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Join Modal */}
      {editingTableJoin !== null && layout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-scaleIn relative">
            <button 
              onClick={() => setEditingTableJoin(null)}
              className="absolute top-4 right-4 text-stone-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Link className="text-gold" size={32} />
            </div>
            <h4 className="text-xl font-serif text-white text-center mb-2">Unir Mesas</h4>
            <p className="text-stone-400 text-center text-sm mb-6">
              Selecciona las mesas que se pueden unir con "{layout.environments[editingTableJoin.envIndex].tables[editingTableJoin.tableIndex].name}".
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-8 pr-2 custom-scrollbar">
              {layout.environments[editingTableJoin.envIndex].tables.map(table => {
                if (table.id === layout.environments[editingTableJoin.envIndex].tables[editingTableJoin.tableIndex].id) return null;
                const isJoined = layout.environments[editingTableJoin.envIndex].tables[editingTableJoin.tableIndex].joinableWith?.includes(table.id);
                return (
                  <button
                    key={table.id}
                    onClick={() => toggleTableJoin(editingTableJoin.envIndex, table.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${isJoined ? 'bg-gold/10 border-gold text-white' : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-600'}`}
                  >
                    <span className="font-medium">{table.name}</span>
                    <span className="text-xs">Cap: {table.capacity}</span>
                  </button>
                );
              })}
            </div>
            <button 
              onClick={() => setEditingTableJoin(null)}
              className="w-full py-3 px-4 bg-gold text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors shadow-lg shadow-gold/20"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-stone-900/20 p-4 rounded-lg border border-stone-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gold/10 rounded-lg">
            <Calculator className="text-gold" size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Configuración de Espacios</h4>
            <p className="text-[10px] text-stone-500 uppercase tracking-widest">Define la capacidad y distribución de mesas</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={addEnvironment}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-bold hover:bg-stone-700 transition-colors border border-stone-700"
          >
            <Plus size={14} />
            Nuevo Ambiente
          </button>
          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300 border ${ 
              status === 'success' ? 'bg-green-800 border-green-700 text-white' : 
              status === 'error' ? 'bg-red-800 border-red-700 text-white' : 
              'bg-gold border-gold text-white hover:bg-white hover:text-black shadow-lg shadow-gold/10'
            }`}
          >
            {isSaving ? 'Guardando...' : status === 'success' ? '¡Listo!' : 'Guardar Diseño'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {layout?.environments.map((env, envIndex) => {
          const tablesSum = env.tables.reduce((sum, t) => sum + t.capacity, 0);
          
          return (
            <div key={env.id} className="group bg-stone-900/40 border border-stone-800/60 rounded-xl overflow-hidden transition-all hover:border-stone-700/80">
              <div className="p-4 bg-black/20 border-b border-stone-800/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-grow min-w-[200px]">
                  <input 
                    value={env.name} 
                    onChange={e => handleEnvironmentChange(envIndex, 'name', e.target.value)} 
                    className="text-lg font-serif text-gold bg-transparent border-b border-transparent focus:border-gold/30 focus:ring-0 px-1 py-0.5 w-full max-w-xs transition-colors"
                    placeholder="Nombre del ambiente"
                  />
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">URL de Imagen</label>
                    <input 
                      value={env.image || ''} 
                      onChange={e => handleEnvironmentChange(envIndex, 'image', e.target.value)} 
                      className="w-full bg-stone-950 text-stone-300 py-1.5 px-3 rounded-lg border border-stone-800 focus:border-gold outline-none text-xs"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">Descripción</label>
                    <input 
                      value={env.description || ''} 
                      onChange={e => handleEnvironmentChange(envIndex, 'description', e.target.value)} 
                      className="w-full bg-stone-950 text-stone-300 py-1.5 px-3 rounded-lg border border-stone-800 focus:border-gold outline-none text-xs"
                      placeholder="Breve descripción del ambiente..."
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-6 mt-4 md:mt-0">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <label className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">Capacidad Máx.</label>
                      {tablesSum !== env.maxCapacity && (
                        <button 
                          onClick={() => calculateTotalCapacity(envIndex)}
                          className="text-[8px] text-gold hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Calculator size={8} />
                          Usar suma ({tablesSum})
                        </button>
                      )}
                    </div>
                    <input 
                      type="number" 
                      value={env.maxCapacity} 
                      onChange={e => handleEnvironmentChange(envIndex, 'maxCapacity', parseInt(e.target.value) || 0)} 
                      className="w-16 bg-stone-950 text-white py-1.5 px-2 rounded-lg border border-stone-800 focus:border-gold outline-none text-center text-sm font-bold"
                    />
                  </div>
                  
                  <button 
                    onClick={() => setEnvToDelete(envIndex)} 
                    className="p-2 text-stone-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Eliminar Ambiente"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {env.tables.map((table, tableIndex) => (
                    <div key={table.id} className="group/table bg-stone-950/40 p-2 rounded-lg flex items-center gap-2 border border-stone-800/50 hover:border-stone-700 transition-colors min-w-0">
                      <input 
                        value={table.name} 
                        onChange={e => handleTableChange(envIndex, tableIndex, 'name', e.target.value)} 
                        className="flex-1 bg-transparent text-stone-300 text-xs py-1 px-2 rounded border border-transparent focus:border-stone-700 focus:bg-stone-900 outline-none transition-all min-w-0"
                        placeholder="Mesa..."
                      />
                      <div className="flex-shrink-0 flex items-center gap-1 bg-stone-900 rounded-md border border-stone-800 px-1.5 py-0.5">
                        <span className="text-[8px] text-stone-600 font-bold">CAP.</span>
                        <input 
                          type="number" 
                          value={table.capacity} 
                          onChange={e => handleTableChange(envIndex, tableIndex, 'capacity', parseInt(e.target.value) || 0)} 
                          className="w-7 bg-transparent text-white outline-none text-center text-xs font-bold"
                        />
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover/table:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingTableJoin({ envIndex, tableIndex })}
                          className={`p-1 rounded transition-all ${table.joinableWith?.length ? 'text-gold hover:bg-gold/10' : 'text-stone-500 hover:text-gold hover:bg-gold/10'}`}
                          title="Unir con otras mesas"
                        >
                          <Link size={14} />
                        </button>
                        <button 
                          onClick={() => deleteTable(envIndex, tableIndex)} 
                          className="p-1 text-stone-700 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                          title="Eliminar Mesa"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => addTable(envIndex)} 
                    className="flex items-center justify-center gap-2 p-2 border border-dashed border-stone-800 text-stone-600 rounded-lg hover:border-gold/50 hover:text-gold hover:bg-gold/5 transition-all text-[10px] uppercase tracking-widest font-bold min-h-[42px]"
                  >
                    <Plus size={14} />
                    Agregar Mesa
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {layout?.environments.length === 0 && (
          <div className="p-12 text-center border-2 border-dashed border-stone-800 rounded-2xl bg-stone-900/10">
            <Calculator className="mx-auto text-stone-800 mb-4" size={48} />
            <p className="text-stone-600 text-sm">No hay ambientes configurados.</p>
            <button 
              onClick={addEnvironment}
              className="mt-4 px-6 py-2 bg-stone-800 text-stone-400 rounded-lg text-xs font-bold hover:bg-stone-700 transition-colors"
            >
              Crear primer ambiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLayout;