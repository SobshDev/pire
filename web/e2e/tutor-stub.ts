/**
 * A scripted Messages API for the tutor e2e test. A question gets a point_at call on RCX; the tool
 * result gets a short answer. Run it, then start the API with TUTOR_BASE_URL pointing here:
 *   bun e2e/tutor-stub.ts   (listens on 127.0.0.1:8099, or TUTOR_STUB_PORT)
 */
const port = Number(process.env.TUTOR_STUB_PORT ?? 8099);

const sse = (events: object[]) =>
  events.map((e) => "event: " + (e as { type: string }).type + "\ndata: " + JSON.stringify(e) + "\n\n").join("");

const start = { type: "message_start", message: { id: "msg_stub", role: "assistant", content: [] } };
const stop = (reason: string) => [{ type: "message_delta", delta: { stop_reason: reason } }, { type: "message_stop" }];

function pointAtRcx() {
  return sse([
    start,
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_" + Date.now(), name: "point_at", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"target":"reg:RCX"}' } },
    { type: "content_block_stop", index: 0 },
    ...stop("tool_use"),
  ]);
}

function answer() {
  const text = "Watch QRCXQ. The QBlea rcx,qword ptr ds:[140003200]QB put the banner's address there.".replaceAll("QB", "\x60").replaceAll("QRCXQ", "\x60RCX\x60");
  return sse([
    start,
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    ...stop("end_turn"),
  ]);
}

Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(req) {
    if (new URL(req.url).pathname !== "/v1/messages") return new Response("not found", { status: 404 });
    const body = (await req.json()) as { messages: { content: { type: string }[] }[] };
    const last = body.messages.at(-1)?.content ?? [];
    const reply = last.some((b) => b.type === "tool_result") ? answer() : pointAtRcx();
    return new Response(reply, { headers: { "content-type": "text/event-stream" } });
  },
});
console.log("tutor stub on http://127.0.0.1:" + port);
