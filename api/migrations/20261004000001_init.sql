CREATE TABLE users (
    id            UUID PRIMARY KEY,
    email         TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE lesson_progress (
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    lesson_id    TEXT NOT NULL,
    beat_index   INTEGER NOT NULL DEFAULT 0 CHECK (beat_index >= 0),
    completed_at TIMESTAMPTZ,
    state        JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
