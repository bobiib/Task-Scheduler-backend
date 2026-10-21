const express = require("express");
const users = require("../controllers/userController");

const router = express.Router();
router.get("/", users.listUsers);
router.post("/", users.createUser);
router.delete("/:id", users.deleteUser);

module.exports = router;
