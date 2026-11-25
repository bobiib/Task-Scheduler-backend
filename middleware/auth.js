const jwt = require("jsonwebtoken");
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

module.exports = { requireAuth };
