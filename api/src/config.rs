use std::{env, net::SocketAddr, path::PathBuf};

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: SocketAddr,
    /// Directory with the built frontend. When unset, the API serves only /api.
    pub static_dir: Option<PathBuf>,
    /// Send the session cookie only over HTTPS. Turn on in production.
    pub cookie_secure: bool,
    /// The AI tutor. Off when TUTOR_API_KEY is unset.
    pub tutor: Option<TutorConfig>,
}

/// Where the tutor sends its questions: an Anthropic Messages API, such as shared_router.
#[derive(Clone, Debug)]
pub struct TutorConfig {
    /// Base URL without the /v1/messages path, for example http://127.0.0.1:8081.
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub max_tokens: u32,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let database_url = env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is not set")?;
        let bind_addr = env::var("BIND_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:8080".into())
            .parse()
            .map_err(|e| format!("BIND_ADDR is invalid: {e}"))?;
        let static_dir = env::var("STATIC_DIR").ok().filter(|s| !s.is_empty()).map(PathBuf::from);
        let cookie_secure = matches!(
            env::var("COOKIE_SECURE").as_deref(),
            Ok("1") | Ok("true") | Ok("TRUE") | Ok("yes")
        );
        let tutor = TutorConfig::from_env()?;
        Ok(Self { database_url, bind_addr, static_dir, cookie_secure, tutor })
    }
}

impl TutorConfig {
    fn from_env() -> Result<Option<Self>, String> {
        let set = |name: &str| env::var(name).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let Some(api_key) = set("TUTOR_API_KEY") else { return Ok(None) };
        let base_url = set("TUTOR_BASE_URL").ok_or("TUTOR_BASE_URL is not set (TUTOR_API_KEY is)")?;
        let model = set("TUTOR_MODEL").unwrap_or_else(|| "claude-sonnet-4-6".into());
        let max_tokens = match set("TUTOR_MAX_TOKENS") {
            Some(v) => v.parse().map_err(|e| format!("TUTOR_MAX_TOKENS is invalid: {e}"))?,
            None => 800,
        };
        Ok(Some(Self { base_url: base_url.trim_end_matches('/').to_string(), api_key, model, max_tokens }))
    }
}
