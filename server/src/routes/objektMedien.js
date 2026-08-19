import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { pool } from '../db/pool.js';

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// Fotos / Renovierungsdokumentation
router.post('/:objektId/fotos', upload.single('datei'), async (req, res, next) => {
  try {
    const { beschriftung, kategorie, aufgenommen_am } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO objekt_fotos (objekt_id, dateiname, speicherpfad, beschriftung, kategorie, aufgenommen_am)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.objektId, req.file.originalname, req.file.path, beschriftung || null,
       kategorie || 'foto', aufgenommen_am || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:objektId/fotos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM objekt_fotos WHERE objekt_id=$1 ORDER BY aufgenommen_am DESC NULLS LAST', [req.params.objektId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Offizielle Stammdokumente (Notarvertrag, Grundsteuerbescheid, ...)
router.post('/:objektId/stammdokumente', upload.single('datei'), async (req, res, next) => {
  try {
    const { dokumenttyp } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO objekt_stammdokumente (objekt_id, dateiname, speicherpfad, dokumenttyp)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.objektId, req.file.originalname, req.file.path, dokumenttyp || 'sonstiges']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:objektId/stammdokumente', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM objekt_stammdokumente WHERE objekt_id=$1 ORDER BY erstellt_am DESC', [req.params.objektId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
