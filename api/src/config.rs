use std::{env, net::SocketAddr, path::PathBuf};

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: SocketAddr,
    /// Directory with the built frontend. When unset, the API serves only /api.
    pub static_dir: Option<PathBuf>,
    /// Send the session cookie only over HTTPS. Turn on in production.
    pub cookie_secure: bool,
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
        Ok(Self { database_url, bind_addr, static_dir, cookie_secure })
    }
}
