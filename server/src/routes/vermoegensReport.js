import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

// Ansicht 1: Objektbezogen mit Wertsteigerungspotenzial
router.get('/objekt-ansicht', async (req, res, next) => {
  try {
    const { rows: objekte } = await pool.query('SELECT * FROM objekte WHERE aktiv=true ORDER BY bezeichnung');

    const ergebnis = objekte.map((o) => {
      const investition =
        Number(o.kaufpreis || 0) +
        Number(o.grunderwerbsteuer || 0) +
        Number(o.notarkosten || 0) +
        Number(o.sonstige_anschaffungskosten || 0);
      const marktwert = Number(o.marktwert_aktuell || 0);
      const wertsteigerung_absolut = marktwert - investition;
      const wertsteigerung_relativ = investition > 0 ? (marktwert / investition - 1) * 100 : null;

      return {
        objekt_id: o.id,
        bezeichnung: o.bezeichnung,
        investition,
        marktwert_aktuell: marktwert,
        marktwert_notiz: o.marktwert_notiz,
        wertsteigerung_absolut,
        wertsteigerung_relativ_prozent: wertsteigerung_relativ,
        vergleichsmiete_pro_qm: o.vergleichsmiete_pro_qm,
        vergleichsmiete_notiz: o.vergleichsmiete_notiz,
        eigentuemer_modus: o.eigentuemer_modus,
      };
    });

    res.json(ergebnis);
  } catch (err) { next(err); }
});

// Ansicht 2: Buchhalterisch – Rendite / Kapitaldienst pro Objekt und Jahr
router.get('/rendite-ansicht', async (req, res, next) => {
  try {
    const { jahr } = req.query;
    const { rows: objekte } = await pool.query('SELECT * FROM objekte WHERE aktiv=true ORDER BY bezeichnung');

    const ergebnis = [];
    for (const o of objekte) {
      const anteil = o.eigentuemer_modus === 'gemeinsam' ? 0.5 : 1.0;
      const investition =
        Number(o.kaufpreis || 0) + Number(o.grunderwerbsteuer || 0) +
        Number(o.notarkosten || 0) + Number(o.sonstige_anschaffungskosten || 0);

      const { rows: einnahmen } = await pool.query(
        `SELECT COALESCE(SUM(betrag),0) AS summe FROM konto_buchungen
         WHERE objekt_id=$1 AND kategorie='miete_eingang' AND EXTRACT(YEAR FROM buchungsdatum)=$2`,
        [o.id, jahr]
      );
      const { rows: kosten } = await pool.query(
        `SELECT COALESCE(SUM(ABS(betrag)),0) AS summe FROM konto_buchungen
         WHERE objekt_id=$1 AND kategorie IN ('hausverwaltung','handwerker') AND EXTRACT(YEAR FROM buchungsdatum)=$2`,
        [o.id, jahr]
      );

      const ist_einnahmen = Number(einnahmen[0].summe) * anteil;
      const ist_kosten = Number(kosten[0].summe) * anteil;
      const netto_ueberschuss = ist_einnahmen - ist_kosten;
      const rendite_prozent = investition > 0 ? (netto_ueberschuss / (investition * anteil)) * 100 : null;

      ergebnis.push({
        objekt_id: o.id,
        bezeichnung: o.bezeichnung,
        jahr: Number(jahr),
        investition_anteilig: investition * anteil,
        ist_mieteinnahmen: ist_einnahmen,
        laufende_kosten: ist_kosten,
        netto_ueberschuss,
        rendite_prozent,
      });
    }

    res.json(ergebnis);
  } catch (err) { next(err); }
});

export default router;
