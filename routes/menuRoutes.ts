
import { Router } from 'express';
import { getFullMenu, updateMenu } from '../controllers/menuController.js';

const router = Router();

router.get('/menu-raw', getFullMenu);
router.put('/menu-update', updateMenu);

export default router;
