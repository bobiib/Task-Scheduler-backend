const HttpError = require("./httpError");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function validationError(message) {
    return new HttpError(400, "VALIDATION_ERROR", "The request is invalid.", [message]);
}

function parseId(value, fieldName, optional = false) {
    if (optional && (value === null || value === undefined || value === "")) {
        return null;
    }

    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw validationError(`${fieldName} must be a positive integer.`);
    }

    return id;
}

function validateDate(value, fieldName = "dueDate") {
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
        throw validationError(`${fieldName} must use YYYY-MM-DD.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw validationError(`${fieldName} must be a valid date.`);
    }

    return value;
}

function validateTime(value) {
    if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
        throw validationError("dueTime must use HH:mm or HH:mm:ss.");
    }

    return value.length === 5 ? `${value}:00` : value;
}

function parseLabelIds(value) {
    if (value === undefined) {
        return undefined;
    }

    if (!Array.isArray(value)) {
        throw validationError("labelIds must be an array.");
    }

    return [...new Set(value.map((id) => parseId(id, "labelIds")))];
}

function parseTaskInput(body, current = null) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw validationError("A JSON request body is required.");
    }

    if (body.scheduleType && body.scheduleType !== "date") {
        throw validationError("Only scheduleType date is supported in Sprint 1.");
    }

    const title = body.title === undefined ? current?.title : String(body.title).trim();
    if (!title || title.length > 255) {
        throw validationError("title is required and must not exceed 255 characters.");
    }

    const description = body.description === undefined
        ? current?.description ?? null
        : body.description === null
            ? null
            : String(body.description).trim();

    const dateValue = body.dueDate ?? body.scheduleDate ?? current?.due_date;
    if (!dateValue) {
        throw validationError("dueDate is required.");
    }

    const assignedUserId = body.assignedUserId === undefined
        ? current?.assigned_user_id ?? null
        : parseId(body.assignedUserId, "assignedUserId", true);
    const assignedTeamId = body.assignedTeamId === undefined
        ? current?.assigned_team_id ?? null
        : parseId(body.assignedTeamId, "assignedTeamId", true);

    if (assignedUserId !== null && assignedTeamId !== null) {
        throw validationError("Only one assignee may be selected.");
    }

    return {
        title,
        description,
        dueDate: validateDate(dateValue),
        dueTime: validateTime(body.dueTime ?? current?.due_time ?? "23:59:00"),
        assignedUserId,
        assignedTeamId,
        labelIds: parseLabelIds(body.labelIds)
    };
}

module.exports = {
    validationError,
    parseId,
    validateDate,
    parseTaskInput
};
