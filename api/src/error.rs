use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("You need to sign in first.")]
    Unauthorized,
    #[error("{0}")]
    InvalidCredentials(&'static str),
    #[error("{0}")]
    Conflict(String),
    #[error("Not found.")]
    NotFound,
    /// A dependency is down or full, such as the tutor's model server.
    #[error("{0}")]
    Unavailable(String),
    /// The model server answered with an error. The detail is logged, never shown.
    #[error("{0}")]
    BadGateway(String),
    #[error("internal error: {0}")]
    Internal(String),
}

#[derive(Serialize, ToSchema)]
pub struct ErrorBody {
    pub error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match &self {
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::Unauthorized | ApiError::InvalidCredentials(_) => StatusCode::UNAUTHORIZED,
            ApiError::Conflict(_) => StatusCode::CONFLICT,
            ApiError::NotFound => StatusCode::NOT_FOUND,
            ApiError::Unavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            ApiError::BadGateway(_) => StatusCode::BAD_GATEWAY,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let message = match &self {
            ApiError::Internal(detail) => {
                tracing::error!(%detail, "request failed");
                "Something went wrong on our side.".to_string()
            }
            ApiError::BadGateway(detail) => {
                tracing::error!(%detail, "tutor model request failed");
                "The tutor couldn't answer. Try again.".to_string()
            }
            other => other.to_string(),
        };
        (status, Json(ErrorBody { error: message })).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        ApiError::Internal(e.to_string())
    }
}

impl From<tower_sessions::session::Error> for ApiError {
    fn from(e: tower_sessions::session::Error) -> Self {
        ApiError::Internal(e.to_string())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
