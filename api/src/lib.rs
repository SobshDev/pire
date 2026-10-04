pub mod app;
pub mod auth;
pub mod config;
pub mod error;
pub mod openapi;
pub mod progress;

/// Embedded SQL migrations from api/migrations.
pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
