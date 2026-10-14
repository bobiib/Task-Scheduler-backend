const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const findTaskCards = require("./taskReader");
const {
    validationError,
    parseId,
    parseTaskInput
} = require("../utils/taskValidation");

async function ensureRecordExists(connection, table, id, fieldName, activeOnly = false) {
    if (id === null) {
        return;
    }

    const activeCondition = activeOnly ? " AND is_active = TRUE" : "";
    const rows = await connection.query(
        `SELECT id FROM ${table} WHERE id = ?${activeCondition}`,
        [id]
    );

    if (rows.length === 0) {
        throw validationError(`${fieldName} does not reference an existing record.`);
    }
}

async function replaceLabels(connection, taskId, labelIds) {
    await connection.query("DELETE FROM task_labels WHERE task_id = ?", [taskId]);

    for (const labelId of labelIds) {
        await connection.query(
            "INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)",
            [taskId, labelId]
        );
    }
}

async function getTaskRow(connection, taskId) {
    const rows = await connection.query(
        `SELECT
            t.title,
            t.description,
            t.assigned_user_id,
            t.assigned_team_id,
            DATE_FORMAT(ti.due_date, '%Y-%m-%d') AS due_date,
            TIME_FORMAT(ti.due_time, '%H:%i:%s') AS due_time
         FROM tasks t
         JOIN task_instances ti ON ti.task_id = t.id
         WHERE t.id = ? AND t.is_active = TRUE
         ORDER BY ti.due_date, ti.due_time
         LIMIT 1`,
        [taskId]
    );

    if (rows.length === 0) {
        throw new HttpError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    return rows[0];
}

async function listTasks() {
    return findTaskCards();
}

async function getTask(id) {
    const taskId = parseId(id, "id");
    const cards = await findTaskCards("AND t.id = ?", [taskId]);

    if (cards.length === 0) {
        throw new HttpError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    return {
        ...cards[0],
        instances: cards.map((card) => ({
            id: card.instanceId,
            dueDate: card.dueDate,
            dueTime: card.dueTime,
            completed: card.completed
        }))
    };
}

async function createTask(body) {
    const task = parseTaskInput(body);
    const createdByUserId = parseId(body.createdByUserId, "createdByUserId");
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await ensureRecordExists(connection, "users", createdByUserId, "createdByUserId", true);
        await ensureRecordExists(connection, "users", task.assignedUserId, "assignedUserId", true);
        await ensureRecordExists(connection, "teams", task.assignedTeamId, "assignedTeamId");

        const result = await connection.query(
            `INSERT INTO tasks (
                title, description, schedule_type, schedule_date,
                default_due_time, created_by_user_id,
                assigned_user_id, assigned_team_id
             ) VALUES (?, ?, 'date', ?, ?, ?, ?, ?)`,
            [
                task.title,
                task.description,
                task.dueDate,
                task.dueTime,
                createdByUserId,
                task.assignedUserId,
                task.assignedTeamId
            ]
        );
        const taskId = Number(result.insertId);

        await replaceLabels(connection, taskId, task.labelIds ?? []);
        const instanceResult = await connection.query(
            "INSERT INTO task_instances (task_id, due_date, due_time) VALUES (?, ?, ?)",
            [taskId, task.dueDate, task.dueTime]
        );

        await connection.commit();
        const cards = await findTaskCards("AND ti.id = ?", [Number(instanceResult.insertId)]);
        return cards[0];
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function updateTask(id, body) {
    const taskId = parseId(id, "id");
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const current = await getTaskRow(connection, taskId);
        const task = parseTaskInput(body, current);

        await ensureRecordExists(connection, "users", task.assignedUserId, "assignedUserId", true);
        await ensureRecordExists(connection, "teams", task.assignedTeamId, "assignedTeamId");

        await connection.query(
            `UPDATE tasks
             SET title = ?, description = ?, default_due_time = ?,
                 assigned_user_id = ?, assigned_team_id = ?,
                 schedule_date = IF(schedule_type = 'date', ?, schedule_date)
             WHERE id = ?`,
            [
                task.title,
                task.description,
                task.dueTime,
                task.assignedUserId,
                task.assignedTeamId,
                task.dueDate,
                taskId
            ]
        );

        if (body.dueDate !== undefined || body.scheduleDate !== undefined || body.dueTime !== undefined) {
            await connection.query(
                `UPDATE task_instances
                 SET due_date = ?, due_time = ?
                 WHERE task_id = ? AND status = 'open'
                 ORDER BY due_date, due_time
                 LIMIT 1`,
                [task.dueDate, task.dueTime, taskId]
            );
        }

        if (task.labelIds !== undefined) {
            await replaceLabels(connection, taskId, task.labelIds);
        }

        await connection.commit();
        const cards = await findTaskCards("AND t.id = ?", [taskId]);
        return cards[0];
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function deleteTask(id) {
    const taskId = parseId(id, "id");
    const result = await pool.query(
        "UPDATE tasks SET is_active = FALSE WHERE id = ? AND is_active = TRUE",
        [taskId]
    );

    if (result.affectedRows === 0) {
        throw new HttpError(404, "TASK_NOT_FOUND", "Task not found.");
    }
}

async function updateTaskInstanceStatus(id, body) {
    const instanceId = parseId(id, "instanceId");

    if (!body || typeof body.completed !== "boolean") {
        throw validationError("completed must be a boolean.");
    }

    const rows = await pool.query(
        `SELECT ti.id
         FROM task_instances ti
         JOIN tasks t ON t.id = ti.task_id
         WHERE ti.id = ? AND t.is_active = TRUE`,
        [instanceId]
    );

    if (rows.length === 0) {
        throw new HttpError(404, "TASK_INSTANCE_NOT_FOUND", "Task instance not found.");
    }

    const status = body.completed ? "completed" : "open";
    await pool.query(
        `UPDATE task_instances
         SET status = ?, completed_at = IF(? = 'completed', NOW(), NULL)
         WHERE id = ?`,
        [status, status, instanceId]
    );

    const cards = await findTaskCards("AND ti.id = ?", [instanceId]);
    return cards[0];
}

module.exports = {
    listTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateTaskInstanceStatus
};
