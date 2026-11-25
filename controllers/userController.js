const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const { positiveId, requiredText } = require("../utils/referenceValidation");

async function listUsers(req, res) {
    const users = await pool.query(`
        SELECT id, name, email, initials
        FROM users WHERE is_active = TRUE ORDER BY name
    `);
    res.json({ data: users });
}

async function createUser(req, res) {
    const name = requiredText(req.body?.name, "name", 100);
    const email = requiredText(req.body?.email, "email", 255);
    const initials = requiredText(req.body?.initials, "initials", 10);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(400, "VALIDATION_ERROR", "email must be a valid email address.");
    }
    const result = await pool.query(
        "INSERT INTO users (name, email, initials) VALUES (?, ?, ?)",
        [name, email, initials]
    );
    const rows = await pool.query(
        "SELECT id, name, email, initials FROM users WHERE id = ?",
        [Number(result.insertId)]
    );
    res.status(201).json({ data: rows[0] });
}

async function deleteUser(req, res) {
    const id = positiveId(req.params.id);
    const result = await pool.query(
        "UPDATE users SET is_active = FALSE WHERE id = ? AND is_active = TRUE",
        [id]
    );
    if (!result.affectedRows) throw new HttpError(404, "NOT_FOUND", "Active user not found.");
    res.status(204).send();
}

module.exports = { listUsers, createUser, deleteUser };
