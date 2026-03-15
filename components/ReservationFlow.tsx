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

type Step = 'welcome' | 'guests' | 'date' | 'time' | 'sector' | 'occasion' | 'preferences' | 'notes' | 'name' | 'phone' | 'confirming' | 'success';

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

  const isPrevMonthDisabled = year === today.getFullYear() && month === today.getMonth();

  const handlePrevMonth = () => {
    if (!isPrevMonthDisabled) {
      setCurrentMonth(new Date(year, month - 1, 1));
    }
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
        className={`aspect-square w-full flex flex-col items-center justify-center rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all relative ${
          isSelected 
          ? 'bg-gold text-black shadow-[0_0_20px_rgba(176,141,72,0.4)] z-10' 
          : disabled 
            ? 'text-stone-800 cursor-not-allowed opacity-30' 
            : 'text-stone-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <span>{day}</span>
        {isSelected && (
          <motion.div 
            layoutId="activeDay"
            className="absolute inset-0 border-2 border-gold rounded-xl sm:rounded-2xl"
          />
        )}
      </button>
    );
  }

  return (
    <div className="bg-stone-900/40 rounded-[2rem] border border-white/5 p-3 sm:p-5 space-y-3 shadow-2xl max-w-lg mx-auto w-full backdrop-blur-md">
      <div className="flex items-center justify-between px-1">
        <button 
          onClick={handlePrevMonth} 
          disabled={isPrevMonthDisabled}
          className={`p-1.5 transition-colors ${isPrevMonthDisabled ? 'text-stone-800 cursor-not-allowed' : 'text-stone-500 hover:text-white'}`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-base font-serif text-white tracking-tight font-bold capitalize">{monthNames[month]} <span className="text-stone-600 font-sans font-normal ml-1">{year}</span></h3>
        <button onClick={handleNextMonth} className="p-1.5 text-stone-500 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {dayNames.map(d => (
          <div key={d} className="flex items-center justify-center text-[8px] uppercase tracking-[0.2em] text-stone-600 font-bold mb-1">
            {d}
          </div>
        ))}
        {calendarDays}
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
    dietaryRestrictions: [] as string[],
    reducedMobility: false,
    hasChildren: false,
    occasion: '',
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
    const steps: Step[] = ['welcome', 'guests', 'date', 'time', 'sector', 'occasion', 'preferences', 'notes', 'name', 'phone', 'confirming', 'success'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['welcome', 'guests', 'date', 'time', 'sector', 'occasion', 'preferences', 'notes', 'name', 'phone', 'confirming', 'success'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      
      // --- CAPACITY CHECK ---
      const reservationsOnDate = await getReservationsForDate(reservationDate);
      const confirmedReservations = reservationsOnDate.filter(r => r.status === 'confirmada');
      
      const dayIndex = reservationDate.getUTCDay();
      const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
      const shiftKey = formData.shift as 'mediodia' | 'noche';
      
      // Check special days first
      let shiftSettings;
      const specialDay = settings?.specialDays?.find(sd => sd.date === formData.date);
      if (specialDay) {
        shiftSettings = specialDay.shifts[shiftKey];
      } else {
        shiftSettings = settings?.days[dayKey].shifts[shiftKey];
      }

      if (!shiftSettings || !shiftSettings.isActive) {
          throw new Error("El turno seleccionado no está activo o es inválido.");
      }

      const totalLayoutCapacity = layout?.environments.reduce((sum, env) => sum + env.maxCapacity, 0) || 0;

      const reservationsForShift = confirmedReservations.filter(r => {
          const hour = parseInt(r.time.split(':')[0]);
          return shiftKey === 'mediodia' ? hour < 16 : hour >= 16;
      });

      const totalGuestsForShift = reservationsForShift.reduce((sum, r) => sum + r.guests, 0);

      if (totalGuestsForShift + Number(formData.guests) > totalLayoutCapacity) {
          setError(`Disculpe, el turno de la ${shiftKey === 'mediodia' ? 'mediodía' : 'noche'} está completo para la fecha seleccionada.`);
          setStep('date');
          onSubmittingChange(false);
          return;
      }

      const selectedEnv = layout?.environments.find(env => env.id === formData.environmentId);
      if (!selectedEnv) throw new Error("Ambiente seleccionado no es válido.");

      const guestsInSelectedEnvForShift = reservationsForShift
          .filter(r => r.environmentId === formData.environmentId)
          .reduce((sum, r) => sum + r.guests, 0);

      if (guestsInSelectedEnvForShift + Number(formData.guests) > selectedEnv.maxCapacity) {
          setError(`Disculpe, no hay suficiente disponibilidad en "${selectedEnv.name}" para la cantidad de personas seleccionada.`);
          setStep('sector');
          onSubmittingChange(false);
          return;
      }
      // --- END CAPACITY CHECK ---

      const customerId = await findOrCreateCustomer(
        formData.phone, 
        formData.name,
        undefined, // email
        formData.dietaryRestrictions,
        formData.reducedMobility,
        formData.hasChildren
      );
      const combinedDate = new Date(`${formData.date}T${formData.time}:00-03:00`);
      
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
        dietaryRestrictions: formData.dietaryRestrictions,
        reducedMobility: formData.reducedMobility,
        hasChildren: formData.hasChildren,
        occasion: formData.occasion,
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
      setError(err.message || 'Hubo un problema al procesar su reserva. Por favor, intente de nuevo.');
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="flex flex-col items-center text-center space-y-6 py-2"
          >
            <div className="relative w-full aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl group">
              <img 
                src="https://images.unsplash.com/photo-1579532582937-16c108930bf6?auto=format&fit=crop&q=80&w=1000" 
                alt="Don Garcia" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-6">
                <span className="text-gold text-[8px] uppercase tracking-[0.5em] font-bold mb-2">La Casona 1930</span>
                <h2 className="text-3xl font-serif text-white leading-tight tracking-tight">Don García</h2>
              </div>
            </div>
            
            <div className="space-y-3 px-4">
              <p className="text-stone-500 text-sm leading-relaxed font-light italic">
                "Una experiencia gastronómica única frente al río Paraná, donde la historia se encuentra con el sabor."
              </p>
            </div>

            <button 
              onClick={nextStep}
              className="w-full bg-gold text-black py-4 rounded-xl font-bold text-base shadow-[0_10px_30px_rgba(176,141,72,0.2)] flex items-center justify-center space-x-2 active:scale-95 transition-all"
            >
              <span>Comenzar Reserva</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        );

      case 'guests':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-6"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Comensales</span>
              <h2 className="text-3xl font-serif text-white">¿Cuántos son?</h2>
            </div>
            
            <div className="grid grid-cols-4 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <button
                  key={n}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, guests: n }));
                    nextStep();
                  }}
                  className={`aspect-square rounded-xl border transition-all text-lg font-bold flex items-center justify-center ${
                    formData.guests === n 
                    ? 'bg-gold text-black border-gold shadow-[0_0_20px_rgba(176,141,72,0.3)] scale-105 z-10' 
                    : 'bg-stone-900/30 border-white/5 text-stone-600 hover:border-white/10'
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-6"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Calendario</span>
              <h2 className="text-3xl font-serif text-white">¿Qué día nos visita?</h2>
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
                            className={`py-3 rounded-2xl border-2 text-base sm:text-lg font-bold transition-all ${
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-6"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Horario</span>
              <h2 className="text-3xl font-serif text-white">¿A qué hora?</h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {availableTimes.map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, time: t }));
                    nextStep();
                  }}
                  className={`py-4 rounded-xl border transition-all text-lg font-bold ${
                    formData.time === t 
                    ? 'bg-gold text-black border-gold shadow-[0_0_20px_rgba(176,141,72,0.3)]' 
                    : 'bg-stone-900/30 border-white/5 text-stone-600 hover:border-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'sector':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-6"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Ambiente</span>
              <h2 className="text-2xl font-serif text-white">¿Dónde prefiere sentarse?</h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredEnvironments.map(env => (
                <button
                  key={env.id}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, environmentId: env.id }));
                    nextStep();
                  }}
                  className={`w-full overflow-hidden rounded-2xl border transition-all text-left relative group ${
                    formData.environmentId === env.id 
                    ? 'border-gold shadow-xl' 
                    : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="h-24 sm:h-28 relative">
                    <img 
                      src={env.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600"} 
                      alt={env.name}
                      className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent flex flex-col justify-center p-5">
                      <h3 className="text-lg font-serif text-white">{env.name}</h3>
                      <p className="text-stone-500 text-[8px] uppercase tracking-widest font-bold">Capacidad: {env.maxCapacity}p</p>
                    </div>
                    {formData.environmentId === env.id && (
                      <div className="absolute top-1/2 -translate-y-1/2 right-5 text-gold">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'occasion':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-6"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Celebración</span>
              <h2 className="text-2xl font-serif text-white leading-tight">¿Venís por alguna ocasión especial?</h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {['Aniversario', 'Cumpleaños', 'Reunión Empresarial'].map(option => (
                <button
                  key={option}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, occasion: option }));
                    nextStep();
                  }}
                  className={`py-3.5 px-5 rounded-xl border transition-all text-left flex items-center justify-between ${
                    formData.occasion === option 
                    ? 'bg-gold/10 border-gold text-white shadow-[0_0_15px_rgba(176,141,72,0.1)]' 
                    : 'bg-stone-900/30 border-white/5 text-stone-500 hover:border-white/10'
                  }`}
                >
                  <span className="font-medium text-sm">{option}</span>
                  {formData.occasion === option && <CheckCircle2 className="w-4 h-4 text-gold" />}
                </button>
              ))}
              <button
                onClick={() => {
                  setFormData(prev => ({ ...prev, occasion: '' }));
                  nextStep();
                }}
                className="py-3 text-stone-600 text-center text-xs font-medium hover:text-stone-400 transition-colors"
              >
                Sin motivo especial
              </button>
            </div>
          </motion.div>
        );

      case 'preferences':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-6"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Preferencias</span>
              <h2 className="text-2xl font-serif text-white leading-tight">Detalles de la visita</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-2.5">
                <p className="text-[8px] uppercase tracking-widest text-stone-600 font-bold ml-1">Restricciones Alimenticias</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Sin TACC', 'Vegetariano', 'Vegano'].map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          dietaryRestrictions: prev.dietaryRestrictions.includes(option)
                            ? prev.dietaryRestrictions.filter(item => item !== option)
                            : [...prev.dietaryRestrictions, option]
                        }));
                      }}
                      className={`px-3 py-1.5 text-[10px] rounded-full border transition-all ${
                        formData.dietaryRestrictions.includes(option) 
                        ? 'bg-gold text-black border-gold font-bold' 
                        : 'bg-stone-900/30 border-white/5 text-stone-500'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setFormData(prev => ({ ...prev, hasChildren: !prev.hasChildren }))}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    formData.hasChildren ? 'bg-white/5 border-gold/40' : 'bg-stone-900/30 border-white/5'
                  }`}
                >
                  <span className="text-stone-400 text-xs font-medium">Asistiremos con niños</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.hasChildren ? 'bg-gold border-gold' : 'border-stone-800'}`}>
                    {formData.hasChildren && <CheckCircle2 className="w-3 h-3 text-black" />}
                  </div>
                </button>

                <button
                  onClick={() => setFormData(prev => ({ ...prev, reducedMobility: !prev.reducedMobility }))}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    formData.reducedMobility ? 'bg-white/5 border-gold/40' : 'bg-stone-900/30 border-white/5'
                  }`}
                >
                  <span className="text-stone-400 text-xs font-medium">Acceso movilidad reducida</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.reducedMobility ? 'bg-gold border-gold' : 'border-stone-800'}`}>
                    {formData.reducedMobility && <CheckCircle2 className="w-3 h-3 text-black" />}
                  </div>
                </button>
              </div>

              <button 
                onClick={nextStep}
                className="w-full bg-gold text-black py-3.5 rounded-xl font-bold text-base shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95"
              >
                <span>Continuar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        );

      case 'notes':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-6"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Comentarios</span>
              <h2 className="text-2xl font-serif text-white leading-tight">¿Algo más que debamos saber?</h2>
            </div>

            <div className="space-y-5">
              <textarea 
                value={formData.specialRequests} 
                onChange={e => setFormData({...formData, specialRequests: e.target.value})} 
                placeholder="Ej: Mesa cerca de la ventana, alergias específicas, etc." 
                className="w-full bg-stone-900/30 border border-white/10 py-4 px-5 rounded-2xl focus:border-gold outline-none h-32 resize-none text-white placeholder:text-stone-800 text-base transition-all"
              />

              <button 
                onClick={nextStep}
                className="w-full bg-gold text-black py-3.5 rounded-xl font-bold text-base shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        );

      case 'name':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-8"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Identificación</span>
              <h2 className="text-3xl font-serif text-white">¿A nombre de quién?</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-stone-900/30 p-5 rounded-2xl border border-white/5 focus-within:border-gold transition-colors">
                <input 
                  autoFocus
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full bg-transparent text-white text-xl outline-none font-serif placeholder:text-stone-800"
                />
              </div>

              <button 
                disabled={!formData.name.trim()}
                onClick={nextStep}
                className="w-full bg-gold text-black py-3.5 rounded-xl font-bold text-base shadow-lg flex items-center justify-center space-x-2 disabled:opacity-30 transition-all active:scale-95"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        );

      case 'phone':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center space-y-8"
          >
            <div className="text-center space-y-2">
              <span className="text-gold text-[9px] uppercase tracking-[0.3em] font-bold">Contacto</span>
              <h2 className="text-3xl font-serif text-white">Su número</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-stone-900/30 p-5 rounded-2xl border border-white/5 focus-within:border-gold transition-colors">
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gold" />
                  <input 
                    autoFocus
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej: 342 4066887"
                    className="w-full bg-transparent text-white text-xl outline-none font-bold placeholder:text-stone-800"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center space-x-2 text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-[10px]">{error}</p>
                </div>
              )}

              <button 
                disabled={!formData.phone.trim()}
                onClick={handleFinalSubmit}
                className="w-full bg-gold text-black py-3.5 rounded-xl font-bold text-base shadow-lg flex items-center justify-center space-x-2 disabled:opacity-30 transition-all active:scale-95"
              >
                <span>Finalizar Reserva</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        );

      case 'confirming':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center py-10">
            <div className="relative">
              <div className="w-20 h-20 border-2 border-gold/20 rounded-full"></div>
              <div className="absolute inset-0 w-20 h-20 border-t-2 border-gold rounded-full animate-spin"></div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif text-white">Confirmando...</h2>
              <p className="text-stone-600 text-xs uppercase tracking-widest">Estamos preparando su mesa</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-6 py-4"
          >
            <div className="w-24 h-24 bg-gold rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(176,141,72,0.3)]">
              <CheckCircle2 className="w-12 h-12 text-black" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-serif text-white">¡Reserva Exitosa!</h2>
              <p className="text-stone-500 text-sm px-4">
                Gracias {formData.name}, lo esperamos el {new Date(formData.date + 'T00:00:00-03:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} a las {formData.time} hs.
              </p>
            </div>

            <div className="w-full bg-stone-900/50 p-5 rounded-3xl border border-white/5 space-y-3 text-left">
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <span className="text-stone-600 text-[10px] uppercase tracking-widest font-bold">Código</span>
                <span className="text-gold font-mono font-bold">{reservationId?.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <span className="text-stone-600 text-[10px] uppercase tracking-widest font-bold">Ambiente</span>
                <span className="text-white font-bold text-sm text-right ml-4">{layout?.environments.find(e => e.id === formData.environmentId)?.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <span className="text-stone-600 text-[10px] uppercase tracking-widest font-bold">Personas</span>
                <span className="text-white font-bold text-sm">{formData.guests} {formData.hasChildren && <span className="text-stone-500 text-[10px] font-normal ml-1">(con niños)</span>}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-600 text-[10px] uppercase tracking-widest font-bold">Motivo</span>
                <span className="text-white font-bold text-sm text-right ml-4">{formData.occasion || 'Cena casual'}</span>
              </div>
            </div>

            <button 
              onClick={() => window.location.hash = '/'}
              className="w-full bg-stone-800 text-white py-4 rounded-xl font-bold text-base hover:bg-stone-700 transition-colors active:scale-95"
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
          className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-2xl border-t border-white/5 p-4 pb-8 z-50"
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={prevStep}
                className="w-9 h-9 flex-shrink-0 rounded-full bg-white/5 flex items-center justify-center text-stone-500 hover:text-white transition-colors border border-white/5 active:scale-90"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex flex-col min-w-0">
                <span className="text-[7px] uppercase tracking-[0.4em] text-gold font-bold mb-0.5">Resumen</span>
                <div className="flex items-center gap-1 text-white text-[10px] font-bold truncate">
                  {formData.guests > 0 && <span>{formData.guests}p</span>}
                  {formData.date && <span>• {new Date(formData.date + 'T00:00:00-03:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
                  {formData.time && <span>• {formData.time}</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 flex-shrink-0">
              {['guests', 'date', 'time', 'sector', 'occasion', 'preferences', 'notes', 'name', 'phone'].map((s, i) => {
                const steps: Step[] = ['guests', 'date', 'time', 'sector', 'occasion', 'preferences', 'notes', 'name', 'phone'];
                const currentIndex = steps.indexOf(step as Step);
                const isActive = i <= currentIndex;
                return (
                  <div 
                    key={s} 
                    className={`transition-all duration-500 rounded-full ${
                      isActive 
                      ? 'w-3 h-1 bg-gold' 
                      : 'w-1 h-1 bg-stone-800'
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
