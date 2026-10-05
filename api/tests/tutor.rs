//! The tutor against a fake Messages API: tool rounds, restoring the chat, stale results, rate limits.

use std::sync::{Arc, Mutex};

use axum::{
    Router,
    body::Body,
    extract::State,
    http::{Method, Request, StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use http_body_util::BodyExt;
use pire_api::{
    app::{self, CSRF_HEADER},
    config::{Config, TutorConfig},
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

/// What the fake model server answers, in order, and every request it got.
#[derive(Clone, Default)]
struct Upstream {
    replies: Arc<Mutex<Vec<(u16, String)>>>,
    seen: Arc<Mutex<Vec<(Option<String>, Value)>>>,
}

async fn messages(State(up): State<Upstream>, req: Request<Body>) -> Response {
    let key = req.headers().get("x-api-key").and_then(|v| v.to_str().ok()).map(String::from);
    let body: Value = serde_json::from_slice(&req.into_body().collect().await.unwrap().to_bytes()).unwrap();
    up.seen.lock().unwrap().push((key, body));
    let (status, text) = up.replies.lock().unwrap().remove(0);
    let mut res = (StatusCode::from_u16(status).unwrap(), text).into_response();
    let ct = if status == 200 { "text/event-stream" } else { "application/json" };
    res.headers_mut().insert(header::CONTENT_TYPE, ct.parse().unwrap());
    res.headers_mut().insert(header::RETRY_AFTER, "0".parse().unwrap());
    res
}

async fn upstream(replies: Vec<(u16, String)>) -> (Upstream, String) {
    let up = Upstream { replies: Arc::new(Mutex::new(replies)), ..Default::default() };
    let app = Router::new().route("/v1/messages", post(messages)).with_state(up.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (up, url)
}

fn sse(events: &[Value]) -> String {
    events.iter().map(|e| format!("event: {}\ndata: {e}\n\n", e["type"].as_str().unwrap())).collect()
}

fn tool_reply(id: &str) -> (u16, String) {
    (200, sse(&[
        json!({ "type": "message_start", "message": { "id": "m", "role": "assistant", "content": [] } }),
        json!({ "type": "content_block_start", "index": 0, "content_block": { "type": "tool_use", "id": id, "name": "point_at", "input": {} } }),
        json!({ "type": "content_block_delta", "index": 0, "delta": { "type": "input_json_delta", "partial_json": "{\"target\":\"reg:RCX\"}" } }),
        json!({ "type": "content_block_stop", "index": 0 }),
        json!({ "type": "message_delta", "delta": { "stop_reason": "tool_use" } }),
        json!({ "type": "message_stop" }),
    ]))
}

fn text_reply(text: &str) -> (u16, String) {
    (200, sse(&[
        json!({ "type": "message_start", "message": { "id": "m", "role": "assistant", "content": [] } }),
        json!({ "type": "content_block_start", "index": 0, "content_block": { "type": "text", "text": "" } }),
        json!({ "type": "content_block_delta", "index": 0, "delta": { "type": "text_delta", "text": text } }),
        json!({ "type": "content_block_stop", "index": 0 }),
        json!({ "type": "message_delta", "delta": { "stop_reason": "end_turn" } }),
        json!({ "type": "message_stop" }),
    ]))
}

fn busy() -> (u16, String) {
    (429, json!({ "type": "error", "error": { "type": "rate_limit_error", "message": "slow down" } }).to_string())
}

struct Client {
    app: Router,
    cookie: Option<String>,
}

impl Client {
    async fn new(pool: PgPool, base_url: Option<String>) -> Self {
        let config = Config {
            database_url: String::new(),
            bind_addr: "127.0.0.1:0".parse().unwrap(),
            static_dir: None,
            cookie_secure: false,
            tutor: base_url.map(|base_url| TutorConfig {
                base_url,
                api_key: "sr_test".into(),
                model: "claude-test".into(),
                max_tokens: 100,
            }),
        };
        let mut c = Self { app: app::build(pool, &config).await.unwrap(), cookie: None };
        let (status, _) = c
            .send(Method::POST, "/api/auth/register", Some(json!({ "email": "ada@example.com", "password": "correct horse", "display_name": "Ada" })))
            .await;
        assert_eq!(status, StatusCode::CREATED);
        c
    }

    /// Status and raw body text.
    async fn send(&mut self, method: Method, uri: &str, body: Option<Value>) -> (StatusCode, String) {
        let mut req = Request::builder().method(method).uri(uri).header(CSRF_HEADER, "1");
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
            self.cookie = Some(set.to_str().unwrap().split(';').next().unwrap().to_string());
        }
        let status = res.status();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, String::from_utf8(bytes.to_vec()).unwrap())
    }

    async fn ask(&mut self, text: &str) -> (StatusCode, String) {
        let message = json!({ "id": "u1", "role": "user", "parts": [{ "type": "text", "text": text }] });
        self.send(Method::POST, "/api/tutor/m1.l2/chat", Some(json!({ "message": message, "state": "RIP 0000000140001070" }))).await
    }

    async fn answer_tool(&mut self, id: &str) -> (StatusCode, String) {
        let message = json!({ "id": "a1", "role": "assistant", "parts": [
            { "type": "tool-point_at", "toolCallId": id, "state": "output-available", "input": { "target": "reg:RCX" }, "output": "ok" }
        ]});
        self.send(Method::POST, "/api/tutor/m1.l2/chat", Some(json!({ "message": message, "state": "RIP 0000000140001070" }))).await
    }

    async fn history(&mut self) -> Vec<Value> {
        let (status, body) = self.send(Method::GET, "/api/tutor/m1.l2/messages", None).await;
        assert_eq!(status, StatusCode::OK);
        serde_json::from_str::<Value>(&body).unwrap()["messages"].as_array().unwrap().clone()
    }
}

/// The JSON chunks of an AI SDK UI message stream, without [DONE].
fn chunks(body: &str) -> Vec<Value> {
    assert!(body.trim_end().ends_with("data: [DONE]"), "stream must end with [DONE]: {body}");
    body.split("\n\n")
        .filter_map(|e| e.strip_prefix("data: "))
        .filter(|d| *d != "[DONE]")
        .map(|d| serde_json::from_str(d).unwrap())
        .collect()
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn a_tool_round_trip_streams_saves_and_restores(pool: PgPool) {
    let (up, url) = upstream(vec![tool_reply("toolu_1"), text_reply("Look at RCX.")]).await;
    let mut c = Client::new(pool, Some(url)).await;

    let (status, body) = c.ask("Why this register?").await;
    assert_eq!(status, StatusCode::OK);
    let first = chunks(&body);
    let call = first.iter().find(|c| c["type"] == "tool-input-available").unwrap();
    assert_eq!(call["input"], json!({ "target": "reg:RCX" }));
    assert_eq!(first.last().unwrap(), &json!({ "type": "finish", "finishReason": "tool-calls" }));

    let (status, body) = c.answer_tool("toolu_1").await;
    assert_eq!(status, StatusCode::OK);
    let second = chunks(&body);
    assert!(second.iter().any(|c| c["type"] == "text-delta" && c["delta"] == "Look at RCX."));
    assert_eq!(second.last().unwrap()["finishReason"], "stop");

    // The router got the key, the question with the debugger state, and the tool result.
    let seen = up.seen.lock().unwrap().clone();
    assert_eq!(seen[0].0.as_deref(), Some("sr_test"));
    let q = &seen[0].1["messages"][0]["content"];
    assert!(q[0]["text"].as_str().unwrap().contains("<debugger_state>"));
    assert_eq!(q[1]["text"], "Why this register?");
    let last = seen[1].1["messages"].as_array().unwrap().last().unwrap().clone();
    assert_eq!(last["content"][0]["type"], "tool_result");
    assert_eq!(last["content"][0]["tool_use_id"], "toolu_1");

    // A reload restores one question and one answer with the tool part filled in.
    let history = c.history().await;
    assert_eq!(history.len(), 2);
    let parts = history[1]["parts"].as_array().unwrap();
    assert!(parts.iter().any(|p| p["type"] == "tool-point_at" && p["state"] == "output-available"));
    assert!(parts.iter().any(|p| p["text"] == "Look at RCX."));

    // Nothing is waiting any more, so a second result for the same call is stale.
    let (status, _) = c.answer_tool("toolu_1").await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (status, _) = c.send(Method::DELETE, "/api/tutor/m1.l2/messages", None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(c.history().await.is_empty());
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn a_rate_limit_is_retried_once_then_reported_busy(pool: PgPool) {
    let (up, url) = upstream(vec![busy(), busy(), busy(), text_reply("Hi.")]).await;
    let mut c = Client::new(pool, Some(url)).await;

    let (status, body) = c.ask("Hello?").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(body.contains("busy"));
    assert_eq!(up.seen.lock().unwrap().len(), 2);
    assert!(c.history().await.is_empty(), "a failed question is not saved");

    // One more 429, then the retry succeeds.
    let (status, body) = c.ask("Hello?").await;
    assert_eq!(status, StatusCode::OK);
    assert!(chunks(&body).iter().any(|c| c["delta"] == "Hi."));
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn after_four_tool_rounds_the_model_must_answer(pool: PgPool) {
    let replies = (1..=5).map(|i| tool_reply(&format!("t{i}"))).collect();
    let (up, url) = upstream(replies).await;
    let mut c = Client::new(pool, Some(url)).await;

    c.ask("What changed?").await;
    for i in 1..=4 {
        let (status, _) = c.answer_tool(&format!("t{i}")).await;
        assert_eq!(status, StatusCode::OK);
    }
    let seen = up.seen.lock().unwrap().clone();
    for (i, (_, body)) in seen.iter().enumerate() {
        let capped = body.get("tool_choice") == Some(&json!({ "type": "none" }));
        assert_eq!(capped, i == 4, "request {i}");
    }
}

#[sqlx::test(migrator = "pire_api::MIGRATOR")]
async fn without_a_key_the_tutor_is_offline(pool: PgPool) {
    let mut c = Client::new(pool, None).await;
    let (_, body) = c.send(Method::GET, "/api/tutor/status", None).await;
    assert_eq!(serde_json::from_str::<Value>(&body).unwrap(), json!({ "enabled": false }));
    let (status, body) = c.ask("Hello?").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(body.contains("isn't set up"));
}
