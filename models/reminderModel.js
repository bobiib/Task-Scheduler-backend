const pool = require("../config/db.js");

const SELECT = "SELECT id, task_id AS taskId, amount, unit, is_active AS isActive FROM task_reminders";

function format(row) {
    return row && { ...row, isActive: Boolean(row.isActive) };
}

async function taskExists(taskId) {
    const rows = await pool.query("SELECT id FROM tasks WHERE id = ? AND is_active = TRUE", [taskId]);
    return rows.length > 0;
}

async function getRemindersByTask(taskId) {
    const rows = await pool.query(`${SELECT} WHERE task_id = ? ORDER BY id`, [taskId]);
    return rows.map(format);
}

async function getReminderById(id) {
    const rows = await pool.query(`${SELECT} WHERE id = ?`, [id]);
    return format(rows[0]);
}

async function createReminder(taskId, amount, unit, isActive) {
    const result = await pool.query(
        "INSERT INTO task_reminders (task_id, amount, unit, is_active) VALUES (?, ?, ?, ?)",
        [taskId, amount, unit, isActive]
    );
    return await getReminderById(Number(result.insertId));
}

async function updateReminder(id, amount, unit, isActive) {
    await pool.query(
        "UPDATE task_reminders SET amount = ?, unit = ?, is_active = ? WHERE id = ?",
        [amount, unit, isActive, id]
    );
    return await getReminderById(id);
}

async function deleteReminderById(id) {
    const result = await pool.query("DELETE FROM task_reminders WHERE id = ?", [id]);
    return result.affectedRows > 0;
}

module.exports = {
    taskExists,
    getRemindersByTask,
    getReminderById,
    createReminder,
    updateReminder,
    deleteReminderById
};
