import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ObjektDetailPage() {
  const { id } = useParams();
  const [objekt, setObjekt] = useState(null);
  const [mieter, setMieter] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [stammdokumente, setStammdokumente] = useState([]);
  const [neuerMieter, setNeuerMieter] = useState({ vorname: '', nachname: '', einzug_am: '' });
  const [verkaufDatum, setVerkaufDatum] = useState('');

  const ladenAlles = () => {
    api.get(`/objekte/${id}`).then(setObjekt);
    api.get(`/mieter?objekt_id=${id}`).then(setMieter);
    api.get(`/objekte/${id}/fotos`).then(setFotos);
    api.get(`/objekte/${id}/stammdokumente`).then(setStammdokumente);
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

  const objektVerkauft = async () => {
    if (!confirm('Objekt als verkauft markieren und archivieren?')) return;
    await api.delete(`/objekte/${id}`, { verkauft_am: verkaufDatum || null });
    window.location.href = '/';
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
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Stammdaten</h3>
        <p className="mono" style={{ color: 'var(--ink-soft)' }}>
          {objekt.adresse} {objekt.einheit_nr && `· ${objekt.einheit_nr}`}
        </p>
        <table>
          <tbody>
            <tr><td>Kaufpreis</td><td className="mono">{objekt.kaufpreis ?? '–'} €</td></tr>
            <tr><td>Grunderwerbsteuer</td><td className="mono">{objekt.grunderwerbsteuer ?? '–'} €</td></tr>
            <tr><td>Notarkosten</td><td className="mono">{objekt.notarkosten ?? '–'} €</td></tr>
            <tr><td>Eigentumsanteil</td><td>{objekt.eigentuemer_modus === 'gemeinsam' ? `50% (${objekt.miteigentuemer_name})` : '100%'}</td></tr>
            <tr><td>Nebenkostenabrechnung durch</td><td>{objekt.abrechnung_durch === 'nutzer' ? 'mich selbst' : 'Hausverwaltung'}</td></tr>
          </tbody>
        </table>
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

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Mieter</h3>
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
