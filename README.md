# Task-Scheduler Backend

Express-Backend für den Task-Scheduler mit einer MariaDB-Datenbank in Docker.

## Voraussetzungen

* Node.js
* Docker Desktop
* WebStorm oder ein anderer MariaDB-Client

## 1. Abhängigkeiten installieren

```bash
npm install
```

## 2. Umgebungsvariablen erstellen

Unter Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Unter macOS/Linux:

```bash
cp .env.example .env
```

Danach in `.env` eigene Passwörter eintragen:

```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=task_scheduler
DB_USER=task_scheduler_user
DB_PASSWORD=CHANGE_ME
MARIADB_ROOT_PASSWORD=CHANGE_ME
```

Die echte `.env` enthält Passwörter und darf nicht auf GitHub gepusht werden.

## 3. MariaDB starten

Docker Desktop starten und anschließend ausführen:

```bash
docker compose up -d
```

Status kontrollieren:

```bash
docker compose ps
```

Bei `PORTS` sollte Folgendes stehen:

```text
127.0.0.1:3307->3306/tcp
```

## 4. Datenbankschema importieren

In WebStorm eine MariaDB Data Source erstellen:

```text
Host: 127.0.0.1
Port: 3307
User: root
Password: Wert von MARIADB_ROOT_PASSWORD
```

Danach `database/schema.sql` öffnen, das Schema `task_scheduler` auswählen und die gesamte Datei ausführen.

## 5. Entwicklungsdaten importieren

Für eine lokale Entwicklungsumgebung kann anschließend `database/seed.sql`
im gleichen Schema ausgeführt werden. Das Skript legt Beispielbenutzer, ein
Projektteam, Labels, Tasks, Wiederholungen, konkrete Task-Instanzen und
Reminder an.

Das Seed-Skript ist wiederholt ausführbar. Bereits vorhandene Stammdaten werden
aktualisiert und Beispiel-Tasks nicht dupliziert. Die verwendeten
`example.test`-E-Mail-Adressen können keine echten E-Mails empfangen.

## 6. Backend starten

Entwicklungsmodus:

```bash
npm run dev
```

Normaler Start:

```bash
npm start
```

Bei erfolgreicher Verbindung erscheint:

```text
MariaDB-Verbindung erfolgreich.
Server läuft auf Port 3001
```

## 7. Verbindung testen

Im Browser:

```text
http://localhost:3001/health
```

Oder unter PowerShell:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Erwartete Antwort:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## Docker stoppen

```bash
docker compose down
```

Dieser Befehl behält die gespeicherten Daten. `docker compose down -v` löscht dagegen das gesamte lokale Datenbank-Volume.
