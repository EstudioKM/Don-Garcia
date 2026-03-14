import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown
} from 'lucide-react';
import { createReservation, getReservationsForDate } from '../services/reservationRepository';
import { findOrCreateCustomer } from '../services/customerRepository';
import { getRestaurantSettings } from '../services/settingsRepository';
import { getLayout } from '../services/layoutRepository';
import { sendReservationWebhook } from '../services/webhookService';
import { Timestamp } from 'firebase/firestore';
import { Reservation, RestaurantSettings, Layout, Environment } from '../types';
import { getArgentinaTime } from '../utils/dateUtils';

interface ReservationFlowProps {
  onSubmittingChange: (isSubmitting: boolean) => void;
}

type Step = 'welcome' | 'guests' | 'date' | 'time' | 'sector' | 'name' | 'phone' | 'confirming' | 'success';

const Calendar: React.FC<{
  selectedDate: string;
  onSelect: (date: string) => void;
  settings: RestaurantSettings | null;
}> = ({ selectedDate, onSelect, settings }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };
  
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const totalDays = daysInMonth(year, month);
  const startDay = startDayOfMonth(year, month);
  
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  
  const dayNames = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
  
  const today = getArgentinaTime();
  today.setHours(0, 0, 0, 0);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(year, month, day);
    if (date < today) return true;
    
    if (settings) {
      const dateStr = formatDate(day);
      
      // Check special days first
      const specialDay = settings.specialDays?.find(sd => sd.date === dateStr);
      if (specialDay) {
        return !specialDay.isOpen;
      }

      const dayIndex = date.getDay();
      const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
      return !settings.days[dayKey].isOpen;
    }
    
    return false;
  };

  const formatDate = (day: number) => {
    const d = new Date(year, month, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="aspect-square w-full" />);
  }
  
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = formatDate(day);
    const isSelected = selectedDate === dateStr;
    const disabled = isDateDisabled(day);
    
    calendarDays.push(
      <button
        key={day}
        disabled={disabled}
        onClick={() => onSelect(dateStr)}
        className={`aspect-square w-full flex flex-col items-center justify-center rounded-2xl text-sm sm:text-base font-bold transition-all relative ${
          isSelected 
          ? 'bg-white/10 border-2 border-gold text-white shadow-lg z-10' 
          : disabled 
            ? 'text-stone-700 cursor-not-allowed' 
            : 'text-stone-300 hover:bg-white/5 hover:text-white border border-transparent'
        }`}
      >
        <span>{day}</span>
        {!disabled && (
          <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
        )}
      </button>
    );
  }

  return (
    <div className="bg-[#0a0a0a] rounded-[2rem] border border-white/5 p-6 sm:p-8 space-y-6 shadow-2xl max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-2 text-stone-500 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h3 className="text-xl sm:text-2xl font-serif text-white tracking-tight font-bold">{monthNames[month]} {year}</h3>
        <button onClick={handleNextMonth} className="p-2 text-stone-500 hover:text-white transition-colors">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {dayNames.map(d => (
          <div key={d} className="flex items-center justify-center text-[10px] sm:text-xs uppercase tracking-widest text-stone-500 font-bold mb-2">
            {d}
          </div>
        ))}
        {calendarDays}
      </div>
      
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 border-t border-white/10 hidden">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <span className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-bold">Hay lugar</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-stone-700"></div>
          <span className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-bold">Lleno</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-bold">Lista de espera</span>
        </div>
      </div>
    </div>
  );
};

const ReservationFlow: React.FC<ReservationFlowProps> = ({ onSubmittingChange }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    date: '',
    shift: '' as 'mediodia' | 'noche' | '',
    time: '',
    guests: 2,
    environmentId: '',
    specialRequests: '',
  });

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsData, layoutData] = await Promise.all([getRestaurantSettings(), getLayout()]);
        setSettings(settingsData);
        setLayout(layoutData);
        
        // Try to get phone from URL (WhatsApp integration)
        const params = new URLSearchParams(window.location.search);
        const phoneParam = params.get('phone') || params.get('tel');
        if (phoneParam) {
          setFormData(prev => ({ ...prev, phone: phoneParam }));
        }
      } catch (e) {
        setError("No se pudo cargar la configuración. Por favor, intente más tarde.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const nextStep = () => {
    const steps: Step[] = ['welcome', 'guests', 'date', 'time', 'sector', 'name', 'phone', 'confirming', 'success'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['welcome', 'guests', 'date', 'time', 'sector', 'name', 'phone', 'confirming', 'success'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const availableShifts = useMemo(() => {
    if (!formData.date || !settings) return [];
    
    // Check special days first
    const specialDay = settings.specialDays?.find(sd => sd.date === formData.date);
    if (specialDay) {
      const shifts = [];
      if (specialDay.isOpen) {
        if (specialDay.shifts.mediodia.isActive) shifts.push({ value: 'mediodia', label: 'Almuerzo' });
        if (specialDay.shifts.noche.isActive) shifts.push({ value: 'noche', label: 'Cena' });
      }
      return shifts;
    }

    const dateObj = new Date(formData.date + 'T00:00:00-03:00');
    const dayIndex = dateObj.getUTCDay();
    const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
    const daySettings = settings.days[dayKey];
    
    const shifts = [];
    if (daySettings?.isOpen) {
      if (daySettings.shifts.mediodia.isActive) shifts.push({ value: 'mediodia', label: 'Almuerzo' });
      if (daySettings.shifts.noche.isActive) shifts.push({ value: 'noche', label: 'Cena' });
    }
    return shifts;
  }, [formData.date, settings]);

  const availableTimes = useMemo(() => {
    if (formData.shift === 'mediodia') return ['12:00', '12:30', '13:00', '13:30', '14:00'];
    if (formData.shift === 'noche') return ['20:30', '21:00', '21:30', '22:00', '22:30'];
    return [];
  }, [formData.shift]);

  const filteredEnvironments = useMemo(() => {
    if (!layout || !settings || !formData.date || !formData.shift) return layout?.environments || [];
    
    // Check special days first
    const specialDay = settings.specialDays?.find(sd => sd.date === formData.date);
    if (specialDay) {
      const activeEnvIds = specialDay.shifts[formData.shift as 'mediodia' | 'noche'].activeEnvironments;
      if (activeEnvIds && activeEnvIds.length > 0) {
        return layout.environments.filter(env => activeEnvIds.includes(env.id));
      }
      return layout.environments;
    }

    const dateObj = new Date(formData.date + 'T00:00:00-03:00');
    const dayIndex = dateObj.getUTCDay();
    const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
    const daySettings = settings.days[dayKey];
    
    const activeEnvIds = daySettings.shifts[formData.shift as 'mediodia' | 'noche'].activeEnvironments;
    if (activeEnvIds && activeEnvIds.length > 0) {
      return layout.environments.filter(env => activeEnvIds.includes(env.id));
    }
    
    return layout.environments;
  }, [layout, settings, formData.date, formData.shift]);

  const handleFinalSubmit = async () => {
    setStep('confirming');
    onSubmittingChange(true);
    setError(null);

    try {
      const reservationDate = new Date(formData.date + 'T00:00:00-03:00');
      const customerId = await findOrCreateCustomer(formData.phone, formData.name);
      const combinedDate = new Date(`${formData.date}T${formData.time}:00-03:00`);
      
      const selectedEnv = layout?.environments.find(env => env.id === formData.environmentId);
      
      const dataToCreate: Omit<Reservation, 'id'> = {
        name: formData.name,
        phone: formData.phone,
        date: Timestamp.fromDate(combinedDate),
        time: formData.time,
        guests: Number(formData.guests),
        status: 'pendiente',
        environmentId: formData.environmentId,
        environmentName: selectedEnv?.name || '',
        specialRequests: formData.specialRequests,
        customerId: customerId,
      };

      const newReservationRef = await createReservation(dataToCreate, customerId);
      setReservationId(newReservationRef.id);

      // Trigger Webhook
      try {
        const webhookPayload = {
          id: newReservationRef.id,
          ...dataToCreate,
          date: combinedDate.toISOString(),
        };
        sendReservationWebhook(webhookPayload);
      } catch (webhookError) {
        console.error("Webhook error:", webhookError);
      }

      setStep('success');
    } catch (err: any) {
      console.error("Submit error:", err);
      setError('Hubo un problema al procesar su reserva. Por favor, intente de nuevo.');
      setStep('phone');
    } finally {
      onSubmittingChange(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-stone-400 font-serif italic">Preparando la mesa...</p>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center text-center space-y-8"
          >
            <div className="relative w-full h-64 rounded-2xl overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1579532582937-16c108930bf6?auto=format&fit=crop&q=80&w=1000" 
                alt="Don Garcia" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
                <h2 className="text-3xl font-serif text-white">Bienvenidos a Don García</h2>
                <p className="text-gold text-sm uppercase tracking-widest">La Casona 1930</p>
              </div>
            </div>
            
            <div className="space-y-4 px-4">
              <p className="text-stone-300 text-lg leading-relaxed">
                Estamos encantados de recibirlo. Siga estos simples pasos para asegurar su mesa frente al río.
              </p>
              <div className="flex flex-col items-center space-y-3 pt-4">
                <div className="flex items-center space-x-3 text-stone-400">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-gold font-bold">1</div>
                  <p>Elija cuántos son y qué día</p>
                </div>
                <div className="flex items-center space-x-3 text-stone-400">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-gold font-bold">2</div>
                  <p>Seleccione el horario y ambiente</p>
                </div>
                <div className="flex items-center space-x-3 text-stone-400">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-gold font-bold">3</div>
                  <p>¡Listo! Reciba su confirmación</p>
                </div>
              </div>
            </div>

            <button 
              onClick={nextStep}
              className="w-full bg-gold text-white py-5 rounded-xl font-bold text-xl shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-transform"
            >
              <span>Comenzar Reserva</span>
              <ChevronRight className="w-6 h-6" />
            </button>
          </motion.div>
        );

      case 'guests':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif text-white">¿Cuántas personas?</h2>
              <p className="text-stone-500">Seleccione la cantidad de comensales</p>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <button
                  key={n}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, guests: n }));
                    nextStep();
                  }}
                  className={`py-4 sm:py-6 rounded-2xl border-2 text-xl sm:text-2xl font-bold transition-all ${
                    formData.guests === n 
                    ? 'bg-gold border-gold text-white shadow-lg scale-105' 
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-gold/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'date':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif text-white">¿Qué día nos visita?</h2>
              <p className="text-stone-500">Elija una fecha disponible</p>
            </div>

            <Calendar 
              selectedDate={formData.date}
              settings={settings}
              onSelect={(date) => {
                setFormData(prev => ({ ...prev, date, shift: '', time: '' }));
                setIsShiftModalOpen(true);
              }}
            />

            <AnimatePresence>
              {isShiftModalOpen && formData.date && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-stone-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-serif text-white">Turnos Disponibles</h3>
                      <button onClick={() => setIsShiftModalOpen(false)} className="text-stone-400 hover:text-white transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {availableShifts.length > 0 ? (
                        availableShifts.map(s => (
                          <button
                            key={s.value}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, shift: s.value as any }));
                              setIsShiftModalOpen(false);
                              nextStep();
                            }}
                            className={`py-4 rounded-2xl border-2 text-lg font-bold transition-all ${
                              formData.shift === s.value 
                              ? 'bg-gold border-gold text-white shadow-lg' 
                              : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-gold/50'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))
                      ) : (
                        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
                          <p className="text-red-400">Lo sentimos, estamos cerrados este día.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case 'time':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif text-white">¿En qué horario?</h2>
              <p className="text-stone-500">Seleccione la hora de su llegada</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {availableTimes.map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, time: t }));
                    nextStep();
                  }}
                  className={`py-4 sm:py-6 rounded-2xl border-2 text-xl sm:text-2xl font-bold transition-all ${
                    formData.time === t 
                    ? 'bg-gold border-gold text-white shadow-lg' 
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-gold/50'
                  }`}
                >
                  {t} hs
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'sector':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif text-white">¿Qué ambiente prefiere?</h2>
              <p className="text-stone-500">Seleccione el sector de su mesa</p>
            </div>

            <div className="space-y-6">
              {filteredEnvironments.map(env => (
                <button
                  key={env.id}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, environmentId: env.id }));
                    nextStep();
                  }}
                  className={`w-full overflow-hidden rounded-3xl border-2 transition-all text-left group ${
                    formData.environmentId === env.id 
                    ? 'border-gold shadow-2xl scale-[1.02]' 
                    : 'border-stone-800 hover:border-gold/50'
                  }`}
                >
                  <div className="h-40 sm:h-48 relative">
                    <img 
                      src={env.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600"} 
                      alt={env.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4 sm:p-6">
                      <h3 className="text-xl sm:text-2xl font-serif text-white">{env.name}</h3>
                      <p className="text-stone-400 text-xs sm:text-sm">Capacidad máxima: {env.maxCapacity} personas</p>
                    </div>
                    {formData.environmentId === env.id && (
                      <div className="absolute top-4 right-4 bg-gold text-white p-2 rounded-full shadow-lg">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
              
              {filteredEnvironments.length === 0 && (
                <div className="p-12 text-center border-2 border-dashed border-stone-800 rounded-3xl">
                  <AlertCircle className="mx-auto text-stone-700 mb-4" size={48} />
                  <p className="text-stone-500">No hay ambientes disponibles para este turno.</p>
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'name':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif text-white">¿A nombre de quién?</h2>
              <p className="text-stone-500">Ingrese su nombre completo</p>
            </div>

            <div className="space-y-6">
              <div className="bg-stone-900 p-4 sm:p-6 rounded-3xl border border-stone-800 focus-within:border-gold transition-colors">
                <input 
                  autoFocus
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Escriba su nombre aquí..."
                  className="w-full bg-transparent text-white text-xl sm:text-2xl outline-none font-bold placeholder:text-stone-700"
                />
              </div>

              <button 
                disabled={!formData.name.trim()}
                onClick={nextStep}
                className="w-full bg-gold text-white py-5 rounded-2xl font-bold text-xl shadow-xl flex items-center justify-center space-x-3 disabled:opacity-50 transition-all active:scale-95"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        );

      case 'phone':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif text-white">Su número de contacto</h2>
              <p className="text-stone-500">Para enviarle los detalles de su reserva</p>
            </div>

            <div className="space-y-6">
              <div className="bg-stone-900 p-4 sm:p-6 rounded-3xl border border-stone-800 focus-within:border-gold transition-colors">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <Phone className="w-6 h-6 sm:w-8 sm:h-8 text-gold" />
                  <input 
                    autoFocus
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej: 54 342 4066887"
                    className="w-full bg-transparent text-white text-xl sm:text-2xl outline-none font-bold placeholder:text-stone-700"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center space-x-3 text-red-400">
                  <AlertCircle className="w-6 h-6 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button 
                disabled={!formData.phone.trim()}
                onClick={handleFinalSubmit}
                className="w-full bg-gold text-white py-5 rounded-2xl font-bold text-xl shadow-xl flex items-center justify-center space-x-3 disabled:opacity-50 transition-all active:scale-95"
              >
                <span>Finalizar Reserva</span>
                <CheckCircle2 className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        );

      case 'confirming':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
            <div className="w-24 h-24 border-8 border-gold border-t-transparent rounded-full animate-spin"></div>
            <div className="space-y-2">
              <h2 className="text-3xl font-serif text-white">Confirmando su lugar...</h2>
              <p className="text-stone-500">Estamos registrando su reserva en nuestro sistema.</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-8 py-8"
          >
            <div className="w-32 h-32 bg-gold rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(176,141,72,0.4)]">
              <CheckCircle2 className="w-20 h-20 text-white" />
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl font-serif text-white">¡Reserva Exitosa!</h2>
              <p className="text-stone-400 text-lg">
                Gracias {formData.name}, hemos recibido su solicitud. Lo esperamos el {new Date(formData.date + 'T00:00:00-03:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} a las {formData.time} hs.
              </p>
            </div>

            <div className="w-full bg-stone-900 p-6 rounded-3xl border border-stone-800 space-y-4 text-left">
              <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                <span className="text-stone-500 text-sm uppercase tracking-widest">Código</span>
                <span className="text-gold font-mono font-bold">{reservationId?.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                <span className="text-stone-500 text-sm uppercase tracking-widest">Ambiente</span>
                <span className="text-white font-bold text-right ml-4">{layout?.environments.find(e => e.id === formData.environmentId)?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 text-sm uppercase tracking-widest">Personas</span>
                <span className="text-white font-bold">{formData.guests}</span>
              </div>
            </div>

            <button 
              onClick={() => window.location.hash = '/'}
              className="w-full bg-stone-800 text-white py-5 rounded-2xl font-bold text-lg hover:bg-stone-700 transition-colors"
            >
              Volver al Inicio
            </button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  // Summary Bar
  const showSummary = step !== 'welcome' && step !== 'confirming' && step !== 'success';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      {showSummary && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/5 p-4 pb-8 z-50 shadow-[0_-20px_40px_rgba(0,0,0,0.8)]"
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button 
                onClick={prevStep}
                className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-full bg-stone-900 flex items-center justify-center text-stone-400 hover:text-white transition-colors border border-white/5"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-gold font-bold mb-0.5 truncate">Su Reserva</span>
                <div className="flex flex-wrap items-center gap-x-1 sm:gap-x-2 text-white text-xs sm:text-sm font-bold tracking-tight">
                  {formData.guests > 0 && <span>{formData.guests}p</span>}
                  {formData.date && <span>• {new Date(formData.date + 'T00:00:00-03:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
                  {formData.time && <span>• {formData.time}</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {['guests', 'date', 'time', 'sector', 'name', 'phone'].map((s, i) => {
                const steps: Step[] = ['guests', 'date', 'time', 'sector', 'name', 'phone'];
                const currentIndex = steps.indexOf(step as Step);
                const isActive = i <= currentIndex;
                return (
                  <div 
                    key={s} 
                    className={`transition-all duration-500 rounded-full ${
                      isActive 
                      ? 'w-4 sm:w-8 h-1 bg-gold' 
                      : 'w-1 sm:w-1.5 h-1 sm:h-1.5 bg-stone-700'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ReservationFlow;
