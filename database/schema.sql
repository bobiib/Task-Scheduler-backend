CREATE DATABASE IF NOT EXISTS task_scheduler
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE task_scheduler;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    initials VARCHAR(10) NOT NULL,
    password_hash VARCHAR(255) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    initials VARCHAR(10) NOT NULL,
    created_by_user_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS team_users (
    team_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('member', 'admin') NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (team_id, user_id),

    FOREIGN KEY (team_id)
        REFERENCES teams(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_team_users_user (user_id),
    INDEX idx_team_users_role (team_id, role)
);

CREATE TABLE IF NOT EXISTS labels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,

    title VARCHAR(255) NOT NULL,
    description TEXT NULL,

    schedule_type ENUM(
        'date',
        'week',
        'weekday_in_month'
    ) NOT NULL DEFAULT 'date',

    schedule_date DATE NULL,
    schedule_year SMALLINT NULL,
    schedule_month TINYINT NULL,
    schedule_week_of_month TINYINT NULL,
    schedule_weekday TINYINT NULL,

    default_due_time TIME NOT NULL DEFAULT '23:59:00',

    created_by_user_id INT NOT NULL,

    assigned_user_id INT NULL,
    assigned_team_id INT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (assigned_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (assigned_team_id)
        REFERENCES teams(id)
        ON DELETE SET NULL,

    CHECK (
        assigned_user_id IS NULL
        OR assigned_team_id IS NULL
    ),

    CHECK (
        schedule_month IS NULL
        OR schedule_month BETWEEN 1 AND 12
    ),

    CHECK (
        schedule_week_of_month IS NULL
        OR schedule_week_of_month BETWEEN 1 AND 5
    ),

    CHECK (
        schedule_weekday IS NULL
        OR schedule_weekday BETWEEN 1 AND 7
    ),

    CHECK (
        (
            schedule_type = 'date'
            AND schedule_date IS NOT NULL
        )
        OR
        (
            schedule_type = 'week'
            AND schedule_year IS NOT NULL
            AND schedule_month IS NOT NULL
            AND schedule_week_of_month IS NOT NULL
        )
        OR
        (
            schedule_type = 'weekday_in_month'
            AND schedule_year IS NOT NULL
            AND schedule_month IS NOT NULL
            AND schedule_week_of_month IS NOT NULL
            AND schedule_weekday IS NOT NULL
        )
    ),

    INDEX idx_tasks_created_by (created_by_user_id),
    INDEX idx_tasks_assigned_user (assigned_user_id),
    INDEX idx_tasks_assigned_team (assigned_team_id)
);

CREATE TABLE IF NOT EXISTS task_labels (
    task_id INT NOT NULL,
    label_id INT NOT NULL,

    PRIMARY KEY (task_id, label_id),

    FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    FOREIGN KEY (label_id)
        REFERENCES labels(id)
        ON DELETE CASCADE,

    INDEX idx_task_labels_label (label_id)
);

CREATE TABLE IF NOT EXISTS task_recurrences (
    id INT AUTO_INCREMENT PRIMARY KEY,

    task_id INT NOT NULL UNIQUE,

    repeat_type ENUM(
        'daily',
        'weekly',
        'monthly_day',
        'monthly_weekday',
        'yearly'
    ) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NULL,

    day_of_month TINYINT NULL,
    week_of_month TINYINT NULL,
    weekday TINYINT NULL,
    month_of_year TINYINT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    CHECK (
        end_date IS NULL
        OR end_date >= start_date
    ),

    CHECK (
        day_of_month IS NULL
        OR day_of_month BETWEEN 1 AND 31
    ),

    CHECK (
        week_of_month IS NULL
        OR week_of_month BETWEEN 1 AND 5
    ),

    CHECK (
        weekday IS NULL
        OR weekday BETWEEN 1 AND 7
    ),

    CHECK (
        month_of_year IS NULL
        OR month_of_year BETWEEN 1 AND 12
    ),

    CHECK (
        repeat_type = 'daily'
        OR repeat_type = 'weekly'
        OR (
            repeat_type = 'monthly_day'
            AND day_of_month IS NOT NULL
        )
        OR (
            repeat_type = 'monthly_weekday'
            AND week_of_month IS NOT NULL
            AND weekday IS NOT NULL
        )
        OR (
            repeat_type = 'yearly'
            AND month_of_year IS NOT NULL
            AND day_of_month IS NOT NULL
        )
    )
);

CREATE TABLE IF NOT EXISTS recurrence_weekdays (
    recurrence_id INT NOT NULL,
    weekday TINYINT NOT NULL,

    PRIMARY KEY (recurrence_id, weekday),

    FOREIGN KEY (recurrence_id)
        REFERENCES task_recurrences(id)
        ON DELETE CASCADE,

    CHECK (
        weekday BETWEEN 1 AND 7
    )
);

CREATE TABLE IF NOT EXISTS task_instances (
    id INT AUTO_INCREMENT PRIMARY KEY,

    task_id INT NOT NULL,
    due_date DATE NOT NULL,
    due_time TIME NOT NULL DEFAULT '23:59:00',

    status ENUM(
        'open',
        'completed'
    ) NOT NULL DEFAULT 'open',

    completed_at DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    UNIQUE (
        task_id,
        due_date,
        due_time
    ),

    INDEX idx_instances_task (task_id),
    INDEX idx_instances_due_date (due_date),
    INDEX idx_instances_status (status),
    INDEX idx_instances_status_due (
        status,
        due_date,
        due_time
    )
);

CREATE TABLE IF NOT EXISTS task_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,

    task_id INT NOT NULL,
    amount INT NOT NULL,

    unit ENUM(
        'minutes',
        'hours',
        'days',
        'weeks'
    ) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    CHECK (
        amount > 0
    ),

    UNIQUE (
        task_id,
        amount,
        unit
    ),

    INDEX idx_reminders_task (task_id)
);

CREATE TABLE IF NOT EXISTS reminder_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,

    reminder_id INT NOT NULL,
    task_instance_id INT NOT NULL,

    scheduled_for DATETIME NOT NULL,

    status ENUM(
        'pending',
        'sent',
        'failed'
    ) NOT NULL DEFAULT 'pending',

    sent_at DATETIME NULL,
    error_message TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (reminder_id)
        REFERENCES task_reminders(id)
        ON DELETE CASCADE,

    FOREIGN KEY (task_instance_id)
        REFERENCES task_instances(id)
        ON DELETE CASCADE,

    UNIQUE (
        reminder_id,
        task_instance_id
    ),

    INDEX idx_reminder_delivery_queue (
        status,
        scheduled_for
    )
);

CREATE OR REPLACE VIEW task_instance_overview AS
SELECT
    ti.id AS task_instance_id,
    ti.task_id,
    t.title,
    t.description,
    ti.due_date,
    ti.due_time,
    ti.status,
    ti.completed_at,
    t.assigned_user_id,
    t.assigned_team_id,
    CASE
        WHEN ti.status = 'open'
             AND TIMESTAMP(ti.due_date, ti.due_time) < NOW()
        THEN TRUE
        ELSE FALSE
    END AS is_overdue
FROM task_instances ti
INNER JOIN tasks t
    ON t.id = ti.task_id;