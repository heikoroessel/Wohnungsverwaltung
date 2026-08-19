import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pool } from '../db/pool.js';

const router = Router();
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/data/outputs';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Schritt 1: Vorauswahl der Anlagen für Objekt+Mieter+Jahr anzeigen (KI-Vorschlag editierbar)
router.get('/vorauswahl', async (req, res, next) => {
  try {
    const { objekt_id, mieter_id, jahr } = req.query;
    const { rows: objektRows } = await pool.query('SELECT * FROM objekte WHERE id=$1', [objekt_id]);
    const objekt = objektRows[0];
    if (objekt?.abrechnung_durch === 'hausverwaltung') {
      return res.status(400).json({
        error: 'Dieses Objekt wird durch die Hausverwaltung selbst abgerechnet – keine eigene Nebenkostenabrechnung nötig.',
      });
    }

    const { rows: abschnitte } = await pool.query(
      `SELECT a.*, d.dateiname, d.speicherpfad
       FROM dokument_abschnitte a
       JOIN dokumente d ON d.id = a.dokument_id
       WHERE d.objekt_id=$1 AND a.jahr=$2
         AND (a.mieter_id=$3 OR a.mieter_id IS NULL)
       ORDER BY a.fuer_mieter_geeignet DESC, a.abschnittstyp`,
      [objekt_id, jahr, mieter_id]
    );

    // Zahlen-Vorschlag aus den bereits extrahierten Daten ableiten, statt den Nutzer blank tippen zu lassen.
    // Gesamtkosten: aus der jahresabrechnung (Objekt-Summe) plus, falls für den Mieter separat erfasst,
    // dessen Techem-/DomoTherm-Anteil (der ja Teil der umlagefähigen Kosten ist und in "gesamtkosten"
    // der Jahresabrechnung meist bereits mit drinsteckt – daher nur EINE der beiden Quellen nehmen,
    // priorisiert die mieterspezifische, sonst die objektweite).
    let gesamtkostenVorschlag = null;
    const jahresabrechnungMieterspezifisch = abschnitte.find(
      (a) => a.mieter_id == mieter_id && a.extrahierte_daten?.gesamtkosten != null
    );
    const jahresabrechnungObjektweit = abschnitte.find(
      (a) => a.abschnittstyp === 'jahresabrechnung' && a.extrahierte_daten?.gesamtkosten != null
    );
    const techemDomotherm = abschnitte.find(
      (a) => ['techem', 'domotherm'].includes(a.abschnittstyp) &&
        (a.extrahierte_daten?.heizkosten != null || a.extrahierte_daten?.gesamtkosten != null)
    );
    if (jahresabrechnungMieterspezifisch) {
      gesamtkostenVorschlag = jahresabrechnungMieterspezifisch.extrahierte_daten.gesamtkosten;
    } else if (jahresabrechnungObjektweit) {
      gesamtkostenVorschlag = jahresabrechnungObjektweit.extrahierte_daten.gesamtkosten;
    }
    // Heiz-/Wasserkosten aus Techem/DomoTherm addieren, falls sie nicht schon in der Jahresabrechnung
    // des Mieters mit drinstecken (Heuristik: nur addieren, wenn die Jahresabrechnung objektweit war,
    // nicht mieterspezifisch, da objektweite Summen die individuellen Heizkosten meist NICHT enthalten).
    if (techemDomotherm && !jahresabrechnungMieterspezifisch) {
      const heiz = Number(techemDomotherm.extrahierte_daten?.heizkosten || 0);
      const ww = Number(techemDomotherm.extrahierte_daten?.warmwasserkosten || 0);
      const kw = Number(techemDomotherm.extrahierte_daten?.kaltwasserkosten || 0);
      const summe = heiz + ww + kw;
      if (summe > 0) gesamtkostenVorschlag = (gesamtkostenVorschlag || 0) + summe;
    }

    // Vorauszahlung: aktuelle monatliche NK-Vorauszahlung des Mieters × 12 als Default-Annahme
    const { rows: mRows } = await pool.query('SELECT aktuelle_nk_vorauszahlung FROM mieter WHERE id=$1', [mieter_id]);
    const vorauszahlungVorschlag = mRows[0]?.aktuelle_nk_vorauszahlung
      ? Number(mRows[0].aktuelle_nk_vorauszahlung) * 12
      : null;

    res.json({
      abschnitte: abschnitte.map((a) => ({ ...a, vorausgewaehlt: a.fuer_mieter_geeignet })),
      vorschlag: {
        gesamtkosten: gesamtkostenVorschlag,
        vorauszahlung_gesamt: vorauszahlungVorschlag,
        hinweis: gesamtkostenVorschlag == null
          ? 'Keine Gesamtkosten in den extrahierten Dokumenten gefunden – bitte manuell prüfen/eintragen.'
          : 'Automatisch aus den hochgeladenen Dokumenten ermittelt – bitte kurz gegenprüfen.',
      },
    });
  } catch (err) { next(err); }
});

// Schritt 2: finale Anlagenauswahl bestätigt -> PDF zusammenbauen (Anschreiben + zusammengeführte Seiten)
router.post('/erstellen', async (req, res, next) => {
  try {
    const { objekt_id, mieter_id, jahr, ausgewaehlte_abschnitt_ids, gesamtkosten, vorauszahlung_gesamt } = req.body;

    const { rows: mieterRows } = await pool.query('SELECT * FROM mieter WHERE id=$1', [mieter_id]);
    const mieter = mieterRows[0];
    const { rows: objektRows } = await pool.query('SELECT * FROM objekte WHERE id=$1', [objekt_id]);
    const objekt = objektRows[0];

    const nachzahlung = (gesamtkosten ?? 0) - (vorauszahlung_gesamt ?? 0);

    // Anschreiben erzeugen
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { height } = page.getSize();
    let y = height - 80;
    const draw = (text, size = 11, gapAfter = 18) => {
      page.drawText(text, { x: 56, y, size, font, color: rgb(0, 0, 0) });
      y -= gapAfter;
    };

    draw(`${mieter.vorname || ''} ${mieter.nachname}`, 11, 16);
    draw(objekt.adresse || '', 11, 30);
    draw(`Betriebskostenabrechnung ${jahr}`, 14, 22);
    draw(`Abrechnungszeitraum 01.01.${jahr} bis 31.12.${jahr}`, 11, 24);
    draw(`Sehr geehrte/r ${mieter.vorname || ''} ${mieter.nachname},`, 11, 20);
    draw(`anbei erhalten Sie die Betriebskostenabrechnung für das Jahr ${jahr}.`, 11, 20);
    draw(`Gesamtkosten: ${(gesamtkosten ?? 0).toFixed(2)} EUR`, 11, 16);
    draw(`Ihre Vorauszahlungen: ${(vorauszahlung_gesamt ?? 0).toFixed(2)} EUR`, 11, 16);
    draw(
      nachzahlung >= 0
        ? `Nachzahlungsbetrag: ${nachzahlung.toFixed(2)} EUR`
        : `Erstattungsbetrag: ${Math.abs(nachzahlung).toFixed(2)} EUR`,
      12, 26
    );
    draw('Die zugehörigen Belege finden Sie in der Anlage.', 11, 30);
    draw('Freundliche Grüße', 11, 16);

    // Ausgewählte Anlagen-Seiten aus den Quelldokumenten anhängen
    for (const abschnittId of ausgewaehlte_abschnitt_ids) {
      const { rows } = await pool.query(
        `SELECT a.*, d.speicherpfad FROM dokument_abschnitte a
         JOIN dokumente d ON d.id=a.dokument_id WHERE a.id=$1`,
        [abschnittId]
      );
      const abschnitt = rows[0];
      if (!abschnitt || !fs.existsSync(abschnitt.speicherpfad)) continue;

      const srcBytes = fs.readFileSync(abschnitt.speicherpfad);
      const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const von = Math.max(0, (abschnitt.seite_von || 1) - 1);
      const bis = Math.min(srcDoc.getPageCount() - 1, (abschnitt.seite_bis || srcDoc.getPageCount()) - 1);
      const indices = [];
      for (let i = von; i <= bis; i++) indices.push(i);
      const kopiert = await pdfDoc.copyPages(srcDoc, indices);
      kopiert.forEach((p) => pdfDoc.addPage(p));
    }

    const finalBytes = await pdfDoc.save();
    const outFileName = `nk-abrechnung-${objekt_id}-${mieter_id}-${jahr}.pdf`;
    const outPath = path.join(OUTPUT_DIR, outFileName);
    fs.writeFileSync(outPath, finalBytes);

    const { rows: gespeichert } = await pool.query(
      `INSERT INTO nk_abrechnungen
        (objekt_id, mieter_id, jahr, gesamtkosten, vorauszahlung_gesamt, nachzahlung_erstattung, ausgewaehlte_abschnitt_ids, pdf_speicherpfad)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (mieter_id, jahr) DO UPDATE SET
         gesamtkosten=EXCLUDED.gesamtkosten, vorauszahlung_gesamt=EXCLUDED.vorauszahlung_gesamt,
         nachzahlung_erstattung=EXCLUDED.nachzahlung_erstattung,
         ausgewaehlte_abschnitt_ids=EXCLUDED.ausgewaehlte_abschnitt_ids, pdf_speicherpfad=EXCLUDED.pdf_speicherpfad
       RETURNING *`,
      [objekt_id, mieter_id, jahr, gesamtkosten, vorauszahlung_gesamt, nachzahlung, ausgewaehlte_abschnitt_ids, outPath]
    );

    res.status(201).json({ ...gespeichert[0], download_url: `/api/nk-abrechnung/download/${gespeichert[0].id}` });
  } catch (err) { next(err); }
});

router.get('/download/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM nk_abrechnungen WHERE id=$1', [req.params.id]);
    const rec = rows[0];
    if (!rec || !fs.existsSync(rec.pdf_speicherpfad)) return res.status(404).send('Nicht gefunden');
    res.download(rec.pdf_speicherpfad);
  } catch (err) { next(err); }
});

// Nach Erstellung: Mieterhöhung / NK-Anpassung abfragen -> wird über /api/mieter/:id/aenderungen gepflegt (Frontend triggert das)
export default router;
