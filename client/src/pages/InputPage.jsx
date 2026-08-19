import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function InputPage() {
  const [objekte, setObjekte] = useState([]);
  const [objektId, setObjektId] = useState('');
  const [dokumente, setDokumente] = useState([]);
  const [ladeStatus, setLadeStatus] = useState(null);
  const [reminder, setReminder] = useState([]);

  useEffect(() => { api.get('/objekte').then(setObjekte); }, []);
  useEffect(() => { api.get('/reminder').then(setReminder); }, []);
  useEffect(() => {
    if (objektId) api.get(`/dokumente?objekt_id=${objektId}`).then(setDokumente);
  }, [objektId]);

  const sammeldokumentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !objektId) return;
    setLadeStatus('Dokument wird hochgeladen und von der KI analysiert – das kann einen Moment dauern…');
    try {
      await api.upload('/dokumente/upload', file, { objekt_id: objektId });
      setLadeStatus('Fertig – Abschnitte erkannt und in die Datenbank übernommen.');
      api.get(`/dokumente?objekt_id=${objektId}`).then(setDokumente);
    } catch (err) {
      setLadeStatus(`Fehler: ${err.message}`);
    }
  };

  const kontoauszugUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !objektId) return;
    setLadeStatus('Kontoauszug wird analysiert, relevante Buchungen werden gefiltert…');
    try {
      const res = await api.upload('/dokumente/kontoauszug', file, { objekt_id: objektId });
      setLadeStatus(`Fertig – ${res.anzahl_buchungen} relevante Buchungen übernommen.`);
    } catch (err) {
      setLadeStatus(`Fehler: ${err.message}`);
    }
  };

  const faelligeReminder = reminder.filter((r) => r.reminder_faellig);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="app-title-eyebrow">Jährlicher Input</span>
          <h2>Dokumente hochladen</h2>
        </div>
      </div>

      {faelligeReminder.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--brass)', background: 'var(--brass-soft)' }}>
          <h3>Erinnerung</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {faelligeReminder.map((r) => (
              <li key={r.objekt_id}>{r.bezeichnung}: Jahresabrechnung {r.jahr} liegt noch nicht vor.</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="field">
          <label>Objekt auswählen</label>
          <select value={objektId} onChange={(e) => setObjektId(e.target.value)}>
            <option value="">– bitte wählen –</option>
            {objekte.map((o) => <option key={o.id} value={o.id}>{o.bezeichnung}</option>)}
          </select>
        </div>

        {objektId && (
          <div className="grid-2" style={{ marginTop: 16 }}>
            <div>
              <label>Sammeldokument der Hausverwaltung / Handwerkerrechnung / sonstiger Beleg (PDF)</label>
              <input type="file" accept="application/pdf" onChange={sammeldokumentUpload} />
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                Die KI erkennt automatisch Jahresabrechnung, Wirtschaftsplan, Sonderumlage, Versammlungsprotokoll,
                Techem-/DomoTherm-Abrechnung oder Handwerkerrechnung – kein manueller Dokumenttyp nötig.
              </p>
            </div>
            <div>
              <label>Voller Kontoauszug (PDF)</label>
              <input type="file" accept="application/pdf" onChange={kontoauszugUpload} />
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                Die KI filtert automatisch Mieteingänge, Hausverwaltungs- und Handwerkerzahlungen heraus.
              </p>
            </div>
          </div>
        )}

        {ladeStatus && <p style={{ marginTop: 12, fontSize: '0.88rem' }}>{ladeStatus}</p>}
      </div>

      {objektId && (
        <div className="card">
          <h3>Erkannte Dokumente & Abschnitte</h3>
          {dokumente.map((d) => (
            <div key={d.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{d.dateiname}</strong>
                <span className={`badge ${d.status === 'verarbeitet' ? 'badge-ok' : d.status === 'fehler' ? 'badge-error' : 'badge-warn'}`}>
                  {d.status}
                </span>
              </div>
              <ul style={{ paddingLeft: 18, marginTop: 6 }}>
                {(d.abschnitte || []).map((a) => (
                  <li key={a.id} style={{ fontSize: '0.85rem' }}>
                    <span className="mono">S. {a.seite_von}–{a.seite_bis}</span> — {a.abschnittstyp}
                    {a.jahr && ` (${a.jahr})`}
                    {a.fuer_mieter_geeignet && <span className="badge badge-ok" style={{ marginLeft: 6 }}>Mieter-Anlage</span>}
                    {a.fuer_steuerberater_geeignet && <span className="badge badge-warn" style={{ marginLeft: 6 }}>StB-Anlage</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!dokumente.length && <p style={{ color: 'var(--ink-soft)' }}>Noch keine Dokumente für dieses Objekt hochgeladen.</p>}
        </div>
      )}
    </div>
  );
}
