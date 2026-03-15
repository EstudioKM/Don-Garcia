import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { listenToAllReservations, updateReservation, deleteReservation } from '../../services/reservationRepository';
import { Reservation, Layout } from '../../types';
import { getLayout } from '../../services/layoutRepository';
import { Edit2, Trash2, CheckCircle, XCircle, Clock, Search, Filter, ChevronLeft, ChevronRight, MoreHorizontal, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import ReservationModal from './ReservationModal';

const AdminReservationsList: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Reservation['status'] | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<Reservation | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToAllReservations((resData) => {
      setReservations(resData);
      setLoading(false);
    });

    const fetchLayout = async () => {
      const layoutData = await getLayout();
      setLayout(layoutData);
    };
    fetchLayout();

    return () => unsubscribe();
  }, []);

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      const matchesSearch = 
        res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.phone?.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [reservations, searchTerm, statusFilter]);

  const paginatedReservations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReservations.slice(start, start + itemsPerPage);
  }, [filteredReservations, currentPage]);

  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedReservations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedReservations.map(r => r.id));
    }
  };

  const handleBatchStatusChange = async (newStatus: Reservation['status']) => {
    if (selectedIds.length === 0) return;
    
    const confirmMessage = `¿Cambiar el estado de ${selectedIds.length} reservas a "${newStatus}"?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      await Promise.all(selectedIds.map(id => updateReservation(id, { status: newStatus })));
      setSelectedIds([]);
    } catch (error) {
      console.error("Error in batch update:", error);
      alert("Hubo un error al actualizar las reservas.");
    }
  };

  const executeDelete = async () => {
    if (!confirmingDelete) return;
    try {
      await deleteReservation(confirmingDelete.id);
      setSelectedIds(prev => prev.filter(i => i !== confirmingDelete.id));
    } catch (error) {
      console.error("Error deleting reservation:", error);
    } finally {
      setConfirmingDelete(null);
    }
  };

  const openEditModal = (res: Reservation) => {
    setEditingReservation(res);
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: Reservation['status']) => {
    switch (status) {
      case 'confirmada':
        return <span className="flex items-center justify-center gap-1.5 px-4 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-widest border border-green-500/30 min-w-[120px]">CONFIRMADA</span>;
      case 'pendiente':
        return <span className="flex items-center justify-center gap-1.5 px-4 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-bold uppercase tracking-widest border border-yellow-500/30 min-w-[120px]">PENDIENTE</span>;
      case 'cancelada':
        return <span className="flex items-center justify-center gap-1.5 px-4 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-widest border border-red-500/30 min-w-[120px]">CANCELADA</span>;
      default:
        return null;
    }
  };

  if (loading && reservations.length === 0) return <div className="text-white text-center p-10">Cargando listado de reservas...</div>;

  const modalRoot = document.getElementById('modal-root');

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-stone-900/40 p-6 rounded-xl border border-stone-800">
        <div>
          <h2 className="text-3xl font-serif text-white mb-1">Listado de Reservas</h2>
          <p className="text-[10px] text-stone-500 uppercase tracking-[0.3em]">Gestiona todas las reservas del sistema</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-grow lg:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full lg:w-72 bg-black/40 border border-stone-800 rounded-sm py-3 pl-10 pr-4 text-sm text-white focus:border-gold outline-none transition-all placeholder:text-stone-600"
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-black/40 border border-stone-800 rounded-sm py-3 px-6 text-sm text-white focus:border-gold outline-none transition-all cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="confirmada">Confirmadas</option>
            <option value="pendiente">Pendientes</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-gold/10 border border-gold/30 p-4 rounded-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="bg-gold text-black p-1.5 rounded-sm">
              <CheckSquare size={16} />
            </div>
            <span className="text-sm font-bold text-gold uppercase tracking-widest">{selectedIds.length} seleccionadas</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleBatchStatusChange('confirmada')}
              className="px-4 py-2 bg-green-600/20 text-green-500 border border-green-500/30 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all"
            >
              Confirmar
            </button>
            <button 
              onClick={() => handleBatchStatusChange('pendiente')}
              className="px-4 py-2 bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-600 hover:text-white transition-all"
            >
              Pendiente
            </button>
            <button 
              onClick={() => handleBatchStatusChange('cancelada')}
              className="px-4 py-2 bg-red-600/20 text-red-500 border border-red-500/30 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
            >
              Cancelar
            </button>
            <div className="w-px h-6 bg-stone-800 mx-2"></div>
            <button 
              onClick={() => setSelectedIds([])}
              className="text-stone-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-stone-900/20 border border-stone-800 rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-900/60 border-b border-stone-800">
                <th className="p-6 w-10">
                  <button onClick={handleSelectAll} className="text-stone-500 hover:text-gold transition-colors">
                    {selectedIds.length === paginatedReservations.length && paginatedReservations.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
                <th className="p-6 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold">Fecha</th>
                <th className="p-6 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold">Hora</th>
                <th className="p-6 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold">Cliente</th>
                <th className="p-6 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold text-center">Cubiertos</th>
                <th className="p-6 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold text-center">Estado</th>
                <th className="p-6 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {paginatedReservations.map(res => (
                <tr key={res.id} className={`hover:bg-stone-800/30 transition-colors ${selectedIds.includes(res.id) ? 'bg-gold/5' : ''}`}>
                  <td className="p-6">
                    <button onClick={() => handleToggleSelect(res.id)} className={`transition-colors ${selectedIds.includes(res.id) ? 'text-gold' : 'text-stone-700 hover:text-stone-500'}`}>
                      {selectedIds.includes(res.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </td>
                  <td className="p-6">
                    <div className="text-sm text-white font-medium">
                      {res.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                    <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">
                      {res.date.toLocaleDateString('es-AR', { weekday: 'short' })}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="text-lg font-mono text-gold font-bold">{res.time}</span>
                  </td>
                  <td className="p-6">
                    <div className="text-sm text-stone-200 font-medium">{res.name}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{res.phone || res.email || 'Sin contacto'}</div>
                    {(res.occasion || res.hasChildren || res.tableName) && (
                      <div className="text-[10px] text-gold mt-1">
                        {res.tableName && <span>Mesa: {res.tableName}</span>}
                        {res.tableName && (res.occasion || res.hasChildren) && <span className="mx-1">•</span>}
                        {res.occasion && <span>{res.occasion}</span>}
                        {res.occasion && res.hasChildren && <span className="mx-1">•</span>}
                        {res.hasChildren && <span>Con niños</span>}
                      </div>
                    )}
                  </td>
                  <td className="p-6 text-center">
                    <span className="text-2xl font-serif text-white">{res.guests}</span>
                  </td>
                  <td className="p-6 flex justify-center">
                    {getStatusBadge(res.status)}
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => openEditModal(res)}
                        className="p-2 text-stone-500 hover:text-gold transition-all"
                        title="Editar reserva"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmingDelete(res)}
                        className="p-2 text-stone-500 hover:text-red-500 transition-all"
                        title="Eliminar reserva"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReservations.length === 0 && (
          <div className="p-16 text-center">
            <p className="text-stone-600 italic text-lg">No se encontraron reservas con los filtros aplicados.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-stone-800 flex items-center justify-between bg-stone-900/40">
            <p className="text-[10px] uppercase tracking-widest text-stone-500">
              Mostrando <span className="text-white font-bold">{paginatedReservations.length}</span> de <span className="text-white font-bold">{filteredReservations.length}</span> reservas
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 text-stone-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-sm text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-gold text-black' : 'text-stone-500 hover:bg-stone-800 hover:text-white'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-stone-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ReservationModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          reservationData={editingReservation} 
          layout={layout} 
          reservations={reservations} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmingDelete && modalRoot && createPortal(
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-red-500/50 rounded-lg shadow-2xl w-full max-w-md p-8 relative animate-fadeInUp text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h3 className="text-2xl font-serif text-red-400 mb-4">Confirmar Eliminación</h3>
            <p className="text-stone-300 mb-8">
              ¿Está seguro que desea eliminar la reserva de <strong className="text-white">{confirmingDelete.name}</strong>?
              <br/>
              <span className="text-stone-500 text-sm mt-2 block italic">Esta acción no se puede deshacer.</span>
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setConfirmingDelete(null)} 
                className="px-8 py-3 border border-stone-700 text-stone-300 hover:border-white hover:text-white transition-colors text-[10px] uppercase tracking-widest font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete} 
                className="px-8 py-3 bg-red-600 text-white font-bold hover:bg-red-700 transition-colors text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        modalRoot
      )}
    </div>
  );
};

export default AdminReservationsList;
