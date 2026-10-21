const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const { positiveId, requiredText, memberIds } = require("../utils/referenceValidation");

async function readTeams(id) {
    const rows = await pool.query(`
        SELECT t.id, t.name, t.initials, t.created_by_user_id AS createdByUserId,
               u.id AS memberId, u.name AS memberName, u.initials AS memberInitials,
               tu.role AS memberRole
        FROM teams t
        LEFT JOIN team_users tu ON tu.team_id = t.id
        LEFT JOIN users u ON u.id = tu.user_id AND u.is_active = TRUE
        ${id ? "WHERE t.id = ?" : ""}
        ORDER BY t.name, u.name
    `, id ? [id] : []);

    const teams = new Map();
    for (const row of rows) {
        if (!teams.has(row.id)) {
            teams.set(row.id, {
                id: row.id, name: row.name, initials: row.initials,
                createdByUserId: row.createdByUserId, members: []
            });
        }
        if (row.memberId) {
            teams.get(row.id).members.push({
                id: row.memberId, name: row.memberName,
                initials: row.memberInitials, role: row.memberRole
            });
        }
    }
    return [...teams.values()];
}

async function checkActiveUsers(conn, ids) {
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(",");
    const rows = await conn.query(
        `SELECT id FROM users WHERE is_active = TRUE AND id IN (${placeholders})`, ids
    );
    if (rows.length !== ids.length) {
        throw new HttpError(400, "INVALID_RELATION", "Every member must be an active user.");
    }
}

async function replaceMembers(conn, teamId, ids) {
    await conn.query("DELETE FROM team_users WHERE team_id = ?", [teamId]);
    for (const id of ids) {
        await conn.query("INSERT INTO team_users (team_id, user_id) VALUES (?, ?)", [teamId, id]);
    }
}

async function listTeams(req, res, next) {
    try {
        res.json({ data: await readTeams() });
    } catch (error) { next(error); }
}

async function createTeam(req, res, next) {
    let conn;
    try {
        const name = requiredText(req.body?.name, "name", 100);
        const initials = requiredText(req.body?.initials, "initials", 10);
        const creatorId = positiveId(req.body?.createdByUserId, "createdByUserId");
        const ids = memberIds(req.body?.memberIds);

        conn = await pool.getConnection();
        await conn.beginTransaction();
        await checkActiveUsers(conn, [creatorId, ...ids.filter((id) => id !== creatorId)]);
        const result = await conn.query(
            "INSERT INTO teams (name, initials, created_by_user_id) VALUES (?, ?, ?)",
            [name, initials, creatorId]
        );
        const teamId = Number(result.insertId);
        await replaceMembers(conn, teamId, ids);
        await conn.commit();
        res.status(201).json({ data: (await readTeams(teamId))[0] });
    } catch (error) {
        if (conn) await conn.rollback();
        next(error);
    } finally {
        if (conn) conn.release();
    }
}

async function updateTeam(req, res, next) {
    let conn;
    try {
        const teamId = positiveId(req.params.id);
        const body = req.body || {};
        if (body.name === undefined && body.initials === undefined && body.memberIds === undefined) {
            throw new HttpError(400, "VALIDATION_ERROR", "Provide name, initials or memberIds.");
        }
        const name = body.name === undefined ? null : requiredText(body.name, "name", 100);
        const initials = body.initials === undefined ? null : requiredText(body.initials, "initials", 10);
        const ids = body.memberIds === undefined ? null : memberIds(body.memberIds);

        conn = await pool.getConnection();
        await conn.beginTransaction();
        const rows = await conn.query("SELECT id FROM teams WHERE id = ? FOR UPDATE", [teamId]);
        if (!rows.length) throw new HttpError(404, "NOT_FOUND", "Team not found.");
        if (ids) await checkActiveUsers(conn, ids);
        await conn.query(
            "UPDATE teams SET name = COALESCE(?, name), initials = COALESCE(?, initials) WHERE id = ?",
            [name, initials, teamId]
        );
        if (ids) await replaceMembers(conn, teamId, ids);
        await conn.commit();
        res.json({ data: (await readTeams(teamId))[0] });
    } catch (error) {
        if (conn) await conn.rollback();
        next(error);
    } finally {
        if (conn) conn.release();
    }
}

async function deleteTeam(req, res, next) {
    let conn;
    try {
        const teamId = positiveId(req.params.id);
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const rows = await conn.query("SELECT id FROM teams WHERE id = ? FOR UPDATE", [teamId]);
        if (!rows.length) throw new HttpError(404, "NOT_FOUND", "Team not found.");
        const tasks = await conn.query(
            "SELECT id FROM tasks WHERE assigned_team_id = ? AND is_active = TRUE LIMIT 1",
            [teamId]
        );
        if (tasks.length) throw new HttpError(409, "CONFLICT", "Active tasks are assigned to this team.");
        await conn.query("DELETE FROM teams WHERE id = ?", [teamId]);
        await conn.commit();
        res.status(204).send();
    } catch (error) {
        if (conn) await conn.rollback();
        next(error);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { listTeams, createTeam, updateTeam, deleteTeam };
