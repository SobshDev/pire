//! The AI tutor. The browser talks to it with the AI SDK's useChat; this module keeps the chat in
//! Postgres and forwards each turn to an Anthropic Messages API (shared_router), streaming the
//! answer back in the AI SDK's UI message format. Every tool runs in the browser: when the model
//! calls one, the stream ends, the browser runs it and posts the result, and the next round starts.

pub mod prompt;
pub mod stream;

use std::{convert::Infallible, sync::Arc, time::Duration};

use axum::{
    Json,
    body::{Body, Bytes},
    extract::{Path, State},
    http::{StatusCode, header},
    response::Response,
};
use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::sync::{Semaphore, mpsc};
use tokio_stream::wrappers::ReceiverStream;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    app::AppState,
    auth::AuthUser,
    config::TutorConfig,
    error::{ApiError, ApiResult, ErrorBody},
};

/// shared_router allows three requests in flight per key.
const MAX_IN_FLIGHT: usize = 3;
/// Tool rounds per question. After this the model must answer in words.
const MAX_ROUNDS: usize = 4;
/// Stored messages sent back to the model with each turn.
const HISTORY: i64 = 30;
const MAX_QUESTION: usize = 4_000;
const MAX_STATE: usize = 32 * 1024;
const MAX_TOOL_OUTPUT: usize = 8 * 1024;

pub const BUSY: &str = "The tutor is busy, try again.";
pub const OFFLINE: &str = "The tutor isn't set up on this server.";
const FAILED: &str = "The tutor couldn't answer. Try again.";

pub struct Tutor {
    client: reqwest::Client,
    cfg: TutorConfig,
    permits: Arc<Semaphore>,
}

impl Tutor {
    pub fn new(cfg: &TutorConfig) -> Self {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .read_timeout(Duration::from_secs(90))
            .build()
            .expect("http client builds");
        Self { client, cfg: cfg.clone(), permits: Arc::new(Semaphore::new(MAX_IN_FLIGHT)) }
    }

    /// POST /v1/messages. A 429 or 529 gets one retry after retry-after (at most 2s), then "busy".
    async fn send(&self, body: &Value) -> ApiResult<reqwest::Response> {
        let url = format!("{}/v1/messages", self.cfg.base_url);
        let mut retried = false;
        loop {
            let res = self
                .client
                .post(&url)
                .header("x-api-key", &self.cfg.api_key)
                .header("anthropic-version", "2023-06-01")
                .json(body)
                .send()
                .await
                .map_err(|e| ApiError::BadGateway(format!("request to {url} failed: {e}")))?;
            let status = res.status();
            if status.is_success() {
                return Ok(res);
            }
            if matches!(status.as_u16(), 429 | 529) {
                if retried {
                    return Err(ApiError::Unavailable(BUSY.into()));
                }
                retried = true;
                let wait = res
                    .headers()
                    .get(header::RETRY_AFTER)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.trim().parse::<u64>().ok())
                    .unwrap_or(1)
                    .min(2);
                tokio::time::sleep(Duration::from_secs(wait)).await;
                continue;
            }
            let text = res.text().await.unwrap_or_default();
            return Err(ApiError::BadGateway(format!("{status}: {}", clip(&text, 500))));
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct TutorStatus {
    pub enabled: bool,
}

#[derive(Serialize, ToSchema)]
pub struct TutorMessages {
    /// The chat as AI SDK UI messages, ready for useChat.
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<Value>,
}

#[derive(Deserialize)]
pub struct ChatRequest {
    /// The newest AI SDK UI message: the learner's question, or the assistant message carrying tool outputs.
    pub message: Value,
    /// The <debugger_state> text the browser built for this turn.
    pub state: String,
}

#[derive(sqlx::FromRow, Clone)]
struct Row {
    seq: i32,
    role: String,
    content: Value,
}

/// Whether the tutor is configured on this server.
#[utoipa::path(
    get,
    path = "/api/tutor/status",
    tag = "tutor",
    responses((status = 200, description = "Tutor availability", body = TutorStatus))
)]
pub async fn status(State(app): State<AppState>) -> Json<TutorStatus> {
    Json(TutorStatus { enabled: app.tutor.is_some() })
}

/// The learner's tutor chat for one lesson.
#[utoipa::path(
    get,
    path = "/api/tutor/{lesson_id}/messages",
    tag = "tutor",
    params(("lesson_id" = String, Path, description = "Lesson id, for example m1.l2")),
    responses(
        (status = 200, description = "The chat so far", body = TutorMessages),
        (status = 401, description = "Signed out", body = ErrorBody),
        (status = 404, description = "Unknown lesson", body = ErrorBody),
    )
)]
pub async fn messages(
    State(app): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(lesson_id): Path<String>,
) -> ApiResult<Json<TutorMessages>> {
    prompt::lesson(&lesson_id).ok_or(ApiError::NotFound)?;
    let conv: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM tutor_conversations WHERE user_id = $1 AND lesson_id = $2")
            .bind(user_id)
            .bind(&lesson_id)
            .fetch_optional(&app.pool)
            .await?;
    let rows = match conv {
        Some(id) => recent(&app.pool, id, 200).await?,
        None => Vec::new(),
    };
    Ok(Json(TutorMessages { messages: to_ui(&rows) }))
}

/// Forget the learner's tutor chat for one lesson.
#[utoipa::path(
    delete,
    path = "/api/tutor/{lesson_id}/messages",
    tag = "tutor",
    params(("lesson_id" = String, Path, description = "Lesson id, for example m1.l2")),
    responses(
        (status = 204, description = "Chat cleared"),
        (status = 401, description = "Signed out", body = ErrorBody),
    )
)]
pub async fn reset(
    State(app): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(lesson_id): Path<String>,
) -> ApiResult<StatusCode> {
    sqlx::query("DELETE FROM tutor_conversations WHERE user_id = $1 AND lesson_id = $2")
        .bind(user_id)
        .bind(&lesson_id)
        .execute(&app.pool)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// One turn: a question or a set of tool results in, an AI SDK UI message stream out.
pub async fn chat(
    State(app): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(lesson_id): Path<String>,
    Json(req): Json<ChatRequest>,
) -> ApiResult<Response> {
    let tutor = app.tutor.clone().ok_or_else(|| ApiError::Unavailable(OFFLINE.into()))?;
    let lesson = prompt::lesson(&lesson_id).ok_or(ApiError::NotFound)?;
    if req.state.len() > MAX_STATE {
        return Err(ApiError::BadRequest("Debugger state is too large.".into()));
    }

    let conv = conversation(&app.pool, user_id, &lesson_id).await?;
    let mut rows = recent(&app.pool, conv, HISTORY).await?;
    let seq = rows.last().map_or(1, |r| r.seq + 1);
    let pending = pending_tool_calls(&rows);
    let (content, rounds) = match req.message["role"].as_str() {
        Some("user") => (question(&req.message, &pending)?, 0),
        Some("assistant") => (tool_results(&req.message, &pending)?, rounds_since_question(&rows)),
        _ => return Err(ApiError::BadRequest("message.role must be user or assistant.".into())),
    };
    let content = Value::Array(content);
    rows.push(Row { seq, role: "user".into(), content: content.clone() });

    let body = prompt::request(
        &tutor.cfg.model,
        tutor.cfg.max_tokens,
        lesson,
        upstream_messages(&rows, &req.state),
        rounds >= MAX_ROUNDS,
        user_id,
    );

    let permit = tokio::time::timeout(Duration::from_secs(20), tutor.permits.clone().acquire_owned())
        .await
        .map_err(|_| ApiError::Unavailable(BUSY.into()))?
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    let res = tutor.send(&body).await?;
    insert(&app.pool, conv, seq, "user", &content).await?;

    let (tx, rx) = mpsc::channel::<Bytes>(64);
    let pool = app.pool.clone();
    tokio::spawn(async move {
        let _permit = permit;
        relay(res, tx, pool, conv, seq + 1).await;
    });

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header("x-vercel-ai-ui-message-stream", "v1")
        .header("x-accel-buffering", "no")
        .body(Body::from_stream(ReceiverStream::new(rx).map(Ok::<_, Infallible>)))
        .expect("valid response"))
}

/// Read the model's stream to the end, forwarding each chunk, then store the answer.
/// It keeps reading after the browser leaves, so the stored chat stays complete.
async fn relay(res: reqwest::Response, tx: mpsc::Sender<Bytes>, pool: PgPool, conv: Uuid, seq: i32) {
    emit(&tx, json!({ "type": "start" })).await;
    emit(&tx, json!({ "type": "start-step" })).await;

    let mut mapper = stream::Mapper::new(format!("t{seq}"));
    let mut events = res.bytes_stream().eventsource();
    let mut failure: Option<(String, String)> = None;
    while let Some(event) = events.next().await {
        let event = match event {
            Ok(e) => e,
            Err(e) => {
                failure = Some(("stream".into(), e.to_string()));
                break;
            }
        };
        let Ok(data) = serde_json::from_str::<Value>(&event.data) else { continue };
        match mapper.feed(&data) {
            Ok(chunks) => {
                for chunk in chunks {
                    emit(&tx, chunk).await;
                }
            }
            Err(e) => {
                failure = Some((e.kind, e.message));
                break;
            }
        }
        if data["type"] == "message_stop" {
            break;
        }
    }

    if let Some((kind, detail)) = failure {
        tracing::error!(%kind, %detail, "tutor stream failed");
        let text = if matches!(kind.as_str(), "overloaded_error" | "rate_limit_error") { BUSY } else { FAILED };
        emit(&tx, json!({ "type": "error", "errorText": text })).await;
        let _ = tx.send(Bytes::from_static(b"data: [DONE]\n\n")).await;
        return;
    }

    let (blocks, finish_reason) = mapper.finish();
    if !blocks.is_empty() {
        if let Err(e) = insert(&pool, conv, seq, "assistant", &Value::Array(blocks)).await {
            tracing::error!(error = ?e, "saving the tutor's answer failed");
        }
    }
    emit(&tx, json!({ "type": "finish-step" })).await;
    emit(&tx, json!({ "type": "finish", "finishReason": finish_reason })).await;
    let _ = tx.send(Bytes::from_static(b"data: [DONE]\n\n")).await;
}

async fn emit(tx: &mpsc::Sender<Bytes>, chunk: Value) {
    let _ = tx.send(Bytes::from(format!("data: {chunk}\n\n"))).await;
}

async fn conversation(pool: &PgPool, user_id: Uuid, lesson_id: &str) -> ApiResult<Uuid> {
    Ok(sqlx::query_scalar(
        "INSERT INTO tutor_conversations (id, user_id, lesson_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(lesson_id)
    .fetch_one(pool)
    .await?)
}

/// The last limit messages, oldest first.
async fn recent(pool: &PgPool, conv: Uuid, limit: i64) -> ApiResult<Vec<Row>> {
    let mut rows = sqlx::query_as::<_, Row>(
        "SELECT seq, role, content FROM tutor_messages WHERE conversation_id = $1 ORDER BY seq DESC LIMIT $2",
    )
    .bind(conv)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    rows.reverse();
    Ok(rows)
}

async fn insert(pool: &PgPool, conv: Uuid, seq: i32, role: &str, content: &Value) -> ApiResult<()> {
    sqlx::query("INSERT INTO tutor_messages (conversation_id, seq, role, content) VALUES ($1, $2, $3, $4)")
        .bind(conv)
        .bind(seq)
        .bind(role)
        .bind(content)
        .execute(pool)
        .await
        .map_err(|e| match &e {
            sqlx::Error::Database(db) if db.is_unique_violation() => {
                ApiError::Conflict("Another answer is still coming. Wait for it to finish.".into())
            }
            _ => e.into(),
        })?;
    Ok(())
}

fn blocks(content: &Value) -> &[Value] {
    content.as_array().map(Vec::as_slice).unwrap_or_default()
}

fn has_type(content: &Value, kind: &str) -> bool {
    blocks(content).iter().any(|b| b["type"] == kind)
}

/// A learner question: a user message with text. Tool results alone don't count.
fn is_question(row: &Row) -> bool {
    row.role == "user" && has_type(&row.content, "text")
}

/// Tool calls in the last answer that still wait for a result.
fn pending_tool_calls(rows: &[Row]) -> Vec<String> {
    match rows.last() {
        Some(r) if r.role == "assistant" => blocks(&r.content)
            .iter()
            .filter(|b| b["type"] == "tool_use")
            .filter_map(|b| b["id"].as_str().map(String::from))
            .collect(),
        _ => Vec::new(),
    }
}

fn rounds_since_question(rows: &[Row]) -> usize {
    rows.iter().rev().take_while(|r| !is_question(r)).filter(|r| r.role == "assistant").count()
}

/// A new question. Tool calls left waiting (the learner asked something else) are closed first.
fn question(message: &Value, pending: &[String]) -> ApiResult<Vec<Value>> {
    let text: String = blocks(&message["parts"])
        .iter()
        .filter(|p| p["type"] == "text")
        .filter_map(|p| p["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let text = text.trim();
    if text.is_empty() {
        return Err(ApiError::BadRequest("Ask a question first.".into()));
    }
    if text.chars().count() > MAX_QUESTION {
        return Err(ApiError::BadRequest("That question is too long.".into()));
    }
    let mut content: Vec<Value> = pending
        .iter()
        .map(|id| json!({ "type": "tool_result", "tool_use_id": id, "content": "Skipped: the learner asked something else.", "is_error": true }))
        .collect();
    content.push(json!({ "type": "text", "text": text }));
    Ok(content)
}

/// Results for every pending tool call, taken from the assistant message's tool parts.
fn tool_results(message: &Value, pending: &[String]) -> ApiResult<Vec<Value>> {
    if pending.is_empty() {
        return Err(ApiError::Conflict("No tool call is waiting for a result.".into()));
    }
    let parts = blocks(&message["parts"]);
    pending
        .iter()
        .map(|id| {
            let part = parts
                .iter()
                .find(|p| p["toolCallId"] == id.as_str())
                .ok_or_else(|| ApiError::Conflict(format!("Missing the result for tool call {id}.")))?;
            match part["state"].as_str() {
                Some("output-available") => {
                    let output = match &part["output"] {
                        Value::String(s) => s.clone(),
                        other => other.to_string(),
                    };
                    Ok(json!({ "type": "tool_result", "tool_use_id": id, "content": clip(&output, MAX_TOOL_OUTPUT) }))
                }
                Some("output-error") => {
                    let error = part["errorText"].as_str().unwrap_or("The tool failed.");
                    Ok(json!({ "type": "tool_result", "tool_use_id": id, "content": clip(error, MAX_TOOL_OUTPUT), "is_error": true }))
                }
                _ => Err(ApiError::Conflict(format!("Tool call {id} has no result yet."))),
            }
        })
        .collect()
}

/// The Messages API conversation: starts at a question, puts the debugger state in front of the
/// newest question, and joins neighbouring messages from the same role.
fn upstream_messages(rows: &[Row], state: &str) -> Vec<Value> {
    let start = rows.iter().position(is_question).unwrap_or(rows.len());
    let latest = rows.iter().rposition(is_question);
    let mut out: Vec<Value> = Vec::new();
    for (i, row) in rows.iter().enumerate().skip(start) {
        let mut content: Vec<Value> = blocks(&row.content).to_vec();
        if i == start {
            // Its tool calls were cut off with the older history.
            content.retain(|b| b["type"] != "tool_result");
        }
        if Some(i) == latest {
            let at = content.iter().position(|b| b["type"] == "text").unwrap_or(content.len());
            let text = format!("<debugger_state>\n{}\n</debugger_state>", state.trim());
            content.insert(at, json!({ "type": "text", "text": text }));
        }
        match out.last_mut() {
            Some(prev) if prev["role"] == row.role.as_str() => {
                prev["content"].as_array_mut().expect("content is an array").extend(content);
            }
            _ => out.push(json!({ "role": row.role, "content": content })),
        }
    }
    out
}

/// Stored messages as AI SDK UI messages. The rounds of one answer become one assistant message,
/// and tool results fill in the tool parts they answer.
fn to_ui(rows: &[Row]) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();
    for row in rows {
        if row.role == "assistant" {
            let continuing = out.last().is_some_and(|m| m["role"] == "assistant");
            if !continuing {
                out.push(json!({ "id": format!("m{}", row.seq), "role": "assistant", "parts": [] }));
            }
            let parts = out.last_mut().unwrap()["parts"].as_array_mut().unwrap();
            parts.push(json!({ "type": "step-start" }));
            for b in blocks(&row.content) {
                match b["type"].as_str() {
                    Some("text") => parts.push(json!({ "type": "text", "text": b["text"], "state": "done" })),
                    Some("tool_use") => parts.push(json!({
                        "type": format!("tool-{}", b["name"].as_str().unwrap_or_default()),
                        "toolCallId": b["id"],
                        "state": "input-available",
                        "input": b["input"],
                    })),
                    _ => {}
                }
            }
            continue;
        }
        for b in blocks(&row.content).iter().filter(|b| b["type"] == "tool_result") {
            let Some(parts) = out.iter_mut().rev().find(|m| m["role"] == "assistant").and_then(|m| m["parts"].as_array_mut())
            else {
                continue;
            };
            if let Some(part) = parts.iter_mut().find(|p| p["toolCallId"] == b["tool_use_id"]) {
                let text = b["content"].as_str().unwrap_or_default();
                if b["is_error"] == true {
                    part["state"] = json!("output-error");
                    part["errorText"] = json!(text);
                } else {
                    part["state"] = json!("output-available");
                    part["output"] = serde_json::from_str(text).unwrap_or_else(|_| json!(text));
                }
            }
        }
        let text: Vec<&str> =
            blocks(&row.content).iter().filter(|b| b["type"] == "text").filter_map(|b| b["text"].as_str()).collect();
        if !text.is_empty() {
            out.push(json!({ "id": format!("m{}", row.seq), "role": "user", "parts": [{ "type": "text", "text": text.join("\n") }] }));
        }
    }
    // A call that never got a result (the page was closed mid-answer) is shown as not run.
    for m in &mut out {
        for p in m["parts"].as_array_mut().into_iter().flatten() {
            if p["state"] == "input-available" {
                p["state"] = json!("output-error");
                p["errorText"] = json!("Not run.");
            }
        }
    }
    out
}

fn clip(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut end = max;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &s[..end])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(seq: i32, role: &str, content: Value) -> Row {
        Row { seq, role: role.into(), content }
    }

    fn sample() -> Vec<Row> {
        vec![
            row(1, "user", json!([{ "type": "text", "text": "Why RCX?" }])),
            row(2, "assistant", json!([{ "type": "tool_use", "id": "t1", "name": "point_at", "input": { "target": "reg:RCX" } }])),
            row(3, "user", json!([{ "type": "tool_result", "tool_use_id": "t1", "content": "ok" }])),
            row(4, "assistant", json!([{ "type": "text", "text": "It holds the first argument." }])),
        ]
    }

    #[test]
    fn the_newest_question_carries_the_debugger_state() {
        let mut rows = sample();
        rows.push(row(5, "user", json!([{ "type": "text", "text": "And RDX?" }])));
        let msgs = upstream_messages(&rows, "RIP 0000000140001070");
        assert_eq!(msgs.len(), 5);
        assert_eq!(msgs[0]["content"].as_array().unwrap().len(), 1);
        let last = msgs[4]["content"].as_array().unwrap();
        assert!(last[0]["text"].as_str().unwrap().starts_with("<debugger_state>"));
        assert_eq!(last[1]["text"], "And RDX?");
    }

    #[test]
    fn history_starts_at_a_question_and_drops_orphaned_results() {
        let rows = vec![
            row(7, "assistant", json!([{ "type": "text", "text": "old" }])),
            row(8, "user", json!([{ "type": "tool_result", "tool_use_id": "gone", "content": "x" }, { "type": "text", "text": "Next?" }])),
        ];
        let msgs = upstream_messages(&rows, "s");
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0]["content"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn rounds_and_pending_calls() {
        let rows = sample();
        assert_eq!(rounds_since_question(&rows), 2);
        assert!(pending_tool_calls(&rows).is_empty());
        assert_eq!(pending_tool_calls(&rows[..2]), ["t1"]);
    }

    #[test]
    fn tool_results_must_answer_every_pending_call() {
        let pending = vec!["t1".to_string()];
        let msg = json!({ "role": "assistant", "parts": [
            { "type": "tool-point_at", "toolCallId": "t1", "state": "output-available", "input": {}, "output": "ok" }
        ]});
        assert_eq!(tool_results(&msg, &pending).unwrap()[0]["content"], "ok");
        let stale = json!({ "role": "assistant", "parts": [{ "type": "tool-point_at", "toolCallId": "t0", "state": "output-available" }] });
        assert!(matches!(tool_results(&stale, &pending), Err(ApiError::Conflict(_))));
        assert!(matches!(tool_results(&msg, &[]), Err(ApiError::Conflict(_))));
    }

    #[test]
    fn stored_rounds_become_one_ui_answer() {
        let ui = to_ui(&sample());
        assert_eq!(ui.len(), 2);
        let parts = ui[1]["parts"].as_array().unwrap();
        let tool = parts.iter().find(|p| p["type"] == "tool-point_at").unwrap();
        assert_eq!(tool["state"], "output-available");
        assert_eq!(tool["output"], "ok");
        assert!(parts.iter().any(|p| p["text"] == "It holds the first argument."));
    }
}
