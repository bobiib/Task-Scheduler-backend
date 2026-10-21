const taskService = require("../services/taskService");

async function listTasks(req, res, next) {
    try {
        const tasks = await taskService.listTasks();
        res.status(200).json({ data: tasks });
    } catch (error) {
        next(error);
    }
}

async function getTask(req, res, next) {
    try {
        const task = await taskService.getTask(req.params.id);
        res.status(200).json({ data: task });
    } catch (error) {
        next(error);
    }
}

async function createTask(req, res, next) {
    try {
        const task = await taskService.createTask(req.body);
        res.status(201).json({ data: task });
    } catch (error) {
        next(error);
    }
}

async function updateTask(req, res, next) {
    try {
        const task = await taskService.updateTask(req.params.id, req.body);
        res.status(200).json({ data: task });
    } catch (error) {
        next(error);
    }
}

async function deleteTask(req, res, next) {
    try {
        await taskService.deleteTask(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
}

async function updateTaskInstanceStatus(req, res, next) {
    try {
        const task = await taskService.updateTaskInstanceStatus(
            req.params.instanceId,
            req.body
        );
        res.status(200).json({ data: task });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateTaskInstanceStatus
};
