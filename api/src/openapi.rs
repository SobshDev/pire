use utoipa::OpenApi;

use crate::{auth, error::ErrorBody, progress, tutor};

#[derive(OpenApi)]
#[openapi(
    info(title = "pire API", description = "Accounts, lesson progress and the AI tutor for pire."),
    paths(
        auth::register,
        auth::login,
        auth::logout,
        auth::me,
        progress::list,
        progress::save,
        tutor::status,
        tutor::messages,
        tutor::reset,
    ),
    components(schemas(
        auth::User,
        auth::RegisterRequest,
        auth::LoginRequest,
        progress::LessonProgress,
        progress::SaveProgressRequest,
        tutor::TutorStatus,
        tutor::TutorMessages,
        ErrorBody,
    )),
    tags(
        (name = "auth", description = "Accounts and sessions"),
        (name = "progress", description = "Lesson progress"),
        (name = "tutor", description = "The AI tutor. Its chat stream is POST /api/tutor/{lesson_id}/chat (AI SDK UI message stream)."),
    )
)]
pub struct ApiDoc;
