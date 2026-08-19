-- Wohnungen Report Software – Schema
-- Wird beim Serverstart automatisch angewendet (idempotent, IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS objekte (
  id SERIAL PRIMARY KEY,
  bezeichnung TEXT NOT NULL,
  adresse TEXT,
  einheit_nr TEXT,
  kaufdatum DATE,
  kaufpreis NUMERIC(12,2),
  grunderwerbsteuer NUMERIC(12,2),
  notarkosten NUMERIC(12,2),
  sonstige_anschaffungskosten NUMERIC(12,2),
  -- Eigentumsanteil: 'allein' oder 'gemeinsam' (dann je 50%)
  eigentuemer_modus TEXT NOT NULL DEFAULT 'allein' CHECK (eigentuemer_modus IN ('allein','gemeinsam')),
  miteigentuemer_name TEXT, -- z.B. "Ines Rössel", nur relevant wenn gemeinsam
  -- steuert ob NK-Abrechnung selbst erstellt wird oder durch Hausverwaltung erfolgt
  abrechnung_durch TEXT NOT NULL DEFAULT 'nutzer' CHECK (abrechnung_durch IN ('nutzer','hausverwaltung')),
  marktwert_aktuell NUMERIC(12,2),
  marktwert_notiz TEXT,
  vergleichsmiete_pro_qm NUMERIC(8,2),
  vergleichsmiete_notiz TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true, -- false = verkauft/archiviert
  verkauft_am DATE,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS objekt_fotos (
  id SERIAL PRIMARY KEY,
  objekt_id INTEGER NOT NULL REFERENCES objekte(id) ON DELETE CASCADE,
  dateiname TEXT NOT NULL,
  speicherpfad TEXT NOT NULL,
  beschriftung TEXT,
  kategorie TEXT DEFAULT 'foto' CHECK (kategorie IN ('foto','renovierung')),
  aufgenommen_am DATE,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Offizielle Stammdaten-Dokumente (Notarvertrag, Grundsteuerbescheid etc.) – einmalige Sicherungskopie
CREATE TABLE IF NOT EXISTS objekt_stammdokumente (
  id SERIAL PRIMARY KEY,
  objekt_id INTEGER NOT NULL REFERENCES objekte(id) ON DELETE CASCADE,
  dateiname TEXT NOT NULL,
  speicherpfad TEXT NOT NULL,
  dokumenttyp TEXT, -- 'notarvertrag' | 'grundsteuerbescheid' | 'sonstiges'
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mieter (
  id SERIAL PRIMARY KEY,
  objekt_id INTEGER NOT NULL REFERENCES objekte(id) ON DELETE CASCADE,
  vorname TEXT,
  nachname TEXT NOT NULL,
  einzug_am DATE,
  auszug_am DATE,
  aktuelle_miete NUMERIC(10,2),
  aktuelle_nk_vorauszahlung NUMERIC(10,2),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mietvertrag_dokumente (
  id SERIAL PRIMARY KEY,
  mieter_id INTEGER NOT NULL REFERENCES mieter(id) ON DELETE CASCADE,
  dateiname TEXT NOT NULL,
  speicherpfad TEXT NOT NULL,
  dokumenttyp TEXT, -- 'mietvertrag' | 'uebergabeprotokoll'
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zählerstände aus dem Übergabe-/Übernahmeprotokoll, zum späteren Abgleich mit Techem/DomoTherm
CREATE TABLE IF NOT EXISTS zaehlerstaende_uebergabe (
  id SERIAL PRIMARY KEY,
  mieter_id INTEGER NOT NULL REFERENCES mieter(id) ON DELETE CASCADE,
  zaehlerart TEXT NOT NULL, -- 'heizung' | 'warmwasser' | 'kaltwasser' | 'strom'
  zaehlernummer TEXT,
  stand NUMERIC(12,3) NOT NULL,
  datum DATE NOT NULL,
  abgeglichen BOOLEAN NOT NULL DEFAULT false,
  abgleich_ergebnis TEXT, -- 'uebereinstimmend' | 'abweichung' | null
  abgleich_notiz TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mieterhöhungen / NK-Vorauszahlungsanpassungen mit Stichdatum
CREATE TABLE IF NOT EXISTS miet_aenderungen (
  id SERIAL PRIMARY KEY,
  mieter_id INTEGER NOT NULL REFERENCES mieter(id) ON DELETE CASCADE,
  typ TEXT NOT NULL CHECK (typ IN ('miete','nk_vorauszahlung')),
  alter_betrag NUMERIC(10,2),
  neuer_betrag NUMERIC(10,2) NOT NULL,
  gueltig_ab DATE NOT NULL,
  ausgeloest_von_abrechnung_id INTEGER, -- FK auf nk_abrechnungen, siehe unten
  im_konto_bestaetigt BOOLEAN NOT NULL DEFAULT false,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Der Rohupload: das jährliche Sammeldokument oder Einzelbelege (Handwerker etc.)
CREATE TABLE IF NOT EXISTS dokumente (
  id SERIAL PRIMARY KEY,
  objekt_id INTEGER NOT NULL REFERENCES objekte(id) ON DELETE CASCADE,
  dateiname TEXT NOT NULL,
  speicherpfad TEXT NOT NULL,
  jahr INTEGER, -- Bezugsjahr, von KI erkannt oder manuell korrigiert
  status TEXT NOT NULL DEFAULT 'hochgeladen' CHECK (status IN ('hochgeladen','verarbeitet','fehler')),
  ki_rohantwort JSONB, -- vollständige KI-Analyse zur Nachvollziehbarkeit
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Von der KI aus einem Dokument identifizierte Teilabschnitte (Seiten-Ranges)
-- z.B. ein Sammel-PDF zerfällt in: jahresabrechnung, wirtschaftsplan, versammlungsprotokoll, techem, domotherm, sonderumlage, handwerkerrechnung
CREATE TABLE IF NOT EXISTS dokument_abschnitte (
  id SERIAL PRIMARY KEY,
  dokument_id INTEGER NOT NULL REFERENCES dokumente(id) ON DELETE CASCADE,
  abschnittstyp TEXT NOT NULL, -- 'jahresabrechnung' | 'wirtschaftsplan' | 'versammlungsprotokoll' | 'techem' | 'domotherm' | 'sonderumlage' | 'handwerkerrechnung' | 'sonstiges'
  seite_von INTEGER,
  seite_bis INTEGER,
  mieter_id INTEGER REFERENCES mieter(id), -- falls Abschnitt einem bestimmten Mieter zuordenbar (z.B. Techem-Einzelabrechnung)
  jahr INTEGER,
  fuer_mieter_geeignet BOOLEAN NOT NULL DEFAULT false, -- KI-Vorschlag: als Anlage an Mieter geeignet?
  fuer_steuerberater_geeignet BOOLEAN NOT NULL DEFAULT false, -- KI-Vorschlag: als Anlage an StB geeignet?
  extrahierte_daten JSONB, -- strukturierte Felder je nach Typ
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entwicklung der Erhaltungsrücklage pro Objekt und Jahr (aus Jahresabrechnung extrahiert)
CREATE TABLE IF NOT EXISTS ruecklagen_bewegungen (
  id SERIAL PRIMARY KEY,
  objekt_id INTEGER NOT NULL REFERENCES objekte(id) ON DELETE CASCADE,
  jahr INTEGER NOT NULL,
  anfangsbestand NUMERIC(12,2),
  zufuehrung NUMERIC(12,2),
  entnahme_material NUMERIC(12,2),
  entnahme_arbeitsleistung NUMERIC(12,2),
  zinsen NUMERIC(12,2),
  endstand NUMERIC(12,2),
  -- Zweck der Entnahme, falls aus Versammlungsprotokoll ableitbar
  entnahme_zweck TEXT,
  entnahme_klassifikation TEXT CHECK (entnahme_klassifikation IN ('erhaltungsaufwand','anschaffungsnahe_herstellungskosten','unklar', NULL)),
  quelle_dokument_abschnitt_id INTEGER REFERENCES dokument_abschnitte(id),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(objekt_id, jahr)
);

-- Kontobewegungen, aus vollem Kontoauszug-Upload durch KI gefiltert
CREATE TABLE IF NOT EXISTS konto_buchungen (
  id SERIAL PRIMARY KEY,
  objekt_id INTEGER NOT NULL REFERENCES objekte(id) ON DELETE CASCADE,
  dokument_id INTEGER REFERENCES dokumente(id),
  buchungsdatum DATE NOT NULL,
  betrag NUMERIC(12,2) NOT NULL, -- positiv = Eingang (Miete), negativ = Ausgang
  buchungstext TEXT,
  kategorie TEXT, -- 'miete_eingang' | 'hausverwaltung' | 'handwerker' | 'sonstiges'
  mieter_id INTEGER REFERENCES mieter(id),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Erzeugte Nebenkostenabrechnungen (Output 1) – Protokoll, welche Anlagen gewählt wurden
CREATE TABLE IF NOT EXISTS nk_abrechnungen (
  id SERIAL PRIMARY KEY,
  objekt_id INTEGER NOT NULL REFERENCES objekte(id) ON DELETE CASCADE,
  mieter_id INTEGER NOT NULL REFERENCES mieter(id) ON DELETE CASCADE,
  jahr INTEGER NOT NULL,
  gesamtkosten NUMERIC(12,2),
  vorauszahlung_gesamt NUMERIC(12,2),
  nachzahlung_erstattung NUMERIC(12,2), -- positiv = Nachzahlung des Mieters, negativ = Erstattung
  ausgewaehlte_abschnitt_ids INTEGER[], -- welche dokument_abschnitte final als Anlage gewählt wurden
  pdf_speicherpfad TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mieter_id, jahr)
);

-- Erzeugte Steuerberater-Exports (Output 2)
CREATE TABLE IF NOT EXISTS steuerberater_exports (
  id SERIAL PRIMARY KEY,
  jahr INTEGER NOT NULL,
  objekt_ids INTEGER[] NOT NULL,
  excel_speicherpfad TEXT,
  anlagen_speicherpfad TEXT, -- Ordner/Zip mit gewählten Anlagen
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dokumente_objekt ON dokumente(objekt_id);
CREATE INDEX IF NOT EXISTS idx_abschnitte_dokument ON dokument_abschnitte(dokument_id);
CREATE INDEX IF NOT EXISTS idx_konto_objekt ON konto_buchungen(objekt_id);
CREATE INDEX IF NOT EXISTS idx_mieter_objekt ON mieter(objekt_id);
