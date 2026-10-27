// Supabase over plain REST (no SDK): email-code sign-in, token refresh, and the few table and
// storage calls the app makes. Only used when CLOUD.configured.
// NOT YET RUN against a live project: see docs/CLOUD.md before relying on it.
import { CLOUD } from "./cloud";
import { cleanDays, type Program } from "./market";
import type { Snapshot, SuggestedProgram } from "./snapshot";

const KEY = "followset-cloud-session";

interface CloudSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
}

function readSession(): CloudSession | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
function writeSession(s: CloudSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

/** Current access token if signed in and not expired. */
export function cloudToken(): string | undefined {
  const s = readSession();
  return s && s.expires_at > Date.now() + 30_000 ? s.access_token : undefined;
}

export function cloudUser(): CloudSession["user"] | null {
  return readSession()?.user ?? null;
}

async function call<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { apikey: CLOUD.anonKey, "Content-Type": "application/json", ...((init.headers as Record<string, string>) ?? {}) };
  if (init.auth) {
    const t = await freshToken();
    if (!t) throw new Error("Sign in to the Followset cloud first.");
    headers.Authorization = `Bearer ${t}`;
  }
  const r = await fetch(`${CLOUD.url}${path}`, { ...init, headers });
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error((body as { msg?: string; message?: string; error_description?: string })?.msg ?? (body as { message?: string })?.message ?? `Cloud returned ${r.status}`);
  return body as T;
}

function save(j: { access_token: string; refresh_token: string; expires_in: number; user: CloudSession["user"] }) {
  writeSession({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000, user: j.user });
}

/** Step 1: email a 6-digit code. */
export async function sendCode(email: string): Promise<void> {
  await call("/auth/v1/otp", { method: "POST", body: JSON.stringify({ email, create_user: true }) });
}

/** Step 2: trade the code for a session. */
export async function verifyCode(email: string, token: string): Promise<void> {
  save(await call("/auth/v1/verify", { method: "POST", body: JSON.stringify({ type: "email", email, token }) }));
}

export async function freshToken(): Promise<string | undefined> {
  const s = readSession();
  if (!s) return undefined;
  if (s.expires_at > Date.now() + 60_000) return s.access_token;
  try {
    save(await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: s.refresh_token }) }));
    return readSession()?.access_token;
  } catch {
    writeSession(null);
    return undefined;
  }
}

export function signOutCloud() {
  writeSession(null);
}

// ---------- Programs ----------

interface ProgramRow {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_handle: string;
  title: string;
  summary: string;
  price_cents: number;
  level: string;
  tags: string[];
  days: Program["days"];
  published: boolean;
  updated_at: string;
}

const toRow = (p: Program, uid: string): Omit<ProgramRow, "updated_at"> => ({
  id: p.id,
  creator_id: uid,
  creator_name: p.creator.name,
  creator_handle: p.creator.handle,
  title: p.title,
  summary: p.summary,
  price_cents: Math.round(p.price * 100),
  level: p.level,
  tags: p.tags,
  days: p.days,
  published: p.published,
});

// Rows come from other people: every field is re-checked before the app uses it.
const LEVELS = ["beginner", "intermediate", "advanced"];
const fromRow = (r: ProgramRow): Program => ({
  id: String(r.id),
  title: String(r.title ?? "").slice(0, 80),
  summary: String(r.summary ?? "").slice(0, 600),
  creator: { id: String(r.creator_id), name: String(r.creator_name ?? "").slice(0, 60), handle: String(r.creator_handle ?? "").slice(0, 30), bio: "" },
  price: Math.max(0, Number(r.price_cents) || 0) / 100,
  level: (LEVELS.includes(r.level) ? r.level : "intermediate") as Program["level"],
  tags: Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === "string").slice(0, 10) : [],
  days: cleanDays(r.days),
  published: r.published,
  createdAt: Date.parse(r.updated_at),
  updatedAt: Date.parse(r.updated_at),
});

/** Published programs from every creator. */
export async function pullPrograms(): Promise<Program[]> {
  const rows = await call<ProgramRow[]>("/rest/v1/programs?published=eq.true&select=*&order=updated_at.desc&limit=200");
  return rows.map(fromRow);
}

/** Upsert one of this creator's programs. Local media refs must be uploaded first (uploadMedia). */
export async function pushProgram(p: Program): Promise<void> {
  const user = cloudUser();
  if (!user) throw new Error("Sign in to publish.");
  await call("/rest/v1/programs?on_conflict=id", {
    method: "POST",
    auth: true,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(toRow(p, user.id)),
  });
}

/** Remove one of this creator's programs from the cloud (RLS allows only your own). */
export async function deleteProgram(id: string): Promise<void> {
  await call(`/rest/v1/programs?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", auth: true, headers: { Prefer: "return=minimal" } });
}

/** Upload a blob to the "media" bucket under the user's folder; returns its public URL. */
export async function uploadMedia(blob: Blob, name: string): Promise<string> {
  const user = cloudUser();
  const t = await freshToken();
  if (!user || !t) throw new Error("Sign in to upload.");
  const path = `${user.id}/${name}`;
  const r = await fetch(`${CLOUD.url}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: { apikey: CLOUD.anonKey, Authorization: `Bearer ${t}`, "Content-Type": blob.type || "application/octet-stream", "x-upsert": "true" },
    body: blob,
  });
  if (!r.ok) throw new Error(`Upload failed (${r.status})`);
  return `${CLOUD.url}/storage/v1/object/public/media/${path}`;
}

/** Start Stripe Checkout for a paid program (the "checkout" function returns the Stripe URL). */
export async function startCheckout(programId: string): Promise<string> {
  const j = await call<{ url: string }>("/functions/v1/checkout", { method: "POST", auth: true, body: JSON.stringify({ programId, returnUrl: location.href }) });
  return j.url;
}

// ---------- Your data, for the coach and outside assistants ----------

/** Replace the signed-in user's synced snapshot. */
export async function pushSnapshot(data: Snapshot): Promise<void> {
  const user = cloudUser();
  if (!user) throw new Error("Sign in to sync.");
  await call("/rest/v1/user_data?on_conflict=user_id", {
    method: "POST",
    auth: true,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: user.id, data }),
  });
}

/** New connector link for Claude / ChatGPT / Grok. Revokes the previous one. Shown once. */
export async function createConnectorLink(): Promise<string> {
  const j = await call<{ url: string }>("/functions/v1/mcp-key", { method: "POST", auth: true, body: "{}" });
  return j.url;
}

/** Programs outside assistants proposed (MCP suggest_program) that haven't been brought into Studio yet. */
export async function pullSuggestions(): Promise<{ id: string; program: SuggestedProgram; created_at: string }[]> {
  return call("/rest/v1/suggestions?claimed_at=is.null&select=id,program,created_at&order=created_at.asc", { auth: true });
}

export async function claimSuggestion(id: string): Promise<void> {
  await call(`/rest/v1/suggestions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ claimed_at: new Date().toISOString() }),
  });
}
