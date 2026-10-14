# Testnachweis – Datenbankrelationen und Constraints

- Issue: #18 – Test database relations and constraints
- Datum: 14.10.2026
- Umgebung: lokale MariaDB in Docker, bestehendes `database/schema.sql`

Ergebnis: **58 von 58 Prüfungen bestanden**

## Testumfang

| Bereich | Prüfungen | Ergebnis |
| --- | ---: | --- |
| Gültige Task-Label-Beziehung | 1 | Bestanden |
| Alle 15 Fremdschlüssel, einschliesslich Task-Zuordnung von Reminder-Zustellungen | 15 | Bestanden |
| Doppelte Stammdaten und Beziehungen | 10 | Bestanden |
| Alle 16 CHECK-Regeln | 16 | Bestanden |
| Löschverhalten und Erhaltung anderer Tasks | 14 | Bestanden |
| Entfernung der Testdaten durch Rollback | 2 | Bestanden |
| **Gesamt** | **58** | **Bestanden** |

Die Fehlertests erwarten folgende MariaDB-Fehlernummern:

- `1452`: Der referenzierte Datensatz fehlt oder gehört zum falschen Task.
- `1062`: Ein eindeutiger Wert oder eine Beziehung ist bereits vorhanden.
- `4025`: Eine CHECK-Regel wurde verletzt.
- `1451`: Ein benötigter Ersteller kann wegen RESTRICT nicht gelöscht werden.

Das Löschen eines Tasks entfernt seine Label-Verknüpfungen, Wiederholung,
Wochentage, Instanzen, Reminder und Zustellungen. Andere Tasks bleiben erhalten.
Das Löschen eines zugewiesenen Users oder Teams setzt die betreffende Zuweisung
auf NULL. Mitgliedschaften und die getesteten Zustellungs-/Label-Verknüpfungen
werden entsprechend ihren Fremdschlüsseln entfernt.

## Test ausführen

Im Backend-Ordner mit ausgefüllter `.env` und laufender MariaDB:

```bash
npm run test:db
```

Alternativ direkt:

```bash
node tests/database-relations.js
```

Das Skript verwendet die bereits installierten Pakete `dotenv` und `mariadb`
sowie das mit Node gelieferte `assert`. Zusätzliche Pakete sind nicht nötig.
Bei einem Fehler beendet es sich mit einem Fehlerstatus.

## Erklärung des Ablaufs

1. Eine Transaktion starten und eigene Testdaten anlegen.
2. Gültige Beziehungen prüfen und absichtlich ungültige SQL-Befehle ausführen.
3. Prüfen, ob MariaDB jeweils den erwarteten Fehler liefert.
4. Nur die eigenen Testdatensätze löschen und das Löschverhalten prüfen.
5. Mit ROLLBACK alle Teständerungen verwerfen.

Das Skript prüft zuerst, dass die Tabellen InnoDB verwenden und die
Fremdschlüssel-/CHECK-Prüfungen aktiv sind. Es verwendet keine bestehenden
Seed- oder Benutzer-Datensätze für Änderungen und führt keine Schemaänderungen
aus. Auch bei einem fehlgeschlagenen Test wird die Transaktion zurückgerollt.
AUTO_INCREMENT-Zähler werden von MariaDB nicht zurückgerollt; dadurch können
Lücken in den vergebenen IDs entstehen.

Dieser Nachweis betrifft die Datenbankregeln. Frontend- und API-Tests sind
separate Prüfungen.
