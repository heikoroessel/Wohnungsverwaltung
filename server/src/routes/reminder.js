import { Router } from 'express';
import { pruefeReminderStatus } from '../services/reminder.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await pruefeReminderStatus());
  } catch (err) { next(err); }
});

export default router;
