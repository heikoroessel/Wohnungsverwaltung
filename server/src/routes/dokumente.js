import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db/pool.js';
import { extractDocument, extractKontoBuchungen } from '../services/aiExtraction.js';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Alle Dokumente eines Objekts, mit ihren erkannten Abschnitten
router.get('/', async (req, res, next) => {
  try {
    const { objekt_id, jahr } = req.query;
    const params = [objekt_id];
    let where = 'WHERE d.objekt_id=$1';
    if (jahr) { params.push(jahr); where += ` AND d.jahr=$${params.length}`; }
    const { rows } = await pool.query(
      `SELECT d.*,
        COALESCE(json_agg(a.*) FILTER (WHERE a.id IS NOT NULL), '[]') AS abschnitte
       FROM dokumente d
       LEFT JOIN dokument_abschnitte a ON a.dokument_id = d.id
       ${where}
       GROUP BY d.id
       ORDER BY d.erstellt_am DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Upload + KI-Analyse eines Sammeldokuments oder Einzelbelegs (jährlicher laufender Input)
router.post('/upload', upload.single('datei'), async (req, res, next) => {
  try {
    const { objekt_id } = req.body;
    if (!objekt_id) return res.status(400).json({ error: 'objekt_id erforderlich' });
    if (!req.file) return res.status(400).json({ error: 'Keine Datei erhalten' });

    const { rows: docRows } = await pool.query(
      `INSERT INTO dokumente (objekt_id, dateiname, speicherpfad, status)
       VALUES ($1,$2,$3,'hochgeladen') RETURNING *`,
      [objekt_id, req.file.originalname, req.file.path]
    );
    const dokument = docRows[0];

    // KI-Analyse anstoßen (kann bei großen Sammel-PDFs einige Sekunden dauern)
    try {
      const analyse = await extractDocument(req.file.path);

      await pool.query('UPDATE dokumente SET jahr=$1, ki_rohantwort=$2, status=$3 WHERE id=$4', [
        analyse.jahr_bezug || null, JSON.stringify(analyse), 'verarbeitet', dokument.id,
      ]);

      for (const abschnitt of analyse.abschnitte || []) {
        let mieterId = null;
        if (abschnitt.mieter_hinweis) {
          const { rows: mRows } = await pool.query(
            `SELECT id FROM mieter WHERE objekt_id=$1 AND (nachname ILIKE $2 OR (vorname || ' ' || nachname) ILIKE $2) LIMIT 1`,
            [objekt_id, `%${abschnitt.mieter_hinweis}%`]
          );
          mieterId = mRows[0]?.id || null;
        }

        const { rows: abschnittRows } = await pool.query(
          `INSERT INTO dokument_abschnitte
            (dokument_id, abschnittstyp, seite_von, seite_bis, mieter_id, jahr,
             fuer_mieter_geeignet, fuer_steuerberater_geeignet, extrahierte_daten)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [dokument.id, abschnitt.abschnittstyp, abschnitt.seite_von, abschnitt.seite_bis,
           mieterId, abschnitt.jahr, !!abschnitt.fuer_mieter_geeignet, !!abschnitt.fuer_steuerberater_geeignet,
           JSON.stringify(abschnitt.extrahierte_daten || {})]
        );

        // Jahresabrechnung: Rücklagenentwicklung separat strukturiert ablegen
        if (abschnitt.abschnittstyp === 'jahresabrechnung' && abschnitt.extrahierte_daten?.ruecklage) {
          const r = abschnitt.extrahierte_daten.ruecklage;
          await pool.query(
            `INSERT INTO ruecklagen_bewegungen
              (objekt_id, jahr, anfangsbestand, zufuehrung, entnahme_material, entnahme_arbeitsleistung, zinsen, endstand, quelle_dokument_abschnitt_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (objekt_id, jahr) DO UPDATE SET
               anfangsbestand=EXCLUDED.anfangsbestand, zufuehrung=EXCLUDED.zufuehrung,
               entnahme_material=EXCLUDED.entnahme_material, entnahme_arbeitsleistung=EXCLUDED.entnahme_arbeitsleistung,
               zinsen=EXCLUDED.zinsen, endstand=EXCLUDED.endstand,
               quelle_dokument_abschnitt_id=EXCLUDED.quelle_dokument_abschnitt_id`,
            [objekt_id, abschnitt.jahr, r.anfangsbestand || null, r.zufuehrung || null,
             r.entnahme_material || null, r.entnahme_arbeitsleistung || null, r.zinsen || null,
             r.endstand || null, abschnittRows[0].id]
          );
        }

        // Versammlungsprotokoll: falls Beschluss zur Rücklagenentnahme erkannt, Zweck nachtragen
        if (abschnitt.abschnittstyp === 'versammlungsprotokoll' && abschnitt.extrahierte_daten?.beschluesse_rueckl_relevant) {
          await pool.query(
            `UPDATE ruecklagen_bewegungen SET entnahme_zweck=$1
             WHERE objekt_id=$2 AND jahr=$3`,
            [abschnitt.extrahierte_daten.beschluesse_rueckl_relevant, objekt_id, abschnitt.jahr]
          );
        }
      }

      const { rows: full } = await pool.query('SELECT * FROM dokumente WHERE id=$1', [dokument.id]);
      res.status(201).json(full[0]);
    } catch (aiErr) {
      await pool.query('UPDATE dokumente SET status=$1 WHERE id=$2', ['fehler', dokument.id]);
      console.error('[KI-Extraktion fehlgeschlagen]', aiErr);
      res.status(207).json({ ...dokument, status: 'fehler', fehler: aiErr.message });
    }
  } catch (err) { next(err); }
});

// Kontoauszug-Upload: volle Datei, KI filtert relevante Buchungen
router.post('/kontoauszug', upload.single('datei'), async (req, res, next) => {
  try {
    const { objekt_id } = req.body;
    if (!objekt_id) return res.status(400).json({ error: 'objekt_id erforderlich' });
    if (!req.file) return res.status(400).json({ error: 'Keine Datei erhalten' });

    const { rows: docRows } = await pool.query(
      `INSERT INTO dokumente (objekt_id, dateiname, speicherpfad, status)
       VALUES ($1,$2,$3,'hochgeladen') RETURNING *`,
      [objekt_id, req.file.originalname, req.file.path]
    );
    const dokument = docRows[0];

    const analyse = await extractKontoBuchungen(req.file.path, req.file.mimetype);

    for (const b of analyse.buchungen || []) {
      let mieterId = null;
      if (b.mieter_oder_empfaenger_hinweis) {
        const { rows: mRows } = await pool.query(
          `SELECT id FROM mieter WHERE objekt_id=$1 AND (nachname ILIKE $2 OR (vorname || ' ' || nachname) ILIKE $2) LIMIT 1`,
          [objekt_id, `%${b.mieter_oder_empfaenger_hinweis}%`]
        );
        mieterId = mRows[0]?.id || null;
      }
      await pool.query(
        `INSERT INTO konto_buchungen (objekt_id, dokument_id, buchungsdatum, betrag, buchungstext, kategorie, mieter_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [objekt_id, dokument.id, b.buchungsdatum, b.betrag, b.buchungstext, b.kategorie, mieterId]
      );
    }

    await pool.query('UPDATE dokumente SET status=$1 WHERE id=$2', ['verarbeitet', dokument.id]);
    res.status(201).json({ dokument, anzahl_buchungen: (analyse.buchungen || []).length });
  } catch (err) { next(err); }
});

// Manuelle Korrektur eines Abschnitts (z.B. Seiten nachjustieren, Typ korrigieren)
router.put('/abschnitte/:id', async (req, res, next) => {
  try {
    const { abschnittstyp, seite_von, seite_bis, fuer_mieter_geeignet, fuer_steuerberater_geeignet } = req.body;
    const { rows } = await pool.query(
      `UPDATE dokument_abschnitte SET
        abschnittstyp=COALESCE($1,abschnittstyp),
        seite_von=COALESCE($2,seite_von),
        seite_bis=COALESCE($3,seite_bis),
        fuer_mieter_geeignet=COALESCE($4,fuer_mieter_geeignet),
        fuer_steuerberater_geeignet=COALESCE($5,fuer_steuerberater_geeignet)
       WHERE id=$6 RETURNING *`,
      [abschnittstyp, seite_von, seite_bis, fuer_mieter_geeignet, fuer_steuerberater_geeignet, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Abschnitt nicht gefunden' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
