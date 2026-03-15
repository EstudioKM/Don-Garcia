import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createReservation, getReservationsForDate } from '../services/reservationRepository';
import { findOrCreateCustomer } from '../services/customerRepository';
import { getRestaurantSettings } from '../services/settingsRepository';
import { getLayout } from '../services/layoutRepository';
import { sendReservationWebhook } from '../services/webhookService';
import { Timestamp } from 'firebase/firestore';
import { Reservation, RestaurantSettings, Layout } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getArgentinaTime } from '../utils/dateUtils';

const DietaryOption: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({ label, selected, onClick }) => (
  <button type="button" onClick={onClick} className={`px-4 py-2 text-xs rounded-full border transition-all ${selected ? 'bg-gold text-black border-gold' : 'bg-transparent border-stone-700 text-stone-400 hover:border-gold'}`}>
    {label}
  </button>
);

interface ReservationFormProps {
  formId: string;
  onSubmittingChange: (isSubmitting: boolean) => void;
}

const ReservationForm: React.FC<ReservationFormProps> = ({ formId, onSubmittingChange }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    date: '',
    shift: '',
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
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  
  const [confirmation, setConfirmation] = useState<Reservation | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestionData, setSuggestionData] = useState<{
    message: string;
    alternatives: { type: 'environment' | 'date'; label: string; action: () => void; }[];
  } | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsData, layoutData] = await Promise.all([getRestaurantSettings(), getLayout()]);
        setSettings(settingsData);
        setLayout(layoutData);
        if (layoutData.environments.length > 0) {
          setFormData(prev => ({ ...prev, environmentId: layoutData.environments[0].id }));
        }
      } catch (e) {
        setError("No se pudo cargar la configuración de reservas. Por favor, intente más tarde.");
      } finally {
        setLoadingInitialData(false);
      }
    };
    loadData();
  }, []);

  const availableShifts = useMemo(() => {
    if (!formData.date || !settings) return [];
    const dayIndex = new Date(formData.date).getUTCDay(); // 0: Dom, 1: Lun...
    const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
    const daySettings = settings.days[dayKey];
    
    const shifts = [];
    if (daySettings?.isOpen) {
      if (daySettings.shifts.mediodia.isActive) shifts.push({ value: 'mediodia', label: 'Mediodía' });
      if (daySettings.shifts.noche.isActive) shifts.push({ value: 'noche', label: 'Noche' });
    }
    return shifts;
  }, [formData.date, settings]);

  const availableTimes = useMemo(() => {
    if (formData.shift === 'mediodia') return ['12:00', '13:00', '14:00'];
    if (formData.shift === 'noche') return ['20:30', '21:00', '21:30', '22:00'];
    return [];
  }, [formData.shift]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, shift: '', time: '' }));
  }, [formData.date]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, time: availableTimes[0] || '' }));
  }, [formData.shift, availableTimes]);

  const handleDietaryToggle = (option: string) => {
    setFormData(prev => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(option)
        ? prev.dietaryRestrictions.filter(item => item !== option)
        : [...prev.dietaryRestrictions, option]
    }));
  };
  
  const performSubmit = async (dataToSubmit: typeof formData) => {
    if (!dataToSubmit.date || !dataToSubmit.shift || !dataToSubmit.time || !dataToSubmit.environmentId) {
        setError("Por favor, complete todos los campos requeridos.");
        return;
    }
    onSubmittingChange(true);
    setError(null);
    
    try {
        const reservationDate = new Date(dataToSubmit.date + 'T00:00:00-03:00'); // Use Argentina timezone offset
        const reservationsOnDate = await getReservationsForDate(reservationDate);
        const confirmedReservations = reservationsOnDate.filter(r => r.status === 'confirmada');
        
        const dayIndex = reservationDate.getUTCDay();
        const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const dayKey = dayKeys[dayIndex] as keyof RestaurantSettings['days'];
        const shiftKey = dataToSubmit.shift as 'mediodia' | 'noche';
        const shiftSettings = settings?.days[dayKey].shifts[shiftKey];

        if (!shiftSettings || !shiftSettings.isActive) {
            throw new Error("El turno seleccionado no está activo o es inválido.");
        }

        const totalLayoutCapacity = layout?.environments.reduce((sum, env) => sum + env.maxCapacity, 0) || 0;

        const reservationsForShift = confirmedReservations.filter(r => {
            const hour = parseInt(r.time.split(':')[0]);
            return shiftKey === 'mediodia' ? hour < 16 : hour >= 16;
        });

        const totalGuestsForShift = reservationsForShift.reduce((sum, r) => sum + r.guests, 0);

        if (totalGuestsForShift + Number(dataToSubmit.guests) > totalLayoutCapacity) {
            await findAndShowAlternatives('shift_full');
            return;
        }

        const selectedEnv = layout?.environments.find(env => env.id === dataToSubmit.environmentId);
        if (!selectedEnv) throw new Error("Ambiente seleccionado no es válido.");

        const guestsInSelectedEnvForShift = reservationsForShift
            .filter(r => r.environmentId === dataToSubmit.environmentId)
            .reduce((sum, r) => sum + r.guests, 0);

        if (guestsInSelectedEnvForShift + Number(dataToSubmit.guests) > selectedEnv.maxCapacity) {
            await findAndShowAlternatives('environment_full');
            return;
        }
      
      const customerId = await findOrCreateCustomer(
        dataToSubmit.phone, 
        dataToSubmit.name,
        undefined, // email
        dataToSubmit.dietaryRestrictions,
        dataToSubmit.reducedMobility,
        dataToSubmit.hasChildren
      );
      const combinedDate = new Date(`${dataToSubmit.date}T${dataToSubmit.time}:00-03:00`); // Force Argentina Timezone
      const environmentName = selectedEnv.name;
      
      const dataToCreate: Omit<Reservation, 'id'> = {
        name: dataToSubmit.name,
        phone: dataToSubmit.phone,
        date: Timestamp.fromDate(combinedDate),
        time: dataToSubmit.time,
        guests: Number(dataToSubmit.guests),
        status: 'pendiente',
        environmentId: dataToSubmit.environmentId,
        environmentName,
        dietaryRestrictions: dataToSubmit.dietaryRestrictions,
        reducedMobility: dataToSubmit.reducedMobility,
        hasChildren: dataToSubmit.hasChildren,
        occasion: dataToSubmit.occasion,
        specialRequests: dataToSubmit.specialRequests,
        customerId: customerId,
      };

      const newReservationRef = await createReservation(dataToCreate, customerId);
      const reservationId = newReservationRef.id;
      
      // --- DISPARAR WEBHOOK ---
      try {
        const webhookPayload = {
          id: reservationId,
          name: dataToCreate.name,
          phone: dataToCreate.phone,
          date: combinedDate.toISOString(),
          time: dataToCreate.time,
          guests: dataToCreate.guests,
          status: dataToCreate.status,
          environmentId: dataToCreate.environmentId,
          environmentName: dataToCreate.environmentName,
          dietaryRestrictions: dataToCreate.dietaryRestrictions,
          reducedMobility: dataToCreate.reducedMobility,
          hasChildren: dataToCreate.hasChildren,
          occasion: dataToCreate.occasion,
          specialRequests: dataToCreate.specialRequests,
          customerId: dataToCreate.customerId,
        };
        
        sendReservationWebhook(webhookPayload);
        // No se espera la respuesta para no bloquear (fire and forget)
      } catch (webhookError) {
        console.error("Error al disparar el webhook de confirmación:", webhookError);
        // No se muestra este error al usuario para no confundir.
      }
      // --- FIN WEBHOOK ---

      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(reservationId)}`;
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setQrCodeDataUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (qrError) {
        console.error("Failed to fetch QR code:", qrError);
      }

      setConfirmation({ id: reservationId, ...dataToCreate, date: combinedDate, email: '' });

    } catch (err: any) {
      console.error("Error al crear reserva:", err);
      setError('Hubo un problema al procesar su reserva. Por favor, intente de nuevo.');
    } finally {
      onSubmittingChange(false);
    }
  };

  const findAndShowAlternatives = async (reason: 'environment_full' | 'shift_full') => {
    onSubmittingChange(true);
    const { date, guests, environmentId, shift } = formData;
    const reservationDate = new Date(date + 'T00:00:00-03:00');
    const reservationsOnDate = await getReservationsForDate(reservationDate);
    const confirmedReservations = reservationsOnDate.filter(r => r.status === 'confirmada');

    let message = '';
    const alternatives: { type: 'environment' | 'date'; label: string; action: () => void; }[] = [];

    if (reason === 'environment_full') {
        const selectedEnv = layout?.environments.find(e => e.id === environmentId);
        message = `Disculpe, no hay suficiente disponibilidad en "${selectedEnv?.name}" para la cantidad de personas seleccionada.`;
        
        if (layout && shift) {
            const reservationsForShift = confirmedReservations.filter(r => {
                const hour = parseInt(r.time.split(':')[0]);
                return (shift === 'mediodia' ? hour < 16 : hour >= 16);
            });
            
            for (const env of layout.environments) {
                if (env.id === environmentId) continue;
                
                const guestsInEnv = reservationsForShift
                    .filter(r => r.environmentId === env.id)
                    .reduce((sum, r) => sum + r.guests, 0);

                if (guestsInEnv + Number(guests) <= env.maxCapacity) {
                    alternatives.push({
                        type: 'environment',
                        label: `Probar en ${env.name}`,
                        action: () => {
                          const newFormData = { ...formData, environmentId: env.id };
                          setFormData(newFormData);
                          performSubmit(newFormData);
                        }
                    });
                }
            }
        }
    }

    if (reason === 'shift_full') {
        message = `Disculpe, el turno de la ${shift === 'mediodia' ? 'mediodía' : 'noche'} está completo para la fecha seleccionada.`;
    }
    
    alternatives.push({
      type: 'date',
      label: 'Seleccionar otro día',
      action: () => {
        dateInputRef.current?.focus();
        if (typeof dateInputRef.current?.showPicker === 'function') {
            dateInputRef.current.showPicker();
        }
      }
    });

    if (alternatives.length > 1) { // more than just the date button
        message += " Le sugerimos estas alternativas:";
    } else {
        message += " Por favor, intente en otra fecha.";
    }

    setSuggestionData({ message, alternatives });
    onSubmittingChange(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSubmit(formData);
  };
  
  const resetForm = () => {
    setConfirmation(null);
    setQrCodeDataUrl(null);
    setError(null);
    setFormData({ name: '', phone: '', date: '', shift: '', time: '', guests: 2, environmentId: layout?.environments[0].id || '', specialRequests: '', dietaryRestrictions: [], reducedMobility: false, hasChildren: false, occasion: '' });
  }

  const handleDownloadPDF = () => {
    const input = document.getElementById('reservation-confirmation-content');
    if (input && confirmation) {
      html2canvas(input, {
        backgroundColor: '#0c0a09',
        scale: 2,
        useCORS: true,
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`reserva-don-garcia-${confirmation.id.slice(0,6)}.pdf`);
      });
    }
  };

  const handleShare = async () => {
    if (confirmation && navigator.share) {
      const shareData = {
        title: 'Reserva en Don García',
        text: `¡Hola! Te comparto los detalles de nuestra reserva en Don García:\n\nDía: ${confirmation.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}\nHora: ${confirmation.time} hs\nPersonas: ${confirmation.guests}\nAmbiente: ${confirmation.environmentName}\n\n¡Nos vemos allí!`,
        url: 'https://www.instagram.com/dongarcia.sf/',
      };
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error al compartir:', err);
        }
      }
    }
  };

  const renderConfirmationModal = () => {
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return null;

    return createPortal(
      <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-stone-900 border border-gold/30 rounded-lg shadow-[0_0_60px_rgba(176,141,72,0.2)] w-full max-w-md p-8 text-center relative">
              <button onClick={resetForm} className="absolute top-4 right-4 text-stone-500 hover:text-white transition-colors text-3xl leading-none">&times;</button>
              <div id="reservation-confirmation-content" className="bg-stone-900 p-4">
                <h2 className="text-3xl font-serif text-gold mb-4">¡Reserva Confirmada!</h2>
                <p className="text-stone-400 mb-8">Gracias, {confirmation?.name}. Lo esperamos para una velada inolvidable.</p>
                <div className="bg-white p-4 inline-block rounded-md shadow-lg mb-8">
                    {qrCodeDataUrl ? (
                        <img 
                            src={qrCodeDataUrl}
                            alt="Código QR de la Reserva" 
                            className="block"
                            crossOrigin="anonymous"
                        />
                    ) : (
                        <div className="w-[160px] h-[160px] flex items-center justify-center bg-gray-200 animate-pulse">
                            <span className="text-xs text-gray-500">Generando QR...</span>
                        </div>
                    )}
                </div>
                <div className="text-left bg-black/30 p-4 rounded-md border border-stone-800 space-y-2 mb-2">
                    <p className="text-sm"><strong className="text-gold w-24 inline-block">Nombre:</strong> {confirmation?.name}</p>
                    <p className="text-sm"><strong className="text-gold w-24 inline-block">Día:</strong> {confirmation?.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <p className="text-sm"><strong className="text-gold w-24 inline-block">Hora:</strong> {confirmation?.time} hs</p>
                    <p className="text-sm"><strong className="text-gold w-24 inline-block">Personas:</strong> {confirmation?.guests} {confirmation?.hasChildren && '(Incluye niños)'}</p>
                    <p className="text-sm"><strong className="text-gold w-24 inline-block">Ambiente:</strong> {confirmation?.environmentName}</p>
                    {confirmation?.occasion && <p className="text-sm"><strong className="text-gold w-24 inline-block">Motivo:</strong> {confirmation?.occasion}</p>}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <button onClick={handleDownloadPDF} className="flex-1 bg-transparent border border-stone-700 text-stone-300 py-3 uppercase tracking-widest text-[10px] font-bold hover:border-gold hover:text-white transition-all rounded-sm">Descargar</button>
                  {navigator.share && <button onClick={handleShare} className="flex-1 bg-transparent border border-stone-700 text-stone-300 py-3 uppercase tracking-widest text-[10px] font-bold hover:border-gold hover:text-white transition-all rounded-sm">Compartir</button>}
              </div>
          </div>
      </div>,
      modalRoot
    );
  };

  const renderSuggestionModal = () => {
    if (!suggestionData) return null;
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return null;

    return createPortal(
      <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-stone-900 border border-red-500/30 rounded-lg shadow-[0_0_60px_rgba(239,68,68,0.2)] w-full max-w-md p-8 text-center relative animate-fadeInUp">
          <h3 className="text-2xl font-serif text-red-400 mb-4">Disponibilidad Limitada</h3>
          <p className="text-stone-300 mb-8">{suggestionData.message}</p>
          
          {suggestionData.alternatives.length > 0 && (
            <div className="flex flex-col gap-3 mb-8">
              {suggestionData.alternatives.map((alt, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSuggestionData(null);
                    alt.action();
                  }}
                  className="w-full bg-stone-800 text-stone-200 px-6 py-3 border border-stone-700 rounded-sm hover:border-gold hover:text-white transition-all group text-sm"
                >
                  {alt.label}
                </button>
              ))}
            </div>
          )}
          
          <button
            onClick={() => setSuggestionData(null)}
            className="px-8 py-3 bg-gold text-black font-bold hover:bg-white transition-colors text-xs uppercase tracking-widest rounded-sm"
          >
            Cerrar
          </button>
        </div>
      </div>,
      modalRoot
    );
  };

  if (loadingInitialData) return <div className="py-24 text-center text-gold">Cargando disponibilidad...</div>;
  if (confirmation) return renderConfirmationModal();

  return (
    <>
      {renderSuggestionModal()}
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="text-xs uppercase tracking-widest text-gold font-black block mb-2">Nombre Completo</label><input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Su nombre" className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none"/></div>
          <div><label className="text-xs uppercase tracking-widest text-gold font-black block mb-2">Teléfono</label><input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Ej: 543424066887" className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none"/></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><label className="text-xs uppercase tracking-widest text-gold font-black block mb-2">Día</label><input ref={dateInputRef} required type="date" value={formData.date} min={getArgentinaTime().toISOString().split("T")[0]} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none appearance-none"/></div>
          <div><label className="text-xs uppercase tracking-widest text-gold font-black block mb-2">Turno</label><select required value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value})} disabled={!formData.date || availableShifts.length === 0} className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none appearance-none"><option value="">{availableShifts.length > 0 ? 'Seleccione turno' : 'Cerrado'}</option>{availableShifts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          <div><label className="text-xs uppercase tracking-widest text-gold font-black block mb-2">Hora</label><select required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} disabled={!formData.shift} className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none appearance-none"><option value="">Seleccione hora</option>{availableTimes.map(t => <option key={t} value={t}>{t} hs</option>)}</select></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="text-xs uppercase tracking-widest text-gold font-black block mb-2">Personas</label><input required type="number" min="1" max="12" value={formData.guests} onChange={e => setFormData({...formData, guests: parseInt(e.target.value)})} className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none"/></div>
          <div><label className="text-xs uppercase tracking-widest text-gold font-black block mb-2">Ambiente</label><select required value={formData.environmentId} onChange={e => setFormData({...formData, environmentId: e.target.value})} className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none appearance-none"><option value="">Seleccione ambiente</option>{layout?.environments.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}</select></div>
        </div>
        <div className="border-t border-stone-800 pt-6 mt-6">
          <h3 className="text-lg font-serif text-gold mb-4">Detalles Especiales</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-400 font-bold block mb-3">Motivo de la Reserva</label>
              <select value={formData.occasion} onChange={e => setFormData({...formData, occasion: e.target.value})} className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none appearance-none text-stone-300">
                <option value="">Cena casual (Sin motivo especial)</option>
                <option value="Aniversario">Aniversario</option>
                <option value="Cumpleaños">Cumpleaños</option>
                <option value="Reunión Empresarial">Reunión Empresarial</option>
                <option value="Cita Romántica">Cita Romántica</option>
                <option value="Celebración Familiar">Celebración Familiar</option>
                <option value="Otro">Otro motivo</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-400 font-bold block mb-3">Acompañantes</label>
              <div className="flex items-center gap-3 bg-stone-900 border-2 border-stone-800 p-3 rounded-sm h-[52px]">
                <input id="children" type="checkbox" checked={formData.hasChildren} onChange={e => setFormData({...formData, hasChildren: e.target.checked})} className="h-5 w-5 rounded bg-stone-800 border-stone-700 text-gold focus:ring-gold focus:ring-offset-stone-900 ml-2"/>
                <label htmlFor="children" className="text-sm text-stone-300 cursor-pointer select-none flex-1">Asistiremos con niños</label>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="text-xs uppercase tracking-widest text-stone-400 font-bold block mb-3">Restricciones Alimenticias</label>
            <div className="flex flex-wrap gap-3">
              <DietaryOption label="Sin TACC" selected={formData.dietaryRestrictions.includes('Sin TACC')} onClick={() => handleDietaryToggle('Sin TACC')} />
              <DietaryOption label="Vegetariano" selected={formData.dietaryRestrictions.includes('Vegetariano')} onClick={() => handleDietaryToggle('Vegetariano')} />
              <DietaryOption label="Vegano" selected={formData.dietaryRestrictions.includes('Vegano')} onClick={() => handleDietaryToggle('Vegano')} />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-xs uppercase tracking-widest text-stone-400 font-bold block mb-3">Accesibilidad</label>
            <div className="flex items-center gap-3 bg-stone-900 border-2 border-stone-800 p-3 rounded-sm w-full md:w-1/2 h-[52px]">
              <input id="mobility" type="checkbox" checked={formData.reducedMobility} onChange={e => setFormData({...formData, reducedMobility: e.target.checked})} className="h-5 w-5 rounded bg-stone-800 border-stone-700 text-gold focus:ring-gold focus:ring-offset-stone-900 ml-2"/>
              <label htmlFor="mobility" className="text-sm text-stone-300 cursor-pointer select-none flex-1">Requerimos acceso para movilidad reducida</label>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-stone-400 font-bold block mb-3">Notas Adicionales</label>
            <textarea value={formData.specialRequests} onChange={e => setFormData({...formData, specialRequests: e.target.value})} placeholder="Algún otro detalle que debamos saber para recibirlo de la mejor manera..." className="w-full bg-stone-900 border-2 border-stone-800 py-3 px-4 focus:border-gold outline-none h-24 resize-none text-stone-300"></textarea>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm font-bold text-center border border-red-500/30 bg-red-500/10 p-4 rounded-md">{error}</p>}
        
      </form>
    </>
  );
};

export default ReservationForm;
