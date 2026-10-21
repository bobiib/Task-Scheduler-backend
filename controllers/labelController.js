const labels = require("../models/labelModel");
const HttpError = require("../utils/httpError");
const { positiveId, requiredText } = require("../utils/referenceValidation");

async function getLabels(req, res, next) {
    try {
        res.json({ data: await labels.getAllLabels() });
    } catch (error) { next(error); }
}

async function getLabel(req, res, next) {
    try {
        const label = await labels.getLabelById(positiveId(req.params.id));
        if (!label) throw new HttpError(404, "NOT_FOUND", "Label not found.");
        res.json({ data: label });
    } catch (error) { next(error); }
}

async function postLabel(req, res, next) {
    try {
        const name = requiredText(req.body?.name, "name", 100);
        const color = requiredText(req.body?.color, "color", 50);
        res.status(201).json({ data: await labels.createLabel(name, color) });
    } catch (error) { next(error); }
}

async function patchLabel(req, res, next) {
    try {
        const id = positiveId(req.params.id);
        const current = await labels.getLabelById(id);
        if (!current) throw new HttpError(404, "NOT_FOUND", "Label not found.");
        if (req.body?.name === undefined && req.body?.color === undefined) {
            throw new HttpError(400, "VALIDATION_ERROR", "Provide name or color.");
        }
        const name = req.body.name === undefined ? current.name : requiredText(req.body.name, "name", 100);
        const color = req.body.color === undefined ? current.color : requiredText(req.body.color, "color", 50);
        res.json({ data: await labels.updateLabel(id, name, color) });
    } catch (error) { next(error); }
}

async function deleteLabel(req, res, next) {
    try {
        const id = positiveId(req.params.id);
        if (!await labels.getLabelById(id)) throw new HttpError(404, "NOT_FOUND", "Label not found.");
        if (!await labels.deleteLabelById(id)) {
            throw new HttpError(409, "CONFLICT", "A task still uses this label.");
        }
        res.status(204).send();
    } catch (error) { next(error); }
}

module.exports = { getLabels, getLabel, postLabel, patchLabel, deleteLabel };
