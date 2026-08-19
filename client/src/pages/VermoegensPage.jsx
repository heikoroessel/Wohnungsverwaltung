import { useEffect, useState } from 'react';
import { api } from '../api/client';

function fmt(n) {
  return n === null || n === undefined ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

export default function VermoegensPage() {
  const [ansicht, setAnsicht] = useState('objekt');
  const [objektDaten, setObjektDaten] = useState([]);
  const [renditeDaten, setRenditeDaten] = useState([]);
  const [jahr, setJahr] = useState(new Date().getFullYear() - 1);

  useEffect(() => { api.get('/vermoegensreport/objekt-ansicht').then(setObjektDaten); }, []);
  useEffect(() => {
    api.get(`/vermoegensreport/rendite-ansicht?jahr=${jahr}`).then(setRenditeDaten);
  }, [jahr]);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="app-title-eyebrow">Output 3</span>
          <h2>Vermögensreport</h2>
        </div>
        <div className="tab-nav" style={{ borderBottom: 'none' }}>
          <button className={`tab-nav-item ${ansicht === 'objekt' ? 'active' : ''}`} onClick={() => setAnsicht('objekt')}>
            Objekt & Wertsteigerung
          </button>
          <button className={`tab-nav-item ${ansicht === 'rendite' ? 'active' : ''}`} onClick={() => setAnsicht('rendite')}>
            Rendite & Kapitaldienst
          </button>
        </div>
      </div>

      {ansicht === 'objekt' && (
        <table>
          <thead>
            <tr>
              <th>Objekt</th><th>Investition</th><th>Marktwert</th><th>Wertsteigerung</th><th>Vergleichsmiete/m²</th>
            </tr>
          </thead>
          <tbody>
            {objektDaten.map((o) => (
              <tr key={o.objekt_id}>
                <td>{o.bezeichnung}</td>
                <td className="mono">{fmt(o.investition)} €</td>
                <td className="mono">{fmt(o.marktwert_aktuell)} €</td>
                <td className="mono" style={{ color: o.wertsteigerung_absolut >= 0 ? 'var(--verdigris)' : 'var(--danger)' }}>
                  {fmt(o.wertsteigerung_absolut)} € {o.wertsteigerung_relativ_prozent != null && `(${o.wertsteigerung_relativ_prozent.toFixed(1)}%)`}
                </td>
                <td className="mono">{o.vergleichsmiete_pro_qm ?? '–'} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ansicht === 'rendite' && (
        <>
          <div className="field" style={{ maxWidth: 160, marginBottom: 16 }}>
            <label>Jahr</label>
            <input type="number" value={jahr} onChange={(e) => setJahr(e.target.value)} />
          </div>
          <table>
            <thead>
              <tr>
                <th>Objekt</th><th>Investition (Anteil)</th><th>Ist-Miete</th><th>Kosten</th><th>Überschuss</th><th>Rendite</th>
              </tr>
            </thead>
            <tbody>
              {renditeDaten.map((r) => (
                <tr key={r.objekt_id}>
                  <td>{r.bezeichnung}</td>
                  <td className="mono">{fmt(r.investition_anteilig)} €</td>
                  <td className="mono">{fmt(r.ist_mieteinnahmen)} €</td>
                  <td className="mono">{fmt(r.laufende_kosten)} €</td>
                  <td className="mono">{fmt(r.netto_ueberschuss)} €</td>
                  <td className="mono">{r.rendite_prozent != null ? `${r.rendite_prozent.toFixed(1)}%` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
