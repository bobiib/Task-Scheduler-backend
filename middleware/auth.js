const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");

function requireAuth(req, res, next) {
    const [type, token] = (req.headers.authorization || "").split(" ");
    if (type !== "Bearer" || !token) {
        return next(new HttpError(401, "UNAUTHORIZED", "Authentication required."));
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: Number(payload.sub) };
        next();
    } catch (error) {
        next(new HttpError(401, "UNAUTHORIZED", "Invalid or expired token."));
    }
}

async function requireTeamAdmin(req, res, next) {
    const rows = await pool.query(
        "SELECT user_id FROM team_users WHERE team_id = ? AND user_id = ? AND role = 'admin'",
        [req.params.id, req.user.id]
    );
    if (!rows.length) throw new HttpError(403, "FORBIDDEN", "Only team admins can do this.");
    next();
}

module.exports = { requireAuth, requireTeamAdmin };
