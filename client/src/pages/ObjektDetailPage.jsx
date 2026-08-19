import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

const BEARBEITBARE_FELDER = [
  'bezeichnung','adresse','einheit_nr','kaufdatum','kaufpreis','grunderwerbsteuer',
  'notarkosten','sonstige_anschaffungskosten','eigentuemer_modus','miteigentuemer_name',
  'abrechnung_durch','marktwert_aktuell','vergleichsmiete_pro_qm',
];

export default function ObjektDetailPage() {
  const { id } = useParams();
  const [objekt, setObjekt] = useState(null);
  const [mieter, setMieter] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [stammdokumente, setStammdokumente] = useState([]);
  const [dokumente, setDokumente] = useState([]);
  const [neuerMieter, setNeuerMieter] = useState({ vorname: '', nachname: '', einzug_am: '' });
  const [verkaufDatum, setVerkaufDatum] = useState('');
  const [bearbeitenModus, setBearbeitenModus] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [speicherStatus, setSpeicherStatus] = useState(null);

  const ladenAlles = () => {
    api.get(`/objekte/${id}`).then((o) => { setObjekt(o); setEditForm(o); });
    api.get(`/mieter?objekt_id=${id}`).then(setMieter);
    api.get(`/objekte/${id}/fotos`).then(setFotos);
    api.get(`/objekte/${id}/stammdokumente`).then(setStammdokumente);
    api.get(`/dokumente?objekt_id=${id}`).then(setDokumente);
  };
  useEffect(ladenAlles, [id]);

  const mieterAnlegen = async (e) => {
    e.preventDefault();
    await api.post('/mieter', { ...neuerMieter, objekt_id: id });
    setNeuerMieter({ vorname: '', nachname: '', einzug_am: '' });
    ladenAlles();
  };

  const fotoHochladen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await api.upload(`/objekte/${id}/fotos`, file, { kategorie: 'foto' });
    ladenAlles();
  };

  const renovierungHochladen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await api.upload(`/objekte/${id}/fotos`, file, { kategorie: 'renovierung' });
    ladenAlles();
  };

  const stammdokumentHochladen = async (e, typ) => {
    const file = e.target.files[0];
    if (!file) return;
    await api.upload(`/objekte/${id}/stammdokumente`, file, { dokumenttyp: typ });
    ladenAlles();
  };

  const laufenderInputHochladen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSpeicherStatus('Dokument wird hochgeladen und analysiert…');
    try {
      await api.upload('/dokumente/upload', file, { objekt_id: id });
      setSpeicherStatus('Fertig – Abschnitte erkannt.');
      ladenAlles();
    } catch (err) {
      setSpeicherStatus(`Fehler: ${err.message}`);
    }
  };

  const objektVerkauft = async () => {
    if (!confirm('Objekt als verkauft markieren und archivieren?')) return;
    await api.delete(`/objekte/${id}`, { verkauft_am: verkaufDatum || null });
    window.location.href = '/';
  };

  const speichernBearbeitung = async (e) => {
    e.preventDefault();
    const payload = {};
    BEARBEITBARE_FELDER.forEach((f) => { payload[f] = editForm[f] ?? null; });
    const updated = await api.put(`/objekte/${id}`, payload);
    setObjekt(updated);
    setBearbeitenModus(false);
  };

  if (!objekt) return <p>Lädt…</p>;

  return (
    <div>
      <Link to="/" style={{ fontSize: '0.85rem' }}>← Alle Objekte</Link>
      <div className="page-header">
        <div>
          <span className="app-title-eyebrow">Objektakte</span>
          <h2>{objekt.bezeichnung}</h2>
        </div>
        <button className="btn" onClick={() => setBearbeitenModus((v) => !v)}>
          {bearbeitenModus ? 'Abbrechen' : 'Stammdaten bearbeiten'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Stammdaten</h3>

        {!bearbeitenModus && (
          <>
            <p className="mono" style={{ color: 'var(--ink-soft)' }}>
              {objekt.adresse} {objekt.einheit_nr && `· ${objekt.einheit_nr}`}
            </p>
            <table>
              <tbody>
                <tr><td>Kaufdatum</td><td className="mono">{objekt.kaufdatum?.slice(0,10) ?? '–'}</td></tr>
                <tr><td>Kaufpreis</td><td className="mono">{objekt.kaufpreis ?? '–'} €</td></tr>
                <tr><td>Grunderwerbsteuer</td><td className="mono">{objekt.grunderwerbsteuer ?? '–'} €</td></tr>
                <tr><td>Notarkosten</td><td className="mono">{objekt.notarkosten ?? '–'} €</td></tr>
                <tr><td>Sonstige Anschaffungskosten</td><td className="mono">{objekt.sonstige_anschaffungskosten ?? '–'} €</td></tr>
                <tr><td>Eigentumsanteil</td><td>{objekt.eigentuemer_modus === 'gemeinsam' ? `50% (${objekt.miteigentuemer_name || '–'})` : '100%'}</td></tr>
                <tr><td>Nebenkostenabrechnung durch</td><td>{objekt.abrechnung_durch === 'nutzer' ? 'mich selbst' : 'Hausverwaltung'}</td></tr>
                <tr><td>Marktwert (geschätzt)</td><td className="mono">{objekt.marktwert_aktuell ?? '–'} €</td></tr>
                <tr><td>Vergleichsmiete/m²</td><td className="mono">{objekt.vergleichsmiete_pro_qm ?? '–'} €</td></tr>
              </tbody>
            </table>
          </>
        )}

        {bearbeitenModus && (
          <form onSubmit={speichernBearbeitung}>
            <div className="grid-2">
              <div className="field">
                <label>Bezeichnung</label>
                <input value={editForm.bezeichnung || ''} onChange={(e) => setEditForm({ ...editForm, bezeichnung: e.target.value })} />
              </div>
              <div className="field">
                <label>Adresse</label>
                <input value={editForm.adresse || ''} onChange={(e) => setEditForm({ ...editForm, adresse: e.target.value })} />
              </div>
              <div className="field">
                <label>Einheits-Nr.</label>
                <input value={editForm.einheit_nr || ''} onChange={(e) => setEditForm({ ...editForm, einheit_nr: e.target.value })} />
              </div>
              <div className="field">
                <label>Kaufdatum</label>
                <input type="date" value={editForm.kaufdatum?.slice(0,10) || ''} onChange={(e) => setEditForm({ ...editForm, kaufdatum: e.target.value })} />
              </div>
              <div className="field">
                <label>Kaufpreis (EUR)</label>
                <input type="number" step="0.01" value={editForm.kaufpreis || ''} onChange={(e) => setEditForm({ ...editForm, kaufpreis: e.target.value })} />
              </div>
              <div className="field">
                <label>Grunderwerbsteuer (EUR)</label>
                <input type="number" step="0.01" value={editForm.grunderwerbsteuer || ''} onChange={(e) => setEditForm({ ...editForm, grunderwerbsteuer: e.target.value })} />
              </div>
              <div className="field">
                <label>Notarkosten (EUR)</label>
                <input type="number" step="0.01" value={editForm.notarkosten || ''} onChange={(e) => setEditForm({ ...editForm, notarkosten: e.target.value })} />
              </div>
              <div className="field">
                <label>Sonstige Anschaffungskosten (EUR)</label>
                <input type="number" step="0.01" value={editForm.sonstige_anschaffungskosten || ''} onChange={(e) => setEditForm({ ...editForm, sonstige_anschaffungskosten: e.target.value })} />
              </div>
              <div className="field">
                <label>Eigentumsanteil</label>
                <select value={editForm.eigentuemer_modus} onChange={(e) => setEditForm({ ...editForm, eigentuemer_modus: e.target.value })}>
                  <option value="allein">100% allein</option>
                  <option value="gemeinsam">50/50 gemeinsam</option>
                </select>
              </div>
              {editForm.eigentuemer_modus === 'gemeinsam' && (
                <div className="field">
                  <label>Name Miteigentümer/in</label>
                  <input value={editForm.miteigentuemer_name || ''} onChange={(e) => setEditForm({ ...editForm, miteigentuemer_name: e.target.value })} />
                </div>
              )}
              <div className="field">
                <label>Nebenkostenabrechnung erstellt durch</label>
                <select value={editForm.abrechnung_durch} onChange={(e) => setEditForm({ ...editForm, abrechnung_durch: e.target.value })}>
                  <option value="nutzer">Ich selbst</option>
                  <option value="hausverwaltung">Hausverwaltung</option>
                </select>
              </div>
              <div className="field">
                <label>Marktwert aktuell (EUR)</label>
                <input type="number" step="0.01" value={editForm.marktwert_aktuell || ''} onChange={(e) => setEditForm({ ...editForm, marktwert_aktuell: e.target.value })} />
              </div>
              <div className="field">
                <label>Vergleichsmiete pro m² (EUR)</label>
                <input type="number" step="0.01" value={editForm.vergleichsmiete_pro_qm || ''} onChange={(e) => setEditForm({ ...editForm, vergleichsmiete_pro_qm: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">Änderungen speichern</button>
          </form>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Hochgeladene Dokumente (laufender Input)</h3>
        <label>Neues Dokument hochladen (Jahresabrechnung, Handwerkerrechnung etc.)</label>
        <input type="file" accept="application/pdf" onChange={laufenderInputHochladen} />
        {speicherStatus && <p style={{ fontSize: '0.85rem', marginTop: 6 }}>{speicherStatus}</p>}

        {dokumente.map((d) => (
          <div key={d.id} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{d.dateiname}</strong>
              <span className={`badge ${d.status === 'verarbeitet' ? 'badge-ok' : d.status === 'fehler' ? 'badge-error' : 'badge-warn'}`}>
                {d.status}
              </span>
            </div>
            <ul style={{ paddingLeft: 18, marginTop: 6 }}>
              {(d.abschnitte || []).map((a) => (
                <li key={a.id} style={{ fontSize: '0.85rem' }}>
                  <span className="mono">S. {a.seite_von}–{a.seite_bis}</span> — {a.abschnittstyp}{a.jahr && ` (${a.jahr})`}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!dokumente.length && <p style={{ color: 'var(--ink-soft)' }}>Noch keine Dokumente für dieses Objekt hochgeladen.</p>}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Fotos</h3>
          <input type="file" accept="image/*" onChange={fotoHochladen} />
          <ul style={{ paddingLeft: 18, marginTop: 10 }}>
            {fotos.filter((f) => f.kategorie === 'foto').map((f) => (
              <li key={f.id} style={{ fontSize: '0.85rem' }}>{f.dateiname}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Renovierungen</h3>
          <input type="file" onChange={renovierungHochladen} />
          <ul style={{ paddingLeft: 18, marginTop: 10 }}>
            {fotos.filter((f) => f.kategorie === 'renovierung').map((f) => (
              <li key={f.id} style={{ fontSize: '0.85rem' }}>{f.dateiname}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Offizielle Stammdokumente (Sicherungskopie)</h3>
        <div className="grid-2">
          <div>
            <label>Notarvertrag</label>
            <input type="file" onChange={(e) => stammdokumentHochladen(e, 'notarvertrag')} />
          </div>
          <div>
            <label>Grundsteuerbescheid</label>
            <input type="file" onChange={(e) => stammdokumentHochladen(e, 'grundsteuerbescheid')} />
          </div>
        </div>
        <ul style={{ paddingLeft: 18, marginTop: 10 }}>
          {stammdokumente.map((d) => (
            <li key={d.id} style={{ fontSize: '0.85rem' }}>{d.dokumenttyp}: {d.dateiname}</li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 20, borderColor: 'var(--verdigris)' }}>
        <h3>Mieter anlegen</h3>
        <form onSubmit={mieterAnlegen} className="grid-2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Vorname</label>
            <input value={neuerMieter.vorname} onChange={(e) => setNeuerMieter({ ...neuerMieter, vorname: e.target.value })} />
          </div>
          <div className="field">
            <label>Nachname</label>
            <input required value={neuerMieter.nachname} onChange={(e) => setNeuerMieter({ ...neuerMieter, nachname: e.target.value })} />
          </div>
          <div className="field">
            <label>Einzug am</label>
            <input type="date" value={neuerMieter.einzug_am} onChange={(e) => setNeuerMieter({ ...neuerMieter, einzug_am: e.target.value })} />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn btn-primary" type="submit">Mieter anlegen</button>
          </div>
        </form>
        <table>
          <thead><tr><th>Name</th><th>Einzug</th><th>Miete</th><th>NK-VZ</th><th></th></tr></thead>
          <tbody>
            {mieter.map((m) => (
              <tr key={m.id}>
                <td>{m.vorname} {m.nachname}</td>
                <td className="mono">{m.einzug_am?.slice(0,10) || '–'}</td>
                <td className="mono">{m.aktuelle_miete ?? '–'} €</td>
                <td className="mono">{m.aktuelle_nk_vorauszahlung ?? '–'} €</td>
                <td><Link to={`/mieter/${m.id}`}>Öffnen →</Link></td>
              </tr>
            ))}
            {!mieter.length && (
              <tr><td colSpan={5} style={{ color: 'var(--ink-soft)' }}>Noch kein Mieter für dieses Objekt angelegt.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Objekt verkaufen / archivieren</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Verkaufsdatum</label>
            <input type="date" value={verkaufDatum} onChange={(e) => setVerkaufDatum(e.target.value)} />
          </div>
          <button className="btn btn-danger" onClick={objektVerkauft}>Als verkauft markieren</button>
        </div>
      </div>
    </div>
  );
}
