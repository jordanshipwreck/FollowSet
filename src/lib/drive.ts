// Google Drive backup: Drive / Fitty-Cent / fitty-workout.json, via Google Identity Services
// with the drive.file scope (the app can only see files it created).
import type { AppState } from "./store";

export const DRIVE = {
  clientId: (window as unknown as { FITTY_GOOGLE_CLIENT_ID?: string }).FITTY_GOOGLE_CLIENT_ID ?? "",
  folder: "Fitty-Cent",
  file: "fitty-workout.json",
  scope: "https://www.googleapis.com/auth/drive.file",
};

const TOKEN_KEY = "fitty-google-token";
const SIGNED_IN_KEY = "fitty-google-signed-in";
export const LAST_SYNC_KEY = "fitty-last-synced";

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);
}

export function wasSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

function cachedToken(): string {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
    if (t?.token && t.exp > Date.now()) return t.token;
  } catch {
    /* none */
  }
  return "";
}

function storeToken(token: string, expiresIn: number): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + Math.max(60, expiresIn - 60) * 1000 }));
    localStorage.setItem(SIGNED_IN_KEY, "1");
  } catch {
    /* storage blocked */
  }
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* storage blocked */
  }
}

type TokenClient = {
  callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void;
  error_callback?: (e: { type?: string; message?: string }) => void;
  requestAccessToken(o: { prompt: string }): void;
};
type GIS = { accounts?: { oauth2?: { initTokenClient(o: Record<string, unknown>): TokenClient } } };

let gisLoad: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as unknown as { google?: GIS }).google?.accounts?.oauth2) return Promise.resolve();
  gisLoad ??= timeout(
    new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisLoad = null;
        reject(new Error("Google sign-in couldn't load. Check the connection."));
      };
      document.head.appendChild(s);
    }),
    15000,
    "Google sign-in",
  );
  return gisLoad;
}

let client: TokenClient | null = null;

/** interactive: shows Google's consent popup, so it gets no short timeout; the person is reading it. */
async function token(interactive: boolean): Promise<string> {
  if (!DRIVE.clientId.trim()) throw new Error("Drive sync isn't configured. Export JSON still works.");
  const cached = cachedToken();
  if (cached) return cached;
  await loadGis();
  const oauth = (window as unknown as { google?: GIS }).google?.accounts?.oauth2;
  if (!oauth) throw new Error("Google sign-in couldn't load.");
  const request = new Promise<string>((resolve, reject) => {
    client ??= oauth.initTokenClient({ client_id: DRIVE.clientId, scope: DRIVE.scope, callback: () => {} });
    client.callback = (r) => {
      if (r?.access_token) {
        storeToken(r.access_token, Number(r.expires_in) || 3600);
        resolve(r.access_token);
      } else reject(new Error(r?.error || "Google didn't return a token"));
    };
    client.error_callback = (e) => reject(new Error(e?.type === "popup_closed" ? "Sign-in was closed" : e?.message || "Sign-in failed"));
    client.requestAccessToken({ prompt: interactive ? "" : "none" });
  });
  return timeout(request, interactive ? 180000 : 12000, "Google sign-in");
}

async function api(tok: string, path: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://www.googleapis.com${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${tok}`, ...(init.headers ?? {}) },
    });
    if (r.status === 401) {
      signOut();
      throw new Error("Google sign-in expired. Sign in again.");
    }
    if (!r.ok) throw new Error(`Drive returned ${r.status}`);
    return r;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Drive timed out. Check the connection.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

const q = (s: string) => encodeURIComponent(s);

async function findFolder(tok: string): Promise<string | undefined> {
  const r = await api(
    tok,
    `/drive/v3/files?q=${q(`name='${DRIVE.folder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&spaces=drive`,
  );
  return (await r.json()).files?.[0]?.id;
}

async function findFile(tok: string, folder: string): Promise<string | undefined> {
  const r = await api(
    tok,
    `/drive/v3/files?q=${q(`name='${DRIVE.file}' and '${folder}' in parents and trashed=false`)}&fields=files(id)&spaces=drive`,
  );
  return (await r.json()).files?.[0]?.id;
}

export interface SyncResult {
  remote: unknown | null;
  push: (state: AppState) => Promise<void>;
}

/**
 * Reads the Drive copy and returns a push function for the merged state.
 * Split in two so the caller merges with its freshest local state in between.
 */
export async function openDrive(interactive: boolean): Promise<SyncResult> {
  const tok = await token(interactive);
  let folder = await findFolder(tok);
  const fileId = folder ? await findFile(tok, folder) : undefined;
  const remote = fileId ? await (await api(tok, `/drive/v3/files/${fileId}?alt=media`)).json() : null;
  return {
    remote,
    push: async (state) => {
      const body = JSON.stringify(state);
      if (fileId) {
        await api(tok, `/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } else {
        folder ??= (
          await (
            await api(tok, "/drive/v3/files", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: DRIVE.folder, mimeType: "application/vnd.google-apps.folder" }),
            })
          ).json()
        ).id;
        const b = "fitty_workout_boundary";
        const meta = JSON.stringify({ name: DRIVE.file, parents: [folder], mimeType: "application/json" });
        await api(tok, "/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: { "Content-Type": `multipart/related; boundary=${b}` },
          body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
        });
      }
      try {
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      } catch {
        /* storage blocked */
      }
    },
  };
}

export function lastSynced(): string {
  try {
    return localStorage.getItem(LAST_SYNC_KEY) || "";
  } catch {
    return "";
  }
}
