import React, { useState, useEffect } from 'react';
import { getRestaurantSettings, saveRestaurantSettings } from '../../services/settingsRepository';
import { getLayout } from '../../services/layoutRepository';
import { RestaurantSettings, DaySetting, Layout, Environment, SpecialDay, Shift } from '../../types';
import { produce } from 'immer';
import AdminLayout from './AdminLayout';
import { Calendar, Plus, Trash2, Info, ChevronDown, ChevronUp } from 'lucide-react';

const DayCard: React.FC<{
  dayKey: keyof RestaurantSettings['days'];
  dayName: string;
  settings: DaySetting;
  environments: Environment[];
  onUpdate: (dayKey: keyof RestaurantSettings['days'], newSettings: DaySetting) => void;
}> = ({ dayKey, dayName, settings, environments, onUpdate }) => {
  const [expandedShift, setExpandedShift] = useState<'mediodia' | 'noche' | null>(null);
  
  const handleDayToggle = (isOpen: boolean) => {
    onUpdate(dayKey, produce(settings, draft => {
      draft.isOpen = isOpen;
    }));
  };
  
  const handleShiftToggle = (shift: 'mediodia' | 'noche', isActive: boolean) => {
    onUpdate(dayKey, produce(settings, draft => {
      draft.shifts[shift].isActive = isActive;
      if (isActive && !draft.shifts[shift].activeEnvironments) {
        draft.shifts[shift].activeEnvironments = environments.map(e => e.id);
      }
    }));
  };

  const handleEnvironmentToggle = (shift: 'mediodia' | 'noche', envId: string, isActive: boolean) => {
    onUpdate(dayKey, produce(settings, draft => {
      const shiftData = draft.shifts[shift];
      if (!shiftData.activeEnvironments) {
        shiftData.activeEnvironments = environments.map(e => e.id);
      }
      
      if (isActive) {
        if (!shiftData.activeEnvironments.includes(envId)) {
          shiftData.activeEnvironments.push(envId);
        }
      } else {
        shiftData.activeEnvironments = shiftData.activeEnvironments.filter(id => id !== envId);
      }
    }));
  };

  return (
    <div className={`rounded-xl border transition-all duration-500 overflow-hidden ${settings.isOpen ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-950 border-stone-900 opacity-60'}`}>
      <div className="p-4 flex justify-between items-center bg-black/20">
        <h4 className={`text-lg font-serif transition-colors ${settings.isOpen ? 'text-white' : 'text-stone-600'}`}>{dayName}</h4>
        <label className="flex items-center cursor-pointer scale-75 origin-right">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={settings.isOpen} onChange={e => handleDayToggle(e.target.checked)} />
            <div className={`block w-14 h-8 rounded-full transition ${settings.isOpen ? 'bg-gold' : 'bg-stone-800'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.isOpen ? 'translate-x-6' : 'translate-x-0'}`}></div>
          </div>
        </label>
      </div>
      
      {settings.isOpen && (
        <div className="p-4 space-y-3 animate-fadeInUp">
          {(['mediodia', 'noche'] as const).map(shiftKey => (
            <div key={shiftKey} className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-stone-800/50">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id={`${dayKey}-${shiftKey}`} 
                    className="h-4 w-4 rounded bg-stone-700 border-stone-600 text-gold focus:ring-gold" 
                    checked={settings.shifts[shiftKey].isActive} 
                    onChange={e => handleShiftToggle(shiftKey, e.target.checked)}
                  />
                  <label htmlFor={`${dayKey}-${shiftKey}`} className="text-sm font-bold text-stone-300 capitalize">{shiftKey}</label>
                </div>
                {settings.shifts[shiftKey].isActive && (
                  <button 
                    onClick={() => setExpandedShift(expandedShift === shiftKey ? null : shiftKey)}
                    className="text-stone-500 hover:text-gold transition-colors"
                  >
                    {expandedShift === shiftKey ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>

              {settings.shifts[shiftKey].isActive && expandedShift === shiftKey && (
                <div className="pl-7 pr-2 py-2 space-y-2 animate-fadeIn">
                  <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-2">Espacios Activos:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {environments.map(env => {
                      const isActive = settings.shifts[shiftKey].activeEnvironments?.includes(env.id) ?? true;
                      return (
                        <div key={env.id} className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id={`${dayKey}-${shiftKey}-${env.id}`}
                            className="h-3 w-3 rounded bg-stone-800 border-stone-700 text-gold focus:ring-gold"
                            checked={isActive}
                            onChange={e => handleEnvironmentToggle(shiftKey, env.id, e.target.checked)}
                          />
                          <label htmlFor={`${dayKey}-${shiftKey}-${env.id}`} className="text-xs text-stone-400">{env.name}</label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'horarios' | 'especiales' | 'diseno'>('horarios');
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const dayNames: Record<keyof RestaurantSettings['days'], string> = {
    lunes: 'Lunes',
    martes: 'Martes',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    sabado: 'Sábado',
    domingo: 'Domingo',
  };

  useEffect(() => {
    const loadData = async () => {
      const [settingsData, layoutData] = await Promise.all([
        getRestaurantSettings(),
        getLayout()
      ]);
      setSettings(settingsData);
      setLayout(layoutData);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleUpdateDay = (dayKey: keyof RestaurantSettings['days'], newSettings: DaySetting) => {
      setSettings(produce(settings, draft => {
          if (draft) {
              draft.days[dayKey] = newSettings;
          }
      }));
  };

  const handleAddSpecialDay = () => {
    setSettings(produce(settings, draft => {
      if (draft) {
        if (!draft.specialDays) draft.specialDays = [];
        const newSpecialDay: SpecialDay = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString().split('T')[0],
          name: 'Nuevo Día Especial',
          isOpen: true,
          shifts: {
            mediodia: { isActive: true, activeEnvironments: layout?.environments.map(e => e.id) || [] },
            noche: { isActive: true, activeEnvironments: layout?.environments.map(e => e.id) || [] }
          }
        };
        draft.specialDays.push(newSpecialDay);
      }
    }));
  };

  const handleUpdateSpecialDay = (id: string, updatedDay: SpecialDay) => {
    setSettings(produce(settings, draft => {
      if (draft && draft.specialDays) {
        const index = draft.specialDays.findIndex(d => d.id === id);
        if (index !== -1) {
          draft.specialDays[index] = updatedDay;
        }
      }
    }));
  };

  const handleRemoveSpecialDay = (id: string) => {
    setSettings(produce(settings, draft => {
      if (draft && draft.specialDays) {
        draft.specialDays = draft.specialDays.filter(d => d.id !== id);
      }
    }));
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setStatus('idle');
    try {
      await saveRestaurantSettings(settings);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-white text-center p-10">Cargando ajustes del restaurante...</div>;
  if (!settings) return <div className="text-red-500 text-center p-10">Error al cargar la configuración.</div>;
  
  return (
    <>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-10">
        <div>
          <h3 className="text-2xl font-serif text-white">
            {activeTab === 'horarios' ? 'Horarios Generales' : activeTab === 'especiales' ? 'Días Especiales' : 'Diseño del Salón'}
          </h3>
          <p className="text-stone-500 text-sm mt-1">
            {activeTab === 'horarios' ? 'Define la configuración semanal base de tu restaurante.' : 
             activeTab === 'especiales' ? 'Configura excepciones para feriados o eventos puntuales.' : 
             'Organice los ambientes, mesas y capacidad de su restaurante.'}
          </p>
        </div>
        <div className="flex gap-2 rounded-full bg-stone-800/50 p-1 self-start md:self-center">
          <button onClick={() => setActiveTab('horarios')} className={`px-4 py-1.5 text-[10px] rounded-full uppercase tracking-widest font-bold transition-colors ${activeTab === 'horarios' ? 'bg-gold text-black' : 'text-stone-400'}`}>Horarios</button>
          <button onClick={() => setActiveTab('especiales')} className={`px-4 py-1.5 text-[10px] rounded-full uppercase tracking-widest font-bold transition-colors ${activeTab === 'especiales' ? 'bg-gold text-black' : 'text-stone-400'}`}>Especiales</button>
          <button onClick={() => setActiveTab('diseno')} className={`px-4 py-1.5 text-[10px] rounded-full uppercase tracking-widest font-bold transition-colors ${activeTab === 'diseno' ? 'bg-gold text-black' : 'text-stone-400'}`}>Diseño Salón</button>
        </div>
      </div>

      <div className="flex justify-end mb-6">
        <button onClick={handleSave} disabled={isSaving} className={`px-10 py-4 uppercase tracking-[0.4em] text-[10px] transition-all duration-500 shadow-xl border ${ status === 'success' ? 'bg-green-800 border-green-700 text-white' : status === 'error' ? 'bg-red-800 border-red-700 text-white' : 'bg-gold border-gold text-white hover:bg-white hover:text-black'}`}>
          {isSaving ? 'Guardando...' : status === 'success' ? '¡Guardado!' : 'Guardar Cambios'}
        </button>
      </div>

      {activeTab === 'horarios' && (
        <div className="animate-fadeInUp">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(dayNames) as Array<keyof typeof dayNames>).map(dayKey => (
              <DayCard
                key={dayKey}
                dayKey={dayKey}
                dayName={dayNames[dayKey]}
                settings={settings.days[dayKey]}
                environments={layout?.environments || []}
                onUpdate={handleUpdateDay}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'especiales' && (
        <div className="animate-fadeInUp space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-serif text-gold">Excepciones y Feriados</h4>
            <button 
              onClick={handleAddSpecialDay}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-bold hover:bg-stone-700 transition-colors"
            >
              <Plus size={16} />
              Agregar Día
            </button>
          </div>

          {!settings.specialDays || settings.specialDays.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-stone-800 rounded-2xl">
              <Calendar className="mx-auto text-stone-700 mb-4" size={48} />
              <p className="text-stone-500">No hay días especiales configurados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {settings.specialDays.map(day => (
                <div key={day.id} className="bg-stone-900/40 border border-stone-800 rounded-xl p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-grow space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-2">Nombre del Evento</label>
                          <input 
                            type="text" 
                            value={day.name}
                            onChange={e => handleUpdateSpecialDay(day.id, { ...day, name: e.target.value })}
                            className="w-full bg-black/30 border border-stone-800 rounded-lg px-4 py-2 text-white outline-none focus:border-gold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-2">Fecha</label>
                          <input 
                            type="date" 
                            value={day.date}
                            onChange={e => handleUpdateSpecialDay(day.id, { ...day, date: e.target.value })}
                            className="w-full bg-black/30 border border-stone-800 rounded-lg px-4 py-2 text-white outline-none focus:border-gold"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 pt-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={day.isOpen}
                            onChange={e => handleUpdateSpecialDay(day.id, { ...day, isOpen: e.target.checked })}
                            className="h-4 w-4 rounded bg-stone-700 border-stone-600 text-gold focus:ring-gold"
                          />
                          <span className="text-sm text-stone-300">Abierto este día</span>
                        </label>
                      </div>

                      {day.isOpen && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                          {(['mediodia', 'noche'] as const).map(shiftKey => (
                            <div key={shiftKey} className="space-y-3 p-4 bg-black/20 rounded-lg border border-stone-800/50">
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  id={`special-${day.id}-${shiftKey}`}
                                  checked={day.shifts[shiftKey].isActive}
                                  onChange={e => {
                                    const updatedDay: SpecialDay = {
                                      ...day,
                                      shifts: {
                                        ...day.shifts,
                                        [shiftKey]: {
                                          ...day.shifts[shiftKey],
                                          isActive: e.target.checked
                                        }
                                      }
                                    };
                                    handleUpdateSpecialDay(day.id, updatedDay);
                                  }}
                                  className="h-4 w-4 rounded bg-stone-700 border-stone-600 text-gold focus:ring-gold"
                                />
                                <label htmlFor={`special-${day.id}-${shiftKey}`} className="text-sm font-bold text-stone-300 capitalize">{shiftKey}</label>
                              </div>
                              
                              {day.shifts[shiftKey].isActive && (
                                <div className="space-y-2 pt-2 border-t border-stone-800/50">
                                  <p className="text-[9px] uppercase tracking-widest text-stone-600 font-bold">Espacios Activos:</p>
                                  <div className="flex flex-wrap gap-3">
                                    {layout?.environments.map(env => {
                                      const isActive = day.shifts[shiftKey].activeEnvironments?.includes(env.id) ?? true;
                                      return (
                                        <label key={env.id} className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            checked={isActive}
                                            onChange={e => {
                                              const currentActive = day.shifts[shiftKey].activeEnvironments || layout?.environments.map(e => e.id) || [];
                                              const newActive = e.target.checked 
                                                ? [...currentActive, env.id]
                                                : currentActive.filter(id => id !== env.id);
                                              
                                              const updatedDay: SpecialDay = {
                                                ...day,
                                                shifts: {
                                                  ...day.shifts,
                                                  [shiftKey]: {
                                                    ...day.shifts[shiftKey],
                                                    activeEnvironments: Array.from(new Set(newActive))
                                                  }
                                                }
                                              };
                                              handleUpdateSpecialDay(day.id, updatedDay);
                                            }}
                                            className="h-3 w-3 rounded bg-stone-800 border-stone-700 text-gold focus:ring-gold"
                                          />
                                          <span className="text-[10px] text-stone-400">{env.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex md:flex-col justify-end gap-2">
                      <button 
                        onClick={() => handleRemoveSpecialDay(day.id)}
                        className="p-3 text-stone-600 hover:text-red-500 transition-colors bg-black/20 rounded-lg"
                        title="Eliminar día especial"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'diseno' && (
        <div className="animate-fadeInUp">
          <AdminLayout />
        </div>
      )}
    </>
  );
};

export default AdminSettings;