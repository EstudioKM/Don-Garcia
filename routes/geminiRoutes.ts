
import { Router } from 'express';
import { 
    handleChat, 
    getLocationInfo,
    generateConfirmationMessage
} from '../controllers/geminiController.js';

const router = Router();

router.post('/chat', handleChat);
router.post('/location-info', getLocationInfo);
router.post('/generate-confirmation', generateConfirmationMessage);

export default router;