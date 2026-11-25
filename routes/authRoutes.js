const express = require("express");
const auth = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.post("/register", auth.register);
router.post("/login", auth.login);
router.get("/me", requireAuth, auth.me);
router.post("/logout", auth.logout);

module.exports = router;
