import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Reservation, Layout, RestaurantSettings, Customer } from '../../types';
import { createReservation, updateReservation } from '../../services/reservationRepository';
import { findOrCreateCustomer, listenToCustomers } from '../../services/customerRepository';
import { getRestaurantSettings } from '../../services/settingsRepository';
import { sendReservationWebhook } from '../../services/webhookService';
import { Timestamp } from 'firebase/firestore';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationData: Partial<Reservation> | null;
  layout: Layout | null;
  reservations: Reservation[]; // Added to check capacity
}

interface ReservationFormData extends Partial<Reservation> {
  dateString?: string;
  shift?: string;
}

const DietaryOption: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({ label, selected, onClick }) => (
  <button type="button" onClick={onClick} className={`px-3 py-1.5 text-xs rounded-full border transition-all ${selected ? 'bg-gold text-black border-gold' : 'bg-transparent border-stone-700 text-stone-400 hover:border-gold'}`}>
    {label}
  </button>
);

const ReservationModal: React.FC<ReservationModalProps> = ({ isOpen, onClose, reservationData, layout, reservations }) => {
  const [formData, setFormData] = useState<ReservationFormData>({ guests: 2, dietaryRestrictions: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  // --- Autocomplete State ---
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [activeSearchField, setActiveSearchField] = useState<'name' | 'phone' | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
        const settingsData = await getRestaurantSettings();
        setSettings(settingsData);
    }
    loadSettings();
    const unsubscribeCustomers = listenToCustomers(setAllCustomers);
    return () => unsubscribeCustomers();
  }, []);
  
  useEffect(() => {
    if (reservationData) {
        setCapacityError(null);
        const initialData: ReservationFormData = { 
          dietaryRestrictions: [],
          reducedMobility: false,
          ...reservationData 
        };
        if (initialData.date) {
            const date = initialData.date instanceof Date ? initialData.date : (initialData.date as Timestamp).toDate();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            initialData.dateString = `${year}-${month}-${day}`;
        }
        
        const hour = parseInt((reservationData.time || '00:00').split(':')[0]);
        initialData.shift = hour < 16 ? 'mediodia' : 'noche';

        setFormData(initialData);
    }
  }, [reservationData]);
  
  const availableShifts = useMemo(() => {
    if (!formData.dateString || !settings) return [];
    const date = new Date(formData.dateString);
    const dayIndex = date.getUTCDay();
    const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
    const daySettings = settings.days[dayKey];
    
    const shifts = [];
    if (daySettings?.isOpen) {
      if (daySettings.shifts.mediodia.isActive) shifts.push({ value: 'mediodia', label: 'Mediodía' });
      if (daySettings.shifts.noche.isActive) shifts.push({ value: 'noche', label: 'Noche' });
    }
    return shifts;
  }, [formData.dateString, settings]);

  const availableTimes = useMemo(() => {
    if (formData.shift === 'mediodia') return ['12:00', '13:00', '14:00'];
    if (formData.shift === 'noche') return ['20:30', '21:00', '21:30', '22:00'];
    return [];
  }, [formData.shift]);
  
  const handleDateChange = (newDateString: string) => {
    setFormData(prev => ({
      ...prev,
      dateString: newDateString,
      shift: '',
      time: ''
    }));
  };

  useEffect(() => {
    if (availableShifts.length > 0 && !availableShifts.some(s => s.value === formData.shift)) {
      setFormData(prev => ({...prev, shift: availableShifts[0].value}));
    }
  }, [formData.dateString, availableShifts, formData.shift]);

  useEffect(() => {
    if (availableTimes.length > 0 && !availableTimes.includes(formData.time || '')) {
      setFormData(prev => ({ ...prev, time: availableTimes[0] }));
    }
  }, [formData.shift, availableTimes, formData.time]);

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

  const handleSearchChange = (field: 'name' | 'phone', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (value.length > 2) {
      const lowerQuery = value.toLowerCase();
      setSearchResults(allCustomers.filter(c =>
        c.name.toLowerCase().includes(lowerQuery) || c.phone.includes(lowerQuery)
      ));
    } else {
      setSearchResults([]);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      dietaryRestrictions: customer.dietaryRestrictions || [],
      reducedMobility: customer.reducedMobility || false,
    }));
    setSearchResults([]);
    setActiveSearchField(null);
  };
  
  const SearchResultsDropdown: React.FC = () => (
    <div className="absolute z-10 w-full mt-1 bg-stone-950 border border-gold/50 rounded-md shadow-lg max-h-48 overflow-y-auto">
      {searchResults.map(customer => (
        <button
          type="button"
          key={customer.id}
          onMouseDown={() => handleCustomerSelect(customer)}
          className="w-full text-left px-4 py-2 text-sm text-stone-300 hover:bg-gold/10 hover:text-white"
        >
          <p className="font-semibold">{customer.name}</p>
          <p className="text-xs text-stone-500">{customer.phone}</p>
        </button>
      ))}
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCapacityError(null);
    if (!formData.name || !formData.phone || !formData.environmentId || !formData.dateString || !formData.shift || !formData.time) {
        alert("Por favor, complete todos los campos obligatorios.");
        return;
    }
    setIsSubmitting(true);
    
    // --- Lógica de Capacidad ---
    const selectedDate = new Date(formData.dateString + 'T00:00:00-03:00'); // Use Argentina timezone offset
    const dayIndex = selectedDate.getUTCDay();
    const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
    const shiftKey = formData.shift as 'mediodia' | 'noche';
    const shiftSettings = settings?.days[dayKey].shifts[shiftKey];

    if (!shiftSettings || !shiftSettings.isActive) {
        setCapacityError("El turno seleccionado no está activo o es inválido.");
        setIsSubmitting(false);
        return;
    }

    const totalLayoutCapacity = layout?.environments.reduce((sum, env) => sum + env.maxCapacity, 0) || 0;

    const reservationsForShift = reservations.filter(r => {
        const hour = parseInt(r.time.split(':')[0]);
        return shiftKey === 'mediodia' ? hour < 16 : hour >= 16;
    });

    const totalGuestsForShift = reservationsForShift
        .filter(r => r.id !== formData.id && r.status === 'confirmada')
        .reduce((sum, r) => sum + r.guests, 0);

    if (totalGuestsForShift + Number(formData.guests) > totalLayoutCapacity) {
        setCapacityError(`El turno de la ${shiftKey} está completo. Capacidad: ${totalLayoutCapacity}, Reservados: ${totalGuestsForShift}.`);
        setIsSubmitting(false);
        return;
    }
    
    const selectedEnv = layout?.environments.find(env => env.id === formData.environmentId);
    
    if (selectedEnv) {
        const guestsInSelectedEnvForShift = reservationsForShift
            .filter(r => r.id !== formData.id && r.environmentId === formData.environmentId && r.status === 'confirmada')
            .reduce((sum, r) => sum + r.guests, 0);

        if (guestsInSelectedEnvForShift + Number(formData.guests) > selectedEnv.maxCapacity) {
            setCapacityError(`El ambiente "${selectedEnv.name}" tiene una capacidad máxima de ${selectedEnv.maxCapacity} cubiertos para este turno. Ocupación actual: ${guestsInSelectedEnvForShift}.`);
            setIsSubmitting(false);
            return;
        }
    }
    
    // --- Lógica de Creación de Cliente y Reserva ---
    try {
      const customerId = await findOrCreateCustomer(formData.phone, formData.name, formData.email);
      const combinedDate = new Date(`${formData.dateString}T${formData.time || '00:00'}:00-03:00`);
      
      const dataPayload: Omit<Reservation, 'id'> = {
          name: formData.name || '',
          phone: formData.phone || '',
          email: formData.email || '',
          date: Timestamp.fromDate(combinedDate),
          time: formData.time || '00:00',
          guests: Number(formData.guests) || 1,
          status: formData.status || 'pendiente',
          tableId: null,
          tableName: null,
          specialRequests: formData.specialRequests || '',
          environmentId: formData.environmentId || null,
          environmentName: selectedEnv?.name || null,
          dietaryRestrictions: formData.dietaryRestrictions || [],
          reducedMobility: formData.reducedMobility || false,
          customerId: customerId,
      };
      
      let reservationId = formData.id;
      if (formData.id) { // Actualizar
        await updateReservation(formData.id, dataPayload);
      } else { // Crear
        const newReservationRef = await createReservation(dataPayload, customerId);
        reservationId = newReservationRef.id;
      }

      // --- DISPARAR WEBHOOK ---
      // Se dispara si es una nueva reserva o si el estado es 'confirmada'
      if (!formData.id || dataPayload.status === 'confirmada') {
        try {
          const webhookPayload = {
            id: reservationId,
            name: dataPayload.name,
            phone: dataPayload.phone,
            date: combinedDate.toISOString(),
            time: dataPayload.time,
            guests: dataPayload.guests,
            status: dataPayload.status,
            environmentId: dataPayload.environmentId,
            environmentName: dataPayload.environmentName,
            dietaryRestrictions: dataPayload.dietaryRestrictions,
            reducedMobility: dataPayload.reducedMobility,
            specialRequests: dataPayload.specialRequests,
            customerId: dataPayload.customerId,
          };
          
          sendReservationWebhook(webhookPayload);
        } catch (webhookError) {
          console.error("Error al disparar el webhook de confirmación (Admin):", webhookError);
        }
      }
      // --- FIN WEBHOOK ---

      onClose();
    } catch (error) {
        console.error("Error al guardar la reserva:", error);
        setCapacityError("No se pudo guardar la reserva. Verifique la consola.");
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
    <>
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-stone-900 border border-gold/20 w-full h-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col animate-fadeInUp rounded-lg shadow-2xl overflow-hidden">
        <header className="p-4 flex justify-between items-center border-b border-stone-800 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-serif text-gold">{formData.id ? 'Editar Reserva' : 'Nueva Reserva'}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-white text-3xl">&times;</button>
        </header>

        <form id="admin-reservation-form" onSubmit={handleSubmit} className="flex-grow p-4 sm:p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-8 gap-y-4 h-full">
            {/* Main Info Column */}
            <div className="lg:col-span-3 flex flex-col gap-y-4">
                <div className="relative">
                    <label className={labelClasses}>Nombre Completo</label>
                    <input required type="text" value={formData.name || ''} 
                        onChange={e => handleSearchChange('name', e.target.value)} 
                        onFocus={() => setActiveSearchField('name')} 
                        onBlur={() => setTimeout(() => setActiveSearchField(null), 150)}
                        placeholder="Buscar o ingresar nombre..." 
                        className={inputClasses}
                        autoComplete="off"
                    />
                    {activeSearchField === 'name' && searchResults.length > 0 && <SearchResultsDropdown />}
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                    <div className="relative">
                        <label className={labelClasses}>Teléfono</label>
                        <input required type="tel" value={formData.phone || ''}
                           onChange={e => handleSearchChange('phone', e.target.value)}
                           onFocus={() => setActiveSearchField('phone')}
                           onBlur={() => setTimeout(() => setActiveSearchField(null), 150)}
                           placeholder="Buscar o ingresar teléfono..." 
                           className={inputClasses}
                           autoComplete="off"
                        />
                         {activeSearchField === 'phone' && searchResults.length > 0 && <SearchResultsDropdown />}
                    </div>
                    <div><label className={labelClasses}>Email</label><input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Opcional" className={inputClasses}/></div>
                </div>
                <div className="grid grid-cols-3 gap-x-4">
                    <div><label className={labelClasses}>Día</label><input required type="date" value={formData.dateString || ''} onChange={e => handleDateChange(e.target.value)} className={inputClasses}/></div>
                    <div><label className={labelClasses}>Turno</label><select required value={formData.shift || ''} onChange={e => setFormData({...formData, shift: e.target.value})} disabled={!formData.dateString || availableShifts.length === 0} className={`${inputClasses} appearance-none`}><option value="">{availableShifts.length > 0 ? 'Seleccione' : 'Cerrado'}</option>{availableShifts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                    <div><label className={labelClasses}>Hora</label><select required value={formData.time || ''} onChange={e => setFormData({...formData, time: e.target.value})} disabled={!formData.shift} className={`${inputClasses} appearance-none`}><option value="">Seleccione</option>{availableTimes.map(t => <option key={t} value={t}>{t} hs</option>)}</select></div>
                </div>
                 <div className="grid grid-cols-2 gap-x-4">
                    <div><label className={labelClasses}>Personas</label><input required type="number" min="1" value={formData.guests || ''} onChange={e => setFormData({...formData, guests: parseInt(e.target.value)})} className={inputClasses}/></div>
                    <div><label className={labelClasses}>Ambiente</label><select required value={formData.environmentId || ''} onChange={e => setFormData({...formData, environmentId: e.target.value})} className={`${inputClasses} appearance-none`}><option value="">Seleccionar</option>{layout?.environments.map(env => (<option key={env.id} value={env.id}>{env.name}</option>))}</select></div>
                </div>
            </div>
            {/* Side Info Column */}
            <div className="lg:col-span-2 flex flex-col gap-y-4 h-full">
                <div>
                    <label className={labelClasses}>Estado de la Reserva</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                        {(['pendiente', 'confirmada', 'cancelada'] as const).map((status) => {
                            const isActive = formData.status === status;
                            let activeClasses = ''; let inactiveClasses = ''; let label = '';

                            switch (status) {
                                case 'confirmada':
                                    label = 'Confirmada';
                                    activeClasses = 'bg-green-500 border-green-500 text-white shadow-lg';
                                    inactiveClasses = 'bg-transparent border-green-500/30 text-green-500/70 hover:bg-green-500/10 hover:text-green-400';
                                    break;
                                case 'pendiente':
                                    label = 'Pendiente';
                                    activeClasses = 'bg-gold border-gold text-black shadow-lg';
                                    inactiveClasses = 'bg-transparent border-gold/30 text-gold/70 hover:bg-gold/10 hover:text-gold';
                                    break;
                                case 'cancelada':
                                    label = 'Cancelada';
                                    activeClasses = 'bg-red-600 border-red-600 text-white shadow-lg';
                                    inactiveClasses = 'bg-transparent border-red-600/30 text-red-600/70 hover:bg-red-600/10 hover:text-red-500';
                                    break;
                            }

                            return (
                                <button key={status} type="button" onClick={() => setFormData({ ...formData, status: status })} className={`w-full text-center py-3 text-xs font-bold uppercase tracking-widest rounded-sm transition-all border-2 ${isActive ? activeClasses : inactiveClasses}`}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <label className={`${labelClasses} mb-2`}>Preferencias</label>
                    <div className="flex flex-wrap gap-2 items-center p-3 bg-black/20 border border-stone-800 rounded">
                        <DietaryOption label="Sin TACC" selected={!!formData.dietaryRestrictions?.includes('Sin TACC')} onClick={() => handleDietaryToggle('Sin TACC')} />
                        <DietaryOption label="Vegetariano" selected={!!formData.dietaryRestrictions?.includes('Vegetariano')} onClick={() => handleDietaryToggle('Vegetariano')} />
                        <DietaryOption label="Vegano" selected={!!formData.dietaryRestrictions?.includes('Vegano')} onClick={() => handleDietaryToggle('Vegano')} />
                        <div className="flex items-center gap-2 pl-3 border-l border-stone-700">
                            <input id="mobility-modal" type="checkbox" checked={!!formData.reducedMobility} onChange={e => setFormData({...formData, reducedMobility: e.target.checked})} className="h-4 w-4 rounded bg-stone-700 border-stone-600 text-gold focus:ring-gold"/>
                            <label htmlFor="mobility-modal" className="text-xs text-stone-300">Movilidad reducida</label>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col flex-grow">
                    <label className={labelClasses}>Notas Adicionales</label>
                    <textarea value={formData.specialRequests || ''} onChange={e => setFormData({...formData, specialRequests: e.target.value})} placeholder="Alergias, celebraciones, etc." className={`${inputClasses} resize-none flex-grow`}></textarea>
                </div>
            </div>
          </div>
        </form>

        <footer className="p-4 flex justify-end gap-4 border-t border-stone-800 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-6 py-2 sm:px-8 sm:py-3 border border-stone-700 text-stone-300 hover:border-white hover:text-white transition-colors text-xs uppercase tracking-widest">Cancelar</button>
            <button type="submit" form="admin-reservation-form" disabled={isSubmitting} className="px-6 py-2 sm:px-8 sm:py-3 bg-gold text-black font-bold hover:bg-white transition-colors disabled:opacity-50 text-xs uppercase tracking-widest">{isSubmitting ? 'Guardando...' : 'Guardar Reserva'}</button>
        </footer>
      </div>
    </div>
    {capacityError && createPortal(
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-red-500/50 rounded-lg shadow-2xl w-full max-w-md p-8 relative animate-fadeInUp text-center">
                <h3 className="text-2xl font-serif text-red-400 mb-4">Error de Capacidad</h3>
                <p className="text-stone-300 mb-8">{capacityError}</p>
                <button
                    onClick={() => setCapacityError(null)}
                    className="px-8 py-3 bg-gold text-black font-bold hover:bg-white transition-colors text-xs uppercase tracking-widest"
                >
                    Entendido
                </button>
            </div>
        </div>,
        modalRoot
    )}
    </>,
    modalRoot
  );
};

export default ReservationModal;
