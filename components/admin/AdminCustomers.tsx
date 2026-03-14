import React, { useState, useEffect, useMemo, useRef } from 'react';
// FIX: Import createPortal from react-dom to fix usage error.
import { createPortal } from 'react-dom';
import { Customer } from '../../types';
import { listenToCustomers, updateCustomer, deleteCustomer } from '../../services/customerRepository';
import CustomerModal from './CustomerModal';
import ReservationHistoryModal from './ReservationHistoryModal';

const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  const notesTimeoutRef = useRef<{ [key: string]: number }>({});

  useEffect(() => {
    const unsubscribe = listenToCustomers((fetchedCustomers) => {
      setCustomers(fetchedCustomers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (isCustomerModalOpen || deletingCustomer || historyCustomer) { document.body.style.overflow = 'hidden'; } 
    else { document.body.style.overflow = 'unset'; }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isCustomerModalOpen, deletingCustomer, historyCustomer]);

  const handleNotesChange = (customerId: string, newNotes: string) => {
    // Optimistic update locally
    const updatedCustomers = customers.map(c => c.id === customerId ? {...c, notes: newNotes} : c);
    setCustomers(updatedCustomers);

    if (notesTimeoutRef.current[customerId]) {
      clearTimeout(notesTimeoutRef.current[customerId]);
    }

    notesTimeoutRef.current[customerId] = window.setTimeout(async () => {
      try {
        await updateCustomer(customerId, { notes: newNotes });
      } catch (error) {
        console.error("Failed to save notes", error);
        // Optionally revert state on error
      }
    }, 1500); // Debounce save
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setIsCustomerModalOpen(true);
  };
  
  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsCustomerModalOpen(true);
  };

  const executeDelete = async () => {
    if (deletingCustomer) {
      try {
        await deleteCustomer(deletingCustomer.id);
      } catch (error) {
        console.error("Failed to delete customer:", error);
      } finally {
        setDeletingCustomer(null);
      }
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const lowerTerm = searchTerm.toLowerCase();
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(lowerTerm) ||
      customer.phone.includes(lowerTerm) ||
      (customer.tags && customer.tags.toLowerCase().includes(lowerTerm))
    );
  }, [customers, searchTerm]);

  if (loading) return <div className="text-white text-center p-10">Cargando base de datos de clientes...</div>;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div className="relative w-full max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div>
          <input type="text" className="block w-full pl-10 pr-3 py-3 border border-stone-700 rounded-sm leading-5 bg-stone-900/50 text-stone-300 placeholder-stone-500 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold sm:text-sm transition-colors" placeholder="Buscar por nombre, teléfono o tag..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={openCreateModal} className="w-full md:w-auto bg-gold text-black px-6 py-3 rounded-sm hover:bg-white transition-all text-xs font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
            Nuevo Cliente
        </button>
      </div>

      <div className="w-full overflow-hidden rounded-sm border border-stone-800 bg-stone-900/20 shadow-2xl">
        <table className="w-full border-collapse text-left">
          <thead><tr className="bg-stone-900/50 border-b border-stone-800"><th className="py-5 px-6 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold">Cliente</th><th className="py-5 px-6 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold text-center">Visitas</th><th className="py-5 px-6 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold">Cliente Desde</th><th className="py-5 px-6 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold">Última Visita</th><th className="py-5 px-6 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold">Etiquetas</th><th className="py-5 px-6 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold w-1/4">Notas</th><th className="py-5 px-6 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold text-center">Acciones</th></tr></thead>
          <tbody className="divide-y divide-stone-800/50">
            {filteredCustomers.length === 0 ? (<tr><td colSpan={7} className="py-12 px-6 text-center text-stone-600 italic text-sm">{searchTerm ? 'No se encontraron clientes.' : 'No hay clientes en la base de datos.'}</td></tr>) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 align-top"><p className="font-semibold text-white">{customer.name}</p><p className="text-stone-400 text-xs font-mono">{customer.phone}</p></td>
                    <td className="py-4 px-6 align-middle text-center"><button onClick={() => setHistoryCustomer(customer)} className="font-bold text-lg text-gold bg-gold/10 border border-gold/20 rounded-full w-10 h-10 flex items-center justify-center transition-transform hover:scale-110" title="Ver historial de reservas">{customer.reservationIds.length}</button></td>
                    <td className="py-4 px-6 align-middle text-stone-400 text-sm">{customer.firstSeen.toLocaleDateString('es-AR')}</td>
                    <td className="py-4 px-6 align-middle text-stone-400 text-sm">{customer.lastSeen.toLocaleDateString('es-AR')}</td>
                    <td className="py-4 px-6 align-middle"><div className="flex flex-wrap gap-1.5">{customer.tags && customer.tags.split(',').map(tag => tag.trim() && <span key={tag} className="inline-block bg-stone-700 text-stone-300 text-[9px] font-bold mr-1 px-2 py-0.5 rounded-full uppercase tracking-wider">{tag}</span>)}</div></td>
                    <td className="py-4 px-6 align-top"><textarea className="w-full bg-stone-800/40 border border-transparent p-2 text-stone-400 text-xs resize-none rounded-sm focus:bg-stone-800 focus:border-gold/50 outline-none transition-colors" placeholder="Agregar notas..." value={customer.notes ?? ''} onChange={(e) => handleNotesChange(customer.id, e.target.value)} rows={2}/></td>
                    <td className="py-4 px-6 align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <a href={`https://wa.me/${customer.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 hover:bg-green-500 hover:text-white transition-all transform hover:scale-110" title="Contactar por WhatsApp">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.433-9.89-9.889-9.89-5.452 0-9.887 4.434-9.889 9.889.002 2.643 1.11 5.289 3.109 7.216l.244.274-1.352 4.939 5.067-1.332.26.163z"/></svg>
                        </a>
                        <button onClick={() => openEditModal(customer)} className="p-2 text-stone-500 hover:text-gold" title="Editar Cliente">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onClick={() => setDeletingCustomer(customer)} className="p-2 text-stone-500 hover:text-red-500" title="Eliminar Cliente">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      {isCustomerModalOpen && <CustomerModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} customerData={editingCustomer} />}
      {historyCustomer && <ReservationHistoryModal isOpen={!!historyCustomer} onClose={() => setHistoryCustomer(null)} customer={historyCustomer} />}
      {deletingCustomer && createPortal(<div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-stone-900 border border-red-500/50 rounded-lg shadow-2xl w-full max-w-md p-8 relative animate-fadeInUp text-center"><h3 className="text-2xl font-serif text-red-400 mb-4">Confirmar Eliminación</h3><p className="text-stone-300 mb-8">¿Está seguro de que desea eliminar a <strong className="text-white">{deletingCustomer.name}</strong>?<br/><span className="text-stone-500 text-sm mt-2 block">Esta acción no se puede deshacer.</span></p><div className="flex justify-center gap-4"><button onClick={() => setDeletingCustomer(null)} className="px-8 py-3 border border-stone-700 text-stone-300 hover:border-white hover:text-white transition-colors text-xs uppercase tracking-widest">Cancelar</button><button onClick={executeDelete} className="px-8 py-3 bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50 text-xs uppercase tracking-widest">Eliminar</button></div></div></div>, modalRoot)}
    </>
  );
};

export default AdminCustomers;