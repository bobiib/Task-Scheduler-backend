const {
    getAllLabels,
    getLabelById,
    createLabel,
    updateLabel,
    deleteLabelById
} = require("../models/labelModel.js");

function isValidText(value, maxLength) {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function handleDatabaseError(error, res) {
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Ein Label mit diesem Namen existiert bereits." });
    }
    console.error("Label-API:", error.message);
    return res.status(500).json({ message: "Interner Serverfehler." });
}

async function getLabels(req, res) {
    try {
        const labels = await getAllLabels();
        return res.status(200).json(labels);
    } catch (error) {
        return handleDatabaseError(error, res);
    }
}

async function getLabel(req, res) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Die ID muss eine positive ganze Zahl sein." });
    }

    try {
        const label = await getLabelById(id);
        if (!label) {
            return res.status(404).json({ message: "Label nicht gefunden." });
        }
        return res.status(200).json(label);
    } catch (error) {
        return handleDatabaseError(error, res);
    }
}

async function postLabel(req, res) {
    const name = req.body?.name;
    const color = req.body?.color;

    if (!isValidText(name, 100)) {
        return res.status(400).json({ message: "name muss ein Text mit 1 bis 100 Zeichen sein." });
    }
    if (!isValidText(color, 50)) {
        return res.status(400).json({ message: "color muss ein Text mit 1 bis 50 Zeichen sein." });
    }

    try {
        const label = await createLabel(name.trim(), color.trim());
        return res.status(201).json(label);
    } catch (error) {
        return handleDatabaseError(error, res);
    }
}

async function patchLabel(req, res) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Die ID muss eine positive ganze Zahl sein." });
    }

    const name = req.body?.name;
    const color = req.body?.color;
    if (name === undefined && color === undefined) {
        return res.status(400).json({ message: "Mindestens name oder color muss angegeben werden." });
    }
    if (name !== undefined && !isValidText(name, 100)) {
        return res.status(400).json({ message: "name muss ein Text mit 1 bis 100 Zeichen sein." });
    }
    if (color !== undefined && !isValidText(color, 50)) {
        return res.status(400).json({ message: "color muss ein Text mit 1 bis 50 Zeichen sein." });
    }

    try {
        const existingLabel = await getLabelById(id);
        if (!existingLabel) {
            return res.status(404).json({ message: "Label nicht gefunden." });
        }

        const label = await updateLabel(
            id,
            name === undefined ? existingLabel.name : name.trim(),
            color === undefined ? existingLabel.color : color.trim()
        );
        if (!label) {
            return res.status(404).json({ message: "Label nicht gefunden." });
        }
        return res.status(200).json(label);
    } catch (error) {
        return handleDatabaseError(error, res);
    }
}

async function deleteLabel(req, res) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Die ID muss eine positive ganze Zahl sein." });
    }

    try {
        const deleted = await deleteLabelById(id);
        if (!deleted) {
            return res.status(404).json({ message: "Label nicht gefunden." });
        }
        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res);
    }
}

module.exports = { getLabels, getLabel, postLabel, patchLabel, deleteLabel };
