const reminders = require("../models/reminderModel");
const HttpError = require("../utils/httpError");
const { positiveId } = require("../utils/referenceValidation");

const UNITS = ["minutes", "hours", "days", "weeks"];

function invalid(message) {
    return new HttpError(400, "VALIDATION_ERROR", message);
}

function parseReminder(body, current = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid("A JSON request body is required.");

    const amount = body.amount ?? current.amount;
    const unit = body.unit ?? current.unit;
    const isActive = body.isActive ?? current.isActive ?? true;

    if (!Number.isInteger(amount) || amount <= 0) throw invalid("amount must be a positive integer.");
    if (!UNITS.includes(unit)) throw invalid(`unit must be one of: ${UNITS.join(", ")}.`);
    if (typeof isActive !== "boolean") throw invalid("isActive must be a boolean.");

    return { amount, unit, isActive };
}

async function findTaskId(req) {
    const taskId = positiveId(req.params.id);
    if (!await reminders.taskExists(taskId)) throw new HttpError(404, "TASK_NOT_FOUND", "Task not found.");
    return taskId;
}

async function findReminder(req) {
    const reminder = await reminders.getReminderById(positiveId(req.params.id));
    if (!reminder) throw new HttpError(404, "REMINDER_NOT_FOUND", "Reminder not found.");
    return reminder;
}

async function getReminders(req, res, next) {
    try {
        res.json({ data: await reminders.getRemindersByTask(await findTaskId(req)) });
    } catch (error) { next(error); }
}

async function postReminder(req, res, next) {
    try {
        const taskId = await findTaskId(req);
        const { amount, unit, isActive } = parseReminder(req.body);
        res.status(201).json({ data: await reminders.createReminder(taskId, amount, unit, isActive) });
    } catch (error) { next(error); }
}

async function patchReminder(req, res, next) {
    try {
        const current = await findReminder(req);
        const { amount, unit, isActive } = parseReminder(req.body, current);
        res.json({ data: await reminders.updateReminder(current.id, amount, unit, isActive) });
    } catch (error) { next(error); }
}

async function deleteReminder(req, res, next) {
    try {
        const current = await findReminder(req);
        await reminders.deleteReminderById(current.id);
        res.status(204).send();
    } catch (error) { next(error); }
}

module.exports = { getReminders, postReminder, patchReminder, deleteReminder };
