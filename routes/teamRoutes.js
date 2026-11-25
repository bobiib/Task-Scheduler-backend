const express = require("express");
const teams = require("../controllers/teamController");
const { requireTeamAdmin } = require("../middleware/auth");

const router = express.Router();
router.get("/", teams.listTeams);
router.post("/", teams.createTeam);
router.patch("/:id", requireTeamAdmin, teams.updateTeam);
router.delete("/:id", requireTeamAdmin, teams.deleteTeam);

module.exports = router;
