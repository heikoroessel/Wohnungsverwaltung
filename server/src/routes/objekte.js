import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM objekte WHERE aktiv = true ORDER BY bezeichnung'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM objekte WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Objekt nicht gefunden' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      bezeichnung, adresse, einheit_nr, kaufdatum, kaufpreis,
      grunderwerbsteuer, notarkosten, sonstige_anschaffungskosten,
      eigentuemer_modus, miteigentuemer_name, abrechnung_durch,
      marktwert_aktuell, vergleichsmiete_pro_qm,
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO objekte
        (bezeichnung, adresse, einheit_nr, kaufdatum, kaufpreis, grunderwerbsteuer,
         notarkosten, sonstige_anschaffungskosten, eigentuemer_modus, miteigentuemer_name,
         abrechnung_durch, marktwert_aktuell, vergleichsmiete_pro_qm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [bezeichnung, adresse, einheit_nr, kaufdatum || null, kaufpreis || null,
       grunderwerbsteuer || null, notarkosten || null, sonstige_anschaffungskosten || null,
       eigentuemer_modus || 'allein', miteigentuemer_name || null,
       abrechnung_durch || 'nutzer', marktwert_aktuell || null, vergleichsmiete_pro_qm || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const fields = req.body;
    const allowed = [
      'bezeichnung','adresse','einheit_nr','kaufdatum','kaufpreis','grunderwerbsteuer',
      'notarkosten','sonstige_anschaffungskosten','eigentuemer_modus','miteigentuemer_name',
      'abrechnung_durch','marktwert_aktuell','marktwert_notiz','vergleichsmiete_pro_qm','vergleichsmiete_notiz',
    ];
    const setClauses = [];
    const values = [];
    let i = 1;
    for (const key of allowed) {
      if (key in fields) {
        setClauses.push(`${key}=$${i}`);
        values.push(fields[key]);
        i++;
      }
    }
    if (!setClauses.length) return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
    setClauses.push(`aktualisiert_am=now()`);
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE objekte SET ${setClauses.join(', ')} WHERE id=$${i} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Objekt nicht gefunden' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// "Löschen" = als verkauft/inaktiv markieren statt hart zu löschen (Datenhistorie bleibt für Steuerjahre erhalten)
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE objekte SET aktiv=false, verkauft_am=COALESCE($2, CURRENT_DATE) WHERE id=$1 RETURNING *`,
      [req.params.id, req.body?.verkauft_am || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Objekt nicht gefunden' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
