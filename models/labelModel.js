const pool = require("../config/db.js");

async function getAllLabels() {
    const rows = await pool.query(`
        SELECT l.id, l.name, l.color, COUNT(t.id) AS taskCount
        FROM labels l
        LEFT JOIN task_labels tl ON tl.label_id = l.id
        LEFT JOIN tasks t ON t.id = tl.task_id AND t.is_active = TRUE
        GROUP BY l.id, l.name, l.color
        ORDER BY l.name ASC
    `);
    return rows.map((row) => ({ ...row, taskCount: Number(row.taskCount) }));
}

async function getLabelById(id) {
    const rows = await pool.query(`
        SELECT l.id, l.name, l.color, COUNT(t.id) AS taskCount
        FROM labels l
        LEFT JOIN task_labels tl ON tl.label_id = l.id
        LEFT JOIN tasks t ON t.id = tl.task_id AND t.is_active = TRUE
        WHERE l.id = ?
        GROUP BY l.id, l.name, l.color
    `, [id]);
    return rows[0] ? { ...rows[0], taskCount: Number(rows[0].taskCount) } : undefined;
}

async function createLabel(name, color) {
    const result = await pool.query("INSERT INTO labels (name, color) VALUES (?, ?)", [name, color]);
    return await getLabelById(Number(result.insertId));
}

async function updateLabel(id, name, color) {
    await pool.query("UPDATE labels SET name = ?, color = ? WHERE id = ?", [name, color, id]);
    return await getLabelById(id);
}

async function deleteLabelById(id) {
    const result = await pool.query(`
        DELETE FROM labels
        WHERE id = ? AND NOT EXISTS (
            SELECT 1 FROM task_labels WHERE label_id = ?
        )
    `, [id, id]);
    return result.affectedRows > 0;
}

module.exports = { getAllLabels, getLabelById, createLabel, updateLabel, deleteLabelById };
