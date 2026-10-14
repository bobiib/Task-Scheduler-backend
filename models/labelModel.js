const pool = require("../config/db.js");

async function getAllLabels() {
    return await pool.query("SELECT id, name, color FROM labels ORDER BY name ASC");
}

async function getLabelById(id) {
    const rows = await pool.query("SELECT id, name, color FROM labels WHERE id = ?", [id]);
    return rows[0];
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
    const result = await pool.query("DELETE FROM labels WHERE id = ?", [id]);
    return result.affectedRows > 0;
}

module.exports = { getAllLabels, getLabelById, createLabel, updateLabel, deleteLabelById };
