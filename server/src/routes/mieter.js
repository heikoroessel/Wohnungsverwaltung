import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { objekt_id } = req.query;
    const { rows } = objekt_id
      ? await pool.query('SELECT * FROM mieter WHERE objekt_id=$1 ORDER BY einzug_am DESC NULLS LAST', [objekt_id])
      : await pool.query('SELECT * FROM mieter ORDER BY einzug_am DESC NULLS LAST');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { objekt_id, vorname, nachname, einzug_am, auszug_am, aktuelle_miete, aktuelle_nk_vorauszahlung } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO mieter (objekt_id, vorname, nachname, einzug_am, auszug_am, aktuelle_miete, aktuelle_nk_vorauszahlung)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [objekt_id, vorname, nachname, einzug_am || null, auszug_am || null, aktuelle_miete || null, aktuelle_nk_vorauszahlung || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// Zählerstände aus dem Übergabeprotokoll erfassen
router.post('/:id/zaehlerstaende', async (req, res, next) => {
  try {
    const { zaehlerart, zaehlernummer, stand, datum } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO zaehlerstaende_uebergabe (mieter_id, zaehlerart, zaehlernummer, stand, datum)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, zaehlerart, zaehlernummer || null, stand, datum]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:id/zaehlerstaende', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM zaehlerstaende_uebergabe WHERE mieter_id=$1 ORDER BY datum', [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Plausibilitätsabgleich: Übergabe-Zählerstand vs. der von Techem/DomoTherm im Folgejahr verwendete Anfangswert.
// Der Anfangswert kommt aus dokument_abschnitte.extrahierte_daten (zaehlerstaende) für einen techem/domotherm-Abschnitt desselben Mieters.
router.post('/:id/zaehlerstaende/:zaehlerId/abgleichen', async (req, res, next) => {
  try {
    const { techem_domotherm_startwert, zaehlerart } = req.body;
    const { rows } = await pool.query('SELECT * FROM zaehlerstaende_uebergabe WHERE id=$1', [req.params.zaehlerId]);
    const eintrag = rows[0];
    if (!eintrag) return res.status(404).json({ error: 'Zählerstand nicht gefunden' });

    const abweichung = Math.abs(Number(eintrag.stand) - Number(techem_domotherm_startwert));
    const ergebnis = abweichung < 0.5 ? 'uebereinstimmend' : 'abweichung';

    const { rows: updated } = await pool.query(
      `UPDATE zaehlerstaende_uebergabe
       SET abgeglichen=true, abgleich_ergebnis=$2,
           abgleich_notiz=$3
       WHERE id=$1 RETURNING *`,
      [req.params.zaehlerId, ergebnis,
       `Übergabe: ${eintrag.stand} | Techem/DomoTherm-Startwert: ${techem_domotherm_startwert} | Differenz: ${abweichung.toFixed(2)}`]
    );
    res.json(updated[0]);
  } catch (err) { next(err); }
});

// Mieterhöhung / NK-Vorauszahlungsanpassung
router.post('/:id/aenderungen', async (req, res, next) => {
  try {
    const { typ, alter_betrag, neuer_betrag, gueltig_ab, ausgeloest_von_abrechnung_id } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO miet_aenderungen (mieter_id, typ, alter_betrag, neuer_betrag, gueltig_ab, ausgeloest_von_abrechnung_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, typ, alter_betrag || null, neuer_betrag, gueltig_ab, ausgeloest_von_abrechnung_id || null]
    );
    // aktuellen Wert am Mieter direkt mit-aktualisieren, wenn Stichdatum erreicht/vergangen ist
    if (new Date(gueltig_ab) <= new Date()) {
      const spalte = typ === 'miete' ? 'aktuelle_miete' : 'aktuelle_nk_vorauszahlung';
      await pool.query(`UPDATE mieter SET ${spalte}=$1 WHERE id=$2`, [neuer_betrag, req.params.id]);
    }
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:id/aenderungen', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM miet_aenderungen WHERE mieter_id=$1 ORDER BY gueltig_ab DESC', [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
