require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { once } = require("node:events");
const { readFile } = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const readline = require("node:readline");
const { test } = require("node:test");
const mariadb = require("mariadb");

const accepted = "accepted@example.test";
const rejected = "rejected@example.test";

function createSmtpReceiver(messages, attempts) {
    return net.createServer(socket => {
        const lines = readline.createInterface({ input: socket, crlfDelay: Infinity });
        let recipient;
        let message;

        socket.setTimeout(5000, () => socket.destroy());
        socket.on("error", () => socket.destroy());
        const reply = line => socket.write(line + "\r\n");
        reply("220 localhost");

        lines.on("line", line => {
            if (message && line === ".") {
                messages.push({ recipient, text: message.join("\n") });
                message = undefined;
                reply("250 Message accepted");
            } else if (message) {
                message.push(line);
            } else if (/^(EHLO |HELO |MAIL FROM:)/i.test(line)) {
                reply("250 localhost");
            } else if (/^RCPT TO:/i.test(line)) {
                recipient = line.match(/<([^>]+)>/)?.[1];
                attempts.push(recipient);
                reply(recipient === rejected ? "550 Test recipient rejected" : "250 Recipient accepted");
            } else if (line === "DATA") {
                message = [];
                reply("354 End data with a single dot");
            } else if (line === "QUIT") {
                socket.end("221 Bye\r\n");
            } else {
                reply("500 Unexpected command");
            }
        });
    });
}

test("plans and sends reminders once and records rejected mail", async t => {
    const database = "task_scheduler_reminder_test_" + randomBytes(6).toString("hex");
    const schema = await readFile(path.join(__dirname, "../database/schema.sql"), "utf8");
    const separator = schema.indexOf("USE task_scheduler;");
    assert.ok(separator > 0, "The test needs the database declaration in schema.sql");
    let databaseCreated = false;
    let pool;
    const connection = await mariadb.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectTimeout: 5000,
        multipleStatements: true
    });
    t.after(async () => {
        try {
            await pool?.end();
        } finally {
            try {
                if (databaseCreated) await connection.query(`DROP DATABASE ${database}`);
            } finally {
                await connection.end();
            }
        }
    });
    await connection.query(schema.slice(0, separator).replace("IF NOT EXISTS task_scheduler", database));
    databaseCreated = true;
    // DELIMITER is handled by the command-line client, not the SQL server.
    const schemaSql = schema.slice(separator)
        .replace("USE task_scheduler;", `USE ${database};`)
        .replace(/^DELIMITER [^\r\n]*\r?\n/gm, "")
        .replace(/^END\/\/\r?$/gm, "END;");
    await connection.query(schemaSql);

    const messages = [];
    const attempts = [];
    const smtp = createSmtpReceiver(messages, attempts);
    smtp.listen(0, "127.0.0.1");
    await once(smtp, "listening");
    t.after(() => new Promise(resolve => smtp.close(resolve)));
    Object.assign(process.env, {
        DB_NAME: database,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(smtp.address().port),
        SMTP_FROM: "scheduler@example.test",
        SMTP_SECURE: "false",
        SMTP_USER: ""
    });

    pool = require("../config/db");
    const { createTask } = require("../services/taskService");
    const { createReminder } = require("../models/reminderModel");
    const { runReminders } = require("../services/reminderScheduler");
    const [due] = await connection.query(
        `SELECT DATE_FORMAT(NOW() + INTERVAL 2 HOUR, '%Y-%m-%d') AS dueDate,
                TIME_FORMAT(NOW() + INTERVAL 2 HOUR, '%H:%i:00') AS dueTime`
    );

    for (const email of [accepted, rejected]) {
        const user = await connection.query(
            "INSERT INTO users (name, email, initials) VALUES (?, ?, 'RT')", [email, email]);
        const userId = Number(user.insertId);
        const task = await createTask({
            title: "Reminder for " + email,
            createdByUserId: userId,
            assignedUserId: userId,
            ...due
        });
        await createReminder(task.id, 30, "minutes", true);
    }

    async function deliveries() {
        return connection.query(
            `SELECT u.email, d.status, d.sent_at AS sentAt, d.error_message AS error,
                    TIMESTAMPDIFF(MINUTE, d.scheduled_for, TIMESTAMP(i.due_date, i.due_time)) AS minutesBeforeDue
             FROM reminder_deliveries d
             JOIN task_instances i ON i.id = d.task_instance_id
             JOIN users u ON u.id = d.recipient_user_id
             ORDER BY u.email`
        );
    }

    await runReminders();
    await runReminders();
    const planned = await deliveries();
    assert.deepEqual(planned.map(row => [row.email, row.status, Number(row.minutesBeforeDue)]), [
        [accepted, "pending", 30],
        [rejected, "pending", 30]
    ]);
    assert.equal(attempts.length, 0);

    await connection.query("UPDATE reminder_deliveries SET scheduled_for = NOW() - INTERVAL 1 SECOND");
    await Promise.all([runReminders(), runReminders()]);
    await runReminders();

    const processed = await deliveries();
    assert.deepEqual(processed.map(row => [row.email, row.status]), [
        [accepted, "sent"],
        [rejected, "failed"]
    ]);
    assert.ok(processed[0].sentAt);
    assert.equal(processed[0].error, null);
    assert.equal(processed[1].sentAt, null);
    assert.match(processed[1].error, /550 Test recipient rejected/);
    assert.deepEqual(attempts.sort(), [accepted, rejected]);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].recipient, accepted);
    assert.match(messages[0].text, /^Subject: .*accepted@example\.test/m);
});
