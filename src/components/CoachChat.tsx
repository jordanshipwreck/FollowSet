import { useEffect, useRef, useState } from "react";
import { cloudToken } from "../lib/cloudAuth";
import { ask, type CoachContext, type CoachMsg } from "../lib/coach";
import { canListen, say } from "../lib/device";
import { Icon } from "./Icon";

const KEY = "followset-coach-v1";

function loadChat(): CoachMsg[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.slice(-60) : [];
  } catch {
    return [];
  }
}

type Rec = { lang: string; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void };

export function CoachChat({ ctx, prompts, speak, compact }: { ctx: () => CoachContext; prompts: string[]; speak: boolean; compact?: boolean }) {
  const [msgs, setMsgs] = useState<CoachMsg[]>(loadChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(msgs.slice(-60)));
    } catch {
      /* storage blocked */
    }
    // Scroll the log itself, never the page (scrollIntoView drags every ancestor along).
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const mine: CoachMsg = { role: "user", text: question, at: Date.now() };
    const history = [...msgs, mine];
    setMsgs(history);
    setText("");
    setBusy(true);
    try {
      const reply = await ask(question, ctx(), msgs, cloudToken());
      setMsgs([...history, reply]);
      say(reply.text, speak);
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const w = window as unknown as Record<string, new () => Rec>;
    const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = "en-US";
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      setListening(false);
      if (t) void send(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }

  const shown = compact ? msgs.slice(-6) : msgs;

  return (
    <div className={compact ? "chat compact" : "chat"} data-testid="coach-chat">
      <div className="chat-log" ref={log}>
        {shown.length === 0 && <p className="muted small chat-empty">Ask about today's workout, a lift, food, sleep, or how your week is going.</p>}
        {shown.map((m, i) => (
          <div key={m.at + "-" + i} className={`bubble ${m.role}`} data-testid={m.role === "coach" ? "coach-reply" : undefined}>
            {m.text}
            {m.role === "coach" && m.via === "local" && !compact && <small>built-in coach</small>}
          </div>
        ))}
        {busy && (
          <div className="bubble coach typing" aria-label="Coach is thinking">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      <div className="chips scroll">
        {prompts.map((p) => (
          <button type="button" key={p} className="chip" onClick={() => void send(p)}>
            {p}
          </button>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input data-testid="coach-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask your coach" enterKeyHint="send" />
        {canListen() && (
          <button type="button" className={listening ? "icon-btn sm on" : "icon-btn sm"} aria-label="Ask by voice" onClick={listen}>
            <Icon name="mic" size={18} />
          </button>
        )}
        <button type="submit" className="arrow" aria-label="Send" data-testid="coach-send" disabled={!text.trim() || busy}>
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
