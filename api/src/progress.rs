use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::OffsetDateTime;
use utoipa::ToSchema;

use crate::{
    auth::AuthUser,
    error::{ApiError, ApiResult, ErrorBody},
};

/// Largest lesson state blob we accept, in bytes of JSON.
const MAX_STATE_BYTES: usize = 64 * 1024;

#[derive(Serialize, ToSchema, sqlx::FromRow)]
pub struct LessonProgress {
    /// Stable lesson id from the content package, for example "m1.l1".
    pub lesson_id: String,
    /// The beat the learner should resume at.
    pub beat_index: i32,
    #[serde(with = "time::serde::rfc3339::option")]
    pub completed_at: Option<OffsetDateTime>,
    /// Lesson-specific data such as checkpoint results and hints used.
    #[schema(value_type = Object)]
    pub state: serde_json::Value,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Deserialize, ToSchema)]
pub struct SaveProgressRequest {
    pub beat_index: i32,
    /// Mark the lesson finished. Once set, the first completion time is kept.
    pub completed: bool,
    #[schema(value_type = Object)]
    pub state: serde_json::Value,
}

fn validate_lesson_id(id: &str) -> ApiResult<()> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '-'));
    if ok { Ok(()) } else { Err(ApiError::BadRequest("Invalid lesson id.".into())) }
}

/// All of the signed-in user's lesson progress.
#[utoipa::path(
    get,
    path = "/api/progress",
    tag = "progress",
    responses(
        (status = 200, description = "Progress for every lesson the user has started", body = Vec<LessonProgress>),
        (status = 401, description = "Signed out", body = ErrorBody),
    )
)]
pub async fn list(State(pool): State<PgPool>, AuthUser(user_id): AuthUser) -> ApiResult<Json<Vec<LessonProgress>>> {
    let rows = sqlx::query_as::<_, LessonProgress>(
        "SELECT lesson_id, beat_index, completed_at, state, updated_at
         FROM lesson_progress WHERE user_id = $1 ORDER BY lesson_id",
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await?;
    Ok(Json(rows))
}

/// Save progress for one lesson.
#[utoipa::path(
    put,
    path = "/api/progress/{lesson_id}",
    tag = "progress",
    params(("lesson_id" = String, Path, description = "Lesson id, for example m1.l1")),
    request_body = SaveProgressRequest,
    responses(
        (status = 200, description = "Saved", body = LessonProgress),
        (status = 400, description = "Invalid input", body = ErrorBody),
        (status = 401, description = "Signed out", body = ErrorBody),
    )
)]
pub async fn save(
    State(pool): State<PgPool>,
    AuthUser(user_id): AuthUser,
    Path(lesson_id): Path<String>,
    Json(req): Json<SaveProgressRequest>,
) -> ApiResult<Json<LessonProgress>> {
    validate_lesson_id(&lesson_id)?;
    if !(0..=10_000).contains(&req.beat_index) {
        return Err(ApiError::BadRequest("beat_index is out of range.".into()));
    }
    if !req.state.is_object() {
        return Err(ApiError::BadRequest("state must be a JSON object.".into()));
    }
    if req.state.to_string().len() > MAX_STATE_BYTES {
        return Err(ApiError::BadRequest("state is too large.".into()));
    }

    let row = sqlx::query_as::<_, LessonProgress>(
        "INSERT INTO lesson_progress (user_id, lesson_id, beat_index, completed_at, state, updated_at)
         VALUES ($1, $2, $3, CASE WHEN $4 THEN now() END, $5, now())
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET
             beat_index   = EXCLUDED.beat_index,
             completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
             state        = EXCLUDED.state,
             updated_at   = now()
         RETURNING lesson_id, beat_index, completed_at, state, updated_at",
    )
    .bind(user_id)
    .bind(&lesson_id)
    .bind(req.beat_index)
    .bind(req.completed)
    .bind(&req.state)
    .fetch_one(&pool)
    .await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::validate_lesson_id;

    #[test]
    fn lesson_ids() {
        assert!(validate_lesson_id("m1.l1").is_ok());
        assert!(validate_lesson_id("m10.challenge").is_ok());
        for bad in ["", "M1.L1", "m1/l1", "../etc", &"a".repeat(65)] {
            assert!(validate_lesson_id(bad).is_err(), "{bad:?} should be rejected");
        }
    }
}
