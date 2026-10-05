//! Turns the Anthropic Messages stream into the AI SDK's UI message stream, block by block.

use serde_json::{Value, json};

enum Block {
    Text { id: String, text: String },
    Tool { id: String, name: String, json: String },
    /// Anything we don't show, such as thinking.
    Other,
}

#[derive(Debug)]
pub struct StreamError {
    pub kind: String,
    pub message: String,
}

pub struct Mapper {
    /// Makes text part ids unique across the rounds of one answer.
    prefix: String,
    blocks: Vec<Block>,
    stop_reason: Option<String>,
}

impl Mapper {
    pub fn new(prefix: impl Into<String>) -> Self {
        Self { prefix: prefix.into(), blocks: Vec::new(), stop_reason: None }
    }

    /// The AI SDK chunks for one Anthropic event.
    pub fn feed(&mut self, ev: &Value) -> Result<Vec<Value>, StreamError> {
        let mut out = Vec::new();
        let index = ev["index"].as_u64().map(|i| i as usize);
        match ev["type"].as_str().unwrap_or_default() {
            "content_block_start" => {
                let index = index.unwrap_or(self.blocks.len());
                let block = &ev["content_block"];
                let new = match block["type"].as_str() {
                    Some("text") => {
                        let id = format!("{}-{index}", self.prefix);
                        let text = block["text"].as_str().unwrap_or_default().to_string();
                        out.push(json!({ "type": "text-start", "id": id }));
                        if !text.is_empty() {
                            out.push(json!({ "type": "text-delta", "id": id, "delta": text }));
                        }
                        Block::Text { id, text }
                    }
                    Some("tool_use") => {
                        let id = block["id"].as_str().unwrap_or_default().to_string();
                        let name = block["name"].as_str().unwrap_or_default().to_string();
                        out.push(json!({ "type": "tool-input-start", "toolCallId": id, "toolName": name }));
                        Block::Tool { id, name, json: String::new() }
                    }
                    _ => Block::Other,
                };
                if self.blocks.len() <= index {
                    self.blocks.resize_with(index + 1, || Block::Other);
                }
                self.blocks[index] = new;
            }
            "content_block_delta" => {
                let delta = &ev["delta"];
                match (index.and_then(|i| self.blocks.get_mut(i)), delta["type"].as_str()) {
                    (Some(Block::Text { id, text }), Some("text_delta")) => {
                        let piece = delta["text"].as_str().unwrap_or_default();
                        text.push_str(piece);
                        out.push(json!({ "type": "text-delta", "id": id, "delta": piece }));
                    }
                    (Some(Block::Tool { id, json, .. }), Some("input_json_delta")) => {
                        let piece = delta["partial_json"].as_str().unwrap_or_default();
                        json.push_str(piece);
                        out.push(json!({ "type": "tool-input-delta", "toolCallId": id, "inputTextDelta": piece }));
                    }
                    _ => {}
                }
            }
            "content_block_stop" => match index.and_then(|i| self.blocks.get(i)) {
                Some(Block::Text { id, .. }) => out.push(json!({ "type": "text-end", "id": id })),
                Some(Block::Tool { id, name, json }) => out.push(json!({
                    "type": "tool-input-available",
                    "toolCallId": id,
                    "toolName": name,
                    "input": parse_input(json),
                })),
                _ => {}
            },
            "message_delta" => {
                if let Some(reason) = ev["delta"]["stop_reason"].as_str() {
                    self.stop_reason = Some(reason.to_string());
                }
            }
            "error" => {
                return Err(StreamError {
                    kind: ev["error"]["type"].as_str().unwrap_or("error").to_string(),
                    message: ev["error"]["message"].as_str().unwrap_or_default().to_string(),
                });
            }
            _ => {}
        }
        Ok(out)
    }

    /// The assistant's content blocks to store, and the AI SDK finish reason.
    pub fn finish(self) -> (Vec<Value>, &'static str) {
        let blocks = self
            .blocks
            .into_iter()
            .filter_map(|b| match b {
                Block::Text { text, .. } if !text.trim().is_empty() => Some(json!({ "type": "text", "text": text })),
                Block::Tool { id, name, json } => {
                    Some(json!({ "type": "tool_use", "id": id, "name": name, "input": parse_input(&json) }))
                }
                _ => None,
            })
            .collect();
        let reason = match self.stop_reason.as_deref() {
            Some("tool_use") => "tool-calls",
            Some("max_tokens") => "length",
            _ => "stop",
        };
        (blocks, reason)
    }
}

fn parse_input(json: &str) -> Value {
    if json.trim().is_empty() {
        return json!({});
    }
    serde_json::from_str(json).unwrap_or_else(|_| json!({}))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A recorded stream: some text, then a point_at call whose input arrives in pieces.
    fn fixture() -> Vec<Value> {
        [
            r#"{"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[]}}"#,
            r#"{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}"#,
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Look at "}}"#,
            r#"{"type":"ping"}"#,
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"RCX."}}"#,
            r#"{"type":"content_block_stop","index":0}"#,
            r#"{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"point_at","input":{}}}"#,
            r#"{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"target\":"}}"#,
            r#"{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\"reg:RCX\"}"}}"#,
            r#"{"type":"content_block_stop","index":1}"#,
            r#"{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":20}}"#,
            r#"{"type":"message_stop"}"#,
        ]
        .iter()
        .map(|s| serde_json::from_str(s).unwrap())
        .collect()
    }

    #[test]
    fn maps_text_and_tool_calls_to_ui_chunks() {
        let mut m = Mapper::new("a");
        let chunks: Vec<Value> = fixture().iter().flat_map(|e| m.feed(e).unwrap()).collect();
        let types: Vec<&str> = chunks.iter().map(|c| c["type"].as_str().unwrap()).collect();
        assert_eq!(
            types,
            [
                "text-start", "text-delta", "text-delta", "text-end", "tool-input-start", "tool-input-delta",
                "tool-input-delta", "tool-input-available"
            ]
        );
        assert_eq!(chunks[1], json!({ "type": "text-delta", "id": "a-0", "delta": "Look at " }));
        assert_eq!(chunks[7]["input"], json!({ "target": "reg:RCX" }));
        assert_eq!(chunks[7]["toolCallId"], "toolu_1");

        let (blocks, reason) = m.finish();
        assert_eq!(reason, "tool-calls");
        assert_eq!(
            Value::Array(blocks),
            json!([
                { "type": "text", "text": "Look at RCX." },
                { "type": "tool_use", "id": "toolu_1", "name": "point_at", "input": { "target": "reg:RCX" } }
            ])
        );
    }

    #[test]
    fn error_events_stop_the_stream() {
        let mut m = Mapper::new("a");
        let err = m.feed(&json!({ "type": "error", "error": { "type": "overloaded_error", "message": "Overloaded" } }));
        assert_eq!(err.unwrap_err().kind, "overloaded_error");
    }
}
