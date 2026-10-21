const express = require("express");
const taskController = require("../controllers/taskController");

const router = express.Router();

router.patch("/:instanceId/status", taskController.updateTaskInstanceStatus);

module.exports = router;
