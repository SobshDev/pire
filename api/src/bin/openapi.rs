//! Prints the OpenAPI spec so the frontend can generate its API types.
use utoipa::OpenApi;

fn main() {
    let spec = pire_api::openapi::ApiDoc::openapi()
        .to_pretty_json()
        .expect("the OpenAPI spec serializes to JSON");
    println!("{spec}");
}
