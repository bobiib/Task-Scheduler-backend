const express = require("express");
const { getLabels, getLabel, postLabel, patchLabel, deleteLabel } = require("../controllers/labelController.js");

const router = express.Router();

router.get("/", getLabels);
router.get("/:id", getLabel);
router.post("/", postLabel);
router.patch("/:id", patchLabel);
router.delete("/:id", deleteLabel);

module.exports = router;
