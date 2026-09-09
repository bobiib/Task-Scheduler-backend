# Environment Variables – Task Scheduler

## 1. `.env.example` kopieren

Im Backend-Projekt:

```bash
cp .env.example .env
```

Unter Windows kann die Datei auch einfach kopiert und in `.env` umbenannt werden.

## 2. Eigene Werte in `.env` eintragen

Beispiel:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=task_scheduler
DB_USER=task_scheduler_user
DB_PASSWORD=dein_passwort
```

Die echte `.env` darf nicht auf GitHub gepusht werden.

## 3. dotenv installieren

```bash
npm install dotenv
```

## 4. Im Express-Backend laden

CommonJS:

```js
require("dotenv").config();
```

oder bei ES Modules:

```js
import "dotenv/config";
```

Danach können die Variablen verwendet werden:

```js
const port = process.env.PORT;
const dbHost = process.env.DB_HOST;
```