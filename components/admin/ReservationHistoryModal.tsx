import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Customer, Reservation } from '../../types';
import { getReservationsForCustomer } from '../../services/customerRepository';

interface ReservationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

const ReservationHistoryModal: React.FC<ReservationHistoryModalProps> = ({ isOpen, onClose, customer }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer) {
      setLoading(true);
      getReservationsForCustomer(customer.id).then(data => {
        setReservations(data);
        setLoading(false);
      });
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;
  
  const statusClasses: Record<Reservation['status'], string> = {
    confirmada: 'bg-green-500/20 text-green-400',
    pendiente: 'bg-yellow-500/20 text-yellow-400',
    cancelada: 'bg-red-500/20 text-red-500',
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-gold/20 w-full max-w-2xl flex flex-col animate-fadeInUp rounded-lg shadow-2xl max-h-[80vh]">
        <header className="p-4 flex justify-between items-center border-b border-stone-800 flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif text-gold">Historial de Reservas</h2>
            <p className="text-sm text-stone-400">{customer.name}</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-white text-3xl">&times;</button>
        </header>

        <div className="flex-grow p-6 overflow-y-auto">
          {loading ? (
            <p className="text-center text-stone-400">Cargando historial...</p>
          ) : reservations.length === 0 ? (
            <p className="text-center text-stone-600 italic">No se encontraron reservas para este cliente.</p>
          ) : (
            <div className="space-y-3">
              {reservations.map(res => (
                <div key={res.id} className="bg-black/30 p-3 rounded-sm border border-stone-800/50 flex justify-between items-center gap-4">
                    <div>
                        <p className="font-bold text-white">{res.date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p className="text-xs text-stone-500">{res.time} hs - {res.guests} cub. - {res.environmentName || 'Salón'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClasses[res.status]}`}>
                        {res.status}
                    </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <footer className="p-4 flex justify-end gap-4 border-t border-stone-800 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-8 py-3 bg-gold text-black font-bold hover:bg-white transition-colors text-xs uppercase tracking-widest">Cerrar</button>
        </footer>
      </div>
    </div>,
    modalRoot
  );
};

export default ReservationHistoryModal;