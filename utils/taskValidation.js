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

function parseRange(value, fieldName, min, max) {
    const number = Number(value);
    if (value === null || value === undefined || !Number.isInteger(number) || number < min || number > max) {
        throw validationError(`${fieldName} must be between ${min} and ${max}.`);
    }

    return number;
}

// week: due on the last day of the 7-day block (days 1-7, 8-14, ...) of the month.
// weekday_in_month: due on the given weekday inside that block, e.g. 2nd Wednesday.
function parseSchedule(body, current) {
    const type = body.scheduleType ?? current?.schedule_type ?? "date";
    const empty = { type, year: null, month: null, weekOfMonth: null, weekday: null };

    if (type === "date") {
        return empty;
    }

    if (type !== "week" && type !== "weekday_in_month") {
        throw validationError("scheduleType must be date, week or weekday_in_month.");
    }

    const schedule = {
        ...empty,
        year: parseRange(body.scheduleYear ?? current?.schedule_year, "scheduleYear", 2000, 2100),
        month: parseRange(body.scheduleMonth ?? current?.schedule_month, "scheduleMonth", 1, 12),
        weekOfMonth: parseRange(body.scheduleWeekOfMonth ?? current?.schedule_week_of_month, "scheduleWeekOfMonth", 1, 5)
    };

    const lastDay = new Date(Date.UTC(schedule.year, schedule.month, 0)).getUTCDate();
    const firstDay = (schedule.weekOfMonth - 1) * 7 + 1;
    let day = Math.min(schedule.weekOfMonth * 7, lastDay);

    if (type === "weekday_in_month") {
        schedule.weekday = parseRange(body.scheduleWeekday ?? current?.schedule_weekday, "scheduleWeekday", 1, 7);
        const firstWeekday = new Date(Date.UTC(schedule.year, schedule.month - 1, firstDay)).getUTCDay() || 7;
        day = firstDay + (schedule.weekday - firstWeekday + 7) % 7;
    }

    if (firstDay > lastDay || day > lastDay) {
        throw validationError("The selected week does not exist in this month.");
    }

    const pad = (value) => String(value).padStart(2, "0");
    schedule.dueDate = `${schedule.year}-${pad(schedule.month)}-${pad(day)}`;
    return schedule;
}

function parseTaskInput(body, current = null) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw validationError("A JSON request body is required.");
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

    const schedule = parseSchedule(body, current);
    const dateValue = schedule.dueDate ?? body.dueDate ?? body.scheduleDate ?? current?.due_date;
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
        schedule,
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
