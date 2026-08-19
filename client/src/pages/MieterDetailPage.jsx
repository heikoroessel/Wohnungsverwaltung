import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function MieterDetailPage() {
  const { id } = useParams();
  const [dokumente, setDokumente] = useState([]);
  const [zaehler, setZaehler] = useState([]);
  const [aenderungen, setAenderungen] = useState([]);
  const [neuerZaehler, setNeuerZaehler] = useState({ zaehlerart: 'heizung', zaehlernummer: '', stand: '', datum: '' });
  const [neueAenderung, setNeueAenderung] = useState({ typ: 'miete', neuer_betrag: '', gueltig_ab: '' });
  const [abgleichWert, setAbgleichWert] = useState({});

  const laden = () => {
    api.get(`/mieter/${id}/dokumente`).then(setDokumente);
    api.get(`/mieter/${id}/zaehlerstaende`).then(setZaehler);
    api.get(`/mieter/${id}/aenderungen`).then(setAenderungen);
  };
  useEffect(laden, [id]);

  const dokUpload = async (e, typ) => {
    const file = e.target.files[0];
    if (!file) return;
    await api.upload(`/mieter/${id}/dokumente`, file, { dokumenttyp: typ });
    laden();
  };

  const zaehlerAnlegen = async (e) => {
    e.preventDefault();
    await api.post(`/mieter/${id}/zaehlerstaende`, neuerZaehler);
    setNeuerZaehler({ zaehlerart: 'heizung', zaehlernummer: '', stand: '', datum: '' });
    laden();
  };

  const abgleichen = async (zaehlerId) => {
    const wert = abgleichWert[zaehlerId];
    if (!wert) return;
    await api.post(`/mieter/${id}/zaehlerstaende/${zaehlerId}/abgleichen`, { techem_domotherm_startwert: wert });
    laden();
  };

  const aenderungAnlegen = async (e) => {
    e.preventDefault();
    await api.post(`/mieter/${id}/aenderungen`, neueAenderung);
    setNeueAenderung({ typ: 'miete', neuer_betrag: '', gueltig_ab: '' });
    laden();
  };

  return (
    <div>
      <Link to="/" style={{ fontSize: '0.85rem' }}>← Alle Objekte</Link>
      <div className="page-header">
        <div>
          <span className="app-title-eyebrow">Mieterakte</span>
          <h2>Mieter #{id}</h2>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Mietvertrag & Übergabeprotokoll</h3>
        <div className="grid-2">
          <div>
            <label>Mietvertrag hochladen</label>
            <input type="file" onChange={(e) => dokUpload(e, 'mietvertrag')} />
          </div>
          <div>
            <label>Übergabeprotokoll hochladen</label>
            <input type="file" onChange={(e) => dokUpload(e, 'uebergabeprotokoll')} />
          </div>
        </div>
        <ul style={{ paddingLeft: 18, marginTop: 10 }}>
          {dokumente.map((d) => <li key={d.id} style={{ fontSize: '0.85rem' }}>{d.dokumenttyp}: {d.dateiname}</li>)}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Zählerstände bei Übergabe</h3>
        <form onSubmit={zaehlerAnlegen} className="grid-2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Zählerart</label>
            <select value={neuerZaehler.zaehlerart} onChange={(e) => setNeuerZaehler({ ...neuerZaehler, zaehlerart: e.target.value })}>
              <option value="heizung">Heizung</option>
              <option value="warmwasser">Warmwasser</option>
              <option value="kaltwasser">Kaltwasser</option>
              <option value="strom">Strom</option>
            </select>
          </div>
          <div className="field">
            <label>Zählernummer</label>
            <input value={neuerZaehler.zaehlernummer} onChange={(e) => setNeuerZaehler({ ...neuerZaehler, zaehlernummer: e.target.value })} />
          </div>
          <div className="field">
            <label>Stand</label>
            <input type="number" step="0.001" value={neuerZaehler.stand} onChange={(e) => setNeuerZaehler({ ...neuerZaehler, stand: e.target.value })} />
          </div>
          <div className="field">
            <label>Datum</label>
            <input type="date" value={neuerZaehler.datum} onChange={(e) => setNeuerZaehler({ ...neuerZaehler, datum: e.target.value })} />
          </div>
          <button className="btn btn-primary" type="submit">Zählerstand erfassen</button>
        </form>

        <table>
          <thead><tr><th>Art</th><th>Stand</th><th>Datum</th><th>Abgleich</th></tr></thead>
          <tbody>
            {zaehler.map((z) => (
              <tr key={z.id}>
                <td>{z.zaehlerart}</td>
                <td className="mono">{z.stand}</td>
                <td className="mono">{z.datum?.slice(0,10)}</td>
                <td>
                  {z.abgeglichen ? (
                    <span className={`badge ${z.abgleich_ergebnis === 'uebereinstimmend' ? 'badge-ok' : 'badge-error'}`}>
                      {z.abgleich_ergebnis}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input placeholder="Techem-Startwert" style={{ width: 120 }}
                        onChange={(e) => setAbgleichWert({ ...abgleichWert, [z.id]: e.target.value })} />
                      <button className="btn" onClick={() => abgleichen(z.id)}>Abgleichen</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Mieterhöhung / NK-Vorauszahlungsanpassung</h3>
        <form onSubmit={aenderungAnlegen} className="grid-2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Typ</label>
            <select value={neueAenderung.typ} onChange={(e) => setNeueAenderung({ ...neueAenderung, typ: e.target.value })}>
              <option value="miete">Miete</option>
              <option value="nk_vorauszahlung">NK-Vorauszahlung</option>
            </select>
          </div>
          <div className="field">
            <label>Neuer Betrag (EUR)</label>
            <input type="number" step="0.01" value={neueAenderung.neuer_betrag}
              onChange={(e) => setNeueAenderung({ ...neueAenderung, neuer_betrag: e.target.value })} />
          </div>
          <div className="field">
            <label>Gültig ab</label>
            <input type="date" value={neueAenderung.gueltig_ab}
              onChange={(e) => setNeueAenderung({ ...neueAenderung, gueltig_ab: e.target.value })} />
          </div>
          <button className="btn btn-primary" type="submit">Änderung speichern</button>
        </form>
        <table>
          <thead><tr><th>Typ</th><th>Neuer Betrag</th><th>Gültig ab</th><th>Konto bestätigt</th></tr></thead>
          <tbody>
            {aenderungen.map((a) => (
              <tr key={a.id}>
                <td>{a.typ}</td>
                <td className="mono">{a.neuer_betrag} €</td>
                <td className="mono">{a.gueltig_ab?.slice(0,10)}</td>
                <td>{a.im_konto_bestaetigt
                  ? <span className="badge badge-ok">ja</span>
                  : <span className="badge badge-warn">noch offen</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
