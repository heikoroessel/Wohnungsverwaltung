import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { pool } from '../db/pool.js';

const router = Router();
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/data/outputs';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Vorschlag der Anlagen pro Objekt (Jahresabrechnung, Sonderumlage, Handwerkerrechnungen, Versammlungsprotokoll)
router.get('/vorauswahl', async (req, res, next) => {
  try {
    const { jahr } = req.query;
    const { rows: objekte } = await pool.query('SELECT * FROM objekte WHERE aktiv=true ORDER BY bezeichnung');

    const ergebnis = [];
    for (const objekt of objekte) {
      const { rows: abschnitte } = await pool.query(
        `SELECT a.*, d.dateiname FROM dokument_abschnitte a
         JOIN dokumente d ON d.id=a.dokument_id
         WHERE d.objekt_id=$1 AND a.jahr=$2 AND a.fuer_steuerberater_geeignet=true
         ORDER BY a.abschnittstyp`,
        [objekt.id, jahr]
      );
      ergebnis.push({ objekt, vorgeschlagene_anlagen: abschnitte });
    }
    res.json(ergebnis);
  } catch (err) { next(err); }
});

router.post('/erstellen', async (req, res, next) => {
  try {
    const { jahr, objekt_ids } = req.body;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Wohnungen Report Software';

    for (const objektId of objekt_ids) {
      const { rows: oRows } = await pool.query('SELECT * FROM objekte WHERE id=$1', [objektId]);
      const objekt = oRows[0];
      if (!objekt) continue;

      const anteil = objekt.eigentuemer_modus === 'gemeinsam' ? 0.5 : 1.0;

      // Einnahmen aus Kontobuchungen
      const { rows: einnahmen } = await pool.query(
        `SELECT COALESCE(SUM(betrag),0) AS summe FROM konto_buchungen
         WHERE objekt_id=$1 AND kategorie='miete_eingang' AND EXTRACT(YEAR FROM buchungsdatum)=$2`,
        [objektId, jahr]
      );
      const { rows: hausverwaltungAusgaben } = await pool.query(
        `SELECT COALESCE(SUM(betrag),0) AS summe FROM konto_buchungen
         WHERE objekt_id=$1 AND kategorie='hausverwaltung' AND EXTRACT(YEAR FROM buchungsdatum)=$2`,
        [objektId, jahr]
      );
      const { rows: handwerkerAusgaben } = await pool.query(
        `SELECT COALESCE(SUM(betrag),0) AS summe FROM konto_buchungen
         WHERE objekt_id=$1 AND kategorie='handwerker' AND EXTRACT(YEAR FROM buchungsdatum)=$2`,
        [objektId, jahr]
      );
      const { rows: ruecklageRows } = await pool.query(
        'SELECT * FROM ruecklagen_bewegungen WHERE objekt_id=$1 AND jahr=$2', [objektId, jahr]
      );
      const ruecklage = ruecklageRows[0];
      const entnahmeGesamt = ruecklage
        ? Number(ruecklage.entnahme_material || 0) + Number(ruecklage.entnahme_arbeitsleistung || 0)
        : 0;

      const tabName = (objekt.bezeichnung || `Objekt ${objektId}`).slice(0, 31);
      const sheet = workbook.addWorksheet(tabName);
      sheet.columns = [{ width: 40 }, { width: 20 }];

      const addRow = (label, value, bold = false) => {
        const row = sheet.addRow([label, value]);
        if (bold) row.font = { bold: true };
      };

      addRow('Objekt', objekt.bezeichnung, true);
      addRow('Adresse', objekt.adresse);
      addRow('Eigentumsanteil', objekt.eigentuemer_modus === 'gemeinsam'
        ? `50% (gemeinsam mit ${objekt.miteigentuemer_name || 'Miteigentümer'})` : '100%');
      addRow('Kaufdatum', objekt.kaufdatum);
      addRow('Kaufpreis', objekt.kaufpreis);
      addRow('Grunderwerbsteuer', objekt.grunderwerbsteuer);
      addRow('Notarkosten', objekt.notarkosten);
      addRow('Sonstige Anschaffungskosten', objekt.sonstige_anschaffungskosten);
      sheet.addRow([]);

      addRow(`EINNAHMEN ${jahr} (Ihr Anteil ${(anteil * 100).toFixed(0)}%)`, '', true);
      addRow('Ist-Mieteinnahmen', Number(einnahmen[0].summe) * anteil);
      sheet.addRow([]);

      addRow(`WERBUNGSKOSTEN ${jahr} (Ihr Anteil ${(anteil * 100).toFixed(0)}%)`, '', true);
      addRow('Zahlungen an Hausverwaltung (Hausgeld etc.)', Math.abs(Number(hausverwaltungAusgaben[0].summe)) * anteil);
      addRow('Handwerker-/Reparaturkosten', Math.abs(Number(handwerkerAusgaben[0].summe)) * anteil);
      addRow('Rücklagen-Entnahme (tatsächlich verausgabt, Werbungskosten-relevant)', entnahmeGesamt * anteil);
      if (ruecklage?.entnahme_zweck) addRow('  → Zweck der Entnahme', ruecklage.entnahme_zweck);
      addRow('  Hinweis Zuführung zur Rücklage (KEINE Werbungskosten, erst bei Entnahme)', ruecklage?.zufuehrung
        ? Number(ruecklage.zufuehrung) * anteil : 0);
      sheet.addRow([]);

      addRow('Prüfhinweis', ruecklage?.entnahme_klassifikation === 'unklar' || (!ruecklage?.entnahme_zweck && entnahmeGesamt > 0)
        ? 'Zweck der Rücklagenentnahme nicht eindeutig aus Dokumenten ableitbar – bitte mit Steuerberater klären (Erhaltungsaufwand vs. anschaffungsnahe Herstellungskosten).'
        : '–');
    }

    const fileName = `steuerbericht-${jahr}.xlsx`;
    const outPath = path.join(OUTPUT_DIR, fileName);
    await workbook.xlsx.writeFile(outPath);

    await pool.query(
      `INSERT INTO steuerberater_exports (jahr, objekt_ids, excel_speicherpfad) VALUES ($1,$2,$3)`,
      [jahr, objekt_ids, outPath]
    );

    res.status(201).json({ jahr, objekt_ids, download_url: `/api/steuer-report/download/${fileName}` });
  } catch (err) { next(err); }
});

router.get('/download/:fileName', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.fileName);
  if (!fs.existsSync(filePath)) return res.status(404).send('Nicht gefunden');
  res.download(filePath);
});

export default router;
