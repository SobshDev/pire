//! End-to-end tests for the HTTP API against a real Postgres database.
//! Each test gets a fresh database from #[sqlx::test]; DATABASE_URL must point at a server.

use axum::{
    Router,
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use http_body_util::BodyExt;
use pire_api::{
    app::{self, CSRF_HEADER},
    config::Config,
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

struct Client {
    app: Router,
    cookie: Option<String>,
}

impl Client {
    async fn new(pool: PgPool) -> Self {
        let config = Config {
            database_url: String::new(),
            bind_addr: "127.0.0.1:0".parse().unwrap(),
            static_dir: None,
            cookie_secure: false,
            tutor: None,
        };
        Self { app: app::build(pool, &config).await.unwrap(), cookie: None }
    }

    async fn send(&mut self, method: Method, uri: &str, body: Option<Value>, csrf: bool) -> (StatusCode, Value) {
        let mut req = Request::builder().method(method).uri(uri);
        if csrf {
            req = req.header(CSRF_HEADER, "1");
        }
        if let Some(cookie) = &self.cookie {
            req = req.header(header::COOKIE, cookie);
        }
        let req = match body {
            Some(b) => req.header(header::CONTENT_TYPE, "application/json").body(Body::from(b.to_string())),
            None => req.body(Body::empty()),
        }
        .unwrap();

        let res = self.app.clone().oneshot(req).await.unwrap();
        if let Some(set) = res.headers().get(header::SET_COOKIE) {
            // Keep only "name=value"; drop attributes like Path and HttpOnly.
            let pair = set.to_str().unwrap().split(';').next().unwrap().to_string();
            self.cookie = Some(pair);
        }
        let status = res.status();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        let json = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).unwrap() };
        (status, json)
    }

    async fn get(&mut self, uri: &str) -> (StatusCode, Value) {
        self.send(Method::GET, uri, None, false).await
    }

    async fn post(&mut self, uri: &str, body: Value) -> (StatusCode, Value) {
        self.send(Method::POST, uri, Some(body), true).await
    }

    async fn put(&mut self, uri: &str, body: Value) -> (StatusCode, Value) {
        self.send(Method::PUT, uri, Some(body), true).await
    }
}

fn ada() -> Value {
    json!({ "email": "Ada@Example.com", "password": "correct horse", "display_name": "Ada" })
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn register_signs_in_and_me_returns_the_user(pool: PgPool) {
    let mut c = Client::new(pool).await;

    let (status, user) = c.post("/api/auth/register", ada()).await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(user["email"], "ada@example.com");
    assert!(user.get("password_hash").is_none());

    let (status, me) = c.get("/api/auth/me").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(me["id"], user["id"]);
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn duplicate_email_is_rejected_regardless_of_case(pool: PgPool) {
    let mut c = Client::new(pool).await;
    c.post("/api/auth/register", ada()).await;

    let mut again = ada();
    again["email"] = json!("ADA@example.COM");
    let (status, _) = c.post("/api/auth/register", again).await;
    assert_eq!(status, StatusCode::CONFLICT);
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn login_logout_cycle(pool: PgPool) {
    let mut c = Client::new(pool.clone()).await;
    c.post("/api/auth/register", ada()).await;

    let (status, _) = c.post("/api/auth/logout", json!({})).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(c.get("/api/auth/me").await.0, StatusCode::UNAUTHORIZED);

    let (status, body) =
        c.post("/api/auth/login", json!({ "email": "ada@example.com", "password": "wrong password" })).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "Wrong email or password.");

    let (status, body) =
        c.post("/api/auth/login", json!({ "email": "nobody@example.com", "password": "whatever1" })).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "unknown emails get the same answer");
    assert_eq!(body["error"], "Wrong email or password.");

    let (status, _) =
        c.post("/api/auth/login", json!({ "email": " ADA@example.com ", "password": "correct horse" })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(c.get("/api/auth/me").await.0, StatusCode::OK);
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn progress_is_saved_per_user_and_keeps_first_completion(pool: PgPool) {
    let mut c = Client::new(pool.clone()).await;
    assert_eq!(c.get("/api/progress").await.0, StatusCode::UNAUTHORIZED);

    c.post("/api/auth/register", ada()).await;
    let (status, saved) =
        c.put("/api/progress/m1.l1", json!({ "beat_index": 3, "completed": false, "state": {} })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(saved["beat_index"], 3);
    assert!(saved["completed_at"].is_null());

    let (_, done) = c
        .put("/api/progress/m1.l1", json!({ "beat_index": 12, "completed": true, "state": { "hints": 1 } }))
        .await;
    let first_completion = done["completed_at"].clone();
    assert!(first_completion.is_string());

    // Replaying the lesson must not erase or move the completion time.
    let (_, replay) =
        c.put("/api/progress/m1.l1", json!({ "beat_index": 0, "completed": false, "state": {} })).await;
    assert_eq!(replay["completed_at"], first_completion);

    let (_, list) = c.get("/api/progress").await;
    assert_eq!(list.as_array().unwrap().len(), 1);
    assert_eq!(list[0]["lesson_id"], "m1.l1");

    // Another account sees none of it.
    let mut other = Client::new(pool).await;
    other
        .post("/api/auth/register", json!({ "email": "bob@example.com", "password": "hunter2hunter2", "display_name": "Bob" }))
        .await;
    let (_, list) = other.get("/api/progress").await;
    assert_eq!(list, json!([]));
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn invalid_progress_is_rejected(pool: PgPool) {
    let mut c = Client::new(pool).await;
    c.post("/api/auth/register", ada()).await;

    let bad_id = c.put("/api/progress/M1..%2F", json!({ "beat_index": 0, "completed": false, "state": {} })).await;
    assert_eq!(bad_id.0, StatusCode::BAD_REQUEST);

    let bad_state = c.put("/api/progress/m1.l1", json!({ "beat_index": 0, "completed": false, "state": [1] })).await;
    assert_eq!(bad_state.0, StatusCode::BAD_REQUEST);

    let big = "x".repeat(20_000);
    let too_big = c.put("/api/progress/m1.l1", json!({ "beat_index": 0, "completed": false, "state": { "big": big } })).await;
    assert_eq!(too_big.0, StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn state_changing_requests_need_the_csrf_header(pool: PgPool) {
    let mut c = Client::new(pool).await;
    let (status, _) = c.send(Method::POST, "/api/auth/register", Some(ada()), false).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn unknown_api_routes_are_json_404s(pool: PgPool) {
    let mut c = Client::new(pool).await;
    let (status, body) = c.get("/api/nope").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "Not found.");
}
