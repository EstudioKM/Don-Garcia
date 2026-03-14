import React, { useState, useEffect } from 'react';
import { listenToOrders, updateOrderState, updateOrderItems } from '../../services/orderRepository';
import { Order, OrderItem } from '../../types';

const AdminOrders: React.FC = () => {
  const [serverOrders, setServerOrders] = useState<Order[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    const unsubscribeOrders = listenToOrders(setServerOrders);
    return () => unsubscribeOrders();
  }, []);

  const handleUpdateServerStatus = async (orderId: string, newStatus: 'pending' | 'completed') => {
    await updateOrderState(orderId, newStatus);
  };

  const startEditingOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setEditingItems(JSON.parse(JSON.stringify(order.items)));
  };

  const cancelEditingOrder = () => {
    setEditingOrderId(null);
    setEditingItems([]);
  };

  const saveEditingOrder = async () => {
    if (!editingOrderId) return;
    try {
      await updateOrderItems(editingOrderId, editingItems);
      cancelEditingOrder();
    } catch (error) {
      console.error("Error updating order items:", error);
      alert("Error al guardar la comanda.");
    }
  };

  const handleOrderEditItemChange = (index: number, field: 'name' | 'quantity', value: string | number) => {
    const newItems = [...editingItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditingItems(newItems);
  };

  const handleOrderRemoveItem = (index: number) => {
    setEditingItems(editingItems.filter((_, i) => i !== index));
  };

  const handleOrderAddItem = () => {
    setEditingItems([...editingItems, { name: '', quantity: 1, price: '$0' }]);
  };

  const pendingOrders = serverOrders.filter(o => o.status === 'pending');
  const completedOrders = serverOrders.filter(o => o.status === 'completed');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      <div>
        <h3 className="text-2xl font-serif text-amber-400 mb-8 border-l-4 border-amber-400 pl-4 flex justify-between">
          Pendientes
          <span className="text-[10px] text-stone-500 uppercase tracking-widest self-center animate-pulse">En vivo</span>
        </h3>
        <div className="space-y-6">
          {pendingOrders.length === 0 && <p className="text-stone-600 italic">No hay comandas pendientes.</p>}
          {pendingOrders.map(order => (
            <div key={order.id} className="bg-stone-900/50 border border-stone-800 rounded-sm p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-stone-800">
                <div>
                  <p className="font-bold text-white text-lg">Comanda #{order.id.slice(-6).toUpperCase()}</p>
                  <p className="text-stone-500 text-xs">{order.timestamp.toLocaleTimeString()}</p>
                  {order.tableId && <p className="text-gold text-[10px] uppercase mt-1">{order.tableId}</p>}
                </div>
                <div className="flex gap-2">
                  {editingOrderId !== order.id ? (
                    <button onClick={() => startEditingOrder(order)} className="text-stone-400 hover:text-gold transition-colors p-2" title="Editar Comanda">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                  ) : (
                     <button onClick={cancelEditingOrder} className="text-stone-400 hover:text-white transition-colors p-2" title="Cancelar Edición">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                  )}
                  <button onClick={() => handleUpdateServerStatus(order.id, 'completed')} className="bg-green-600/20 text-green-400 px-4 py-2 text-[10px] uppercase tracking-widest rounded-sm hover:bg-green-500 hover:text-white transition-colors">Marcar Listo</button>
                </div>
              </div>
              
              {editingOrderId === order.id ? (
                <div className="space-y-3 bg-black/20 p-4 rounded border border-stone-700/50">
                  <p className="text-[10px] uppercase tracking-widest text-gold mb-2">Editando Comanda</p>
                  {editingItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="number" className="w-16 bg-black/50 border border-stone-700 text-white px-2 py-1 text-sm rounded-sm focus:border-gold outline-none" value={item.quantity} onChange={(e) => handleOrderEditItemChange(idx, 'quantity', parseInt(e.target.value))} min="1"/>
                      <input type="text" className="flex-1 bg-black/50 border border-stone-700 text-white px-2 py-1 text-sm rounded-sm focus:border-gold outline-none" value={item.name} onChange={(e) => handleOrderEditItemChange(idx, 'name', e.target.value)} placeholder="Nombre del plato"/>
                      <button onClick={() => handleOrderRemoveItem(idx)} className="text-red-500 hover:text-red-400 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </div>
                  ))}
                  <button onClick={handleOrderAddItem} className="w-full py-2 border border-dashed border-stone-700 text-stone-500 hover:text-gold hover:border-gold text-xs uppercase tracking-widest mt-2 transition-colors">+ Agregar Ítem</button>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-stone-700">
                    <button onClick={saveEditingOrder} className="flex-1 bg-gold text-black py-2 text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors">Guardar</button>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {order.items.map((item, i) => <li key={i} className="flex justify-between text-stone-300"><span className="font-bold text-gold">{item.quantity}x</span> <span>{item.name}</span></li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-serif text-stone-500 mb-8 border-l-4 border-stone-700 pl-4">Completados</h3>
        <div className="space-y-4">
          {completedOrders.length === 0 && <p className="text-stone-700 italic">No hay comandas completadas.</p>}
          {completedOrders.map(order => (
            <div key={order.id} className="bg-stone-900/20 border border-stone-800/50 rounded-sm p-4 opacity-50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-stone-500">Comanda #{order.id.slice(-6).toUpperCase()}</p>
                  <p className="text-stone-600 text-xs">{order.timestamp.toLocaleTimeString()}</p>
                  <ul className="mt-2 text-xs text-stone-600">{order.items.map((item, i) => <li key={i}>{item.quantity}x {item.name}</li>)}</ul>
                </div>
                <span className="text-green-600 text-xs uppercase font-bold tracking-widest">Servido</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;