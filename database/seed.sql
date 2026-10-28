USE task_scheduler;

START TRANSACTION;

-- Users ---------------------------------------------------------------------
-- example.test addresses are deliberately non-deliverable development data.
INSERT INTO users (name, email, initials, password_hash, is_active)
VALUES
    ('Fabio Erculiani', 'fabio.erculiani@example.test', 'FA', NULL, TRUE),
    ('Dmytro Yermakov', 'dmytro.yermakov@example.test', 'DY', NULL, TRUE),
    ('Boris', 'boris@example.test', 'BO', NULL, TRUE),
    ('Liam Bruno', 'liam.bruno@example.test', 'LB', NULL, TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    initials = VALUES(initials),
    is_active = TRUE;

SELECT id INTO @fabio_id FROM users WHERE email = 'fabio.erculiani@example.test';
SELECT id INTO @dmytro_id FROM users WHERE email = 'dmytro.yermakov@example.test';
SELECT id INTO @boris_id FROM users WHERE email = 'boris@example.test';
SELECT id INTO @liam_id FROM users WHERE email = 'liam.bruno@example.test';

-- Teams ---------------------------------------------------------------------
INSERT INTO teams (name, initials, created_by_user_id)
VALUES ('Projektteam', 'PT', @fabio_id)
ON DUPLICATE KEY UPDATE
    initials = VALUES(initials),
    created_by_user_id = VALUES(created_by_user_id);

SELECT id INTO @project_team_id FROM teams WHERE name = 'Projektteam';

INSERT INTO team_users (team_id, user_id, role)
VALUES
    (@project_team_id, @fabio_id, 'admin'),
    (@project_team_id, @dmytro_id, 'member'),
    (@project_team_id, @boris_id, 'member'),
    (@project_team_id, @liam_id, 'member')
ON DUPLICATE KEY UPDATE role = VALUES(role);

-- Labels --------------------------------------------------------------------
INSERT INTO labels (name, color)
VALUES
    ('Development', '#4F46E5'),
    ('Schule', '#9333EA'),
    ('IT', '#0284C7'),
    ('Design', '#EF4444'),
    ('Organisation', '#D97706')
ON DUPLICATE KEY UPDATE color = VALUES(color);

SELECT id INTO @development_label_id FROM labels WHERE name = 'Development';
SELECT id INTO @school_label_id FROM labels WHERE name = 'Schule';
SELECT id INTO @it_label_id FROM labels WHERE name = 'IT';
SELECT id INTO @design_label_id FROM labels WHERE name = 'Design';
SELECT id INTO @organisation_label_id FROM labels WHERE name = 'Organisation';

-- Tasks ---------------------------------------------------------------------
-- Each INSERT is guarded so the seed can safely be executed more than once.
INSERT INTO tasks (
    title, description, schedule_type, schedule_date, default_due_time,
    created_by_user_id, assigned_user_id, assigned_team_id
)
SELECT
    'Projektstatusbericht Sprint 1',
    'Statusbericht für Sprint 1 fertigstellen und abgeben.',
    'date', '2026-10-14', '17:00:00',
    @fabio_id, NULL, @project_team_id
WHERE NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE title = 'Projektstatusbericht Sprint 1'
      AND created_by_user_id = @fabio_id
);

SELECT id INTO @status_report_task_id
FROM tasks
WHERE title = 'Projektstatusbericht Sprint 1'
  AND created_by_user_id = @fabio_id
ORDER BY id
LIMIT 1;

INSERT INTO tasks (
    title, description, schedule_type, schedule_date, default_due_time,
    created_by_user_id, assigned_user_id, assigned_team_id
)
SELECT
    'Sprint-Planning abschliessen',
    'Offene Punkte festhalten und die Aufgaben des Teams priorisieren.',
    'date', '2026-10-14', '14:00:00',
    @liam_id, @liam_id, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE title = 'Sprint-Planning abschliessen'
      AND created_by_user_id = @liam_id
);

SELECT id INTO @sprint_planning_task_id
FROM tasks
WHERE title = 'Sprint-Planning abschliessen'
  AND created_by_user_id = @liam_id
ORDER BY id
LIMIT 1;

INSERT INTO tasks (
    title, description, schedule_type, schedule_date, default_due_time,
    created_by_user_id, assigned_user_id, assigned_team_id
)
SELECT
    'Server-Backup prüfen',
    'Automatisches Backup prüfen und Fehlermeldungen dokumentieren.',
    'date', '2026-10-14', '18:30:00',
    @fabio_id, @dmytro_id, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE title = 'Server-Backup prüfen'
      AND created_by_user_id = @fabio_id
);

SELECT id INTO @backup_task_id
FROM tasks
WHERE title = 'Server-Backup prüfen'
  AND created_by_user_id = @fabio_id
ORDER BY id
LIMIT 1;

INSERT INTO tasks (
    title, description, schedule_type, schedule_date, default_due_time,
    created_by_user_id, assigned_user_id, assigned_team_id
)
SELECT
    'Mockups finalisieren',
    'Pflichtenheft-Mockups für die Abgabe vorbereiten.',
    'date', '2026-09-02', '12:00:00',
    @liam_id, @liam_id, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE title = 'Mockups finalisieren'
      AND created_by_user_id = @liam_id
);

SELECT id INTO @mockups_task_id
FROM tasks
WHERE title = 'Mockups finalisieren'
  AND created_by_user_id = @liam_id
ORDER BY id
LIMIT 1;

INSERT INTO tasks (
    title, description, schedule_type, schedule_date, default_due_time,
    created_by_user_id, assigned_user_id, assigned_team_id
)
SELECT
    'Team-Meeting vorbereiten',
    'Agenda aktualisieren und offene Fragen für das Team sammeln.',
    'date', '2026-10-15', '09:00:00',
    @boris_id, @boris_id, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE title = 'Team-Meeting vorbereiten'
      AND created_by_user_id = @boris_id
);

SELECT id INTO @team_meeting_task_id
FROM tasks
WHERE title = 'Team-Meeting vorbereiten'
  AND created_by_user_id = @boris_id
ORDER BY id
LIMIT 1;

INSERT INTO tasks (
    title, description, schedule_type, schedule_date, default_due_time,
    created_by_user_id, assigned_user_id, assigned_team_id
)
SELECT
    'Task-API fertigstellen',
    'Task-Endpunkte implementieren und mit dem Frontend integrieren.',
    'date', '2026-10-14', '16:00:00',
    @fabio_id, @fabio_id, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE title = 'Task-API fertigstellen'
      AND created_by_user_id = @fabio_id
);

SELECT id INTO @task_api_task_id
FROM tasks
WHERE title = 'Task-API fertigstellen'
  AND created_by_user_id = @fabio_id
ORDER BY id
LIMIT 1;

-- Task labels ---------------------------------------------------------------
INSERT IGNORE INTO task_labels (task_id, label_id)
VALUES
    (@status_report_task_id, @school_label_id),
    (@sprint_planning_task_id, @organisation_label_id),
    (@backup_task_id, @it_label_id),
    (@mockups_task_id, @design_label_id),
    (@team_meeting_task_id, @organisation_label_id),
    (@task_api_task_id, @development_label_id);

-- Recurrence definitions ----------------------------------------------------
INSERT INTO task_recurrences (task_id, repeat_type, start_date)
VALUES
    (@sprint_planning_task_id, 'weekly', '2026-10-14'),
    (@backup_task_id, 'daily', '2026-10-14'),
    (@team_meeting_task_id, 'weekly', '2026-10-15')
ON DUPLICATE KEY UPDATE
    repeat_type = VALUES(repeat_type),
    start_date = VALUES(start_date),
    end_date = NULL;

SELECT id INTO @sprint_planning_recurrence_id
FROM task_recurrences WHERE task_id = @sprint_planning_task_id;
SELECT id INTO @team_meeting_recurrence_id
FROM task_recurrences WHERE task_id = @team_meeting_task_id;

-- ISO weekday numbers: Monday = 1, Sunday = 7.
INSERT IGNORE INTO recurrence_weekdays (recurrence_id, weekday)
VALUES
    (@sprint_planning_recurrence_id, 3),
    (@team_meeting_recurrence_id, 4);

-- Concrete task instances ---------------------------------------------------
-- Wiederkehrende Tasks haben hier jeweils zwei einzelne Termine.
INSERT INTO task_instances (task_id, due_date, due_time, status, completed_at)
VALUES
    (@status_report_task_id, '2026-10-14', '17:00:00', 'open', NULL),
    (@sprint_planning_task_id, '2026-10-14', '14:00:00', 'open', NULL),
    (@sprint_planning_task_id, '2026-10-21', '14:00:00', 'open', NULL),
    (@backup_task_id, '2026-10-14', '18:30:00', 'open', NULL),
    (@backup_task_id, '2026-10-15', '18:30:00', 'open', NULL),
    (@mockups_task_id, '2026-09-02', '12:00:00', 'completed', '2026-09-02 11:45:00'),
    (@team_meeting_task_id, '2026-10-15', '09:00:00', 'open', NULL),
    (@team_meeting_task_id, '2026-10-22', '09:00:00', 'open', NULL),
    (@task_api_task_id, '2026-10-14', '16:00:00', 'open', NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    completed_at = VALUES(completed_at);

-- Reminder definitions ------------------------------------------------------
INSERT INTO task_reminders (task_id, amount, unit, is_active)
VALUES
    (@status_report_task_id, 3, 'days', TRUE),
    (@sprint_planning_task_id, 1, 'hours', TRUE),
    (@backup_task_id, 30, 'minutes', TRUE),
    (@mockups_task_id, 1, 'days', TRUE),
    (@team_meeting_task_id, 1, 'hours', TRUE),
    (@task_api_task_id, 30, 'minutes', TRUE)
ON DUPLICATE KEY UPDATE is_active = TRUE;

COMMIT;

-- Compact verification output for database clients.
SELECT 'users' AS entity, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'labels', COUNT(*) FROM labels
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'task_instances', COUNT(*) FROM task_instances
UNION ALL
SELECT 'task_reminders', COUNT(*) FROM task_reminders;
