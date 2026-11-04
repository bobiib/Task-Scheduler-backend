const pool = require("../config/db");
const { sendReminderEmail } = require("./emailService");

const INTERVAL_MS = 60 * 1000;
let running = false;

// Creates a pending delivery for every open future instance, active reminder and
// recipient. The unique key uq_delivery prevents duplicates.
async function planDeliveries() {
    await pool.query(
        `INSERT IGNORE INTO reminder_deliveries (
            task_id, reminder_id, task_instance_id, recipient_user_id, scheduled_for
         )
         SELECT t.id, r.id, ti.id, u.id,
            CASE r.unit
                WHEN 'minutes' THEN TIMESTAMP(ti.due_date, ti.due_time) - INTERVAL r.amount MINUTE
                WHEN 'hours' THEN TIMESTAMP(ti.due_date, ti.due_time) - INTERVAL r.amount HOUR
                WHEN 'days' THEN TIMESTAMP(ti.due_date, ti.due_time) - INTERVAL r.amount DAY
                ELSE TIMESTAMP(ti.due_date, ti.due_time) - INTERVAL r.amount WEEK
            END
         FROM task_instances ti
         JOIN tasks t ON t.id = ti.task_id AND t.is_active = TRUE
         JOIN task_reminders r ON r.task_id = t.id AND r.is_active = TRUE
         LEFT JOIN team_users tu ON tu.team_id = t.assigned_team_id
         JOIN users u ON u.id = COALESCE(t.assigned_user_id, tu.user_id) AND u.is_active = TRUE
         WHERE ti.status = 'open'
           AND TIMESTAMP(ti.due_date, ti.due_time) > NOW()`
    );
}

async function sendDueDeliveries() {
    const deliveries = await pool.query(
        `SELECT
            d.id,
            u.email,
            t.title,
            DATE_FORMAT(ti.due_date, '%Y-%m-%d') AS dueDate,
            TIME_FORMAT(ti.due_time, '%H:%i') AS dueTime
         FROM reminder_deliveries d
         JOIN users u ON u.id = d.recipient_user_id
         JOIN tasks t ON t.id = d.task_id
         JOIN task_instances ti ON ti.id = d.task_instance_id
         WHERE d.status = 'pending' AND d.scheduled_for <= NOW()
         ORDER BY d.scheduled_for`
    );

    for (const delivery of deliveries) {
        try {
            await sendReminderEmail(delivery.email, delivery);
            await pool.query(
                "UPDATE reminder_deliveries SET status = 'sent', sent_at = NOW() WHERE id = ? AND status = 'pending'",
                [delivery.id]
            );
        } catch (error) {
            await pool.query(
                "UPDATE reminder_deliveries SET status = 'failed', error_message = ? WHERE id = ?",
                [error.message, delivery.id]
            );
        }
    }

    return deliveries.length;
}

async function runReminders() {
    if (running) {
        return;
    }

    running = true;
    try {
        await planDeliveries();
        const count = await sendDueDeliveries();
        if (count > 0) {
            console.log(`Reminder: ${count} Zustellung(en) verarbeitet.`);
        }
    } catch (error) {
        console.error("Reminder-Lauf fehlgeschlagen:", error.message);
    } finally {
        running = false;
    }
}

function startReminderScheduler() {
    if (!process.env.SMTP_HOST) {
        console.log("Reminder-Versand ist aus, weil SMTP_HOST fehlt.");
        return;
    }

    runReminders();
    setInterval(runReminders, INTERVAL_MS);
}

module.exports = { runReminders, startReminderScheduler };
