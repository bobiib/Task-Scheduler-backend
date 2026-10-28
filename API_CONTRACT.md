# Sprint 1 API contract

Base URL: `http://localhost:3001/api`

All request and response fields use `camelCase`. Successful responses use a
`data` property. Validation and server errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": ["title is required"]
  }
}
```

## Task card representation

`GET /api/tasks` returns task instances because recurring tasks must be
completed independently.

```json
{
  "id": 12,
  "instanceId": 31,
  "title": "Sprintbericht fertigstellen",
  "description": "Statusbericht abgeben",
  "dueDate": "2026-10-14",
  "dueTime": "17:00",
  "scheduleType": "date",
  "recurrence": null,
  "reminder": "3 Tage vorher",
  "labels": [
    { "id": 2, "name": "Schule", "color": "schule" }
  ],
  "assignee": {
    "type": "user",
    "id": 1,
    "name": "Fabio",
    "initials": "FA"
  },
  "completed": false
}
```

For Sprint 1 the frontend may display the first entry from `labels`, while the
API keeps the array so that the database's many-to-many relation is preserved.

## Tasks

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/tasks` | List task instances |
| `GET` | `/tasks/:id` | Read one task and its current instances |
| `POST` | `/tasks` | Create a task and its first instance |
| `PATCH` | `/tasks/:id` | Update task master data |
| `DELETE` | `/tasks/:id` | Deactivate a task (`is_active = false`) |
| `PATCH` | `/task-instances/:instanceId/status` | Complete or reopen exactly one task instance |

Minimal create-task body:

```json
{
  "title": "Sprintbericht fertigstellen",
  "description": "Statusbericht abgeben",
  "scheduleType": "date",
  "dueDate": "2026-10-14",
  "dueTime": "17:00",
  "createdByUserId": 1,
  "assignedUserId": 1,
  "assignedTeamId": null,
  "labelIds": [2]
}
```

Status body:

```json
{ "completed": true }
```

At most one of `assignedUserId` and `assignedTeamId` may be set.

## Recurrence

`POST /tasks` and `PATCH /tasks/:id` accept an optional `recurrence` object.
`null` removes the rule. `GET /tasks/:id` returns it as `recurrenceRule`.

```json
{
  "type": "weekly",
  "startDate": "2026-10-28",
  "endDate": null,
  "weekdays": [1, 5]
}
```

| `type` | Fields | Default from `startDate` |
| --- | --- | --- |
| `daily` | – | – |
| `weekly` | `weekdays` (1 = Monday … 7 = Sunday) | weekday of start |
| `monthly_day` | `dayOfMonth` (1–31) | day of start |
| `monthly_weekday` | `weekOfMonth` (1–5), `weekday` (1–7) | from start |
| `yearly` | `monthOfYear` (1–12), `dayOfMonth` | from start |

`startDate` defaults to `dueDate`, `endDate` is optional. When a task is created
with a rule, its first instance is the first date that matches the rule.
Months without the requested day (e.g. 31) are skipped.

Reminder rules from the seed are returned for display only.

## Labels

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/labels` | List labels with their task counts |
| `GET` | `/labels/:id` | Read one label |
| `POST` | `/labels` | Create a label from `name` and `color` |
| `PATCH` | `/labels/:id` | Change a label's name or color |
| `DELETE` | `/labels/:id` | Delete an unused label |

Label responses contain numeric `id`, `name`, `color` and `taskCount` (number of
active tasks using the label). A label still linked to a task cannot be deleted.

## Users

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/users` | List active users |
| `POST` | `/users` | Create a user from `name`, `email`, and `initials` |
| `DELETE` | `/users/:id` | Deactivate a user |

Users contain numeric `id`, `name`, `email` and `initials`. Deactivated users no
longer appear in `GET /users`.

## Teams

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/teams` | List teams and their members |
| `POST` | `/teams` | Create a team with `name`, `initials`, `createdByUserId`, and `memberIds` |
| `PATCH` | `/teams/:id` | Update team data and members |
| `DELETE` | `/teams/:id` | Delete a team when it is not required by active work |

Teams contain numeric `id`, `name`, `initials`, `createdByUserId` and `members`.
Each member has `id`, `name`, `initials` and `role`. `memberIds` in a create or
update request must refer to active users. Deleting a team with active assigned
tasks returns `409`.

The optional `adminIds` array sets which members have the `admin` role; every
admin must also be a member. When a team is created without `adminIds`, the
creator becomes admin if they are a member. When a team is updated without
`adminIds`, the remaining members keep their stored roles.

For these reference endpoints, successful reads, creates and updates also use
`{ "data": ... }`, like the task endpoints.

## Required status codes

- `200` for successful reads and updates
- `201` for successful creates
- `204` for successful deletes
- `400` for validation failures
- `404` when a requested record does not exist
- `409` for unique or relationship conflicts
- `500` for unexpected server errors
