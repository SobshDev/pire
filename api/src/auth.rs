use argon2::{
    Argon2,
    password_hash::{PasswordHasher, PasswordVerifier, phc::PasswordHash},
};
use axum::{
    Json,
    extract::{FromRequestParts, State},
    http::{StatusCode, request::Parts},
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::OffsetDateTime;
use tower_sessions::Session;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult, ErrorBody};

const USER_ID_KEY: &str = "user_id";
const MIN_PASSWORD: usize = 8;
const MAX_PASSWORD: usize = 128;

#[derive(Serialize, ToSchema, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// The signed-in user's id, taken from the session. Rejects with 401 when signed out.
pub struct AuthUser(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let session = Session::from_request_parts(parts, state)
            .await
            .map_err(|_| ApiError::Internal("session layer missing".into()))?;
        match session.get::<Uuid>(USER_ID_KEY).await? {
            Some(id) => Ok(AuthUser(id)),
            None => Err(ApiError::Unauthorized),
        }
    }
}

fn normalize_email(raw: &str) -> ApiResult<String> {
    let email = raw.trim().to_lowercase();
    let valid = email.len() <= 254
        && email.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
        })
        && !email.contains(char::is_whitespace);
    if valid { Ok(email) } else { Err(ApiError::BadRequest("Enter a valid email address.".into())) }
}

async fn hash_password(password: String) -> ApiResult<String> {
    tokio::task::spawn_blocking(move || {
        Argon2::default()
            .hash_password(password.as_bytes())
            .map(|h| h.to_string())
            .map_err(|e| ApiError::Internal(format!("hash failed: {e}")))
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
}

async fn verify_password(password: String, hash: String) -> ApiResult<bool> {
    tokio::task::spawn_blocking(move || {
        let parsed = PasswordHash::new(&hash).map_err(|e| ApiError::Internal(format!("bad stored hash: {e}")))?;
        Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
}

/// A real hash of a random password. Checking against it when the email is unknown
/// makes a failed login take the same time whether or not the account exists.
static DUMMY_HASH: std::sync::OnceLock<String> = std::sync::OnceLock::new();

fn dummy_hash() -> String {
    DUMMY_HASH
        .get_or_init(|| {
            Argon2::default()
                .hash_password(Uuid::new_v4().as_bytes())
                .map(|h| h.to_string())
                .expect("argon2 hashing with default params works")
        })
        .clone()
}

async fn start_session(session: &Session, user_id: Uuid) -> ApiResult<()> {
    // A new session id on sign-in prevents session fixation.
    session.cycle_id().await?;
    session.insert(USER_ID_KEY, user_id).await?;
    Ok(())
}

/// Create an account and sign in.
#[utoipa::path(
    post,
    path = "/api/auth/register",
    tag = "auth",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "Account created and signed in", body = User),
        (status = 400, description = "Invalid input", body = ErrorBody),
        (status = 409, description = "Email already registered", body = ErrorBody),
    )
)]
pub async fn register(
    State(pool): State<PgPool>,
    session: Session,
    Json(req): Json<RegisterRequest>,
) -> ApiResult<(StatusCode, Json<User>)> {
    let email = normalize_email(&req.email)?;
    let display_name = req.display_name.trim().to_string();
    if display_name.is_empty() || display_name.chars().count() > 40 {
        return Err(ApiError::BadRequest("Display name must be 1 to 40 characters.".into()));
    }
    let len = req.password.chars().count();
    if !(MIN_PASSWORD..=MAX_PASSWORD).contains(&len) {
        return Err(ApiError::BadRequest(format!(
            "Password must be {MIN_PASSWORD} to {MAX_PASSWORD} characters."
        )));
    }

    let password_hash = hash_password(req.password).await?;
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)
         RETURNING id, email, display_name, created_at",
    )
    .bind(Uuid::new_v4())
    .bind(&email)
    .bind(&display_name)
    .bind(&password_hash)
    .fetch_one(&pool)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => {
            ApiError::Conflict("An account with this email already exists.".into())
        }
        _ => e.into(),
    })?;

    start_session(&session, user.id).await?;
    Ok((StatusCode::CREATED, Json(user)))
}

/// Sign in with email and password.
#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Signed in", body = User),
        (status = 401, description = "Wrong email or password", body = ErrorBody),
    )
)]
pub async fn login(
    State(pool): State<PgPool>,
    session: Session,
    Json(req): Json<LoginRequest>,
) -> ApiResult<Json<User>> {
    const INVALID: ApiError = ApiError::InvalidCredentials("Wrong email or password.");
    let email = req.email.trim().to_lowercase();

    let row: Option<(Uuid, String)> =
        sqlx::query_as("SELECT id, password_hash FROM users WHERE lower(email) = $1")
            .bind(&email)
            .fetch_optional(&pool)
            .await?;

    let Some((id, hash)) = row else {
        verify_password(req.password, dummy_hash()).await?;
        return Err(INVALID);
    };
    if !verify_password(req.password, hash).await? {
        return Err(INVALID);
    }

    let user = fetch_user(&pool, id).await?.ok_or(INVALID)?;
    start_session(&session, user.id).await?;
    Ok(Json(user))
}

/// Sign out and end the session.
#[utoipa::path(
    post,
    path = "/api/auth/logout",
    tag = "auth",
    responses((status = 204, description = "Signed out"))
)]
pub async fn logout(session: Session) -> ApiResult<StatusCode> {
    session.flush().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// The signed-in user.
#[utoipa::path(
    get,
    path = "/api/auth/me",
    tag = "auth",
    responses(
        (status = 200, description = "Signed in", body = User),
        (status = 401, description = "Signed out", body = ErrorBody),
    )
)]
pub async fn me(State(pool): State<PgPool>, session: Session, AuthUser(id): AuthUser) -> ApiResult<Json<User>> {
    match fetch_user(&pool, id).await? {
        Some(user) => Ok(Json(user)),
        None => {
            // The account was deleted while the session was alive.
            session.flush().await?;
            Err(ApiError::Unauthorized)
        }
    }
}

async fn fetch_user(pool: &PgPool, id: Uuid) -> ApiResult<Option<User>> {
    Ok(sqlx::query_as::<_, User>("SELECT id, email, display_name, created_at FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::normalize_email;

    #[test]
    fn email_is_trimmed_and_lowercased() {
        assert_eq!(normalize_email("  Ada@Example.COM ").unwrap(), "ada@example.com");
    }

    #[test]
    fn malformed_emails_are_rejected() {
        for bad in ["", "ada", "@example.com", "ada@", "ada@example", "ada@.com", "a da@example.com"] {
            assert!(normalize_email(bad).is_err(), "{bad:?} should be rejected");
        }
    }
}
