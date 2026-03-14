
import { Router } from 'express';
import { handleReservation } from '../controllers/reservationController.js';

const router = Router();

router.post('/reservations', handleReservation);

export default router;
