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
  ChevronDown,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { createReservation, getReservationsForDate, listenToReservationsForDate } from '../services/reservationRepository';
import { findOrCreateCustomer } from '../services/customerRepository';
import { getRestaurantSettings, subscribeToRestaurantSettings } from '../services/settingsRepository';
import { getLayout, subscribeToLayout } from '../services/layoutRepository';
import { sendReservationWebhook } from '../services/webhookService';
import { Timestamp } from 'firebase/firestore';
import { Reservation, RestaurantSettings, Layout, Environment, WebImages } from '../types';
import { getArgentinaTime } from '../utils/dateUtils';
import { checkAvailability } from '../utils/reservationLogic';

interface ReservationFlowProps {
  onSubmittingChange: (isSubmitting: boolean) => void;
  webImages?: WebImages;
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
        return !specialDay.isOpen || (!specialDay.shifts.mediodia.isActive && !specialDay.shifts.noche.isActive);
      }

      const dayIndex = date.getDay();
      const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
      const daySettings = settings.days[dayKey];
      return !daySettings.isOpen || (!daySettings.shifts.mediodia.isActive && !daySettings.shifts.noche.isActive);
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
        className={`aspect-square w-full flex flex-col items-center justify-center rounded-2xl text-base sm:text-lg font-bold transition-all relative group ${
          isSelected 
          ? 'bg-gold text-black shadow-[0_0_30px_rgba(176,141,72,0.6)] z-10 scale-110' 
          : disabled 
            ? 'text-stone-800 cursor-not-allowed opacity-10' 
            : 'text-stone-300 hover:bg-white/10 hover:text-white hover:scale-105'
        }`}
      >
        <span className="relative z-10">{day}</span>
        {!disabled && !isSelected && (
          <div className="absolute bottom-2 w-1 h-1 rounded-full bg-gold/20 group-hover:bg-gold/50 transition-colors" />
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
          <div key={d} className="flex items-center justify-center text-[8px] uppercase tracking-[0.2em] text-stone-500 font-bold mb-1">
            {d}
          </div>
        ))}
        {calendarDays}
      </div>
    </div>
  );
};

const ReservationFlow: React.FC<ReservationFlowProps> = ({ onSubmittingChange, webImages }) => {
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
  const [error, setError] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [selectedEnvForModal, setSelectedEnvForModal] = useState<Environment | null>(null);
  const [showOccasionOptions, setShowOccasionOptions] = useState(false);
  const [dateReservations, setDateReservations] = useState<Reservation[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void;
    if (formData.date) {
      setIsCheckingAvailability(true);
      setDateReservations([]); // Clear previous reservations
      const dateObj = new Date(formData.date + 'T00:00:00-03:00');
      
      unsubscribe = listenToReservationsForDate(dateObj, (res) => {
        setDateReservations(res);
        setIsCheckingAvailability(false);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [formData.date]);

  // Load initial data
  useEffect(() => {
    let unsubscribeSettings: () => void;
    let unsubscribeLayout: () => void;

    const loadData = async () => {
      try {
        // Try to get phone from URL (WhatsApp integration)
        const params = new URLSearchParams(window.location.search);
        const phoneParam = params.get('phone') || params.get('tel');
        if (phoneParam) {
          setFormData(prev => ({ ...prev, phone: phoneParam }));
        }

        unsubscribeSettings = subscribeToRestaurantSettings((settingsData) => {
          setSettings(settingsData);
        });

        unsubscribeLayout = subscribeToLayout((layoutData) => {
          setLayout(layoutData);
        });

      } catch (e) {
        setError("No se pudo cargar la configuración. Por favor, intente más tarde.");
      }
    };
    loadData();

    return () => {
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeLayout) unsubscribeLayout();
    };
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
    if (step === 'occasion' && showOccasionOptions) {
      setShowOccasionOptions(false);
      return;
    }
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
    let times: string[] = [];
    if (formData.shift === 'mediodia') times = ['12:00', '12:30', '13:00', '13:30', '14:00'];
    else if (formData.shift === 'noche') times = ['20:30', '21:00', '21:30', '22:00', '22:30'];
    else return [];

    if (!layout || !settings || !formData.date) return times;

    // Get active environments for this shift
    let activeEnvs = layout.environments || [];
    const specialDay = settings.specialDays?.find(sd => sd.date === formData.date);
    const shiftKey = formData.shift as 'mediodia' | 'noche';

    if (specialDay) {
      const activeEnvIds = specialDay.shifts[shiftKey]?.activeEnvironments;
      if (activeEnvIds && activeEnvIds.length > 0) {
        activeEnvs = layout.environments.filter(env => activeEnvIds.includes(env.id));
      }
    } else {
      const dateObj = new Date(formData.date + 'T00:00:00-03:00');
      const dayIndex = dateObj.getUTCDay();
      const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
      const daySettings = settings.days[dayKey];
      
      const activeEnvIds = daySettings?.shifts[shiftKey]?.activeEnvironments;
      if (activeEnvIds && activeEnvIds.length > 0) {
        activeEnvs = layout.environments.filter(env => activeEnvIds.includes(env.id));
      }
    }

    if (activeEnvs.length === 0) activeEnvs = layout.environments;

    // Filter times where at least one active environment has availability for the requested guests
    const filteredTimes = times.filter(time => {
      return activeEnvs.some(env => {
        const availability = checkAvailability(
          env,
          dateReservations,
          time,
          Number(formData.guests)
        );
        return availability.available;
      });
    });

    // Fallback: If filtering is too aggressive (e.g. no tables fit the group size even if empty),
    // show all times to let the user proceed and handle it in the next step or with a message.
    if (filteredTimes.length === 0 && times.length > 0 && !isCheckingAvailability) {
      return times;
    }

    return filteredTimes;
  }, [formData.shift, formData.guests, formData.date, layout, settings, dateReservations, isCheckingAvailability]);

  const environmentsWithAvailability = useMemo(() => {
    if (!layout || !settings || !formData.date || !formData.shift) return [];
    
    let activeEnvs = layout.environments;

    // Determine which environments are active for this shift
    const specialDay = settings.specialDays?.find(sd => sd.date === formData.date);
    const shiftKey = formData.shift as 'mediodia' | 'noche';
    
    let activeEnvIds: string[] | undefined;
    if (specialDay) {
      activeEnvIds = specialDay.shifts[shiftKey].activeEnvironments;
    } else {
      const dateObj = new Date(formData.date + 'T00:00:00-03:00');
      const dayIndex = dateObj.getUTCDay();
      const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
      activeEnvIds = settings.days[dayKey].shifts[shiftKey].activeEnvironments;
    }

    if (activeEnvIds && activeEnvIds.length > 0) {
      activeEnvs = layout.environments.filter(env => activeEnvIds!.includes(env.id));
    }

    // Now calculate availability for each active environment
    return activeEnvs.map(env => {
        const reservationsForShift = dateReservations.filter(r => {
            const hour = parseInt(r.time.split(':')[0]);
            return shiftKey === 'mediodia' ? hour < 16 : hour >= 16;
        });

        const guestsInEnv = reservationsForShift
            .filter(r => r.environmentId === env.id && r.status !== 'cancelada')
            .reduce((sum, r) => sum + Number(r.guests), 0);
        
        // Coarse check by total capacity
        const hasCapacity = (guestsInEnv + Number(formData.guests)) <= env.maxCapacity;

        // Fine check by table availability if time is selected
        let hasTables = true;
        let reason = '';
        if (formData.time) {
          const availability = checkAvailability(
            env,
            dateReservations,
            formData.time,
            Number(formData.guests)
          );
          hasTables = availability.available;
          if (!availability.available) {
            reason = 'Sin mesas para este grupo';
          }
        }

        const isAvailable = hasCapacity && hasTables;

        return {
          ...env,
          isAvailable,
          availabilityReason: !hasCapacity ? 'Capacidad completa' : reason
        };
    });

  }, [layout, settings, formData.date, formData.shift, formData.time, formData.guests, dateReservations]);

  const handleFinalSubmit = async () => {
    setStep('confirming');
    onSubmittingChange(true);
    setError(null);

    try {
      const reservationDate = new Date(formData.date + 'T00:00:00-03:00');
      
      // --- CAPACITY CHECK ---
      const confirmedReservations = dateReservations.filter(r => r.status !== 'cancelada');
      
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

      const totalGuestsForShift = reservationsForShift.reduce((sum, r) => sum + Number(r.guests), 0);

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
          .reduce((sum, r) => sum + Number(r.guests), 0);

      if (guestsInSelectedEnvForShift + Number(formData.guests) > selectedEnv.maxCapacity) {
          setError(`Disculpe, no hay suficiente disponibilidad en "${selectedEnv.name}" para la cantidad de personas seleccionada en este turno.`);
          setStep('sector');
          onSubmittingChange(false);
          return;
      }
      // --- END CAPACITY CHECK ---

      // --- TABLE ASSIGNMENT ---
      const availability = checkAvailability(
        selectedEnv,
        confirmedReservations,
        formData.time,
        Number(formData.guests)
      );

      if (!availability.available) {
        setError(`Disculpe, no hay mesas disponibles para ${formData.guests} personas en el horario y sector seleccionado.`);
        setStep('sector');
        onSubmittingChange(false);
        return;
      }

      const tableIds = availability.tableIds || [];
      const tableId = tableIds.length === 1 ? tableIds[0] : null;
      
      // Get table names for the assigned tables
      const assignedTables = selectedEnv.tables.filter(t => tableIds.includes(t.id));
      const tableName = assignedTables.map(t => t.name).join(' + ') || null;
      // --- END TABLE ASSIGNMENT ---

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
        tableId,
        tableIds,
        tableName,
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

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="flex flex-col h-[calc(100dvh-10rem)] sm:h-[600px] min-h-[450px] max-h-[800px] w-full relative rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
          >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
              <img 
                src={webImages?.reservation || "https://images.unsplash.com/photo-1579532582937-16c108930bf6?auto=format&fit=crop&q=80&w=1000"} 
                alt="Don Garcia" 
                className="w-full h-full object-cover scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/30 to-black/90" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full p-6 sm:p-8">
              <div className="flex flex-col items-center mt-8 sm:mt-12">
                <h1 className="text-4xl sm:text-5xl font-serif text-gold tracking-[0.2em] font-bold leading-none text-center drop-shadow-lg">DON GARCÍA</h1>
                <p className="text-stone-200 text-[10px] sm:text-xs uppercase tracking-[0.4em] mt-4 font-medium text-center drop-shadow-md">La Casona 1930</p>
              </div>

              <div className="mt-auto mb-2 sm:mb-4">
                <button 
                  onClick={nextStep}
                  className="w-full bg-gold text-black py-5 sm:py-6 rounded-2xl font-bold text-lg sm:text-xl shadow-[0_15px_40px_rgba(176,141,72,0.4)] flex items-center justify-center space-x-3 active:scale-[0.98] transition-all hover:bg-white hover:text-black"
                >
                  <span className="tracking-wide uppercase">Reservar una Mesa</span>
                  <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
                </button>
              </div>
            </div>
          </motion.div>
        );

      case 'guests':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">1</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Comensales</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">¿Cuántos son?</h2>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <button
                  key={n}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, guests: n }));
                    nextStep();
                  }}
                  className={`aspect-square rounded-2xl border transition-all text-2xl font-bold flex items-center justify-center group ${
                    formData.guests === n 
                    ? 'bg-gold text-black border-gold shadow-[0_0_30px_rgba(176,141,72,0.3)] scale-105 z-10' 
                    : 'bg-stone-900/30 border-white/10 text-stone-300 hover:border-white/30 hover:bg-white/5'
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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">2</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Calendario</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">¿Qué día nos visita?</h2>
            </div>

            {!settings ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                <p className="text-stone-400 text-sm uppercase tracking-widest">Cargando calendario...</p>
              </div>
            ) : (
              <div className="w-full max-w-lg mx-auto">
                <Calendar 
                  selectedDate={formData.date}
                  settings={settings}
                  onSelect={(date) => {
                    setFormData(prev => ({ ...prev, date, shift: '', time: '' }));
                    
                    // Calculate available shifts for the selected date
                    let shifts = [];
                    const specialDay = settings?.specialDays?.find(sd => sd.date === date);
                    if (specialDay) {
                      if (specialDay.isOpen) {
                        if (specialDay.shifts.mediodia.isActive) shifts.push('mediodia');
                        if (specialDay.shifts.noche.isActive) shifts.push('noche');
                      }
                    } else if (settings) {
                      const dateObj = new Date(date + 'T00:00:00-03:00');
                      const dayIndex = dateObj.getUTCDay();
                      const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                      const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
                      const daySettings = settings.days[dayKey];
                      if (daySettings?.isOpen) {
                        if (daySettings.shifts.mediodia.isActive) shifts.push('mediodia');
                        if (daySettings.shifts.noche.isActive) shifts.push('noche');
                      }
                    }

                    if (shifts.length === 1) {
                      setFormData(prev => ({ ...prev, date, shift: shifts[0] as any, time: '' }));
                      nextStep();
                    } else {
                      setIsShiftModalOpen(true);
                    }
                  }}
                />
              </div>
            )}

            <AnimatePresence>
              {isShiftModalOpen && formData.date && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-stone-900 border border-white/10 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl"
                  >
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-serif text-white">Turnos Disponibles</h3>
                      <button onClick={() => setIsShiftModalOpen(false)} className="text-stone-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {availableShifts.length > 0 ? (
                        availableShifts.map(s => (
                          <button
                            key={s.value}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, shift: s.value as any }));
                              setIsShiftModalOpen(false);
                              nextStep();
                            }}
                            className={`py-4 rounded-2xl border-2 text-lg font-bold transition-all flex items-center justify-center space-x-3 group ${
                              formData.shift === s.value 
                              ? 'bg-gold border-gold text-black shadow-lg' 
                              : 'bg-stone-800/50 border-stone-700 text-stone-300 hover:border-gold/50 hover:bg-white/5'
                            }`}
                          >
                            {s.value === 'mediodia' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            <span>{s.label}</span>
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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">3</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Horario</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">¿A qué hora?</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {isCheckingAvailability ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  <p className="text-stone-400 text-sm uppercase tracking-widest">Buscando horarios...</p>
                </div>
              ) : availableTimes.length > 0 ? (
                availableTimes.map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, time: t }));
                      nextStep();
                    }}
                    className={`py-5 rounded-2xl border transition-all text-xl font-bold flex items-center justify-center group ${
                      formData.time === t 
                      ? 'bg-gold text-black border-gold shadow-[0_0_30px_rgba(176,141,72,0.3)] scale-105 z-10' 
                      : 'bg-stone-900/30 border-white/10 text-stone-300 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    {t}
                  </button>
                ))
              ) : (
                <div className="col-span-full p-8 bg-red-500/10 border border-red-500/30 rounded-2xl text-center space-y-4">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                  <p className="text-stone-300">No hay horarios disponibles para {formData.guests} personas en este turno.</p>
                  <button 
                    onClick={() => setStep('date')}
                    className="text-gold font-bold uppercase tracking-widest text-xs hover:underline"
                  >
                    Cambiar fecha o turno
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'sector':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">4</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Ambiente</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">¿Dónde prefiere sentarse?</h2>
            </div>

            {!layout || isCheckingAvailability ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                <p className="text-stone-400 text-sm uppercase tracking-widest">{!layout ? 'Cargando ambientes...' : 'Verificando disponibilidad...'}</p>
              </div>
            ) : environmentsWithAvailability.length === 0 ? (
              <div className="bg-stone-900/50 border border-red-500/30 rounded-[2rem] p-8 text-center space-y-6">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto opacity-80" />
                <div>
                  <h3 className="text-xl font-serif text-white mb-2">Sin ambientes activos</h3>
                  <p className="text-stone-400 text-sm">
                    No hay espacios configurados para este turno.
                  </p>
                </div>
                <button
                  onClick={() => setStep('date')}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all text-sm uppercase tracking-widest font-bold border border-white/10"
                >
                  Seleccionar otra fecha
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {environmentsWithAvailability.map(env => (
                  <div key={env.id} className="relative group">
                    <button
                      disabled={!env.isAvailable}
                      onClick={() => {
                        if (env.isAvailable) {
                          setFormData(prev => ({ ...prev, environmentId: env.id }));
                          nextStep();
                        }
                      }}
                      className={`w-full overflow-hidden rounded-[2.5rem] border transition-all text-left relative flex flex-col ${
                        formData.environmentId === env.id 
                        ? 'border-gold shadow-[0_0_40px_rgba(176,141,72,0.4)] scale-[1.02] z-10 bg-stone-900' 
                        : !env.isAvailable
                          ? 'border-white/5 bg-stone-950/50 opacity-60 cursor-not-allowed'
                          : 'border-white/10 hover:border-white/30 bg-stone-900/40 hover:bg-stone-900/60'
                      }`}
                    >
                      <div className="h-48 sm:h-56 relative overflow-hidden">
                        <img 
                          src={env.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600"} 
                          alt={env.name}
                          className={`w-full h-full object-cover transition-all duration-700 ${
                            formData.environmentId === env.id ? 'scale-110 opacity-80' : 'opacity-40 group-hover:opacity-60 group-hover:scale-105'
                          } ${!env.isAvailable ? 'grayscale' : ''}`}
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" />
                        
                        {!env.isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                            <div className="bg-red-500/90 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                              {env.availabilityReason}
                            </div>
                          </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`text-2xl font-serif leading-none ${formData.environmentId === env.id ? 'text-gold' : 'text-white'}`}>
                              {env.name}
                            </h3>
                            {formData.environmentId === env.id && (
                              <CheckCircle2 className="w-6 h-6 text-gold" />
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-stone-400 text-[10px] uppercase tracking-widest font-bold">Capacidad: {env.maxCapacity}p</span>
                            {env.isAvailable && (
                              <span className="flex items-center text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                                Disponible
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEnvForModal(env);
                      }}
                      className="absolute top-4 right-4 p-3 bg-black/60 backdrop-blur-xl rounded-full text-white/50 hover:text-gold hover:bg-black/80 transition-all border border-white/10 z-20 shadow-xl"
                      title="Ver detalles"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Modal de Detalles de Ambiente */}
            <AnimatePresence>
              {selectedEnvForModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/95 backdrop-blur-xl"
                  onClick={() => setSelectedEnvForModal(null)}
                >
                  <motion.div 
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="bg-stone-900 border border-white/10 rounded-[2rem] overflow-hidden w-full max-w-4xl shadow-2xl relative flex flex-col sm:flex-row max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Image Section */}
                    <div className="relative w-full sm:w-3/5 h-[40vh] sm:h-auto min-h-[300px]">
                      <img 
                        src={selectedEnvForModal.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=100&w=1200"} 
                        alt={selectedEnvForModal.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-stone-900" />
                      
                      <button 
                        onClick={() => setSelectedEnvForModal(null)}
                        className="absolute top-4 right-4 sm:hidden p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:text-gold transition-colors z-10"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      {environmentsWithAvailability.length > 1 && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentIndex = environmentsWithAvailability.findIndex(env => env.id === selectedEnvForModal.id);
                              const prevIndex = (currentIndex - 1 + environmentsWithAvailability.length) % environmentsWithAvailability.length;
                              setSelectedEnvForModal(environmentsWithAvailability[prevIndex]);
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:text-gold hover:bg-black/80 transition-all z-10 border border-white/10"
                          >
                            <ChevronLeft className="w-6 h-6" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentIndex = environmentsWithAvailability.findIndex(env => env.id === selectedEnvForModal.id);
                              const nextIndex = (currentIndex + 1) % environmentsWithAvailability.length;
                              setSelectedEnvForModal(environmentsWithAvailability[nextIndex]);
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:text-gold hover:bg-black/80 transition-all z-10 border border-white/10"
                          >
                            <ChevronRight className="w-6 h-6" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="w-full sm:w-2/5 p-6 sm:p-8 flex flex-col justify-center bg-stone-900 relative">
                      <button 
                        onClick={() => setSelectedEnvForModal(null)}
                        className="hidden sm:flex absolute top-6 right-6 p-2 bg-white/5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors z-10"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <div className="space-y-6 flex-1 flex flex-col justify-center">
                        <div>
                          <h3 className="text-4xl sm:text-5xl font-serif text-white mb-2">{selectedEnvForModal.name}</h3>
                          <div className="flex items-center space-x-2 text-gold">
                            <Users className="w-4 h-4" />
                            <span className="text-xs uppercase tracking-widest font-bold">Capacidad: {selectedEnvForModal.maxCapacity}p</span>
                          </div>
                        </div>
                        
                        <div className="h-px bg-gradient-to-r from-gold/50 to-transparent w-full" />
                        
                        <div className="pt-4">
                          <button 
                            onClick={() => {
                              setFormData(prev => ({ ...prev, environmentId: selectedEnvForModal.id }));
                              setSelectedEnvForModal(null);
                              nextStep();
                            }}
                            className="w-full bg-gold text-black py-5 rounded-2xl font-bold text-xl hover:bg-white hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center space-x-2"
                            disabled={!selectedEnvForModal.isAvailable}
                          >
                            <span>{selectedEnvForModal.isAvailable ? 'Reservar Aquí' : 'No Disponible'}</span>
                            {selectedEnvForModal.isAvailable && <ChevronRight className="w-6 h-6" />}
                          </button>
                          {!selectedEnvForModal.isAvailable && selectedEnvForModal.availabilityReason && (
                            <p className="text-red-400 text-sm text-center mt-4 font-medium">
                              {selectedEnvForModal.availabilityReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case 'occasion':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">5</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Celebración</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">¿Venís por alguna ocasión especial?</h2>
            </div>

            {!showOccasionOptions ? (
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => setShowOccasionOptions(true)}
                  className="w-full py-5 px-6 rounded-2xl border border-white/10 bg-stone-900/30 text-white text-xl font-medium hover:bg-white/5 hover:border-white/30 transition-all flex items-center justify-between group"
                >
                  <span>Sí, es una ocasión especial</span>
                  <span className="text-stone-500 text-sm group-hover:text-gold transition-colors font-bold">A</span>
                </button>
                <button
                  onClick={() => {
                    setFormData(prev => ({ ...prev, occasion: '' }));
                    nextStep();
                  }}
                  className="w-full py-5 px-6 rounded-2xl border border-white/10 bg-stone-900/30 text-white text-xl font-medium hover:bg-white/5 hover:border-white/30 transition-all flex items-center justify-between group"
                >
                  <span>No, es una visita normal</span>
                  <span className="text-stone-500 text-sm group-hover:text-gold transition-colors font-bold">B</span>
                </button>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6"
              >
                <p className="text-stone-400 text-lg">¡Qué bueno! ¿Qué celebramos?</p>
                <div className="grid grid-cols-1 gap-3">
                  {['Aniversario', 'Cumpleaños', 'Reunión Empresarial', 'Cita Romántica'].map((option, idx) => (
                    <button
                      key={option}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, occasion: option }));
                        nextStep();
                      }}
                      className={`w-full py-5 px-6 rounded-2xl border transition-all text-left flex items-center justify-between group ${
                        formData.occasion === option 
                        ? 'bg-gold text-black border-gold shadow-[0_0_30px_rgba(176,141,72,0.3)] scale-[1.02] z-10' 
                        : 'bg-stone-900/30 border-white/10 text-stone-300 hover:border-white/30 hover:bg-white/5'
                      }`}
                    >
                      <span className="font-medium text-xl">{option}</span>
                      <span className={`text-sm font-bold transition-colors ${formData.occasion === option ? 'text-black/50' : 'text-stone-500 group-hover:text-gold'}`}>
                        {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        );

      case 'preferences':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">6</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Preferencias</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">Detalles de la visita</h2>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-widest text-stone-400 font-bold ml-1">Restricciones Alimenticias</p>
                <div className="flex flex-wrap gap-3">
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
                      className={`px-5 py-3 text-sm rounded-full border transition-all ${
                        formData.dietaryRestrictions.includes(option) 
                        ? 'bg-gold text-black border-gold font-bold shadow-lg' 
                        : 'bg-stone-900/30 border-white/10 text-stone-300 hover:border-white/30 hover:bg-white/5'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setFormData(prev => ({ ...prev, hasChildren: !prev.hasChildren }))}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all group ${
                    formData.hasChildren ? 'bg-white/5 border-gold/40' : 'bg-stone-900/30 border-white/10 hover:border-white/30 hover:bg-white/5'
                  }`}
                >
                  <span className="text-stone-200 text-lg font-medium">Asistiremos con niños</span>
                  <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${formData.hasChildren ? 'bg-gold border-gold' : 'border-stone-600 group-hover:border-stone-400'}`}>
                    {formData.hasChildren && <CheckCircle2 className="w-4 h-4 text-black" />}
                  </div>
                </button>

                <button
                  onClick={() => setFormData(prev => ({ ...prev, reducedMobility: !prev.reducedMobility }))}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all group ${
                    formData.reducedMobility ? 'bg-white/5 border-gold/40' : 'bg-stone-900/30 border-white/10 hover:border-white/30 hover:bg-white/5'
                  }`}
                >
                  <span className="text-stone-200 text-lg font-medium">Acceso movilidad reducida</span>
                  <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${formData.reducedMobility ? 'bg-gold border-gold' : 'border-stone-600 group-hover:border-stone-400'}`}>
                    {formData.reducedMobility && <CheckCircle2 className="w-4 h-4 text-black" />}
                  </div>
                </button>
              </div>

              <button 
                onClick={nextStep}
                className="w-full bg-gold text-black py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center space-x-3 transition-all hover:bg-white active:scale-95"
              >
                <span>Continuar</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );

      case 'notes':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">7</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Comentarios</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">¿Algo más que debamos saber?</h2>
            </div>

            <div className="space-y-6">
              <textarea 
                value={formData.specialRequests} 
                onChange={e => setFormData({...formData, specialRequests: e.target.value})} 
                placeholder="Ej: Mesa cerca de la ventana, alergias específicas, etc." 
                className="w-full bg-stone-900/30 border border-white/20 py-5 px-6 rounded-2xl focus:border-gold outline-none h-40 resize-none text-white placeholder:text-stone-500 text-lg transition-all"
              />

              <button 
                onClick={nextStep}
                className="w-full bg-gold text-black py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center space-x-3 transition-all hover:bg-white active:scale-95"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );

      case 'name':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">8</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Identificación</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">¿A nombre de quién?</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-stone-900/30 p-6 rounded-2xl border border-white/10 focus-within:border-gold transition-colors shadow-2xl">
                <input 
                  autoFocus
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full bg-transparent text-white text-2xl outline-none font-serif placeholder:text-stone-600"
                />
              </div>

              <button 
                disabled={!formData.name.trim()}
                onClick={nextStep}
                className="w-full bg-gold text-black py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center space-x-3 disabled:opacity-30 transition-all hover:bg-white active:scale-95"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );

      case 'phone':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="flex flex-col h-full justify-center space-y-8 max-w-2xl mx-auto w-full px-4"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-gold">
                <span className="text-sm font-bold">9</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Contacto</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif text-white leading-tight">Su número</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-stone-900/30 p-6 rounded-2xl border border-white/10 focus-within:border-gold transition-colors shadow-2xl">
                <div className="flex items-center space-x-4">
                  <Phone className="w-6 h-6 text-gold" />
                  <input 
                    autoFocus
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej: 342 4066887"
                    className="w-full bg-transparent text-white text-2xl outline-none font-bold placeholder:text-stone-600"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center space-x-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <button 
                disabled={!formData.phone.trim()}
                onClick={handleFinalSubmit}
                className="w-full bg-gold text-black py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center space-x-3 disabled:opacity-30 transition-all hover:bg-white active:scale-95"
              >
                <span>Finalizar Reserva</span>
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );

      case 'confirming':
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-full space-y-8 text-center"
          >
            <div className="relative">
              <div className="w-24 h-24 border-2 border-gold/20 rounded-full"></div>
              <div className="absolute inset-0 w-24 h-24 border-t-2 border-gold rounded-full animate-spin"></div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-serif text-white">Confirmando...</h2>
              <p className="text-stone-400 text-sm uppercase tracking-[0.2em] font-bold">Estamos preparando su mesa</p>
            </div>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex flex-col items-center text-center justify-center h-full space-y-10 max-w-2xl mx-auto w-full px-4"
          >
            <div className="w-32 h-32 bg-gold rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(176,141,72,0.4)]">
              <CheckCircle2 className="w-16 h-16 text-black" />
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl sm:text-5xl font-serif text-white leading-tight">¡Reserva Exitosa!</h2>
              <p className="text-stone-300 text-lg px-4 max-w-md mx-auto">
                Gracias <span className="text-white font-bold">{formData.name}</span>, lo esperamos el <span className="text-gold font-bold">{new Date(formData.date + 'T00:00:00-03:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span> a las <span className="text-gold font-bold">{formData.time} hs</span>.
              </p>
            </div>

            <div className="w-full bg-stone-900/40 p-8 rounded-3xl border border-white/10 space-y-5 text-left shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold">Código</span>
                <span className="text-gold font-mono font-bold text-lg">{reservationId?.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold">Ambiente</span>
                <span className="text-white font-bold text-base text-right ml-4">{layout?.environments.find(e => e.id === formData.environmentId)?.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold">Personas</span>
                <span className="text-white font-bold text-base">{formData.guests} {formData.hasChildren && <span className="text-stone-500 text-xs font-normal ml-2">(con niños)</span>}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold">Motivo</span>
                <span className="text-white font-bold text-base text-right ml-4">{formData.occasion || 'Cena casual'}</span>
              </div>
            </div>

            <button 
              onClick={() => window.location.hash = '/'}
              className="w-full bg-stone-800 text-white py-5 rounded-2xl font-bold text-lg hover:bg-stone-700 transition-colors active:scale-95 shadow-lg"
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
    <div className="flex flex-col h-full relative">
      <div className={`flex-grow ${showSummary ? 'pb-32' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {showSummary && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 p-5 pb-10 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button 
                onClick={prevStep}
                className="w-12 h-12 flex-shrink-0 rounded-full bg-white/10 flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/20 transition-all border border-white/10 active:scale-90 shadow-lg"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase tracking-[0.3em] text-gold font-bold mb-1">Resumen de Reserva</span>
                <div className="flex flex-wrap items-center gap-1.5 text-white text-xs font-bold">
                  {formData.guests > 0 && (
                    <button onClick={() => setStep('guests')} className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md transition-colors">
                      {formData.guests} pers.
                    </button>
                  )}
                  {formData.date && (
                    <button onClick={() => setStep('date')} className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md transition-colors">
                      {new Date(formData.date + 'T00:00:00-03:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </button>
                  )}
                  {formData.time && (
                    <button onClick={() => setStep('time')} className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md transition-colors">
                      {formData.time}
                    </button>
                  )}
                  {formData.environmentId && (
                    <button onClick={() => setStep('sector')} className="bg-gold/20 hover:bg-gold/30 text-gold px-2 py-0.5 rounded-md truncate max-w-[120px] transition-colors">
                      {layout?.environments.find(e => e.id === formData.environmentId)?.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {['guests', 'date', 'time', 'sector', 'occasion', 'preferences', 'notes', 'name', 'phone'].map((s, i) => {
                const steps: Step[] = ['guests', 'date', 'time', 'sector', 'occasion', 'preferences', 'notes', 'name', 'phone'];
                const currentIndex = steps.indexOf(step as Step);
                const isActive = i <= currentIndex;
                return (
                  <div 
                    key={s} 
                    className={`transition-all duration-500 rounded-full ${
                      isActive 
                      ? 'w-4 h-1.5 bg-gold shadow-[0_0_8px_rgba(212,175,55,0.5)]' 
                      : 'w-1.5 h-1.5 bg-stone-800'
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
