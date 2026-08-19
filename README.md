# Wohnungen Report Software

Neues, eigenständiges Projekt (unabhängig von der bisherigen "Wohnungsverwaltung"-App).
Verarbeitet Objekt-Rohdaten zu drei Outputs:

1. **Nebenkostenabrechnung** für Mieter (nur für Objekte mit `abrechnung_durch = 'nutzer'`)
2. **Steuerbericht** als Excel-Datei, ein Tab pro Objekt
3. **Vermögensreport** mit zwei Ansichten (Objekt/Wertsteigerung, Rendite/Kapitaldienst)

## Architektur

- **Backend:** Node.js/Express, PostgreSQL, Datei-Uploads via Multer, KI-Extraktion via Anthropic API (Claude liest PDFs, erkennt Dokumentabschnitte automatisch: Jahresabrechnung, Wirtschaftsplan, Sonderumlage, Versammlungsprotokoll, Techem/DomoTherm, Handwerkerrechnung)
- **Frontend:** React/Vite, eigenes Design-Token-System ("Aktenregister" – Karteikarten-Navigation, Ledger-Tabellen)
- **Deployment:** ein Docker-Service auf Railway, Multi-Stage-Build (Frontend wird gebaut und vom Express-Server mitausgeliefert) – gleiches Muster wie SBL-Tool und SIPREMA-CRM

## Railway-Setup

1. Repo auf GitHub anlegen, dieses Projekt pushen
2. In Railway: New Project → Deploy from GitHub Repo
3. **Root Directory leer lassen** (Dockerfile liegt im Repo-Root)
4. Umgebungsvariablen setzen:
   - `DATABASE_URL` (Railway PostgreSQL-Plugin hinzufügen, wird automatisch injiziert)
   - `ANTHROPIC_API_KEY`
   - `PORT=8080`
   - `CLIENT_ORIGIN=https://<deine-railway-domain>`
   - `UPLOAD_DIR=/data/uploads` und `OUTPUT_DIR=/data/outputs` (Volume empfohlen, siehe unten)
5. **Persistenter Speicher:** Für Uploads/Outputs unbedingt ein Railway Volume auf `/data` mounten, sonst gehen Dateien beim Redeploy verloren.
6. Deploy auslösen – Schema wird beim ersten Start automatisch angewendet (idempotent).

## Lokale Entwicklung

```bash
# Backend
cd server && npm install
DATABASE_URL=postgres://... ANTHROPIC_API_KEY=... npm start

# Frontend (separates Terminal)
cd client && npm install
npm run dev
```

## Nächste Ausbauschritte (bewusst noch nicht umgesetzt)

- Historischer Bestandsimport für 2024/2025 als eigener Bulk-Upload-Flow
- Login/Berechtigungen (aktuell keine Authentifizierung – vor Produktivbetrieb ergänzen)
- Automatischer PDF-Seiten-Vorschau in der Vorauswahl-GUI (aktuell nur Seitenzahlen-Anzeige)
- E-Mail-Reminder statt nur In-App-Hinweis
