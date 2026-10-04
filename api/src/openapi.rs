use utoipa::OpenApi;

use crate::{auth, error::ErrorBody, progress};

#[derive(OpenApi)]
#[openapi(
    info(title = "pire API", description = "Accounts and lesson progress for pire."),
    paths(
        auth::register,
        auth::login,
        auth::logout,
        auth::me,
        progress::list,
        progress::save,
    ),
    components(schemas(
        auth::User,
        auth::RegisterRequest,
        auth::LoginRequest,
        progress::LessonProgress,
        progress::SaveProgressRequest,
        ErrorBody,
    )),
    tags(
        (name = "auth", description = "Accounts and sessions"),
        (name = "progress", description = "Lesson progress"),
    )
)]
pub struct ApiDoc;
