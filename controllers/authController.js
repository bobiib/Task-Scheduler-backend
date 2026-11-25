const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const { requiredText } = require("../utils/referenceValidation");

const USER_FIELDS = "id, name, email, initials";

function createToken(user) {
    return jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    });
}

function initialsFrom(name) {
    const words = name.split(/\s+/);
    const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2);
    return letters.toUpperCase();
}

async function register(req, res, next) {
    try {
        const name = requiredText(req.body?.name, "name", 100);
        const email = requiredText(req.body?.email, "email", 255);
        const password = req.body?.password;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new HttpError(400, "VALIDATION_ERROR", "email must be a valid email address.");
        }
        if (typeof password !== "string" || password.length < 8) {
            throw new HttpError(400, "VALIDATION_ERROR", "password must contain at least 8 characters.");
        }

        const existing = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length) throw new HttpError(409, "CONFLICT", "Email is already registered.");

        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (name, email, initials, password_hash) VALUES (?, ?, ?, ?)",
            [name, email, initialsFrom(name), hash]
        );
        const rows = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [Number(result.insertId)]);
        res.status(201).json({ data: { token: createToken(rows[0]), user: rows[0] } });
    } catch (error) { next(error); }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body || {};
        const rows = await pool.query(
            `SELECT ${USER_FIELDS}, password_hash FROM users WHERE email = ? AND is_active = TRUE`,
            [String(email || "").trim()]
        );
        const user = rows[0];
        if (!user?.password_hash || !await bcrypt.compare(String(password || ""), user.password_hash)) {
            throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
        }

        delete user.password_hash;
        res.json({ data: { token: createToken(user), user } });
    } catch (error) { next(error); }
}

async function me(req, res, next) {
    try {
        const rows = await pool.query(
            `SELECT ${USER_FIELDS} FROM users WHERE id = ? AND is_active = TRUE`,
            [req.user.id]
        );
        if (!rows.length) throw new HttpError(401, "UNAUTHORIZED", "Authentication required.");
        res.json({ data: rows[0] });
    } catch (error) { next(error); }
}

function logout(req, res) {
    res.status(204).send();
}

module.exports = { register, login, me, logout };
