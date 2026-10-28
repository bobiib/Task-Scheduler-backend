const { validationError, validateDate } = require("./taskValidation");

const TYPES = ["daily", "weekly", "monthly_day", "monthly_weekday", "yearly"];
const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
    return new Date(`${value}T00:00:00.000Z`);
}

function toText(date) {
    return date.toISOString().slice(0, 10);
}

// ISO weekday: Monday = 1, Sunday = 7.
function isoWeekday(date) {
    return date.getUTCDay() || 7;
}

function parseNumber(value, fieldName, min, max) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        throw validationError(`recurrence.${fieldName} must be between ${min} and ${max}.`);
    }

    return number;
}

function parseRecurrence(value, defaultStartDate) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw validationError("recurrence must be an object or null.");
    }

    if (!TYPES.includes(value.type)) {
        throw validationError(`recurrence.type must be one of: ${TYPES.join(", ")}.`);
    }

    const startDate = validateDate(value.startDate ?? defaultStartDate, "recurrence.startDate");
    const endDate = value.endDate == null ? null : validateDate(value.endDate, "recurrence.endDate");
    if (endDate && endDate < startDate) {
        throw validationError("recurrence.endDate must not be before recurrence.startDate.");
    }

    const start = toDate(startDate);
    const rule = {
        type: value.type,
        startDate,
        endDate,
        weekdays: [],
        dayOfMonth: null,
        weekOfMonth: null,
        weekday: null,
        monthOfYear: null
    };

    if (rule.type === "weekly") {
        const weekdays = value.weekdays ?? [isoWeekday(start)];
        if (!Array.isArray(weekdays) || weekdays.length === 0) {
            throw validationError("recurrence.weekdays must be a non-empty array.");
        }
        rule.weekdays = [...new Set(weekdays.map((day) => parseNumber(day, "weekdays", 1, 7)))];
    }

    if (rule.type === "monthly_day" || rule.type === "yearly") {
        rule.dayOfMonth = parseNumber(value.dayOfMonth ?? start.getUTCDate(), "dayOfMonth", 1, 31);
    }

    if (rule.type === "monthly_weekday") {
        rule.weekOfMonth = parseNumber(value.weekOfMonth ?? Math.ceil(start.getUTCDate() / 7), "weekOfMonth", 1, 5);
        rule.weekday = parseNumber(value.weekday ?? isoWeekday(start), "weekday", 1, 7);
    }

    if (rule.type === "yearly") {
        rule.monthOfYear = parseNumber(value.monthOfYear ?? start.getUTCMonth() + 1, "monthOfYear", 1, 12);
    }

    return rule;
}

function matches(rule, date) {
    const day = date.getUTCDate();

    switch (rule.type) {
        case "daily":
            return true;
        case "weekly":
            return rule.weekdays.includes(isoWeekday(date));
        case "monthly_day":
            return day === rule.dayOfMonth;
        case "monthly_weekday":
            return isoWeekday(date) === rule.weekday && Math.ceil(day / 7) === rule.weekOfMonth;
        case "yearly":
            return date.getUTCMonth() + 1 === rule.monthOfYear && day === rule.dayOfMonth;
        default:
            return false;
    }
}

function addDays(value, days) {
    return toText(new Date(toDate(value).getTime() + days * DAY_MS));
}

function today() {
    return toText(new Date());
}

// Returns all dates (YYYY-MM-DD) between from and to that match the rule.
function getOccurrences(rule, from, to) {
    const first = from > rule.startDate ? from : rule.startDate;
    const last = rule.endDate && rule.endDate < to ? rule.endDate : to;
    const dates = [];

    for (let time = toDate(first).getTime(); time <= toDate(last).getTime(); time += DAY_MS) {
        const date = new Date(time);
        if (matches(rule, date)) {
            dates.push(toText(date));
        }
    }

    return dates;
}

// First matching date within one year after the start date.
function getFirstOccurrence(rule) {
    const [first] = getOccurrences(rule, rule.startDate, addDays(rule.startDate, 366));

    if (!first) {
        throw validationError("recurrence does not produce any date.");
    }

    return first;
}

module.exports = {
    parseRecurrence,
    getOccurrences,
    getFirstOccurrence,
    addDays,
    today
};
