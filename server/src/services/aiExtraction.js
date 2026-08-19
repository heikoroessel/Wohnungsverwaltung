import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_SYSTEM_PROMPT = `Du analysierst gescannte Dokumente einer Hausverwaltung oder Rechnungen rund um vermietete Wohnungen in Deutschland.

Ein hochgeladenes PDF kann MEHRERE logische Abschnitte enthalten, typischerweise in dieser Reihenfolge:
- jahresabrechnung: Betriebskosten-/Hausgeldabrechnung der WEG-Verwaltung für ein abgelaufenes Jahr (enthält oft eine Tabelle "Ausgaben/Einnahmen" und eine "Entwicklung der Erhaltungsrücklage")
- wirtschaftsplan: Plan für das Folgejahr, mit neuen monatlichen Vorauszahlungen
- versammlungsprotokoll: Einladung oder Protokoll der Eigentümerversammlung mit Tagesordnungspunkten (TOPs)
- sonderumlage: Sonderumlage-Ankündigung/-Abrechnung
- techem: Heiz-/Warm-/Kaltwasserkostenabrechnung der Firma Techem
- domotherm: Heizkosten-/Kaltwasserabrechnung der Firma DomoTherm (oder ähnlicher Messdienstleister)
- handwerkerrechnung: Einzelrechnung eines Handwerkers/Dienstleisters
- sonstiges: alles andere

Deine Aufgabe: Identifiziere jeden Abschnitt im Dokument (mit Seitenbereich), extrahiere die relevanten strukturierten Felder, und antworte AUSSCHLIESSLICH mit validem JSON nach folgendem Schema, ohne Erklärtext:

{
  "jahr_bezug": <int oder null>,
  "abschnitte": [
    {
      "abschnittstyp": "jahresabrechnung" | "wirtschaftsplan" | "versammlungsprotokoll" | "sonderumlage" | "techem" | "domotherm" | "handwerkerrechnung" | "sonstiges",
      "seite_von": <int>,
      "seite_bis": <int>,
      "jahr": <int oder null>,
      "mieter_hinweis": "<Name, falls einem bestimmten Mieter/einer Einheit zuordenbar, sonst null>",
      "fuer_mieter_geeignet": <true/false>,
      "fuer_steuerberater_geeignet": <true/false>,
      "extrahierte_daten": {
        // je nach Typ z.B. für jahresabrechnung:
        // "gesamtkosten": ..., "umlagefaehige_kosten": [...], "nicht_umlagefaehige_kosten": [...],
        // "ruecklage": { "anfangsbestand":..., "zufuehrung":..., "entnahme_material":..., "entnahme_arbeitsleistung":..., "zinsen":..., "endstand":... }
        // für techem/domotherm: "mieter_name":..., "heizkosten":..., "warmwasserkosten":..., "kaltwasserkosten":..., "zaehlerstaende": [...]
        // für handwerkerrechnung: "rechnungssteller":..., "betrag":..., "leistungsbeschreibung":..., "rechnungsdatum":...
        // für versammlungsprotokoll: "tops": [...], "beschluesse_rueckl_relevant": "..."
      }
    }
  ]
}

Regeln:
- fuer_mieter_geeignet = true nur für Abschnitte, die ausschließlich umlagefähige/mieterrelevante Kosten enthalten (z.B. techem, domotherm, die umlagefähigen Zeilen der jahresabrechnung). WEG-interne Details (Rücklage, Verwaltervergütung) sind NICHT für den Mieter geeignet.
- fuer_steuerberater_geeignet = true für jahresabrechnung, sonderumlage, handwerkerrechnung, versammlungsprotokoll (wegen Rücklagen-Zweckbindung).
- Gib nur Seitenbereiche an, die im Dokument tatsächlich vorkommen.
- Wenn du unsicher bist, setze das Feld auf null statt zu raten.`;

/**
 * Analysiert ein hochgeladenes PDF und liefert die erkannten Abschnitte + extrahierten Felder.
 * @param {string} filePath - Pfad zur PDF-Datei
 * @returns {Promise<object>} Geparste JSON-Struktur gemäß EXTRACTION_SYSTEM_PROMPT
 */
export async function extractDocument(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: 'Analysiere dieses Dokument gemäß den Systemanweisungen und antworte nur mit dem JSON-Objekt.',
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  if (!textBlock) throw new Error('Keine Textantwort von der KI erhalten.');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`KI-Antwort konnte nicht als JSON geparst werden: ${err.message}\n${cleaned.slice(0, 500)}`);
  }
}

const KONTOAUSZUG_SYSTEM_PROMPT = `Du analysierst einen vollständigen Bank-Kontoauszug (PDF, CSV-Text oder Excel-Auszug als Text) einer Privatperson, die mehrere Wohnungen vermietet.

Filtere ausschließlich Buchungen heraus, die zu Vermietung/Hausverwaltung gehören:
- Mieteingänge von Mietern (Kaltmiete, Nebenkosten-Vorauszahlung, Nachzahlungen)
- Zahlungen an Hausverwaltungen (Hausgeld, Sonderumlage, Verwaltergebühr)
- Zahlungen an Handwerker/Dienstleister im Kontext der Wohnungen

Ignoriere alle erkennbar privaten Buchungen (Supermarkt, Gehalt, private Abos etc.), es sei denn der Buchungstext lässt eindeutig einen Wohnungsbezug erkennen.

Antworte AUSSCHLIESSLICH mit validem JSON:
{
  "buchungen": [
    {
      "buchungsdatum": "YYYY-MM-DD",
      "betrag": <number, positiv=Eingang negativ=Ausgang>,
      "buchungstext": "...",
      "kategorie": "miete_eingang" | "hausverwaltung" | "handwerker" | "sonstiges",
      "mieter_oder_empfaenger_hinweis": "<Name falls erkennbar, sonst null>"
    }
  ]
}`;

export async function extractKontoBuchungen(filePath, mimeType) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');
  const docType = mimeType === 'application/pdf' ? 'application/pdf' : 'application/pdf'; // Excel wird vorher in Text/CSV konvertiert, siehe route

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: KONTOAUSZUG_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: docType, data: base64 } },
          { type: 'text', text: 'Filtere die relevanten Buchungen gemäß Systemanweisung, antworte nur mit JSON.' },
        ],
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}
