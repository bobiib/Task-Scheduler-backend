require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./config/db");
const { startReminderScheduler } = require("./services/reminderScheduler");
const labelRoutes = require("./routes/labelRoutes.js");
const taskRoutes = require("./routes/taskRoutes");
const taskInstanceRoutes = require("./routes/taskInstanceRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const userRoutes = require("./routes/userRoutes");
const teamRoutes = require("./routes/teamRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const authRoutes = require("./routes/authRoutes");
const { requireAuth } = require("./middleware/auth");
const HttpError = require("./utils/httpError");

const app = express();
const PORT = process.env.PORT || 3000;
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim());

function limit(max) {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: max,
        handler: (req, res, next) => next(new HttpError(429, "TOO_MANY_REQUESTS", "Too many requests. Try again later."))
    });
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(express.json());
app.use("/api", limit(300));
app.use(["/api/auth/login", "/api/auth/register"], limit(10));
app.use("/api/auth", authRoutes);
app.use("/api", requireAuth);
app.use("/api/labels", labelRoutes);
app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);

app.get("/", (req, res) => {
    res.send("Task-Scheduler Backend läuft!");
});

app.get("/health", async(req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            status: "ok",
            database: "connected"
        });
    } catch (error) {
        res.status(503).json({
            status: "error",
            database: "disconnected"
        });
    }
});

app.use("/api/tasks", taskRoutes);
app.use("/api/task-instances", taskInstanceRoutes);
app.use("/api/reminders", reminderRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
    try {
        await pool.query("SELECT 1");
        console.log("MariaDB-Verbindung erfolgreich.");

        app.listen(PORT, () => {
            console.log(`Server läuft auf Port ${PORT}`);
        });
        startReminderScheduler();
    } catch (error) {
        console.error("MariaDB-Verbindung fehlgeschlagen:", error.message);
        process.exit(1);
    }
}

startServer();
