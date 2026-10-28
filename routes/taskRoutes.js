const express = require("express");
const taskController = require("../controllers/taskController");
const { getReminders, postReminder } = require("../controllers/reminderController");

const router = express.Router();

router.get("/", taskController.listTasks);
router.get("/:id", taskController.getTask);
router.post("/", taskController.createTask);
router.patch("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);
router.get("/:id/reminders", getReminders);
router.post("/:id/reminders", postReminder);

module.exports = router;
