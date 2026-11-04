const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
        throw new Error("E-Mail-Versand ist nicht konfiguriert: SMTP_HOST und SMTP_FROM in .env setzen.");
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
                : undefined
        });
    }

    return transporter;
}

function formatDate(value) {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
}

// Errors are passed on so that the caller can store them for the delivery.
async function sendReminderEmail(to, task) {
    const due = `${formatDate(task.dueDate)} um ${task.dueTime.slice(0, 5)} Uhr`;

    await getTransporter().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: `Erinnerung: ${task.title}`,
        text: `Hallo\n\nDie Aufgabe "${task.title}" ist am ${due} fällig.\n\nTask-Scheduler`
    });
}

module.exports = { sendReminderEmail };
