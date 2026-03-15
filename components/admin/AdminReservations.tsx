import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { listenToReservationsForDate, updateReservation, deleteReservation } from '../../services/reservationRepository';
import { getLayout } from '../../services/layoutRepository';
import { Reservation, Layout, RestaurantSettings } from '../../types';
import ReservationModal from './ReservationModal';
import { getRestaurantSettings } from '../../services/settingsRepository';
import { getArgentinaTime } from '../../utils/dateUtils';
import { ChevronLeft, ChevronRight, Calendar, Plus, Printer } from 'lucide-react';

interface AdminReservationsProps {
  preselectedDate?: Date;
}

const AdminReservations: React.FC<AdminReservationsProps> = ({ preselectedDate }) => {
  const [selectedDate, setSelectedDate] = useState(preselectedDate || getArgentinaTime());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<Reservation | null>(null);
  const [dateTabsOffset, setDateTabsOffset] = useState(0);
  
  const [mobileView, setMobileView] = useState<'timeline' | 'salon'>('timeline');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToReservationsForDate(selectedDate, setReservations);
    
    const fetchInitialData = async () => {
        const [layoutData, settingsData] = await Promise.all([ getLayout(), getRestaurantSettings() ]);
        setLayout(layoutData); setSettings(settingsData); setLoading(false);
    };
    fetchInitialData();
    return () => unsubscribe();
  }, [selectedDate]);

  useEffect(() => {
    if (isModalOpen || confirmingDelete) { document.body.style.overflow = 'hidden'; } 
    else { document.body.style.overflow = 'unset'; }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen, confirmingDelete]);

  useEffect(() => {
    const today = getArgentinaTime(); today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate); selected.setHours(0, 0, 0, 0);
    if (selected < today) { setSelectedDate(today); return; }
    const diffDays = Math.round((selected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < dateTabsOffset || diffDays >= dateTabsOffset + 7) { setDateTabsOffset(diffDays > 3 ? diffDays - 3 : 0); }
  }, [selectedDate, dateTabsOffset]);

  const handleDateChange = (increment: number) => {
    const newDate = new Date(selectedDate); newDate.setDate(newDate.getDate() + increment);
    const today = getArgentinaTime(); today.setHours(0, 0, 0, 0);
    if (newDate < today) return; setSelectedDate(newDate);
  };
  
  const handlePrint = () => { window.print(); };

  const handlePrintList = (title: string, reservationsToPrint: Reservation[]) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDocument = printWindow?.document;

    if (!printWindow || !printDocument) {
        alert('No se pudo generar la vista de impresión.');
        document.body.removeChild(iframe);
        return;
    }

    const tableRows = reservationsToPrint.map(r => {
        let notesContent = '-';
        if (r.status !== 'cancelada') {
            const preferences = [];
            if (r.specialRequests) preferences.push(r.specialRequests);
            if (r.dietaryRestrictions && r.dietaryRestrictions.length > 0) preferences.push(`Dietas: ${r.dietaryRestrictions.join(', ')}`);
            if (r.reducedMobility) preferences.push('Movilidad reducida');
            if (r.hasChildren) preferences.push('Con niños');
            if (r.occasion) preferences.push(`Motivo: ${r.occasion}`);
            if (preferences.length > 0) notesContent = preferences.join(' | ');
        } else {
            notesContent = 'CANCELADA';
        }
        
        const rowStyle = r.status === 'cancelada' ? 'style="color: #999; text-decoration: line-through;"' : '';

        return `
            <tr ${rowStyle}>
                <td>${r.time}</td>
                <td>${r.name}</td>
                <td>${r.guests}</td>
                <td>${r.environmentName || 'N/A'}</td>
                <td>${notesContent}</td>
            </tr>
        `;
    }).join('');

    const content = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Listado de Reservas - ${title}</title>
                <style>
                    body { font-family: sans-serif; margin: 20px; color: black; background: white; }
                    h1, h2 { font-family: serif; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    @media print {
                        body { margin: 0; padding: 20px; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                    }
                </style>
            </head>
            <body>
                <h1>Don García - Listado de Reservas</h1>
                <h2>${title} - ${selectedDate.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Hora</th>
                            <th>Nombre</th>
                            <th>Cub.</th>
                            <th>Ambiente</th>
                            <th>Notas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows.length > 0 ? tableRows : '<tr><td colspan="5" style="text-align: center; font-style: italic;">No hay reservas para este turno.</td></tr>'}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
        </html>
    `;

    printDocument.open();
    printDocument.write(content);
    printDocument.close();

    // Remove the iframe after printing is done or cancelled
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 2000);
  };

  const openNewReservationModal = () => { setEditingReservation({ date: selectedDate, time: '20:30', status: 'pendiente', guests: 2, environmentId: layout?.environments[0]?.id }); setIsModalOpen(true); };
  const openNewReservationModalForEnv = (envId: string, envName: string) => { setEditingReservation({ date: selectedDate, time: '20:30', status: 'pendiente', guests: 2, environmentId: envId, environmentName: envName }); setIsModalOpen(true); };
  const openEditReservationModal = (res: Reservation) => { setEditingReservation(res); setIsModalOpen(true); };
  const executeDelete = async () => { if(confirmingDelete) { try { await deleteReservation(confirmingDelete.id); } catch(e){ console.error(e); } finally { setConfirmingDelete(null); } }};

  const dayKey = useMemo(() => {
    const dayKeys: (keyof RestaurantSettings['days'])[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return dayKeys[selectedDate.getDay()];
  }, [selectedDate]);

  const totalLayoutCapacity = useMemo(() => {
      return layout?.environments.reduce((sum, env) => sum + env.maxCapacity, 0) || 0;
  }, [layout]);

  const middayCapacity = useMemo(() => {
      return settings?.days[dayKey]?.shifts.mediodia.isActive ? totalLayoutCapacity : 0;
  }, [settings, dayKey, totalLayoutCapacity]);

  const nightCapacity = useMemo(() => {
      return settings?.days[dayKey]?.shifts.noche.isActive ? totalLayoutCapacity : 0;
  }, [settings, dayKey, totalLayoutCapacity]);

  const sortedReservations = useMemo(() => [...reservations].sort((a, b) => a.time.localeCompare(b.time)), [reservations]);
  const middayReservations = useMemo(() => sortedReservations.filter(r => parseInt(r.time.split(':')[0]) < 16), [sortedReservations]);
  const nightReservations = useMemo(() => sortedReservations.filter(r => parseInt(r.time.split(':')[0]) >= 16), [sortedReservations]);
  const totalGuestsMidday = useMemo(() => middayReservations.reduce((s, r) => s + (r.status === 'confirmada' || r.status === 'pendiente' ? r.guests : 0), 0), [middayReservations]);
  const totalGuestsNoche = useMemo(() => nightReservations.reduce((s, r) => s + (r.status === 'confirmada' || r.status === 'pendiente' ? r.guests : 0), 0), [nightReservations]);
  
  if (loading && !layout) return <div className="text-white text-center p-10">Cargando gestión de reservas...</div>;
  
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;
  
  const renderReservationList = (title: string, shiftReservations: Reservation[]) => (
     <div>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-serif text-white border-l-4 border-white/50 pl-4">{title}</h3>
            <button onClick={() => handlePrintList(title, shiftReservations)} className="no-print text-stone-400 hover:text-gold transition-colors p-2" title={`Imprimir listado de ${title}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            </button>
        </div>
        <div className="w-full overflow-hidden rounded-sm border border-stone-800 bg-stone-900/20">
          <table className="w-full text-left printable-table">
            <thead><tr className="bg-stone-900/50"><th className="p-4 text-xs uppercase tracking-widest text-gold">Hora</th><th className="p-4 text-xs uppercase tracking-widest text-gold">Nombre</th><th className="p-4 text-xs uppercase tracking-widest text-gold hidden sm:table-cell">Cub.</th><th className="p-4 text-xs uppercase tracking-widest text-gold hidden md:table-cell">Ambiente</th><th className="p-4 text-xs uppercase tracking-widest text-gold">Notas</th><th className="p-4 text-xs uppercase tracking-widest text-gold no-print">Acciones</th></tr></thead>
            <tbody className="divide-y divide-stone-800">
              {shiftReservations.map(r => {
                const isCancelled = r.status === 'cancelada';
                const hasSpecialNotes = !isCancelled && (r.specialRequests || (r.dietaryRestrictions && r.dietaryRestrictions.length > 0) || r.reducedMobility || r.hasChildren || r.occasion);
                return (
                  <tr key={r.id} className={`transition-colors ${isCancelled ? 'bg-stone-900/50 opacity-60' : 'hover:bg-stone-800/50'}`}>
                    <td className={`p-4 font-bold ${isCancelled ? 'text-stone-600 line-through' : 'text-white'}`}>{r.time}</td>
                    <td className={`p-4 ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-300'}`}>
                      <div className="flex items-center gap-2">
                        <span>{r.name}</span>
                        {hasSpecialNotes && 
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <title>Esta reserva tiene notas especiales</title>
                                <path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.852-1.21 3.488 0l6.237 11.94c.64 1.222-.464 2.71-1.744 2.71H3.764c-1.28 0-2.384-1.488-1.744-2.71l6.237-11.94zM9 14a1 1 0 112 0 1 1 0 01-2 0zm1-7a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd"></path>
                            </svg>
                        }
                      </div>
                    </td>
                    <td className={`p-4 hidden sm:table-cell ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-300'}`}>{r.guests}</td>
                    <td className={`p-4 hidden md:table-cell ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-300'}`}>{r.environmentName || 'N/A'}</td>
                    <td className={`p-4 text-xs italic ${isCancelled ? 'text-stone-700 line-through' : 'text-stone-400'}`}>
                      {(() => {
                        const notes = [];
                        if (r.specialRequests) notes.push(r.specialRequests);
                        if (r.dietaryRestrictions && r.dietaryRestrictions.length > 0) notes.push(`Dietas: ${r.dietaryRestrictions.join(', ')}`);
                        if (r.reducedMobility) notes.push('Movilidad reducida');
                        if (r.hasChildren) notes.push('Con niños');
                        if (r.occasion) notes.push(`Motivo: ${r.occasion}`);
                        return notes.length > 0 ? notes.join(' | ') : '-';
                      })()}
                    </td>
                    <td className="p-4 text-right no-print">
                      <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditReservationModal(r)} className="text-stone-400 hover:text-gold p-2 transition-colors" title="Editar reserva"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                          <button onClick={() => setConfirmingDelete(r)} className="text-stone-400 hover:text-red-500 p-2 transition-colors" title="Eliminar reserva"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
           {shiftReservations.length === 0 && <p className="text-center text-stone-600 p-8 italic">No hay reservas para este turno.</p>}
        </div>
      </div>
  );

  const renderReservationsViewDesktop = () => {
    const renderShiftView = (title: string, shiftReservations: Reservation[], shiftCapacity: number) => {
      const totalGuestsInShift = shiftReservations.reduce((s, r) => s + (r.status === 'confirmada' || r.status === 'pendiente' ? r.guests : 0), 0);
      return (
        <div>
          <div className="sticky top-[210px] z-20 bg-luxury-black/95 backdrop-blur-md flex justify-between items-baseline mb-8 border-b-2 border-gold/20 pb-4 pt-4 -mx-2 px-2 shadow-lg">
            <h2 className="text-3xl font-serif text-gold">{title}</h2>
            <div className="text-right">
              <p className="text-xl font-bold text-white">{shiftCapacity > 0 ? Math.round((totalGuestsInShift / shiftCapacity) * 100) : 0}%</p>
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Ocupación Turno</p>
            </div>
          </div>
          {layout?.environments.map(env => { 
            const reservationsInEnv = shiftReservations.filter(r => r.environmentId === env.id);
            const currentGuests = reservationsInEnv.filter(r => r.status === 'confirmada' || r.status === 'pendiente').reduce((s,r)=>s+r.guests,0);
            const perc = env.maxCapacity>0?(currentGuests/env.maxCapacity)*100:0; 
            const isFull = currentGuests >= env.maxCapacity; 
            return (<div key={env.id} className="mb-12"><div className="mb-6"><div className={`flex justify-between items-center mb-3 border-l-4 ${isFull ? 'border-red-500/70' : 'border-gold/50'} pl-4`}><h3 className={`text-xl font-serif ${isFull ? 'text-red-400' : 'text-gold'}`}>{env.name}</h3><div className="text-right"><p className={`text-sm font-bold font-mono ${isFull ? 'text-red-400' : 'text-white'}`}>{Math.round(perc)}%</p><p className="text-[8px] uppercase tracking-widest text-stone-500 font-bold">Ocupación</p></div></div><div className="w-full bg-stone-800/50 h-1.5"><div className={`h-1.5 transition-all ${perc >= 100 ?'bg-red-500':'bg-gold'}`} style={{width:`${perc>100?100:perc}%`}}></div></div></div><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{reservationsInEnv.map(res=>{ 
              const isPending = res.status === 'pendiente';
              const isCancelled = res.status === 'cancelada';
              const hasSpecialNotes = !isCancelled && (res.specialRequests || (res.dietaryRestrictions && res.dietaryRestrictions.length > 0) || res.reducedMobility || res.hasChildren || res.occasion); 
              return (
                <div key={res.id} className={`relative group aspect-square bg-stone-900/70 border-2 rounded-sm transition-colors 
                  ${isCancelled ? 'border-red-900/50 opacity-60 hover:border-red-700' :
                  isPending ? 'border-stone-600 hover:border-stone-400' :
                  'border-gold/30 hover:border-gold'
                }`}>
                    {isPending && <span className="absolute top-2 left-2 text-[9px] uppercase tracking-widest font-bold text-stone-500 bg-black/40 px-2 py-0.5 rounded z-10">Pendiente</span>}
                    {isCancelled && <span className="absolute top-2 left-2 text-[9px] uppercase tracking-widest font-bold text-red-500 bg-black/40 px-2 py-0.5 rounded z-10">Cancelada</span>}
                    <button onClick={() => openEditReservationModal(res)} className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                        <p className={`text-4xl font-serif font-bold transition-transform group-hover:scale-110 
                          ${isCancelled ? 'text-stone-700 line-through' :
                            isPending ? 'text-stone-500 group-hover:text-stone-300' :
                            'text-gold'
                          }`}>{res.guests}</p>
                        <p className={`text-[10px] uppercase tracking-widest -mt-1 
                          ${isCancelled ? 'text-stone-800' :
                            isPending ? 'text-stone-600' :
                            'text-stone-400'
                          }`}>cubiertos</p>
                        <div className={`font-semibold text-sm text-stone-200 mt-2 w-full break-words px-1 
                          ${isCancelled ? 'text-stone-600 line-through' :
                            isPending ? 'text-stone-400' :
                            'text-stone-200'
                          }`}>
                            {res.name}
                            {hasSpecialNotes && (
                                <svg className="w-4 h-4 text-yellow-400 inline-block align-middle ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <title>Notas especiales</title>
                                    <path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.852-1.21 3.488 0l6.237 11.94c.64 1.222-.464 2.71-1.744 2.71H3.764c-1.28 0-2.384-1.488-1.744-2.71l6.237-11.94zM9 14a1 1 0 112 0 1 1 0 01-2 0zm1-7a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                </svg>
                            )}
                        </div>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmingDelete(res); }} 
                        className="absolute top-1 right-1 p-1 text-stone-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/30 hover:bg-black/70"
                        aria-label={`Eliminar reserva de ${res.name}`}
                        title={`Eliminar reserva de ${res.name}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
              )})}<button onClick={()=>openNewReservationModalForEnv(env.id, env.name)} className="aspect-square border-2 border-dashed border-stone-700 text-stone-600 rounded flex flex-col items-center justify-center p-2 text-center transition-all hover:border-gold hover:text-gold"><span className="text-2xl font-thin">+</span><span className="text-[9px] uppercase tracking-widest">Nueva Reserva</span></button></div></div>); })}
        </div>
      );
    };

    return (<div className="hidden md:block">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 no-print">
            {renderShiftView('Turno Mediodía', middayReservations, middayCapacity)}
            {renderShiftView('Turno Noche', nightReservations, nightCapacity)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12">
            {renderReservationList('Listado Mediodía', middayReservations)}
            {renderReservationList('Listado Noche', nightReservations)}
        </div>
    </div>);
  };
  
  const renderMobileView = () => {
    const statusClasses: Record<Reservation['status'], string> = { confirmada: 'bg-gold', pendiente: 'bg-stone-500', cancelada: 'bg-red-500' };
    const ReservationCard: React.FC<{res: Reservation}> = ({res}) => {
        const hasSpecialNotes = res.specialRequests || (res.dietaryRestrictions && res.dietaryRestrictions.length > 0) || res.reducedMobility || res.hasChildren || res.occasion;
        return (
            <button onClick={() => openEditReservationModal(res)} className="w-full bg-stone-900/70 border-l-4 border-gold/30 p-4 rounded-sm flex items-center gap-4 text-left shadow-lg hover:bg-stone-800 transition-colors">
                <div className={`w-1.5 h-10 rounded-full ${statusClasses[res.status]}`}></div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{res.name}</p>
                        {hasSpecialNotes && 
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                               <title>Esta reserva tiene notas especiales</title>
                               <path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.852-1.21 3.488 0l6.237 11.94c.64 1.222-.464 2.71-1.744 2.71H3.764c-1.28 0-2.384-1.488-1.744-2.71l6.237-11.94zM9 14a1 1 0 112 0 1 1 0 01-2 0zm1-7a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd"></path>
                            </svg>
                        }
                    </div>
                    <p className="text-xs text-stone-400">{res.environmentName || 'Sin asignar'}</p>
                </div>
                <div className="text-right">
                    <p className="text-xl font-serif text-white">{res.guests}</p>
                    <p className="text-[9px] uppercase tracking-widest text-stone-500 -mt-1">CUB.</p>
                </div>
                <div className="text-right pl-4 border-l border-stone-700/50">
                    <p className="text-xl font-bold font-mono text-gold">{res.time}</p>
                </div>
            </button>
        );
    };
    const TimelineView = () => (<div className="space-y-4 pb-24">{middayReservations.length > 0 && <div className="text-xs text-stone-500 uppercase tracking-widest font-bold pt-4 pb-2 border-b border-stone-800">Turno Mediodía</div>}{middayReservations.map(res => <ReservationCard key={res.id} res={res}/>)}{nightReservations.length > 0 && <div className="text-xs text-stone-500 uppercase tracking-widest font-bold pt-8 pb-2 border-b border-stone-800">Turno Noche</div>}{nightReservations.map(res => <ReservationCard key={res.id} res={res}/>)}{sortedReservations.length === 0 && <p className="text-center text-stone-600 italic pt-12">No hay reservas para este día.</p>}</div>);
    const SalonView = () => {
    const renderShiftEnvironments = (title: string, shiftReservations: Reservation[]) => (
        <div className="mb-8">
            <h3 className="text-xs text-stone-500 uppercase tracking-widest font-bold pt-4 pb-2 border-b border-stone-800 mb-4">{title}</h3>
            {layout?.environments.length === 0 ? (
                <p className="text-stone-600 italic text-center py-4">No hay ambientes configurados.</p>
            ) : (
                <div className="space-y-6">
                    {layout?.environments.map(env => {
                        const currentGuests = shiftReservations
                            .filter(r => r.environmentId === env.id && (r.status === 'confirmada' || r.status === 'pendiente'))
                            .reduce((s, r) => s + r.guests, 0);
                        const perc = env.maxCapacity > 0 ? (currentGuests / env.maxCapacity) * 100 : 0;
                        const isFull = perc >= 100;
                        
                        return (
                            <div key={env.id}>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-lg font-serif text-white">{env.name}</h4>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold font-mono ${isFull ? 'text-red-400' : 'text-gold'}`}>{Math.round(perc)}%</p>
                                        <p className="text-[8px] uppercase tracking-widest text-stone-500 font-bold">Ocupación</p>
                                    </div>
                                </div>
                                <div className="w-full bg-stone-800 h-2 rounded-full">
                                    <div 
                                        className={`h-2 rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-gold'}`} 
                                        style={{ width: `${perc > 100 ? 100 : perc}%` }}>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div className="pb-24 pt-4">
            {middayReservations.length > 0 && renderShiftEnvironments('Turno Mediodía', middayReservations)}
            {nightReservations.length > 0 && renderShiftEnvironments('Turno Noche', nightReservations)}
            {sortedReservations.length === 0 && (
                 <p className="text-center text-stone-600 italic pt-12">No hay reservas para mostrar la ocupación.</p>
            )}
        </div>
    );
};
    return (<div className="md:hidden no-print">{mobileView === 'timeline' ? <TimelineView/> : <SalonView/>}<button onClick={openNewReservationModal} className="fixed bottom-24 right-6 w-16 h-16 bg-gold rounded-full flex items-center justify-center text-black shadow-2xl hover:scale-110 transition-transform z-40"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg></button><div className="fixed bottom-0 left-0 right-0 bg-stone-900/80 backdrop-blur-lg border-t border-stone-800 grid grid-cols-2 z-30">{[{id:'timeline',label:'Reservas',icon:<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>},{id:'salon',label:'Salón',icon:<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>}].map(item=>(<button key={item.id} onClick={()=>setMobileView(item.id as any)} className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors ${mobileView===item.id?'text-gold':'text-stone-500 hover:text-white'}`}><div className="flex-shrink-0">{item.icon}</div><span className="text-[10px] uppercase tracking-widest">{item.label}</span></button>))}</div></div>);
  };
  
  const totalDayGuests = totalGuestsMidday + totalGuestsNoche;
  const totalDayCapacity = middayCapacity + nightCapacity;
  const totalPercentage = totalDayCapacity > 0 ? (totalDayGuests / totalDayCapacity) * 100 : 0;
  const today = getArgentinaTime();
  const isTodaySelected = selectedDate.toDateString() === today.toDateString();
  const handleCalendarSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const [y,m,d] = e.target.value.split('-').map(Number); const newDate = new Date(y,m-1,d); const todayCal = getArgentinaTime(); todayCal.setHours(0,0,0,0); if(newDate >= todayCal) setSelectedDate(newDate); };
  const minDate = today.toISOString().split('T')[0];
  const datesToShow = Array.from({ length: 7 }).map((_, i) => { const d = getArgentinaTime(); d.setDate(d.getDate() + dateTabsOffset + i); return d; });
  const dayKeys: (keyof RestaurantSettings['days'])[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  return (
    <div className="px-6 md:px-12">
      {/* Unified Responsive Header */}
      <div className="sticky top-0 z-30 bg-luxury-black/95 backdrop-blur-xl border-b border-stone-800 shadow-2xl no-print -mx-6 px-6 md:-mx-12 md:px-12 py-6 mb-8">
        <div className="w-full flex flex-col lg:flex-row justify-between items-center gap-6">
            
            {/* Left: Selected Date (Large) */}
            <div className="flex-1 w-full lg:w-auto flex items-center justify-between lg:justify-start gap-6">
                <div className="flex items-baseline gap-4">
                    <span className="text-6xl md:text-7xl font-serif text-gold leading-none tracking-tighter">{selectedDate.getDate()}</span>
                    <div className="flex flex-col">
                        <span className="text-sm md:text-base text-white font-bold uppercase tracking-[0.2em]">{selectedDate.toLocaleDateString('es-AR', { month: 'long' })}</span>
                        <span className="text-[10px] md:text-xs text-stone-500 uppercase tracking-[0.2em] font-medium">{selectedDate.toLocaleDateString('es-AR', { weekday: 'long' })}</span>
                    </div>
                </div>
                
                {/* Mobile Create Button (Visible only on small screens) */}
                <button 
                  onClick={openNewReservationModal}
                  className="lg:hidden bg-gold hover:bg-gold-light text-black p-4 rounded-full shadow-lg shadow-gold/20 active:scale-95 transition-all"
                  aria-label="Nueva Reserva"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* Center: Day selection (navigation) */}
            <div className="flex-shrink-0 w-full lg:w-auto flex items-center justify-center">
                <div className="flex items-center bg-stone-900/60 border border-stone-800 p-1 rounded-xl shadow-inner w-full lg:w-auto justify-between lg:justify-start">
                    <button 
                      onClick={() => handleDateChange(-1)} 
                      disabled={isTodaySelected} 
                      className="p-3 text-stone-500 hover:text-gold transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:bg-stone-800/50 rounded-lg" 
                      aria-label="Día anterior"
                    >
                      <ChevronLeft size={24} />
                    </button>

                    <div className="flex items-center gap-2 mx-2 overflow-x-auto no-scrollbar py-1">
                        <button 
                          onClick={() => setSelectedDate(getArgentinaTime())} 
                          className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-all border shrink-0 ${isTodaySelected ? 'bg-gold text-black border-gold shadow-lg shadow-gold/20' : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-white'}`}
                        >
                          Hoy
                        </button>
                        
                        <div className="w-px h-8 bg-stone-800 mx-1 shrink-0"></div>

                        <div className="flex items-center gap-1">
                            {datesToShow.map(date => { 
                                const dayKey = dayKeys[date.getDay()]; 
                                const daySetting = settings?.days[dayKey]; 
                                const isOpen = daySetting?.isOpen ?? true; 
                                const isSelected = date.toDateString() === selectedDate.toDateString(); 
                                const isToday = date.toDateString() === getArgentinaTime().toDateString(); 
                                
                                if (isToday) return null;

                                const dayName = date.toLocaleDateString('es-AR',{weekday:'short'}).replace('.','').toUpperCase(); 
                                
                                return (
                                  <button 
                                    key={date.toISOString()} 
                                    onClick={() => setSelectedDate(date)} 
                                    disabled={!isOpen} 
                                    className={`group relative flex flex-col items-center justify-center min-w-[50px] py-2 rounded-lg transition-all border shrink-0 ${isSelected ? 'bg-gold/10 border-gold/50 text-gold shadow-lg shadow-gold/5' : 'border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-800/30'} ${!isOpen ? 'opacity-30 cursor-not-allowed':''}`}
                                  >
                                      <span className="text-[8px] font-bold uppercase tracking-widest mb-0.5">{dayName}</span>
                                      <span className="font-serif text-lg leading-none">{date.getDate()}</span>
                                      {isSelected && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-gold rounded-full"></div>}
                                  </button>
                                ); 
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleDateChange(1)} 
                          className="p-3 text-stone-500 hover:text-gold transition-all hover:bg-stone-800/50 rounded-lg" 
                          aria-label="Día siguiente"
                        >
                          <ChevronRight size={24} />
                        </button>

                        <div className="w-px h-8 bg-stone-800 mx-1"></div>

                        <label htmlFor="calendar-picker-unified" className="relative cursor-pointer group">
                            <input 
                              id="calendar-picker-unified" 
                              type="date" 
                              min={minDate} 
                              value={selectedDate.toISOString().split('T')[0]} 
                              onChange={handleCalendarSelect} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="p-3 text-stone-500 group-hover:text-gold transition-all">
                              <Calendar size={24} />
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Right: Create reservation button (Desktop) */}
            <div className="hidden lg:flex flex-1 justify-end">
                <button 
                  onClick={openNewReservationModal}
                  className="bg-gold hover:bg-gold-light text-black px-8 py-4 rounded-full font-bold uppercase tracking-[0.2em] text-xs flex items-center gap-3 transition-all shadow-xl shadow-gold/20 active:scale-95 group"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    Nueva Reserva
                </button>
            </div>
        </div>

        {/* Occupancy Summary Bar (Integrated) */}
        <div className="mt-6 pt-6 border-t border-stone-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1">Ocupación del Día</span>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-white font-bold text-xl">{totalDayGuests} <span className="text-stone-600 text-sm">/ {totalDayCapacity}</span></span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${totalPercentage > 90 ? 'bg-red-500/20 text-red-500' : 'bg-gold/20 text-gold'}`}>
                            {Math.round(totalPercentage)}%
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex-1 w-full max-w-md bg-stone-900/50 h-1.5 rounded-full overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all duration-1000 ease-out ${totalPercentage > 90 ? 'bg-red-500' : 'bg-gold'}`} style={{ width: `${totalPercentage > 100 ? 100 : totalPercentage}%` }}></div>
            </div>
            <div className="hidden sm:flex items-center gap-4">
                <button onClick={handlePrint} className="p-2 text-stone-500 hover:text-gold transition-colors" title="Imprimir vista del día">
                    <Printer size={20} />
                </button>
            </div>
        </div>
      </div>

      <div className="printable-area">
        <div className="hidden print:block mb-8">
            <h2 className="text-2xl font-serif">Listado de Reservas: Don García</h2>
            <p className="text-lg">{selectedDate.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <>{renderReservationsViewDesktop()}{renderMobileView()}</>
      </div>
      
      {isModalOpen && <ReservationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} reservationData={editingReservation} layout={layout} reservations={reservations} />}
      {confirmingDelete && createPortal(<div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-stone-900 border border-red-500/50 rounded-lg shadow-2xl w-full max-w-md p-8 relative animate-fadeInUp text-center"><h3 className="text-2xl font-serif text-red-400 mb-4">Confirmar Eliminación</h3><p className="text-stone-300 mb-8">¿Está seguro que desea eliminar la reserva de <strong className="text-white">{confirmingDelete.name}</strong>?<br/><span className="text-stone-500 text-sm mt-2 block">Esta acción no se puede deshacer.</span></p><div className="flex justify-center gap-4"><button onClick={()=>setConfirmingDelete(null)} className="px-8 py-3 border border-stone-700 text-stone-300 hover:border-white hover:text-white transition-colors text-xs uppercase tracking-widest">Cancelar</button><button onClick={executeDelete} className="px-8 py-3 bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50 text-xs uppercase tracking-widest">Eliminar</button></div></div></div>, modalRoot)}
    </div>
  );
};

export default AdminReservations;
