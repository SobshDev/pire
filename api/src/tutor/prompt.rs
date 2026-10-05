//! What the tutor is told: its rules, the lesson it teaches, and the tools it may call.
//! Everything here is a Messages API request body, kept to the fields shared_router allows.

use serde_json::{Value, json};
use std::{collections::HashMap, sync::LazyLock};
use uuid::Uuid;

/// Every tool the tutor has. They all run in the learner's browser and only look or point.
pub const TOOL_NAMES: [&str; 5] = ["point_at", "show_source", "read_memory", "disassemble", "describe_value"];

pub struct LessonInfo {
    pub challenge: bool,
    /// The lesson as pretty JSON, sent as the second system block.
    pub json: String,
}

static LESSONS: LazyLock<HashMap<String, LessonInfo>> = LazyLock::new(|| {
    let all: serde_json::Map<String, Value> =
        serde_json::from_str(include_str!("../../tutor/lessons.json")).expect("api/tutor/lessons.json is valid JSON");
    all.into_iter()
        .map(|(id, lesson)| {
            let challenge = lesson["challenge"].as_bool().unwrap_or(false);
            let json = serde_json::to_string_pretty(&lesson).expect("lesson serializes");
            (id, LessonInfo { challenge, json })
        })
        .collect()
});

pub fn lesson(id: &str) -> Option<&'static LessonInfo> {
    LESSONS.get(id)
}

const RULES: &str = r#"You are the tutor inside pire, a course that teaches reverse engineering of x64 Windows programs in a recreated x64dbg that runs in the browser. The learner already knows C and C++, can roughly read assembly, and cannot write it yet.

The <lesson> block holds the whole lesson: the mission, the C source of the program, and every step with what the learner reads, what they must do (the gate), the expected answer, and the hints. Each question from the learner starts with a <debugger_state> block: the current step and phase, registers, flags, the disassembly around RIP, the stack, breakpoints and the learner's recent actions. Trust it over your memory of the lesson.

How to answer:
- Be brief: one to four short sentences. Warm and direct, like a patient friend sitting next to them. No headings, no lists unless they ask for steps.
- Climb a ladder. First a nudge that points their attention at the right place. If they ask again, a clearer pointer. Give the full answer only when they plainly ask for it ("just tell me"). Then name the exact key or click that finishes the step.
- When they want to "talk it through", ask one guiding question at a time and wait for their reply.
- If the phase in <debugger_state> is "success", the step is done: tell them to press Enter to continue.
- Write registers, flags, keys, addresses and instructions in backticks, exactly as the debugger prints them, for example `RCX`, `ZF`, `F8`, `0000000140001070`. Put a whole instruction on its own line in a code block.
- Stay on the lesson, the debugger and reverse engineering. Politely steer anything else back.

Tools:
- Your tools only look and point. You cannot step, set breakpoints or change anything, so never say you did. Tell the learner which key to press instead.
- Call point_at on the register, line, flag, stack slot or byte you are talking about, so they can see it. One or two targets per answer.
- Check facts with read_memory, disassemble or describe_value instead of guessing values.
- Make your tool calls first, then write your answer."#;

const CHALLENGE_RULE: &str = "This lesson is a challenge. Give nudges and pointers only, never the final answer or the exact value they must find, even when asked directly. Remind them kindly that finding it is the point.";

fn tools() -> Value {
    json!([
        {
            "name": "point_at",
            "description": "Highlight something on the learner's screen. Target ids: reg:RAX ... reg:R15, reg:RIP, flag:ZF (also CF, SF, OF, PF, AF, DF, TF, IF), disasm:<16 hex digit address> for a disassembly line, stack:<address> for a stack slot, dump:byte:<address> for a byte in the dump. Addresses are 16 uppercase hex digits, for example disasm:0000000140001070.",
            "input_schema": {
                "type": "object",
                "properties": { "target": { "type": "string", "description": "Target id, for example reg:RCX" } },
                "required": ["target"]
            }
        },
        {
            "name": "show_source",
            "description": "Open the C source of the program next to the debugger.",
            "input_schema": { "type": "object", "properties": {} }
        },
        {
            "name": "read_memory",
            "description": "Read bytes from the debugged process at the current step. Returns hex, ASCII and any string at that address.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "address": { "type": "string", "description": "Hex address, register name or symbol, for example 140003200, RCX or vault.main" },
                    "length": { "type": "integer", "minimum": 1, "maximum": 256, "description": "Bytes to read, default 64" }
                },
                "required": ["address"]
            }
        },
        {
            "name": "disassemble",
            "description": "Disassemble instructions starting at an address.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "address": { "type": "string", "description": "Hex address, register name or symbol. Default RIP." },
                    "count": { "type": "integer", "minimum": 1, "maximum": 20, "description": "Instructions to show, default 10" }
                }
            }
        },
        {
            "name": "describe_value",
            "description": "Explain what a value points at, the way x64dbg comments it: a string, a symbol, a return address, or nothing.",
            "input_schema": {
                "type": "object",
                "properties": { "expression": { "type": "string", "description": "Register, hex value or symbol, for example RDX" } },
                "required": ["expression"]
            }
        }
    ])
}

/// A streaming Messages API request.
pub fn request(model: &str, max_tokens: u32, lesson: &LessonInfo, messages: Vec<Value>, no_tools: bool, user: Uuid) -> Value {
    let mut lesson_text = format!("<lesson>
{}
</lesson>", lesson.json);
    if lesson.challenge {
        lesson_text.push_str("

");
        lesson_text.push_str(CHALLENGE_RULE);
    }
    let mut body = json!({
        "model": model,
        "max_tokens": max_tokens,
        "stream": true,
        "system": [
            { "type": "text", "text": RULES, "cache_control": { "type": "ephemeral" } },
            { "type": "text", "text": lesson_text, "cache_control": { "type": "ephemeral" } }
        ],
        "tools": tools(),
        "messages": messages,
        "metadata": { "user_id": user.to_string() }
    });
    if no_tools {
        body["tool_choice"] = json!({ "type": "none" });
    }
    body
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The fields shared_router's policy accepts. A request with anything else is rejected there.
    const TOP: [&str; 15] = [
        "model", "messages", "system", "tools", "tool_choice", "max_tokens", "stream", "temperature", "top_p",
        "top_k", "stop_sequences", "metadata", "thinking", "output_config", "service_tier",
    ];
    const TOOL: [&str; 5] = ["name", "type", "description", "input_schema", "cache_control"];

    #[test]
    fn requests_use_only_fields_the_router_allows() {
        let lesson = lesson("m1.l2").unwrap();
        let msgs = vec![json!({ "role": "user", "content": [{ "type": "text", "text": "hi" }] })];
        for no_tools in [false, true] {
            let body = request("claude-sonnet-4-6", 800, lesson, msgs.clone(), no_tools, Uuid::nil());
            for key in body.as_object().unwrap().keys() {
                assert!(TOP.contains(&key.as_str()), "{key} is not allowed");
            }
            for tool in body["tools"].as_array().unwrap() {
                for key in tool.as_object().unwrap().keys() {
                    assert!(TOOL.contains(&key.as_str()), "tool field {key} is not allowed");
                }
                assert!(TOOL_NAMES.contains(&tool["name"].as_str().unwrap()));
            }
            assert_eq!(body["metadata"].as_object().unwrap().len(), 1);
            if let Some(choice) = body.get("tool_choice") {
                assert_eq!(choice, &json!({ "type": "none" }));
            }
        }
    }

    #[test]
    fn every_lesson_is_exported_and_challenges_get_the_extra_rule() {
        assert!(LESSONS.len() >= 18);
        let challenge = LESSONS.values().find(|l| l.challenge).expect("a challenge lesson");
        let body = request("m", 1, challenge, vec![], false, Uuid::nil());
        assert!(body["system"][1]["text"].as_str().unwrap().contains("never the final answer"));
    }
}
