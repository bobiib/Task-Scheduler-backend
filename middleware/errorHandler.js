const HttpError = require("../utils/httpError");

const DB_ERRORS = {
    ER_DUP_ENTRY: [409, "CONFLICT", "A record with these values already exists."],
    ER_NO_REFERENCED_ROW_2: [400, "INVALID_RELATION", "A referenced record does not exist."],
    ER_ROW_IS_REFERENCED_2: [409, "CONFLICT", "The record is still used by other records."]
};

function notFoundHandler(req, res, next) {
    next(new HttpError(404, "ROUTE_NOT_FOUND", "Route not found."));
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof SyntaxError && error.status === 400 && error.body !== undefined) {
        error = new HttpError(400, "INVALID_JSON", "The request body contains invalid JSON.");
    } else if (DB_ERRORS[error.code]) {
        error = new HttpError(...DB_ERRORS[error.code]);
    } else if (!(error instanceof HttpError)) {
        // Log only method, path and stack, never the request body or headers.
        console.error(`${req.method} ${req.path} failed:`, error.stack || error.message);
        error = new HttpError(500, "INTERNAL_ERROR", "An unexpected server error occurred.");
    }

    res.status(error.status).json({
        error: {
            code: error.code,
            message: error.message,
            details: error.details
        }
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};
