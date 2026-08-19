import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function SteuerberichtPage() {
  const [jahr, setJahr] = useState(new Date().getFullYear() - 1);
  const [vorschlag, setVorschlag] = useState([]);
  const [ausgewaehlteObjekte, setAusgewaehlteObjekte] = useState(new Set());
  const [ergebnis, setErgebnis] = useState(null);
  const [fehler, setFehler] = useState(null);

  const laden = async () => {
    setFehler(null);
    try {
      const daten = await api.get(`/steuer-report/vorauswahl?jahr=${jahr}`);
      setVorschlag(daten);
      setAusgewaehlteObjekte(new Set(daten.map((d) => d.objekt.id)));
    } catch (err) { setFehler(err.message); }
  };
  useEffect(() => { laden(); }, []);

  const toggle = (id) => {
    const next = new Set(ausgewaehlteObjekte);
    next.has(id) ? next.delete(id) : next.add(id);
    setAusgewaehlteObjekte(next);
  };

  const erstellen = async () => {
    setFehler(null);
    try {
      const res = await api.post('/steuer-report/erstellen', {
        jahr, objekt_ids: Array.from(ausgewaehlteObjekte),
      });
      setErgebnis(res);
    } catch (err) { setFehler(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="app-title-eyebrow">Output 2</span>
          <h2>Steuerbericht</h2>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <div className="field">
            <label>Jahr</label>
            <input type="number" value={jahr} onChange={(e) => setJahr(e.target.value)} />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn" onClick={laden}>Vorschläge neu laden</button>
          </div>
        </div>
      </div>

      {fehler && <p style={{ color: 'var(--danger)' }}>{fehler}</p>}

      {vorschlag.map(({ objekt, vorgeschlagene_anlagen }) => (
        <div className="card" key={objekt.id} style={{ marginBottom: 14 }}>
          <label className="checkbox-row" style={{ borderBottom: 'none' }}>
            <input type="checkbox" checked={ausgewaehlteObjekte.has(objekt.id)} onChange={() => toggle(objekt.id)} />
            <strong>{objekt.bezeichnung}</strong>
          </label>
          <ul style={{ paddingLeft: 40, marginTop: 6 }}>
            {vorgeschlagene_anlagen.map((a) => (
              <li key={a.id} style={{ fontSize: '0.85rem' }}>{a.abschnittstyp} — {a.dateiname} (S. {a.seite_von}–{a.seite_bis})</li>
            ))}
            {!vorgeschlagene_anlagen.length && (
              <li style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>Keine steuerrelevanten Anlagen für {jahr} gefunden.</li>
            )}
          </ul>
        </div>
      ))}

      {vorschlag.length > 0 && (
        <button className="btn btn-primary" onClick={erstellen}>Excel-Steuerbericht erstellen</button>
      )}

      {ergebnis && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Fertig</h3>
          <a className="btn btn-primary" href={ergebnis.download_url}>Excel herunterladen</a>
        </div>
      )}
    </div>
  );
}
