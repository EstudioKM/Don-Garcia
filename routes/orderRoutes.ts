
import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orderController.js';

const router = Router();

router.post('/orders', createOrder);
router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);

export default router;
