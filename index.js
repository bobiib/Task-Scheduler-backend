require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

async function startServer() {
    try {
        await pool.query("SELECT 1");
        console.log("MariaDB-Verbindung erfolgreich.");

        app.listen(PORT, () => {
            console.log(`Server läuft auf Port ${PORT}`);
        });
    } catch (error) {
        console.error("MariaDB-Verbindung fehlgeschlagen:", error.message);
        process.exit(1);
    }
}

startServer();