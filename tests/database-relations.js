require("dotenv").config({ quiet: true });
const mariadb = require("mariadb");
const assert = require("node:assert/strict");

// Issue #18: Nur eigene Testdaten verwenden und am Ende alles zurückrollen.
async function main() {
    let connection;
    let transactionStarted = false;
    let passed = 0;
    const name = `dbtest_${Date.now()}`;

    async function insert(sql, parameters = []) {
        const result = await connection.query(sql, parameters);
        return Number(result.insertId);
    }

    // Ein ungültiger SQL-Befehl muss genau den erwarteten Fehler auslösen.
    async function expectError(description, sql, parameters, errno) {
        let error;
        try {
            await connection.query(sql, parameters);
        } catch (caught) {
            error = caught;
        }
        assert.equal(error?.errno, errno, description);
        console.log(`PASS: ${description} (MariaDB ${errno})`);
        passed++;
    }

    async function expectValue(description, sql, parameters, expected) {
        const rows = await connection.query(sql, parameters);
        const actual = rows[0].value === null ? null : Number(rows[0].value);
        assert.equal(actual, expected, description);
        console.log(`PASS: ${description}`);
        passed++;
    }

    try {
        connection = await mariadb.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectTimeout: 5000
        });

        const tables = await connection.query(
            "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
        );
        assert.ok(tables.length > 0 && tables.every(table => table.ENGINE === "InnoDB"),
            "Für den Rollback müssen alle Tabellen InnoDB verwenden.");
        const settings = await connection.query(
            "SELECT @@foreign_key_checks AS foreignKeys, @@check_constraint_checks AS checks"
        );
        assert.equal(Number(settings[0].foreignKeys), 1, "Fremdschlüssel müssen aktiv sein.");
        assert.equal(Number(settings[0].checks), 1, "CHECK-Regeln müssen aktiv sein.");

        await connection.beginTransaction();
        transactionStarted = true;

        // 1. Gültige, miteinander verknüpfte Testdaten aufbauen.
        const creator = await insert(
            "INSERT INTO users (name, email, initials) VALUES (?, ?, 'TC')",
            [name, `${name}_creator@example.test`]
        );
        const assignee = await insert(
            "INSERT INTO users (name, email, initials) VALUES (?, ?, 'TA')",
            [`${name}_assignee`, `${name}_assignee@example.test`]
        );
        const team = await insert(
            "INSERT INTO teams (name, initials, created_by_user_id) VALUES (?, 'TT', ?)",
            [name, creator]
        );
        const label = await insert(
            "INSERT INTO labels (name, color) VALUES (?, '#4F46E5')", [name]
        );
        const taskSql = "INSERT INTO tasks (title, schedule_date, created_by_user_id, assigned_user_id, assigned_team_id) VALUES (?, '2030-01-10', ?, ?, ?)";
        const task = await insert(taskSql, [name, creator, null, null]);
        const userTask = await insert(taskSql, [`${name}_user`, creator, assignee, null]);
        const teamTask = await insert(taskSql, [`${name}_team`, creator, null, team]);
        await connection.query("INSERT INTO team_users (team_id, user_id) VALUES (?, ?), (?, ?)",
            [team, creator, team, assignee]);
        await connection.query("INSERT INTO task_labels (task_id, label_id) VALUES (?, ?), (?, ?)",
            [task, label, userTask, label]);
        const recurrence = await insert(
            "INSERT INTO task_recurrences (task_id, repeat_type, start_date) VALUES (?, 'daily', '2030-01-10')", [task]
        );
        await connection.query("INSERT INTO recurrence_weekdays (recurrence_id, weekday) VALUES (?, 1)", [recurrence]);
        const instance = await insert(
            "INSERT INTO task_instances (task_id, due_date) VALUES (?, '2030-01-10')", [task]
        );
        const otherInstance = await insert(
            "INSERT INTO task_instances (task_id, due_date) VALUES (?, '2030-01-10')", [userTask]
        );
        const reminder = await insert(
            "INSERT INTO task_reminders (task_id, amount, unit) VALUES (?, 30, 'minutes')", [task]
        );
        const otherReminder = await insert(
            "INSERT INTO task_reminders (task_id, amount, unit) VALUES (?, 30, 'minutes')", [userTask]
        );
        const deliverySql = "INSERT INTO reminder_deliveries (task_id, reminder_id, task_instance_id, recipient_user_id, scheduled_for) VALUES (?, ?, ?, ?, '2030-01-10 08:30:00')";
        const delivery = await insert(deliverySql, [task, reminder, instance, assignee]);
        await insert(deliverySql, [userTask, otherReminder, otherInstance, assignee]);
        const missingId = Math.max(creator, assignee, team, label, task, userTask,
            teamTask, recurrence, instance, otherInstance, reminder, otherReminder, delivery) + 1;
        await expectValue("Gültige Task-Label-Beziehung", "SELECT COUNT(*) AS value FROM task_labels WHERE task_id = ? AND label_id = ?", [task, label], 1);

        // 2. Fremdschlüssel: nicht vorhandene oder unpassende Verweise ablehnen.
        const foreignKeyTests = [
            ["Team mit unbekanntem Ersteller", "UPDATE teams SET created_by_user_id = ? WHERE id = ?", [missingId, team]],
            ["Mitgliedschaft mit unbekanntem Team", "INSERT INTO team_users (team_id, user_id) VALUES (?, ?)", [missingId, creator]],
            ["Mitgliedschaft mit unbekanntem User", "INSERT INTO team_users (team_id, user_id) VALUES (?, ?)", [team, missingId]],
            ["Task mit unbekanntem Ersteller", "UPDATE tasks SET created_by_user_id = ? WHERE id = ?", [missingId, task]],
            ["Task mit unbekanntem User", "UPDATE tasks SET assigned_user_id = ? WHERE id = ?", [missingId, task]],
            ["Task mit unbekanntem Team", "UPDATE tasks SET assigned_team_id = ? WHERE id = ?", [missingId, task]],
            ["Label-Verknüpfung mit unbekanntem Task", "INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)", [missingId, label]],
            ["Label-Verknüpfung mit unbekanntem Label", "INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)", [task, missingId]],
            ["Wiederholung mit unbekanntem Task", "UPDATE task_recurrences SET task_id = ? WHERE id = ?", [missingId, recurrence]],
            ["Wochentag mit unbekannter Wiederholung", "INSERT INTO recurrence_weekdays (recurrence_id, weekday) VALUES (?, 1)", [missingId]],
            ["Instanz mit unbekanntem Task", "UPDATE task_instances SET task_id = ? WHERE id = ?", [missingId, otherInstance]],
            ["Reminder mit unbekanntem Task", "UPDATE task_reminders SET task_id = ? WHERE id = ?", [missingId, otherReminder]],
            ["Reminder gehört zum falschen Task", deliverySql, [userTask, reminder, otherInstance, assignee]],
            ["Instanz gehört zum falschen Task", deliverySql, [task, reminder, otherInstance, assignee]],
            ["Zustellung mit unbekanntem Empfänger", deliverySql, [task, reminder, instance, missingId]]
        ];
        for (const [description, sql, parameters] of foreignKeyTests) {
            await expectError(description, sql, parameters, 1452);
        }

        // 3. Eindeutige Werte und doppelte Beziehungen prüfen.
        const duplicateTests = [
            ["Doppelte E-Mail", "INSERT INTO users (name, email, initials) VALUES (?, ?, 'TC')", [name, `${name}_creator@example.test`]],
            ["Doppelter Teamname", "INSERT INTO teams (name, initials, created_by_user_id) VALUES (?, 'TT', ?)", [name, creator]],
            ["Doppelter Labelname", "INSERT INTO labels (name, color) VALUES (?, '#4F46E5')", [name]],
            ["Doppelte Mitgliedschaft", "INSERT INTO team_users (team_id, user_id) VALUES (?, ?)", [team, creator]],
            ["Doppelte Task-Label-Beziehung", "INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)", [task, label]],
            ["Doppelte Wiederholung", "INSERT INTO task_recurrences (task_id, repeat_type, start_date) VALUES (?, 'daily', '2030-01-10')", [task]],
            ["Doppelter Wiederholungs-Wochentag", "INSERT INTO recurrence_weekdays (recurrence_id, weekday) VALUES (?, 1)", [recurrence]],
            ["Doppelte Task-Instanz", "INSERT INTO task_instances (task_id, due_date) VALUES (?, '2030-01-10')", [task]],
            ["Doppelter Reminder", "INSERT INTO task_reminders (task_id, amount, unit) VALUES (?, 30, 'minutes')", [task]],
            ["Doppelte Zustellung", deliverySql, [task, reminder, instance, assignee]]
        ];
        for (const [description, sql, parameters] of duplicateTests) {
            await expectError(description, sql, parameters, 1062);
        }

        // 4. CHECK-Regeln verhindern ungültige Werte.
        const checkTests = [
            ["Task-Monat 13", "UPDATE tasks SET schedule_month = 13 WHERE id = ?", [task]],
            ["Task-Woche 6", "UPDATE tasks SET schedule_week_of_month = 6 WHERE id = ?", [task]],
            ["Task-Wochentag 8", "UPDATE tasks SET schedule_weekday = 8 WHERE id = ?", [task]],
            ["Task-Uhrzeit 25:00", "UPDATE tasks SET default_due_time = '25:00:00' WHERE id = ?", [task]],
            ["Datumstask ohne Datum", "UPDATE tasks SET schedule_date = NULL WHERE id = ?", [task]],
            ["Wiederholungsende vor Beginn", "UPDATE task_recurrences SET end_date = '2029-01-01' WHERE id = ?", [recurrence]],
            ["Wiederholungs-Monatstag 32", "UPDATE task_recurrences SET day_of_month = 32 WHERE id = ?", [recurrence]],
            ["Wiederholungs-Woche 6", "UPDATE task_recurrences SET week_of_month = 6 WHERE id = ?", [recurrence]],
            ["Wiederholungs-Wochentag 8", "UPDATE task_recurrences SET weekday = 8 WHERE id = ?", [recurrence]],
            ["Wiederholungs-Monat 13", "UPDATE task_recurrences SET month_of_year = 13 WHERE id = ?", [recurrence]],
            ["Monatswiederholung ohne Monatstag", "UPDATE task_recurrences SET repeat_type = 'monthly_day' WHERE id = ?", [recurrence]],
            ["Wochentagsliste mit Wert 8", "INSERT INTO recurrence_weekdays (recurrence_id, weekday) VALUES (?, 8)", [recurrence]],
            ["Abgeschlossene Instanz ohne Abschlussdatum", "UPDATE task_instances SET status = 'completed' WHERE id = ?", [instance]],
            ["Instanz-Uhrzeit 25:00", "UPDATE task_instances SET due_time = '25:00:00' WHERE id = ?", [instance]],
            ["Reminder-Abstand 0", "UPDATE task_reminders SET amount = 0 WHERE id = ?", [reminder]],
            ["Gesendete Zustellung ohne Versanddatum", "UPDATE reminder_deliveries SET status = 'sent' WHERE id = ?", [delivery]]
        ];
        for (const [description, sql, parameters] of checkTests) {
            await expectError(description, sql, parameters, 4025);
        }

        // 5. RESTRICT: Ersteller mit bestehenden Tasks/Teams nicht löschen.
        await expectError("Ersteller löschen wird verhindert (RESTRICT)",
            "DELETE FROM users WHERE id = ?", [creator], 1451);

        // CASCADE: abhängige Daten des gelöschten Testtasks verschwinden.
        await connection.query("DELETE FROM tasks WHERE id = ?", [task]);
        for (const table of ["task_labels", "task_recurrences", "task_instances", "task_reminders", "reminder_deliveries"]) {
            await expectValue(`Task-Löschung entfernt ${table}`,
                `SELECT COUNT(*) AS value FROM ${table} WHERE task_id = ?`, [task], 0);
        }
        await expectValue("Wochentage der gelöschten Wiederholung entfernt",
            "SELECT COUNT(*) AS value FROM recurrence_weekdays WHERE recurrence_id = ?", [recurrence], 0);
        await expectValue("Andere Tasks bleiben erhalten",
            "SELECT COUNT(*) AS value FROM tasks WHERE id IN (?, ?)", [userTask, teamTask], 2);

        // SET NULL: eine Zuweisung wird entfernt, der Task bleibt erhalten.
        await connection.query("DELETE FROM users WHERE id = ?", [assignee]);
        await expectValue("User-Löschung setzt Zuweisung auf NULL",
            "SELECT assigned_user_id AS value FROM tasks WHERE id = ?", [userTask], null);
        await expectValue("User-Löschung entfernt Mitgliedschaft",
            "SELECT COUNT(*) AS value FROM team_users WHERE user_id = ?", [assignee], 0);
        await expectValue("User-Löschung entfernt seine Zustellungen",
            "SELECT COUNT(*) AS value FROM reminder_deliveries WHERE recipient_user_id = ?", [assignee], 0);
        await connection.query("DELETE FROM teams WHERE id = ?", [team]);
        await expectValue("Team-Löschung setzt Zuweisung auf NULL",
            "SELECT assigned_team_id AS value FROM tasks WHERE id = ?", [teamTask], null);
        await expectValue("Team-Löschung entfernt Mitgliedschaften",
            "SELECT COUNT(*) AS value FROM team_users WHERE team_id = ?", [team], 0);
        await connection.query("DELETE FROM labels WHERE id = ?", [label]);
        await expectValue("Label-Löschung entfernt Verknüpfungen",
            "SELECT COUNT(*) AS value FROM task_labels WHERE label_id = ?", [label], 0);

        await connection.rollback();
        transactionStarted = false;
        await expectValue("Rollback entfernt alle Testtasks",
            "SELECT COUNT(*) AS value FROM tasks WHERE id IN (?, ?, ?)", [task, userTask, teamTask], 0);
        await expectValue("Rollback entfernt Test-Ersteller",
            "SELECT COUNT(*) AS value FROM users WHERE id = ?", [creator], 0);
        console.log(`\n${passed} Tests bestanden. Testdaten zurückgerollt.`);
    } finally {
        if (connection) {
            if (transactionStarted) await connection.rollback();
            await connection.end();
        }
    }
}

main().catch(error => {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
});
