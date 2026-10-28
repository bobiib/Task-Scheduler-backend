const pool = require("../config/db");

const COLOR_ALIASES = {
    "#4F46E5": "development",
    "#9333EA": "schule",
    "#0284C7": "it",
    "#EF4444": "design",
    "#D97706": "organisation"
};

function formatRecurrence(type) {
    const names = {
        daily: "Täglich",
        weekly: "Wöchentlich",
        monthly_day: "Monatlich",
        monthly_weekday: "Monatlich",
        yearly: "Jährlich"
    };

    return type ? names[type] ?? type : null;
}

function formatReminder(amount, unit) {
    if (!amount || !unit) {
        return null;
    }

    const names = {
        minutes: "Min.",
        hours: "Std.",
        days: amount === 1 ? "Tag" : "Tage",
        weeks: amount === 1 ? "Woche" : "Wochen"
    };

    return `${amount} ${names[unit]} vorher`;
}

async function findTaskCards(where = "", parameters = [], connection = pool) {
    const rows = await connection.query(
        `SELECT
            t.id AS task_id,
            ti.id AS instance_id,
            t.title,
            t.description,
            DATE_FORMAT(ti.due_date, '%Y-%m-%d') AS due_date,
            TIME_FORMAT(ti.due_time, '%H:%i') AS due_time,
            t.schedule_type,
            t.schedule_year,
            t.schedule_month,
            t.schedule_week_of_month,
            t.schedule_weekday,
            tr.repeat_type,
            reminder.amount AS reminder_amount,
            reminder.unit AS reminder_unit,
            ti.status,
            u.id AS user_id,
            u.name AS user_name,
            u.initials AS user_initials,
            team.id AS team_id,
            team.name AS team_name,
            team.initials AS team_initials
         FROM tasks t
         JOIN task_instances ti ON ti.task_id = t.id
         LEFT JOIN task_recurrences tr ON tr.task_id = t.id
         LEFT JOIN task_reminders reminder ON reminder.id = (
             SELECT MIN(id) FROM task_reminders
             WHERE task_id = t.id AND is_active = TRUE
         )
         LEFT JOIN users u ON u.id = t.assigned_user_id
         LEFT JOIN teams team ON team.id = t.assigned_team_id
         WHERE t.is_active = TRUE ${where}
         ORDER BY ti.due_date, ti.due_time`,
        parameters
    );

    const taskIds = [...new Set(rows.map((row) => Number(row.task_id)))];
    const labelsByTask = new Map();

    if (taskIds.length > 0) {
        const placeholders = taskIds.map(() => "?").join(", ");
        const labels = await connection.query(
            `SELECT tl.task_id, l.id, l.name, l.color
             FROM task_labels tl
             JOIN labels l ON l.id = tl.label_id
             WHERE tl.task_id IN (${placeholders})`,
            taskIds
        );

        for (const label of labels) {
            const taskId = Number(label.task_id);
            const taskLabels = labelsByTask.get(taskId) ?? [];
            taskLabels.push({
                id: Number(label.id),
                name: label.name,
                color: COLOR_ALIASES[label.color] ?? label.color
            });
            labelsByTask.set(taskId, taskLabels);
        }
    }

    return rows.map((row) => {
        let assignee = null;

        if (row.user_id !== null) {
            assignee = {
                type: "user",
                id: Number(row.user_id),
                name: row.user_name,
                initials: row.user_initials
            };
        } else if (row.team_id !== null) {
            assignee = {
                type: "team",
                id: Number(row.team_id),
                name: row.team_name,
                initials: row.team_initials
            };
        }

        return {
            id: Number(row.task_id),
            instanceId: Number(row.instance_id),
            title: row.title,
            description: row.description,
            dueDate: row.due_date,
            dueTime: row.due_time,
            scheduleType: row.schedule_type,
            schedule: row.schedule_type === "date" ? null : {
                year: row.schedule_year,
                month: row.schedule_month,
                weekOfMonth: row.schedule_week_of_month,
                weekday: row.schedule_weekday
            },
            recurrence: formatRecurrence(row.repeat_type),
            reminder: formatReminder(row.reminder_amount, row.reminder_unit),
            labels: labelsByTask.get(Number(row.task_id)) ?? [],
            assignee,
            completed: row.status === "completed"
        };
    });
}

module.exports = findTaskCards;
