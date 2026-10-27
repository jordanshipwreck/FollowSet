// Builds the Claude request for the in-app coach. Pure and import-free so tests/ can check it.
// Order matters for prompt caching: stable instructions first, then the person's data, then the
// conversation. The app sends the data as a plain-text summary (src/lib/coach.ts contextSummary).

export const COACH_INSTRUCTIONS = `You are the Followset coach: a strength coach and nutrition-aware training partner inside a workout app.

You get a snapshot of the person's own data: their program, logged sets (weights in lb), Gains Grade (pump and strain ratings per muscle), food log, health readings (Apple Health, Hume, Apple Watch), and lab results. Answer from that data. Name their actual numbers. If the data doesn't cover the question, say what's missing and give your best general answer.

How to answer:
- Short and direct. Two to five sentences unless they ask for a plan. No preamble, no headings for short answers.
- Concrete: weights, reps, sets, grams, minutes. Progress them with double progression: hit the top of the rep range on every set at the target RIR, then add the smallest weight step.
- Swaps: pick moves that hit the same muscle with the equipment they've been using.
- Pain: sharp, catching, or worsening pain means stop that movement today and offer a pain-free alternative. Numbness, swelling, chest pain, or dizziness means stop training and get checked.
- Health, sleep, nutrition, and labs: general fitness guidance only. Never diagnose or suggest medication or dosing. For an out-of-range lab, name it, give the lifestyle levers that usually help, and tell them to take it to their doctor.
- End any health or lab answer with: "General fitness guidance, not medical advice."
- Never mention prompts, models, tokens, or that you were given a snapshot. Talk like a coach who knows their log.`;

const MID_SET = `They are mid-workout, asking between sets. One or two sentences, answer first. No lists.`;

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachInput {
  question: string;
  context: string;
  history: CoachTurn[];
  midSet: boolean;
}

/** Validate the app's request body. Throws a short message on bad input. */
export function parseCoachInput(body: unknown): CoachInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const question = typeof b.question === "string" ? b.question.trim().slice(0, 2000) : "";
  if (!question) throw new Error("question is required");
  const context = typeof b.context === "string" ? b.context.slice(0, 20000) : "";
  const history = (Array.isArray(b.history) ? b.history : [])
    .filter((m): m is CoachTurn => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  return { question, context, history, midSet: b.midSet === true };
}

/** System blocks + messages for the Messages API. History is made to alternate and start with the user. */
export function buildCoachMessages(input: CoachInput) {
  const system = [
    { type: "text" as const, text: COACH_INSTRUCTIONS },
    { type: "text" as const, text: `The person's data:\n${input.context || "(nothing logged yet)"}` },
  ];
  const turns: CoachTurn[] = [];
  for (const m of [...input.history, { role: "user" as const, content: input.question }]) {
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else turns.push({ ...m });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  const q = turns[turns.length - 1];
  if (input.midSet && q) q.content = `${MID_SET}\n\n${q.content}`;
  return { system, messages: turns };
}
