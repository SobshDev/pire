use axum::{
    Json, Router,
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use serde_json::json;
use sqlx::PgPool;
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tower_sessions::{
    Expiry, SessionManagerLayer,
    cookie::{SameSite, time::Duration},
};
use tower_sessions_sqlx_store::PostgresStore;
use utoipa::OpenApi;

use crate::{auth, config::Config, error::ApiError, openapi::ApiDoc, progress};

/// Header every state-changing API request must carry. Browsers can't add custom
/// headers to cross-site requests without a CORS preflight, which this API never
/// approves, so requiring it blocks cross-site request forgery.
pub const CSRF_HEADER: &str = "x-pire-request";

pub const SESSION_COOKIE: &str = "pire_session";

/// Build the full application: API routes, sessions, and (optionally) the frontend.
pub async fn build(pool: PgPool, config: &Config) -> Result<Router, sqlx::Error> {
    let store = PostgresStore::new(pool.clone());
    store.migrate().await?;

    let sessions = SessionManagerLayer::new(store)
        .with_name(SESSION_COOKIE)
        .with_http_only(true)
        .with_same_site(SameSite::Lax)
        .with_secure(config.cookie_secure)
        .with_expiry(Expiry::OnInactivity(Duration::days(30)));

    let api = Router::new()
        .route("/health", get(health))
        .route("/openapi.json", get(openapi_json))
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/me", get(auth::me))
        .route("/progress", get(progress::list))
        .route("/progress/{lesson_id}", put(progress::save))
        .fallback(|| async { ApiError::NotFound })
        .layer(middleware::from_fn(require_csrf_header))
        .layer(sessions)
        .with_state(pool);

    let mut app = Router::new().nest("/api", api);

    if let Some(dir) = &config.static_dir {
        // Unknown paths fall back to index.html so client-side routes work on reload.
        let index = dir.join("index.html");
        app = app.fallback_service(ServeDir::new(dir).fallback(ServeFile::new(index)));
    }

    Ok(app.layer(CompressionLayer::new()).layer(TraceLayer::new_for_http()))
}

async fn require_csrf_header(req: Request, next: Next) -> Response {
    let safe = matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS);
    if safe || req.headers().contains_key(CSRF_HEADER) {
        next.run(req).await
    } else {
        (StatusCode::FORBIDDEN, Json(json!({ "error": "Missing request header." }))).into_response()
    }
}

async fn health(State(pool): State<PgPool>) -> Response {
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => Json(json!({ "status": "ok" })).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "health check failed");
            (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "status": "database unavailable" }))).into_response()
        }
    }
}

async fn openapi_json() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}
