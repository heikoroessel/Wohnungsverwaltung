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

// Mietvertrag oder Übergabeprotokoll hochladen
router.post('/:mieterId/dokumente', upload.single('datei'), async (req, res, next) => {
  try {
    const { dokumenttyp } = req.body; // 'mietvertrag' | 'uebergabeprotokoll'
    const { rows } = await pool.query(
      `INSERT INTO mietvertrag_dokumente (mieter_id, dateiname, speicherpfad, dokumenttyp)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.mieterId, req.file.originalname, req.file.path, dokumenttyp || 'sonstiges']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:mieterId/dokumente', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM mietvertrag_dokumente WHERE mieter_id=$1 ORDER BY erstellt_am DESC', [req.params.mieterId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
