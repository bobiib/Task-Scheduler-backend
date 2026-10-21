const express = require("express");
const teams = require("../controllers/teamController");

const router = express.Router();
router.get("/", teams.listTeams);
router.post("/", teams.createTeam);
router.patch("/:id", teams.updateTeam);
router.delete("/:id", teams.deleteTeam);

module.exports = router;
