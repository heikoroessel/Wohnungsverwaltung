import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function NebenkostenPage() {
  const [objekte, setObjekte] = useState([]);
  const [mieter, setMieter] = useState([]);
  const [objektId, setObjektId] = useState('');
  const [mieterId, setMieterId] = useState('');
  const [jahr, setJahr] = useState(new Date().getFullYear() - 1);
  const [vorauswahl, setVorauswahl] = useState([]);
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set());
  const [gesamtkosten, setGesamtkosten] = useState('');
  const [vorauszahlung, setVorauszahlung] = useState('');
  const [ergebnis, setErgebnis] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => { api.get('/objekte').then(setObjekte); }, []);
  useEffect(() => {
    if (objektId) api.get(`/mieter?objekt_id=${objektId}`).then(setMieter);
  }, [objektId]);

  const objekt = objekte.find((o) => String(o.id) === String(objektId));
  const nichtSelbstAbgerechnet = objekt && objekt.abrechnung_durch !== 'nutzer';

  const vorauswahlLaden = async () => {
    setFehler(null);
    setErgebnis(null);
    try {
      const daten = await api.get(`/nk-abrechnung/vorauswahl?objekt_id=${objektId}&mieter_id=${mieterId}&jahr=${jahr}`);
      setVorauswahl(daten);
      setAusgewaehlt(new Set(daten.filter((d) => d.vorausgewaehlt).map((d) => d.id)));
    } catch (err) { setFehler(err.message); }
  };

  const toggle = (id) => {
    const next = new Set(ausgewaehlt);
    next.has(id) ? next.delete(id) : next.add(id);
    setAusgewaehlt(next);
  };

  const erstellen = async () => {
    setFehler(null);
    try {
      const res = await api.post('/nk-abrechnung/erstellen', {
        objekt_id: objektId, mieter_id: mieterId, jahr,
        ausgewaehlte_abschnitt_ids: Array.from(ausgewaehlt),
        gesamtkosten: Number(gesamtkosten) || 0,
        vorauszahlung_gesamt: Number(vorauszahlung) || 0,
      });
      setErgebnis(res);
    } catch (err) { setFehler(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="app-title-eyebrow">Output 1</span>
          <h2>Nebenkostenabrechnung</h2>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <div className="field">
            <label>Objekt</label>
            <select value={objektId} onChange={(e) => { setObjektId(e.target.value); setMieterId(''); }}>
              <option value="">– wählen –</option>
              {objekte.map((o) => <option key={o.id} value={o.id}>{o.bezeichnung}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Mieter</label>
            <select value={mieterId} onChange={(e) => setMieterId(e.target.value)} disabled={!objektId}>
              <option value="">– wählen –</option>
              {mieter.map((m) => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Abrechnungsjahr</label>
            <input type="number" value={jahr} onChange={(e) => setJahr(e.target.value)} />
          </div>
        </div>

        {nichtSelbstAbgerechnet && (
          <p className="badge badge-warn" style={{ display: 'inline-block' }}>
            Dieses Objekt wird durch die Hausverwaltung selbst abgerechnet – keine eigene Nebenkostenabrechnung nötig.
          </p>
        )}

        {!nichtSelbstAbgerechnet && objektId && mieterId && (
          <button className="btn btn-primary" onClick={vorauswahlLaden} style={{ marginTop: 12 }}>
            Anlagen-Vorauswahl laden
          </button>
        )}
      </div>

      {fehler && <p style={{ color: 'var(--danger)' }}>{fehler}</p>}

      {vorauswahl.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Anlagen auswählen</h3>
          {vorauswahl.map((a) => (
            <label key={a.id} className="checkbox-row">
              <input type="checkbox" checked={ausgewaehlt.has(a.id)} onChange={() => toggle(a.id)} />
              <span>
                <strong>{a.abschnittstyp}</strong> — {a.dateiname} (S. {a.seite_von}–{a.seite_bis})
              </span>
            </label>
          ))}

          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Gesamtkosten (EUR)</label>
              <input type="number" step="0.01" value={gesamtkosten} onChange={(e) => setGesamtkosten(e.target.value)} />
            </div>
            <div className="field">
              <label>Vorauszahlungen gesamt (EUR)</label>
              <input type="number" step="0.01" value={vorauszahlung} onChange={(e) => setVorauszahlung(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={erstellen}>Abrechnung erstellen</button>
        </div>
      )}

      {ergebnis && (
        <div className="card">
          <h3>Fertig</h3>
          <p>Nachzahlung/Erstattung: <span className="mono">{ergebnis.nachzahlung_erstattung} €</span></p>
          <a className="btn btn-primary" href={ergebnis.download_url}>PDF herunterladen</a>
        </div>
      )}
    </div>
  );
}
