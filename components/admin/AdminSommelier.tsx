import React, { useState, useEffect } from 'react';
// FIX: Corrected module imports for settings management.
import { getSettingsFromDB, saveSettingsToDB } from '../../services/settingsRepository';
import { SommelierSettings } from '../../types';

const AdminSommelier: React.FC = () => {
  const [settings, setSettings] = useState<SommelierSettings>({ voice: 'Zephyr', systemPrompt: '' });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const availableVoices = ['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir'];
  
  useEffect(() => {
    const loadSettings = async () => {
      const settingsData = await getSettingsFromDB();
      setSettings(settingsData);
      setLoading(false);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus('idle');
    try {
      await saveSettingsToDB(settings);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-white text-center p-10">Cargando configuración del Sommelier...</div>;

  return (
    <>
    <div className="flex justify-end mb-8">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`px-10 py-4 uppercase tracking-[0.4em] text-[10px] transition-all duration-500 shadow-xl border ${
            status === 'success' ? 'bg-green-800 border-green-700 text-white' : 
            status === 'error' ? 'bg-red-800 border-red-700 text-white' : 
            'bg-gold border-gold text-white hover:bg-white hover:text-black'
          }`}
        >
          {isSaving ? 'Guardando...' : status === 'success' ? '¡Guardado!' : 'Guardar Configuración'}
        </button>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-stone-900/20 border border-stone-800 rounded-sm p-8 shadow-xl">
          <h3 className="text-xl font-serif text-white mb-6">Voz del Asistente</h3>
          <label className="text-[10px] uppercase tracking-widest text-stone-500 block mb-3">Seleccionar Voz</label>
          <select
            value={settings.voice}
            onChange={(e) => setSettings({...settings, voice: e.target.value})}
            className="w-full bg-stone-800/50 border border-stone-700 py-3 px-4 focus:border-gold outline-none transition-colors text-sm text-white rounded-sm appearance-none"
            style={{ background: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23c5a059' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e") no-repeat right 0.75rem center/1.5em 1.5em`}}
          >
            {availableVoices.map(voice => <option key={voice} value={voice} className="bg-stone-900">{voice}</option>)}
          </select>
          <p className="text-stone-600 text-xs mt-4">Esta voz será la que escuchen los clientes al interactuar con el Sommelier AI.</p>
        </div>
      </div>
      
      <div className="lg:col-span-2">
        <div className="bg-stone-900/20 border border-stone-800 rounded-sm p-8 shadow-xl h-full">
          <h3 className="text-xl font-serif text-white mb-2">Prompt del Sistema (Personalidad)</h3>
          <p className="text-stone-500 text-xs mb-6">Define las reglas, tono y comportamiento del Sommelier. La carta se inyecta automáticamente.</p>
          <textarea 
            className="w-full h-[400px] bg-black/40 border border-stone-700 p-6 text-stone-300 font-mono text-sm leading-relaxed focus:border-gold outline-none resize-none rounded-sm"
            value={settings.systemPrompt}
            onChange={(e) => setSettings({...settings, systemPrompt: e.target.value})}
            placeholder="Escribe aquí las instrucciones para la IA..."
          />
        </div>
      </div>
    </div>
    </>
  );
};

export default AdminSommelier;