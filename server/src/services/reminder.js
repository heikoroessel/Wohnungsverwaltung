import { pool } from '../db/pool.js';

// Einfacher Stichtag-Reminder: konfigurierbar per ENV (Default: 15. Februar, "Zeit für die Vorjahresdaten")
const REMINDER_MONAT = Number(process.env.REMINDER_MONAT || 2);
const REMINDER_TAG = Number(process.env.REMINDER_TAG || 15);

// Liefert für jedes aktive Objekt, ob für das Vorjahr bereits ein Dokument vom Typ 'jahresabrechnung' vorliegt.
export async function pruefeReminderStatus() {
  const heute = new Date();
  const vorjahr = heute.getFullYear() - 1;
  const nachStichtag =
    heute.getMonth() + 1 > REMINDER_MONAT ||
    (heute.getMonth() + 1 === REMINDER_MONAT && heute.getDate() >= REMINDER_TAG);

  const { rows: objekte } = await pool.query('SELECT id, bezeichnung FROM objekte WHERE aktiv=true');
  const ergebnisse = [];
  for (const o of objekte) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM dokument_abschnitte a
       JOIN dokumente d ON d.id=a.dokument_id
       WHERE d.objekt_id=$1 AND a.abschnittstyp='jahresabrechnung' AND a.jahr=$2`,
      [o.id, vorjahr]
    );
    const vorhanden = Number(rows[0].count) > 0;
    ergebnisse.push({
      objekt_id: o.id,
      bezeichnung: o.bezeichnung,
      jahr: vorjahr,
      daten_vorhanden: vorhanden,
      reminder_faellig: nachStichtag && !vorhanden,
    });
  }
  return ergebnisse;
}
