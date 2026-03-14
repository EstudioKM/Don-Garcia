
import { Request, Response } from 'express';

// Simulación de Base de Datos en Memoria
let ordersDB: any[] = [];

export const getOrders = (req: any, res: any) => {
    // Retornamos las órdenes ordenadas por fecha (más nuevas primero)
    const sortedOrders = [...ordersDB].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return res.json(sortedOrders);
};

export const updateOrderStatus = (req: any, res: any) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const orderIndex = ordersDB.findIndex(o => o.id === id);
    if (orderIndex > -1) {
        ordersDB[orderIndex].status = status;
        return res.json({ success: true, order: ordersDB[orderIndex] });
    }
    return res.status(404).json({ error: 'Orden no encontrada' });
};

export const createOrder = (req: any, res: any) => {
    const { items, tableId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'La comanda no puede estar vacía.' });
    }

    const orderId = `CMD-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    const newOrder = {
        id: orderId,
        items,
        tableId: tableId || 'Mesa 4',
        timestamp,
        status: 'pending'
    };

    // Guardar en "Base de Datos"
    ordersDB.push(newOrder);

    console.log(`\n=== NUEVA COMANDA GUARDADA [${orderId}] ===`);
    console.log(`Items: ${items.length}`);
    console.log('===========================================\n');

    return res.status(201).json({
        success: true,
        message: 'Comanda enviada a cocina correctamente.',
        order: newOrder
    });
};
