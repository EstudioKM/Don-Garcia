import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { listenToReservationsForDate, updateReservation, deleteReservation } from '../../services/reservationRepository';
import { getLayout } from '../../services/layoutRepository';
import { Reservation, Layout, RestaurantSettings } from '../../types';
import ReservationModal from './ReservationModal';
import { getRestaurantSettings } from '../../services/settingsRepository';
import { getArgentinaTime } from '../../utils/dateUtils';
import { ChevronLeft, ChevronRight, Calendar, Plus, Printer, Users, Edit2, Trash2, AlertCircle, Info } from 'lucide-react';

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
  const [selectedTables, setSelectedTables] = useState<Record<string, string[]>>({});
  const [expandedEnvs, setExpandedEnvs] = useState<Record<string, boolean>>({});

  const toggleEnvExpand = (envId: string, shiftKey: string) => {
    setExpandedEnvs(prev => ({
      ...prev,
      [`${envId}-${shiftKey}`]: !prev[`${envId}-${shiftKey}`]
    }));
  };

  const handleTableClick = (envId: string, tableId: string) => {
    setSelectedTables(prev => {
      const envSelected = prev[envId] || [];
      if (envSelected.includes(tableId)) {
        return { ...prev, [envId]: envSelected.filter(id => id !== tableId) };
      } else {
        return { ...prev, [envId]: [...envSelected, tableId] };
      }
    });
  };
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
  
  const handlePrint = () => {
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

    const generateTableRows = (reservationsToPrint: Reservation[]) => {
        return reservationsToPrint.map(r => {
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
    };

    const middayRows = generateTableRows(middayReservations);
    const nightRows = generateTableRows(nightReservations);

    const content = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Listado de Reservas del Día</title>
                <style>
                    body { font-family: sans-serif; margin: 20px; color: black; background: white; }
                    h1, h2, h3 { font-family: serif; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 30px; }
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
                <h1>Don García - Reservas del Día</h1>
                <h2>${selectedDate.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                
                <h3>Turno Mediodía</h3>
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
                        ${middayRows.length > 0 ? middayRows : '<tr><td colspan="5" style="text-align: center; font-style: italic;">No hay reservas para este turno.</td></tr>'}
                    </tbody>
                </table>

                <h3>Turno Noche</h3>
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
                        ${nightRows.length > 0 ? nightRows : '<tr><td colspan="5" style="text-align: center; font-style: italic;">No hay reservas para este turno.</td></tr>'}
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

    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 2000);
  };

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
  const openNewReservationModalForEnv = (envId: string, envName: string, tableIds?: string[], defaultTime: string = '20:30') => { 
      let guests = 2;
      let tableName = undefined;
      if (tableIds && tableIds.length > 0) {
          const env = layout?.environments.find(e => e.id === envId);
          if (env) {
              const tables = tableIds.map(id => env.tables.find(t => t.id === id)).filter(Boolean);
              guests = tables.reduce((sum, t) => sum + (t?.capacity || 0), 0);
              tableName = tables.map(t => t?.name).join(', ');
          }
      }
      setEditingReservation({ date: selectedDate, time: defaultTime, status: 'pendiente', guests, environmentId: envId, environmentName: envName, tableIds, tableName }); 
      setIsModalOpen(true); 
  };
  const openEditReservationModal = (res: Reservation) => { setEditingReservation(res); setIsModalOpen(true); };
  const executeDelete = async () => { if(confirmingDelete) { try { await deleteReservation(confirmingDelete.id); } catch(e){ console.error(e); } finally { setConfirmingDelete(null); } }};

  const dayKey = useMemo(() => {
    const dayKeys: (keyof RestaurantSettings['days'])[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return dayKeys[selectedDate.getDay()];
  }, [selectedDate]);

  const totalLayoutCapacity = useMemo(() => {
      return layout?.environments.reduce((sum, env) => sum + env.maxCapacity, 0) || 0;
  }, [layout]);

  const totalLayoutTables = useMemo(() => {
      return layout?.environments.reduce((sum, env) => sum + env.tables.length, 0) || 0;
  }, [layout]);

  const middayCapacity = useMemo(() => {
      return settings?.days[dayKey]?.shifts.mediodia.isActive ? totalLayoutCapacity : 0;
  }, [settings, dayKey, totalLayoutCapacity]);

  const nightCapacity = useMemo(() => {
      return settings?.days[dayKey]?.shifts.noche.isActive ? totalLayoutCapacity : 0;
  }, [settings, dayKey, totalLayoutCapacity]);

  const middayTableCapacity = useMemo(() => {
      return settings?.days[dayKey]?.shifts.mediodia.isActive ? totalLayoutTables : 0;
  }, [settings, dayKey, totalLayoutTables]);

  const nightTableCapacity = useMemo(() => {
      return settings?.days[dayKey]?.shifts.noche.isActive ? totalLayoutTables : 0;
  }, [settings, dayKey, totalLayoutTables]);

  const sortedReservations = useMemo(() => [...reservations].sort((a, b) => a.time.localeCompare(b.time)), [reservations]);
  const middayReservations = useMemo(() => sortedReservations.filter(r => parseInt(r.time.split(':')[0]) < 16), [sortedReservations]);
  const nightReservations = useMemo(() => sortedReservations.filter(r => parseInt(r.time.split(':')[0]) >= 16), [sortedReservations]);
  
  const totalGuestsMidday = useMemo(() => middayReservations.reduce((s, r) => s + (r.status === 'confirmada' || r.status === 'pendiente' ? r.guests : 0), 0), [middayReservations]);
  const totalGuestsNoche = useMemo(() => nightReservations.reduce((s, r) => s + (r.status === 'confirmada' || r.status === 'pendiente' ? r.guests : 0), 0), [nightReservations]);
  
  const totalReservedTablesMidday = useMemo(() => middayReservations.reduce((s, r) => s + (r.status !== 'cancelada' ? (r.tableIds?.length || (r.tableId ? 1 : 0)) : 0), 0), [middayReservations]);
  const totalReservedTablesNoche = useMemo(() => nightReservations.reduce((s, r) => s + (r.status !== 'cancelada' ? (r.tableIds?.length || (r.tableId ? 1 : 0)) : 0), 0), [nightReservations]);
  
  if (loading && !layout) return <div className="text-white text-center p-10">Cargando gestión de reservas...</div>;
  
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;
  
  const renderReservationList = (title: string, shiftReservations: Reservation[]) => (
    <div className="bg-stone-900/10 rounded-lg border border-stone-800/30 overflow-hidden">
        <div className="flex justify-between items-center p-4 bg-stone-900/40 border-b border-stone-800/50">
            <h3 className="text-xl font-serif text-white border-l-4 border-gold pl-4 leading-none">{title}</h3>
            <button onClick={() => handlePrintList(title, shiftReservations)} className="no-print text-stone-500 hover:text-gold transition-colors p-2 rounded-full hover:bg-gold/10" title={`Imprimir listado de ${title}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            </button>
        </div>
        <div className="w-full overflow-hidden">
          <table className="w-full text-left printable-table border-collapse">
            <thead className="bg-stone-900/80 no-print">
                <tr className="backdrop-blur-sm border-b border-stone-800">
                    <th className="p-3 text-xs uppercase tracking-[0.2em] text-gold font-bold">Hora</th>
                    <th className="p-3 text-xs uppercase tracking-[0.2em] text-gold font-bold">Nombre</th>
                    <th className="p-3 text-xs uppercase tracking-[0.2em] text-gold font-bold hidden sm:table-cell text-center">Cub.</th>
                    <th className="p-3 text-xs uppercase tracking-[0.2em] text-gold font-bold hidden md:table-cell">Ambiente</th>
                    <th className="p-3 text-xs uppercase tracking-[0.2em] text-gold font-bold">Notas</th>
                    <th className="p-3 text-xs uppercase tracking-[0.2em] text-gold font-bold no-print text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {shiftReservations.map(r => {
                const isCancelled = r.status === 'cancelada';
                const hasSpecialNotes = !isCancelled && (r.specialRequests || (r.dietaryRestrictions && r.dietaryRestrictions.length > 0) || r.reducedMobility || r.hasChildren || r.occasion);
                return (
                  <tr key={r.id} className={`transition-colors text-sm ${isCancelled ? 'bg-stone-900/30 opacity-60' : 'hover:bg-stone-800/30'}`}>
                    <td className={`p-3 font-mono font-bold text-base ${isCancelled ? 'text-stone-600 line-through' : 'text-gold'}`}>{r.time}</td>
                    <td className={`p-3 ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-300'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-100">{r.name}</span>
                        {hasSpecialNotes && 
                            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                <title>Esta reserva tiene notas especiales</title>
                                <path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.852-1.21 3.488 0l6.237 11.94c.64 1.222-.464 2.71-1.744 2.71H3.764c-1.28 0-2.384-1.488-1.744-2.71l6.237-11.94zM9 14a1 1 0 112 0 1 1 0 01-2 0zm1-7a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd"></path>
                            </svg>
                        }
                        {!isCancelled && (!r.tableIds || r.tableIds.length === 0) && (
                            <svg className="w-3 h-3 text-red-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                <title>¡ALERTA! Sin mesa asignada</title>
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                            </svg>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 hidden sm:table-cell text-center font-mono font-bold text-base ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-200'}`}>{r.guests}</td>
                    <td className={`p-3 hidden md:table-cell ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-400'}`}>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-medium">{r.environmentName || 'N/A'}</span>
                        {r.tableName && <span className="text-[10px] text-gold font-bold uppercase tracking-widest">{r.tableName}</span>}
                      </div>
                    </td>
                    <td className={`p-3 text-xs italic leading-relaxed ${isCancelled ? 'text-stone-700 line-through' : 'text-stone-500'}`}>
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
                    <td className="p-3 text-right no-print">
                      <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditReservationModal(r)} className="text-stone-500 hover:text-gold p-2 transition-colors rounded-lg hover:bg-gold/10" title="Editar reserva"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(r); }} className="text-stone-500 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-red-500/10" title="Eliminar reserva"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
           {shiftReservations.length === 0 && (
             <div className="flex flex-col items-center justify-center p-12 text-stone-600 italic">
               <svg className="w-8 h-8 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
               <p className="text-sm">No hay reservas registradas para este turno.</p>
             </div>
           )}
        </div>
      </div>
  );

  const renderReservationsViewDesktop = () => {
    const renderShiftView = (title: string, shiftReservations: Reservation[], shiftCapacity: number, shiftTableCapacity: number) => {
      const isMediodia = title.includes('Mediodía');
      const shiftKey = isMediodia ? 'mediodia' : 'noche';
      const defaultTime = isMediodia ? '12:30' : '20:30';
      
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            {layout?.environments.map(env => { 
              const reservationsInEnv = shiftReservations.filter(r => r.environmentId === env.id);
              const currentGuests = reservationsInEnv.filter(r => r.status === 'confirmada' || r.status === 'pendiente').reduce((s,r)=>s+r.guests,0);
              const currentTables = reservationsInEnv.filter(r => r.status !== 'cancelada').reduce((s,r)=>s+(r.tableIds?.length || (r.tableId ? 1 : 0)), 0);
              
              const tablePercEnv = env.tables.length>0?(currentTables/env.tables.length)*100:0;
              const isFull = currentGuests >= env.maxCapacity || currentTables >= env.tables.length; 
              const isExpanded = expandedEnvs[`${env.id}-${shiftKey}`];
   
              const availableTables = env.tables.filter(table => !reservationsInEnv.some(res => res.status !== 'cancelada' && (res.tableIds?.includes(table.id) || res.tableId === table.id)));
              
              // Fallback images for environments
              const envImage = env.image || `https://picsum.photos/seed/${env.name}/400/200?blur=2`;
   
              return (
                <div key={env.id} className="group bg-stone-900/30 rounded-xl border border-stone-800/60 overflow-hidden transition-all hover:border-stone-700 hover:bg-stone-900/50">
                  <div 
                    className={`flex items-center gap-6 p-5 cursor-pointer transition-all ${isExpanded ? 'bg-stone-800/20' : ''}`}
                    onClick={() => toggleEnvExpand(env.id, shiftKey)}
                  >
                    <div className="w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-stone-700/30 shadow-inner">
                        <img src={envImage} alt={env.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <h3 className={`text-lg font-medium ${isFull ? 'text-red-400' : 'text-stone-100'} transition-colors`}>{env.name}</h3>
                            <div className={`p-1 rounded-full text-stone-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex-1 bg-stone-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-1000 ease-out ${tablePercEnv >= 100 ?'bg-red-500':'bg-gold'}`} style={{width:`${tablePercEnv>100?100:tablePercEnv}%`}}></div>
                            </div>
                            <span className={`text-xs font-mono font-bold ${isFull ? 'text-red-400' : 'text-stone-400'}`}>{Math.round(tablePercEnv)}%</span>
                        </div>
                    </div>
                  </div>
                
                {isExpanded && (
                  <div className="border-t border-stone-800 animate-fadeIn">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-950/40">
                          <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-stone-500 font-bold w-16">Hora</th>
                          <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-stone-500 font-bold">Reserva</th>
                          <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-stone-500 font-bold w-12 text-center">Cub.</th>
                          <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-stone-500 font-bold w-20 text-center">Estado</th>
                          <th className="py-2 px-4 text-[9px] uppercase tracking-widest text-stone-500 font-bold w-16 text-right">Acc.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800/30">
                        {reservationsInEnv.map(res=>{ 
                          const isPending = res.status === 'pendiente';
                          const isCancelled = res.status === 'cancelada';
                          return (
                            <tr key={res.id} 
                              onClick={() => openEditReservationModal(res)}
                              className={`transition-all duration-200 text-xs group/row cursor-pointer
                              ${isCancelled ? 'bg-stone-950/60 opacity-40' :
                              isPending ? 'bg-stone-800/20 hover:bg-stone-800/40' :
                              'bg-transparent hover:bg-white/[0.03]'
                            }`}>
                                <td className={`py-2 px-4 font-mono font-bold ${isCancelled ? 'text-stone-600 line-through' : 'text-gold'}`}>{res.time}</td>
                                <td className={`py-2 px-4 ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-300'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-stone-100">{res.name}</span>
                                    {res.tableName && <span className="text-[9px] text-gold font-bold uppercase tracking-wider bg-gold/10 px-1.5 py-0.5 rounded">{res.tableName}</span>}
                                  </div>
                                </td>
                                <td className={`py-2 px-4 text-center font-mono font-bold ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-200'}`}>{res.guests}</td>
                                <td className="py-2 px-4 text-center">
                                    {isPending && <span className="text-[9px] uppercase tracking-widest font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">Pend.</span>}
                                    {isCancelled && <span className="text-[9px] uppercase tracking-widest font-bold text-stone-500 bg-stone-900 px-2 py-0.5 rounded-full border border-stone-800">Canc.</span>}
                                    {!isPending && !isCancelled && <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Conf.</span>}
                                </td>
                                <td className="py-2 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.stopPropagation(); openEditReservationModal(res); }} className="text-stone-500 hover:text-gold p-1 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                                      <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(res); }} className="text-stone-500 hover:text-red-500 p-1 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                  </div>
                                </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                           {/* HIGHLIGHTED AVAILABLE TABLES SECTION */}
                    <div className="p-5 border-t border-stone-800/60 bg-stone-950/20">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs uppercase tracking-widest text-stone-400 font-bold">Mesas Disponibles</h4>
                        {availableTables.length > 0 && (
                          <button onClick={()=>openNewReservationModalForEnv(env.id, env.name, undefined, defaultTime)} className="text-gold hover:text-white transition-all flex items-center gap-2 text-xs uppercase tracking-widest font-bold bg-gold/10 hover:bg-gold/20 px-4 py-2 rounded-lg border border-gold/20">
                            <Plus className="w-4 h-4" /> Nueva
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {availableTables.map(table => {
                          const isSelected = selectedTables[`${env.id}-${shiftKey}`]?.includes(table.id);
                          return (
                            <button
                              key={table.id}
                              onClick={() => handleTableClick(`${env.id}-${shiftKey}`, table.id)}
                              className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all font-bold w-full h-20
                                ${isSelected 
                                  ? 'bg-gold border-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' 
                                  : 'bg-stone-800/60 border-stone-700 text-stone-100 hover:border-gold/50 hover:bg-stone-800'}`}
                            >
                              <span className="text-lg">{table.name}</span>
                              <span className="text-[12px] opacity-80 flex items-center gap-1">
                                <Users size={12} />
                                {table.capacity}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      
                      {selectedTables[`${env.id}-${shiftKey}`]?.length > 0 && (
                        <div className="mt-6 flex justify-center">
                            <button 
                               onClick={() => {
                                   openNewReservationModalForEnv(env.id, env.name, selectedTables[`${env.id}-${shiftKey}`], defaultTime);
                                   setSelectedTables(prev => ({ ...prev, [`${env.id}-${shiftKey}`]: [] }));
                               }}
                               className="flex items-center gap-2 px-6 py-2 bg-gold text-black text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-yellow-500 transition-all">
                               <span>Reservar {selectedTables[`${env.id}-${shiftKey}`].length} {selectedTables[`${env.id}-${shiftKey}`].length === 1 ? 'Mesa' : 'Mesas'}</span>
                             </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ); 
          })}
        </div>
      </div>
      );
    };

    return (<div className="hidden md:block">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24 no-print">
            <div className="space-y-8">
                {renderShiftView('Turno Mediodía', middayReservations, middayCapacity, middayTableCapacity)}
            </div>
            <div className="space-y-8">
                {renderShiftView('Turno Noche', nightReservations, nightCapacity, nightTableCapacity)}
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-16 border-t border-stone-800/50 pt-16">
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
    const renderShiftEnvironments = (title: string, shiftReservations: Reservation[]) => {
        const isMediodia = title.includes('Mediodía');
        const shiftKey = isMediodia ? 'mediodia' : 'noche';
        
        return (
            <div className="mb-12">
                <div className="sticky top-[140px] z-20 bg-luxury-black/95 backdrop-blur-md border-b border-stone-800 pb-3 pt-3 mb-6 flex justify-between items-end -mx-4 px-4">
                    <div className="space-y-0.5">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-bold">Turno</p>
                        <h3 className="text-2xl font-serif text-gold leading-none">{title}</h3>
                    </div>
                </div>
                {layout?.environments.length === 0 ? (
                    <p className="text-stone-600 italic text-center py-4">No hay ambientes configurados.</p>
                ) : (
                    <div className="space-y-6">
                        {layout?.environments.map(env => {
                            const reservationsInEnv = shiftReservations.filter(r => r.environmentId === env.id);
                            const currentGuests = reservationsInEnv
                                .filter(r => r.status === 'confirmada' || r.status === 'pendiente')
                                .reduce((s, r) => s + r.guests, 0);
                            const currentTables = reservationsInEnv
                                .filter(r => r.status !== 'cancelada')
                                .reduce((s, r) => s + (r.tableIds?.length || (r.tableId ? 1 : 0)), 0);
                            
                            const guestPerc = env.maxCapacity > 0 ? (currentGuests / env.maxCapacity) * 100 : 0;
                            const tablePerc = env.tables.length > 0 ? (currentTables / env.tables.length) * 100 : 0;
                            const isFull = guestPerc >= 100 || tablePerc >= 100;
                            const isExpanded = expandedEnvs[`${env.id}-${shiftKey}-mobile`];

                            return (
                                <div key={env.id} className="group">
                                    <div className="mb-4">
                                        <div className={`flex justify-between items-center mb-3 border-l-2 ${isFull ? 'border-red-500' : 'border-gold/30'} pl-4 cursor-pointer transition-all py-1`} onClick={() => setExpandedEnvs(prev => ({...prev, [`${env.id}-${shiftKey}-mobile`]: !isExpanded}))}>
                                            <div className="flex items-center gap-3">
                                                <h4 className={`text-xl font-serif tracking-tight ${isFull ? 'text-red-400' : 'text-stone-100'}`}>{env.name}</h4>
                                                <div className={`p-1 rounded-full bg-stone-800/50 text-stone-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-lg font-mono font-bold ${isFull ? 'text-red-400' : 'text-white'}`}>{Math.round(tablePerc)}%</p>
                                            </div>
                                        </div>
                                        <div className="w-full bg-stone-800/30 h-[2px] rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-700 ${tablePerc >= 100 ? 'bg-red-500' : 'bg-gold/60'}`} style={{ width: `${tablePerc > 100 ? 100 : tablePerc}%` }}></div>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="space-y-3 mt-4 animate-fadeIn">
                                            {reservationsInEnv.length === 0 ? (
                                                <p className="text-center text-stone-600 italic text-xs py-2">Sin reservas</p>
                                            ) : (
                                                reservationsInEnv.map(res => {
                                                    const isCancelled = res.status === 'cancelada';
                                                    const isPending = res.status === 'pendiente';
                                                    return (
                                                        <div key={res.id} 
                                                            onClick={() => openEditReservationModal(res)}
                                                            className={`flex justify-between items-center p-4 rounded-xl border border-stone-800/50 transition-all active:scale-[0.98] ${isCancelled ? 'bg-stone-950/40 opacity-40' : isPending ? 'bg-stone-900/40' : 'bg-stone-900/20'}`}>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`font-mono font-bold text-base ${isCancelled ? 'text-stone-600 line-through' : 'text-gold'}`}>{res.time}</p>
                                                                    <p className={`font-bold text-base tracking-tight ${isCancelled ? 'text-stone-600 line-through' : 'text-stone-100'}`}>{res.name}</p>
                                                                </div>
                                                                <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">{res.tableName || 'Sin mesa asignada'}</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className={`font-mono font-bold text-base ${isCancelled ? 'text-stone-600' : 'text-stone-200'}`}>{res.guests} cub.</p>
                                                                <div className="flex justify-end">
                                                                    {isPending && <span className="text-[8px] uppercase tracking-widest font-black text-gold/80 bg-gold/5 px-2 py-0.5 rounded-full border border-gold/20">Pendiente</span>}
                                                                    {isCancelled && <span className="text-[8px] uppercase tracking-widest font-black text-stone-500 bg-stone-900 px-2 py-0.5 rounded-full border border-stone-800">Cancelada</span>}
                                                                    {!isPending && !isCancelled && <span className="text-[8px] uppercase tracking-widest font-black text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/20">Confirmada</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

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
  const totalDayTables = middayTableCapacity + nightTableCapacity;
  const totalReservedTables = totalReservedTablesMidday + totalReservedTablesNoche;
  
  const guestPercentage = totalDayCapacity > 0 ? (totalDayGuests / totalDayCapacity) * 100 : 0;
  const tablePercentage = totalDayTables > 0 ? (totalReservedTables / totalDayTables) * 100 : 0;

  // Shift metrics for sticky header
  const middayGuests = middayReservations.reduce((s, r) => s + (r.status === 'confirmada' || r.status === 'pendiente' ? r.guests : 0), 0);
  const middayTables = middayReservations.reduce((s, r) => s + (r.status !== 'cancelada' ? (r.tableIds?.length || (r.tableId ? 1 : 0)) : 0), 0);
  const middayGuestPerc = middayCapacity > 0 ? (middayGuests / middayCapacity) * 100 : 0;
  const middayTablePerc = middayTableCapacity > 0 ? (middayTables / middayTableCapacity) * 100 : 0;

  const nightGuests = nightReservations.reduce((s, r) => s + (r.status === 'confirmada' || r.status === 'pendiente' ? r.guests : 0), 0);
  const nightTables = nightReservations.reduce((s, r) => s + (r.status !== 'cancelada' ? (r.tableIds?.length || (r.tableId ? 1 : 0)) : 0), 0);
  const nightGuestPerc = nightCapacity > 0 ? (nightGuests / nightCapacity) * 100 : 0;
  const nightTablePerc = nightTableCapacity > 0 ? (nightTables / nightTableCapacity) * 100 : 0;

  const today = getArgentinaTime();
  const isTodaySelected = selectedDate.toDateString() === today.toDateString();
  const handleCalendarSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const [y,m,d] = e.target.value.split('-').map(Number); const newDate = new Date(y,m-1,d); const todayCal = getArgentinaTime(); todayCal.setHours(0,0,0,0); if(newDate >= todayCal) setSelectedDate(newDate); };
  const minDate = today.toISOString().split('T')[0];
  const datesToShow = Array.from({ length: 7 }).map((_, i) => { const d = getArgentinaTime(); d.setDate(d.getDate() + dateTabsOffset + i); return d; });
  const dayKeys: (keyof RestaurantSettings['days'])[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  return (
    <div className="px-6 md:px-12">
      {/* Unified Responsive Header */}
      <div className="sticky top-0 z-30 bg-luxury-black/95 backdrop-blur-xl border-b border-stone-800 shadow-2xl no-print -mx-6 px-6 md:-mx-12 md:px-12 py-3 mb-4">
        <div className="w-full flex flex-col lg:flex-row justify-between items-center gap-4">
            
            {/* Left: Selected Date (Large) */}
            <div className="flex-1 w-full lg:w-auto flex items-center justify-between lg:justify-start gap-4">
                <div className="flex items-baseline gap-3">
                    <span className="text-4xl md:text-5xl font-serif text-gold leading-none tracking-tighter">{selectedDate.getDate()}</span>
                    <div className="flex flex-col">
                        <span className="text-xs md:text-sm text-white font-bold uppercase tracking-[0.1em]">{selectedDate.toLocaleDateString('es-AR', { month: 'long' })}</span>
                        <span className="text-[9px] md:text-[10px] text-stone-500 uppercase tracking-[0.1em] font-medium">{selectedDate.toLocaleDateString('es-AR', { weekday: 'long' })}</span>
                    </div>
                </div>
                
                {/* Mobile Create Button (Visible only on small screens) */}
                <button 
                  onClick={openNewReservationModal}
                  className="lg:hidden bg-gold hover:bg-gold-light text-black p-3 rounded-full shadow-lg shadow-gold/20 active:scale-95 transition-all"
                  aria-label="Nueva Reserva"
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* Center: Day selection (navigation) */}
            <div className="flex-shrink-0 w-full lg:w-auto flex items-center justify-center">
                <div className="flex items-center bg-stone-900/60 border border-stone-800 p-0.5 rounded-xl shadow-inner w-full lg:w-auto justify-between lg:justify-start">
                    <button 
                      onClick={() => handleDateChange(-1)} 
                      disabled={isTodaySelected} 
                      className="p-2 text-stone-500 hover:text-gold transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:bg-stone-800/50 rounded-lg" 
                      aria-label="Día anterior"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-1 mx-1 overflow-x-auto no-scrollbar py-0.5">
                        <button 
                          onClick={() => setSelectedDate(getArgentinaTime())} 
                          className={`px-3 py-1.5 text-[9px] uppercase tracking-widest font-bold rounded-lg transition-all border shrink-0 ${isTodaySelected ? 'bg-gold text-black border-gold shadow-lg shadow-gold/20' : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-white'}`}
                        >
                          Hoy
                        </button>
                        
                        <div className="w-px h-6 bg-stone-800 mx-0.5 shrink-0"></div>

                        <div className="flex items-center gap-0.5">
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
                                    className={`group relative flex flex-col items-center justify-center min-w-[42px] py-1.5 rounded-lg transition-all border shrink-0 ${isSelected ? 'bg-gold/10 border-gold/50 text-gold shadow-lg shadow-gold/5' : 'border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-800/30'} ${!isOpen ? 'opacity-30 cursor-not-allowed':''}`}
                                  >
                                      <span className="text-[7px] font-bold uppercase tracking-widest mb-0.5">{dayName}</span>
                                      <span className="font-serif text-base leading-none">{date.getDate()}</span>
                                      {isSelected && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-gold rounded-full"></div>}
                                  </button>
                                ); 
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                        <button 
                          onClick={() => handleDateChange(1)} 
                          className="p-2 text-stone-500 hover:text-gold transition-all hover:bg-stone-800/50 rounded-lg" 
                          aria-label="Día siguiente"
                        >
                          <ChevronRight size={20} />
                        </button>

                        <div className="w-px h-6 bg-stone-800 mx-0.5"></div>

                        <label htmlFor="calendar-picker-unified" className="relative cursor-pointer group">
                            <input 
                              id="calendar-picker-unified" 
                              type="date" 
                              min={minDate} 
                              value={selectedDate.toISOString().split('T')[0]} 
                              onChange={handleCalendarSelect} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="p-2 text-stone-500 group-hover:text-gold transition-all">
                              <Calendar size={20} />
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Right: Create reservation button (Desktop) */}
            <div className="hidden lg:flex flex-1 justify-end">
                <button 
                  onClick={openNewReservationModal}
                  className="bg-gold hover:bg-gold-light text-black px-6 py-3 rounded-full font-bold uppercase tracking-[0.15em] text-[10px] flex items-center gap-2 transition-all shadow-xl shadow-gold/20 active:scale-95 group"
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                    Nueva Reserva
                </button>
            </div>
        </div>

        {/* Occupancy Summary Bar (Integrated) */}
        <div className="mt-3 pt-3 border-t border-stone-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 w-full sm:w-auto">
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-0.5">Ocupación del Día (Mesas)</span>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-white font-bold text-lg">{totalReservedTables} <span className="text-stone-600 text-xs">/ {totalDayTables}</span></span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tablePercentage > 90 ? 'bg-red-500/20 text-red-500' : 'bg-gold/20 text-gold'}`}>
                            {Math.round(tablePercentage)}%
                        </span>
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-stone-600 font-bold mb-0.5">Ocupación del Día (Personas)</span>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-400 font-bold text-lg">{totalDayGuests} <span className="text-stone-700 text-xs">/ {totalDayCapacity}</span></span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-800 text-stone-400`}>
                            {Math.round(guestPercentage)}%
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex-1 w-full max-w-md bg-stone-900/50 h-1 rounded-full overflow-hidden">
                <div className={`h-1 rounded-full transition-all duration-1000 ease-out ${tablePercentage > 90 ? 'bg-red-500' : 'bg-gold'}`} style={{ width: `${tablePercentage > 100 ? 100 : tablePercentage}%` }}></div>
            </div>
            <div className="hidden sm:flex items-center gap-4">
                <button onClick={handlePrint} className="no-print text-stone-500 hover:text-gold transition-colors p-1" title="Imprimir listado del día">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                </button>
            </div>
        </div>

        {/* Shift Specific Sticky Headers */}
        <div className="hidden md:grid grid-cols-2 gap-8 mt-3 pt-3 border-t border-stone-800/30">
            <div className="flex items-center justify-between bg-stone-900/40 p-2 rounded-lg border border-stone-800/50">
                <div className="flex items-center gap-2">
                    <div className="w-0.5 h-6 bg-gold rounded-full"></div>
                    <span className="text-[10px] font-serif text-gold uppercase tracking-widest">Turno Mediodía</span>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-[7px] uppercase tracking-widest text-stone-500 font-bold">Mesas</p>
                        <p className="text-[10px] font-mono font-bold text-white leading-none">{Math.round(middayTablePerc)}%</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[7px] uppercase tracking-widest text-stone-500 font-bold">Personas</p>
                        <p className="text-[10px] font-mono font-bold text-stone-400 leading-none">{Math.round(middayGuestPerc)}%</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between bg-stone-900/40 p-2 rounded-lg border border-stone-800/50">
                <div className="flex items-center gap-2">
                    <div className="w-0.5 h-6 bg-gold rounded-full"></div>
                    <span className="text-[10px] font-serif text-gold uppercase tracking-widest">Turno Noche</span>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-[7px] uppercase tracking-widest text-stone-500 font-bold">Mesas</p>
                        <p className="text-[10px] font-mono font-bold text-white leading-none">{Math.round(nightTablePerc)}%</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[7px] uppercase tracking-widest text-stone-500 font-bold">Personas</p>
                        <p className="text-[10px] font-mono font-bold text-stone-400 leading-none">{Math.round(nightGuestPerc)}%</p>
                    </div>
                </div>
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
