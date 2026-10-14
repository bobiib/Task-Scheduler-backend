const HttpError = require("../utils/httpError");

function notFoundHandler(req, res, next) {
    next(new HttpError(404, "ROUTE_NOT_FOUND", "Route not found."));
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof HttpError) {
        return res.status(error.status).json({
            error: {
                code: error.code,
                message: error.message,
                details: error.details
            }
        });
    }

    if (error instanceof SyntaxError && error.status === 400 && error.body !== undefined) {
        return res.status(400).json({
            error: {
                code: "INVALID_JSON",
                message: "The request body contains invalid JSON.",
                details: []
            }
        });
    }

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            error: {
                code: "CONFLICT",
                message: "A record with these values already exists.",
                details: []
            }
        });
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json({
            error: {
                code: "INVALID_RELATION",
                message: "A referenced record does not exist.",
                details: []
            }
        });
    }

    console.error(error);

    return res.status(500).json({
        error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected server error occurred.",
            details: []
        }
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};
