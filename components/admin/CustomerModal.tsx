import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Customer } from '../../types';
import { createCustomer, updateCustomer } from '../../services/customerRepository';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerData: Partial<Customer> | null;
}

const DietaryOption: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({ label, selected, onClick }) => (
  <button type="button" onClick={onClick} className={`px-3 py-1.5 text-xs rounded-full border transition-all ${selected ? 'bg-gold text-black border-gold' : 'bg-transparent border-stone-700 text-stone-400 hover:border-gold'}`}>
    {label}
  </button>
);

const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, customerData }) => {
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!customerData?.id;

  useEffect(() => {
    if (customerData) {
      setFormData(customerData);
    } else {
      setFormData({ name: '', phone: '', email: '', notes: '', tags: '', dietaryRestrictions: [], reducedMobility: false });
    }
    setError(null);
  }, [customerData]);

  const handleDietaryToggle = (option: string) => {
    setFormData(prev => {
        const dietary = prev.dietaryRestrictions || [];
        return {
            ...prev,
            dietaryRestrictions: dietary.includes(option)
                ? dietary.filter(item => item !== option)
                : [...dietary, option]
        };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      setError("El nombre y el teléfono son obligatorios.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      if (isEditing) {
        await updateCustomer(formData.id!, formData);
      } else {
        await createCustomer(formData as Omit<Customer, 'id' | 'reservationIds' | 'firstSeen' | 'lastSeen'>);
      }
      onClose();
    } catch (err: any) {
      console.error("Error al guardar cliente:", err);
      setError(err.message || "No se pudo guardar el cliente.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    console.error("El elemento #modal-root no se encuentra en el DOM.");
    return null;
  }

  const inputClasses = "w-full bg-stone-950 border-2 border-stone-800 py-2 px-3 focus:border-gold outline-none text-white text-sm";
  const labelClasses = "text-[10px] uppercase tracking-widest text-gold font-bold block mb-1";

  return createPortal(
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-gold/20 w-full max-w-xl flex flex-col animate-fadeInUp rounded-lg shadow-2xl overflow-hidden">
        <header className="p-4 flex justify-between items-center border-b border-stone-800 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-serif text-gold">{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-white text-3xl">&times;</button>
        </header>

        <form onSubmit={handleSubmit} id="customer-form" className="flex-grow p-6 space-y-4 overflow-y-auto">
          <div><label className={labelClasses}>Nombre Completo</label><input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nombre del cliente" className={inputClasses}/></div>
          <div className="grid grid-cols-2 gap-x-4">
            <div><label className={labelClasses}>Teléfono</label><input required type="tel" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="54342..." className={inputClasses}/></div>
            <div><label className={labelClasses}>Email</label><input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Opcional" className={inputClasses}/></div>
          </div>
          
          <div>
            <label className={`${labelClasses} mb-2`}>Preferencias del Cliente</label>
            <div className="flex flex-col gap-3 p-3 bg-black/20 border border-stone-800 rounded">
                <div className="flex flex-wrap gap-2 items-center">
                    <DietaryOption label="Sin TACC" selected={!!formData.dietaryRestrictions?.includes('Sin TACC')} onClick={() => handleDietaryToggle('Sin TACC')} />
                    <DietaryOption label="Vegetariano" selected={!!formData.dietaryRestrictions?.includes('Vegetariano')} onClick={() => handleDietaryToggle('Vegetariano')} />
                    <DietaryOption label="Vegano" selected={!!formData.dietaryRestrictions?.includes('Vegano')} onClick={() => handleDietaryToggle('Vegano')} />
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-stone-800">
                    <div className="flex items-center gap-2">
                        <input id="mobility-customer-modal" type="checkbox" checked={!!formData.reducedMobility} onChange={e => setFormData({...formData, reducedMobility: e.target.checked})} className="h-4 w-4 rounded bg-stone-700 border-stone-600 text-gold focus:ring-gold"/>
                        <label htmlFor="mobility-customer-modal" className="text-xs text-stone-300">Movilidad reducida</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input id="children-customer-modal" type="checkbox" checked={!!formData.hasChildren} onChange={e => setFormData({...formData, hasChildren: e.target.checked})} className="h-4 w-4 rounded bg-stone-700 border-stone-600 text-gold focus:ring-gold"/>
                        <label htmlFor="children-customer-modal" className="text-xs text-stone-300">Suele asistir con niños</label>
                    </div>
                </div>
            </div>
          </div>

          <div>
            <label className={labelClasses}>Etiquetas</label>
            <input type="text" value={formData.tags || ''} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="VIP, Alergias, Frecuente" className={inputClasses}/>
            <p className="text-xs text-stone-600 mt-1">Separadas por coma.</p>
          </div>
          <div>
            <label className={labelClasses}>Notas Internas</label>
            <textarea value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Preferencias, alergias, etc." className={`${inputClasses} resize-none h-24`}></textarea>
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </form>

        <footer className="p-4 flex justify-end gap-4 border-t border-stone-800 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-8 py-3 border border-stone-700 text-stone-300 hover:border-white hover:text-white transition-colors text-xs uppercase tracking-widest">Cancelar</button>
          <button type="submit" form="customer-form" disabled={isSubmitting} className="px-8 py-3 bg-gold text-black font-bold hover:bg-white transition-colors disabled:opacity-50 text-xs uppercase tracking-widest">{isSubmitting ? 'Guardando...' : 'Guardar Cliente'}</button>
        </footer>
      </div>
    </div>,
    modalRoot
  );
};

export default CustomerModal;