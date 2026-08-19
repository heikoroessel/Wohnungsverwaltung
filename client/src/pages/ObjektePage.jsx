import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const LEER = {
  bezeichnung: '', adresse: '', einheit_nr: '', kaufdatum: '', kaufpreis: '',
  grunderwerbsteuer: '', notarkosten: '', sonstige_anschaffungskosten: '',
  eigentuemer_modus: 'allein', miteigentuemer_name: '', abrechnung_durch: 'nutzer',
};

export default function ObjektePage() {
  const [objekte, setObjekte] = useState([]);
  const [form, setForm] = useState(LEER);
  const [zeigeFormular, setZeigeFormular] = useState(false);
  const [fehler, setFehler] = useState(null);

  const laden = () => api.get('/objekte').then(setObjekte).catch((e) => setFehler(e.message));
  useEffect(() => { laden(); }, []);

  const anlegen = async (e) => {
    e.preventDefault();
    setFehler(null);
    try {
      await api.post('/objekte', form);
      setForm(LEER);
      setZeigeFormular(false);
      laden();
    } catch (err) { setFehler(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="app-title-eyebrow">Stammdaten</span>
          <h2>Objekte</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setZeigeFormular((v) => !v)}>
          {zeigeFormular ? 'Abbrechen' : '+ Objekt anlegen'}
        </button>
      </div>

      {fehler && <p style={{ color: 'var(--danger)' }}>{fehler}</p>}

      {zeigeFormular && (
        <form className="card" onSubmit={anlegen} style={{ marginBottom: 24 }}>
          <div className="grid-2">
            <div className="field">
              <label>Bezeichnung</label>
              <input required value={form.bezeichnung}
                onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })} />
            </div>
            <div className="field">
              <label>Adresse</label>
              <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </div>
            <div className="field">
              <label>Einheits-Nr.</label>
              <input value={form.einheit_nr} onChange={(e) => setForm({ ...form, einheit_nr: e.target.value })} />
            </div>
            <div className="field">
              <label>Kaufdatum</label>
              <input type="date" value={form.kaufdatum} onChange={(e) => setForm({ ...form, kaufdatum: e.target.value })} />
            </div>
            <div className="field">
              <label>Kaufpreis (EUR)</label>
              <input type="number" step="0.01" value={form.kaufpreis}
                onChange={(e) => setForm({ ...form, kaufpreis: e.target.value })} />
            </div>
            <div className="field">
              <label>Grunderwerbsteuer (EUR)</label>
              <input type="number" step="0.01" value={form.grunderwerbsteuer}
                onChange={(e) => setForm({ ...form, grunderwerbsteuer: e.target.value })} />
            </div>
            <div className="field">
              <label>Notarkosten (EUR)</label>
              <input type="number" step="0.01" value={form.notarkosten}
                onChange={(e) => setForm({ ...form, notarkosten: e.target.value })} />
            </div>
            <div className="field">
              <label>Sonstige Anschaffungskosten (EUR)</label>
              <input type="number" step="0.01" value={form.sonstige_anschaffungskosten}
                onChange={(e) => setForm({ ...form, sonstige_anschaffungskosten: e.target.value })} />
            </div>
            <div className="field">
              <label>Eigentumsanteil</label>
              <select value={form.eigentuemer_modus}
                onChange={(e) => setForm({ ...form, eigentuemer_modus: e.target.value })}>
                <option value="allein">100% allein</option>
                <option value="gemeinsam">50/50 gemeinsam</option>
              </select>
            </div>
            {form.eigentuemer_modus === 'gemeinsam' && (
              <div className="field">
                <label>Name Miteigentümer/in</label>
                <input value={form.miteigentuemer_name}
                  onChange={(e) => setForm({ ...form, miteigentuemer_name: e.target.value })} />
              </div>
            )}
            <div className="field">
              <label>Nebenkostenabrechnung erstellt durch</label>
              <select value={form.abrechnung_durch}
                onChange={(e) => setForm({ ...form, abrechnung_durch: e.target.value })}>
                <option value="nutzer">Ich selbst (über diese Software)</option>
                <option value="hausverwaltung">Hausverwaltung (nur Kenntnisnahme)</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Objekt speichern</button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Bezeichnung</th><th>Adresse</th><th>Eigentum</th><th>Abrechnung</th><th></th>
          </tr>
        </thead>
        <tbody>
          {objekte.map((o) => (
            <tr key={o.id}>
              <td>{o.bezeichnung}</td>
              <td>{o.adresse}</td>
              <td>{o.eigentuemer_modus === 'gemeinsam' ? `50% (${o.miteigentuemer_name || 'gemeinsam'})` : '100%'}</td>
              <td>
                <span className={`badge ${o.abrechnung_durch === 'nutzer' ? 'badge-ok' : 'badge-warn'}`}>
                  {o.abrechnung_durch === 'nutzer' ? 'selbst' : 'Hausverwaltung'}
                </span>
              </td>
              <td><Link to={`/objekte/${o.id}`}>Öffnen →</Link></td>
            </tr>
          ))}
          {!objekte.length && (
            <tr><td colSpan={5} style={{ color: 'var(--ink-soft)' }}>Noch keine Objekte angelegt.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
