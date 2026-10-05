import { Chat, useChat } from "@ai-sdk/react";
import type { Lesson } from "@pire/content";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { api, unwrap } from "../api/client";
import { meQuery } from "../api/queries";
import { cx } from "../ui/bits";
import { Code, CodeBlock } from "../ui/Rich";
import { runTool, snapshot, type TutorContext } from "./tutorTools";

export const tutorStatusQuery = {
  queryKey: ["tutor", "status"],
  queryFn: async () => unwrap(await api.GET("/api/tutor/status")),
  staleTime: 5 * 60_000,
} as const;

interface TutorProps {
  lesson: Lesson;
  /** The latest lesson and debugger state, read when a question goes out or a tool runs. */
  context: () => TutorContext;
  /** Text to put in the composer, such as the "talk it through" opener. */
  prefill: { text: string; n: number } | null;
  onAsk(): void;
  onGuide(): void;
  active: boolean;
}

/** The Ask tab: a chat with the AI tutor, who can see the lesson and the debugger and point at things. */
export function Tutor(props: TutorProps) {
  const status = useQuery(tutorStatusQuery);
  const me = useQuery(meQuery);
  if (status.isPending || me.isPending) return null;
  if (!status.data?.enabled) return <Offline onGuide={props.onGuide} />;
  if (!me.data) return <SignedOut onGuide={props.onGuide} />;
  return <TutorChat key={props.lesson.id} {...props} />;
}

function TutorChat({ lesson, context, prefill, onAsk, onGuide, active }: TutorProps) {
  const ctx = useRef(context);
  ctx.current = context;

  const chat = useMemo(() => {
    const c: Chat<UIMessage> = new Chat<UIMessage>({
      id: "tutor-" + lesson.id,
      transport: new DefaultChatTransport({
        api: "/api/tutor/" + lesson.id + "/chat",
        headers: { "x-pire-request": "1" },
        // The server keeps the history; send only the newest message and what the screen shows now.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { message: messages.at(-1), state: snapshot(ctx.current()) },
        }),
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onToolCall({ toolCall }) {
        const result = runTool(toolCall.toolName, toolCall.input, ctx.current());
        if ("error" in result) {
          void c.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, state: "output-error", errorText: result.error });
        } else {
          void c.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: result.output });
        }
      },
    });
    return c;
  }, [lesson.id]);
  const { messages, setMessages, sendMessage, status, error, regenerate, clearError } = useChat({ chat });

  // Restore the saved chat once.
  const history = useQuery({
    queryKey: ["tutor", "messages", lesson.id],
    queryFn: async () => unwrap(await api.GET("/api/tutor/{lesson_id}/messages", { params: { path: { lesson_id: lesson.id } } })),
    staleTime: Infinity,
    gcTime: 0,
  });
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !history.data) return;
    restored.current = true;
    if (chat.messages.length === 0) setMessages(history.data.messages as unknown as UIMessage[]);
  }, [history.data, chat, setMessages]);

  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (prefill) setDraft(prefill.text);
  }, [prefill]);
  useEffect(() => {
    if (active) input.current?.focus();
  }, [active, prefill]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    clearError();
    onAsk();
    setDraft("");
    void sendMessage({ text: t });
  };

  const last = messages.at(-1);
  const waiting = busy && (last?.role !== "assistant" || !hasVisibleText(last) || runningTool(last));
  const now = context();
  const step = now.lesson.steps[now.state.stepIndex];

  return (
    <div className="flex min-h-0 grow flex-col" data-testid="tutor">
      <div ref={scroller} className="pane-scroll min-h-0 grow overflow-y-auto px-5 pt-5 pb-4">
        {messages.length === 0 && !history.isPending ? (
          <Empty title={step?.title} challenge={lesson.challenge} onAsk={ask} />
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} message={m} /> : <Answer key={m.id} message={m} />))}
            {waiting && <Thinking tool={last?.role === "assistant" && runningTool(last)} />}
            {error && <ErrorNote error={error} onRetry={() => void regenerate()} onGuide={onGuide} />}
            {!busy && !error && last?.role === "assistant" && (
              <div className="flex flex-wrap gap-2">
                <Suggestion onClick={() => ask("Give me another hint.")}>Another hint</Suggestion>
                {!lesson.challenge && <Suggestion onClick={() => ask("Just tell me.")}>Just tell me</Suggestion>}
              </div>
            )}
          </div>
        )}
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-amber-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input
          ref={input}
          aria-label="Ask the tutor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onGuide();
          }}
          placeholder="Ask about this step…"
          spellCheck={false}
          autoComplete="off"
          maxLength={2000}
          className="h-9 min-w-0 grow rounded-md border border-line bg-ink px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-amber-dim"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy || !draft.trim()}
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber text-ink hover:brightness-110 disabled:bg-raised disabled:text-faint"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}

const SUGGESTIONS = ["What changed?", "What am I looking for here?", "Give me a hint."];
const CHALLENGE_SUGGESTIONS = ["Where should I start?", "Am I on the right track?", "Give me a nudge."];

function Empty({ title, challenge, onAsk }: { title?: string; challenge: boolean; onAsk(text: string): void }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg/6 font-semibold text-fg">{title ? "Stuck on “" + title + "”?" : "Ask the tutor"}</h2>
      <div className="flex flex-col items-start gap-2">
        {(challenge ? CHALLENGE_SUGGESTIONS : SUGGESTIONS).map((s) => (
          <Suggestion key={s} onClick={() => onAsk(s)}>
            {s}
          </Suggestion>
        ))}
      </div>
    </div>
  );
}

function Suggestion({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-amber-line bg-[#1C160C] px-3 py-1.5 text-left text-[13px] text-fg hover:border-amber-dim"
    >
      {children}
    </button>
  );
}

function UserBubble({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  return <p className="max-w-[85%] self-end rounded-xl rounded-br-sm bg-[#221E17] px-3.5 py-2 text-sm/5.5 whitespace-pre-wrap text-fg">{text}</p>;
}

function Answer({ message }: { message: UIMessage }) {
  return (
    <div className="flex flex-col gap-2.5" data-testid="tutor-answer">
      {message.parts.map((part, i) => {
        if (part.type === "text") return part.text.trim() ? <Reply key={i} text={part.text} /> : null;
        if (part.type.startsWith("tool-") && "toolCallId" in part) {
          return <ToolTrace key={i} name={part.type.slice(5)} input={part.input} failed={part.state === "output-error"} />;
        }
        return null;
      })}
    </div>
  );
}

const markdown: Components = {
  p: ({ children }) => <p className="text-[15px]/[23px] text-fg">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="text-fg">{children}</em>,
  ul: ({ children }) => <ul className="ml-4 list-disc text-[15px]/[23px] text-fg marker:text-faint">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 list-decimal text-[15px]/[23px] text-fg marker:text-faint">{children}</ol>,
  a: ({ children }) => <span className="text-amber">{children}</span>,
  code: ({ children }) => <Code code={String(children)} />,
  // A fenced block: render its lines with the disassembly colors.
  pre: ({ node }) => {
    const code = node?.children[0];
    const text = code && "children" in code ? code.children.map((c) => ("value" in c ? c.value : "")).join("") : "";
    return <CodeBlock code={text.replace(/\n$/, "")} />;
  },
};

function Reply({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Markdown components={markdown} skipHtml>
        {text}
      </Markdown>
    </div>
  );
}

/** "Pointed at RCX": what the tutor looked at, so the learner can follow along. */
function ToolTrace({ name, input, failed }: { name: string; input: unknown; failed: boolean }) {
  const args = (input ?? {}) as Record<string, string | undefined>;
  const label =
    name === "point_at"
      ? "Pointed at " + targetName(args.target ?? "")
      : name === "show_source"
        ? "Opened the source"
        : name === "read_memory"
          ? "Read memory at " + (args.address ?? "?")
          : name === "disassemble"
            ? "Read the code at " + (args.address ?? "RIP")
            : name === "describe_value"
              ? "Looked up " + (args.expression ?? "?")
              : name;
  return (
    <p className={cx("flex items-center gap-1.5 font-mono text-[11px]", failed ? "text-faint line-through" : "text-amber-dim")}>
      <span aria-hidden>↳</span>
      {label}
    </p>
  );
}

const short = (hex: string) => hex.replace(/^0+(?=.)/, "");
function targetName(t: string): string {
  if (t.startsWith("reg:") || t.startsWith("flag:")) return t.split(":")[1] ?? t;
  if (t.startsWith("disasm:")) return "line " + short(t.slice(7));
  if (t.startsWith("stack:")) return "stack slot " + short(t.slice(6));
  if (t.startsWith("dump:byte:")) return "byte " + short(t.slice(10));
  return t;
}

function Thinking({ tool }: { tool: boolean }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-pulse rounded-full bg-amber" style={{ animationDelay: i * 150 + "ms" }} />
        ))}
      </span>
      {tool ? "Looking at the debugger…" : "Thinking…"}
    </p>
  );
}

function ErrorNote({ error, onRetry, onGuide }: { error: Error; onRetry(): void; onGuide(): void }) {
  const message = errorText(error);
  const offline = message.includes("isn't set up");
  return (
    <div className="relative overflow-hidden rounded-md bg-[#1C160C] py-3 pr-3.5 pl-4.5 text-sm/5.5 text-fg" role="alert">
      <span className="absolute inset-y-0 left-0 w-0.75 bg-amber" />
      <p className="mb-1 text-[13px] font-semibold text-amber">{message.includes("busy") ? "The tutor is busy" : offline ? "Tutor offline" : "No answer"}</p>
      <p className="text-muted">{message}</p>
      {offline ? (
        <button type="button" onClick={onGuide} className="mt-2 text-[13px] text-amber hover:underline">
          Back to the guide →
        </button>
      ) : (
        <button type="button" onClick={onRetry} className="mt-2 text-[13px] text-amber hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

function Offline({ onGuide }: { onGuide(): void }) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-5" data-testid="tutor-offline">
      <h2 className="text-lg/6 font-semibold text-fg">Tutor offline</h2>
      <p className="text-[15px]/6 text-muted">The tutor isn't set up on this server.</p>
      <button type="button" onClick={onGuide} className="self-start text-[13px] text-amber hover:underline">
        Back to the guide →
      </button>
    </div>
  );
}

/** The tutor keeps each chat on the server, so it needs an account. The lesson itself doesn't. */
function SignedOut({ onGuide }: { onGuide(): void }) {
  const here = useLocation({ select: (l) => l.href });
  return (
    <div className="flex flex-col gap-3 px-5 pt-5" data-testid="tutor-signed-out">
      <h2 className="text-lg/6 font-semibold text-fg">Sign in to ask the tutor</h2>
      <p className="text-[15px]/6 text-muted">
        The tutor needs an account. Your progress in this lesson comes with you when you create one.
      </p>
      <div className="flex items-center gap-4">
        <Link to="/register" search={{ redirect: here }} className="h-8 rounded-md bg-amber px-3 text-[13px]/8 font-medium text-ink">
          Create account
        </Link>
        <Link to="/login" search={{ redirect: here }} className="text-[13px] text-fg hover:text-amber">
          Sign in
        </Link>
        <button type="button" onClick={onGuide} className="text-[13px] text-amber hover:underline">
          Back to the guide →
        </button>
      </div>
    </div>
  );
}

/** The server's message from a failed request: the body is JSON like {"error": "..."}. */
function errorText(error: Error): string {
  try {
    const body = JSON.parse(error.message) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Not JSON: a network error or a message from the stream.
  }
  return error.message && error.message.length < 200 ? error.message : "The tutor couldn't answer. Try again.";
}

const hasVisibleText = (m: UIMessage) => m.parts.some((p) => p.type === "text" && p.text.trim());
const runningTool = (m: UIMessage) =>
  m.parts.some((p) => p.type.startsWith("tool-") && "state" in p && (p.state === "input-streaming" || p.state === "input-available"));
