const taskService = require("../services/taskService");

async function listTasks(req, res) {
    const tasks = await taskService.listTasks(req.query);
    res.status(200).json({ data: tasks });
}

async function getTask(req, res) {
    const task = await taskService.getTask(req.params.id);
    res.status(200).json({ data: task });
}

async function createTask(req, res) {
    const task = await taskService.createTask(req.body);
    res.status(201).json({ data: task });
}

async function updateTask(req, res) {
    const task = await taskService.updateTask(req.params.id, req.body);
    res.status(200).json({ data: task });
}

async function deleteTask(req, res) {
    await taskService.deleteTask(req.params.id);
    res.status(204).send();
}

async function updateTaskInstanceStatus(req, res) {
    const task = await taskService.updateTaskInstanceStatus(
        req.params.instanceId,
        req.body
    );
    res.status(200).json({ data: task });
}

module.exports = {
    listTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateTaskInstanceStatus
};
