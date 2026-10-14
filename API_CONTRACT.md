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
| `GET` | `/tasks` | List task instances; optional `search`, `status`, `assigneeId`, `labelId`, `from`, and `to` filters |
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
  "scheduleDate": "2026-10-14",
  "dueTime": "17:00",
  "createdByUserId": 1,
  "assignedUserId": 1,
  "assignedTeamId": null,
  "labelIds": [2],
  "recurrence": null,
  "reminder": { "amount": 3, "unit": "days" }
}
```

Status body:

```json
{ "completed": true }
```

Exactly one of `assignedUserId` and `assignedTeamId` may be set.

## Labels

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/labels` | List labels with their task counts |
| `POST` | `/labels` | Create a label from `name` and `color` |
| `DELETE` | `/labels/:id` | Delete an unused label |

## Users

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/users` | List active users |
| `POST` | `/users` | Create a user from `name`, `email`, and `initials` |
| `DELETE` | `/users/:id` | Deactivate a user |

## Teams

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/teams` | List teams and their members |
| `POST` | `/teams` | Create a team with `name`, `initials`, `createdByUserId`, and `memberIds` |
| `PATCH` | `/teams/:id` | Update team data and members |
| `DELETE` | `/teams/:id` | Delete a team when it is not required by active work |

## Required status codes

- `200` for successful reads and updates
- `201` for successful creates
- `204` for successful deletes
- `400` for validation failures
- `404` when a requested record does not exist
- `409` for unique or relationship conflicts
- `500` for unexpected server errors
