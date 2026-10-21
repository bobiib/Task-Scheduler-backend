const HttpError = require("./httpError");

function positiveId(value, field = "id") {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", `${field} must be a positive integer.`);
    }
    return id;
}

function requiredText(value, field, maxLength) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
        throw new HttpError(400, "VALIDATION_ERROR", `${field} must contain 1 to ${maxLength} characters.`);
    }
    return value.trim();
}

function memberIds(value, field = "memberIds") {
    if (!Array.isArray(value)) {
        throw new HttpError(400, "VALIDATION_ERROR", `${field} must be an array.`);
    }
    return [...new Set(value.map((id) => positiveId(id, `${field} entry`)))];
}

module.exports = { positiveId, requiredText, memberIds };
