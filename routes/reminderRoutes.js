const express = require("express");
const { patchReminder, deleteReminder } = require("../controllers/reminderController");

const router = express.Router();

router.patch("/:id", patchReminder);
router.delete("/:id", deleteReminder);

module.exports = router;
