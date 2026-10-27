// Followset cloud sync. Does nothing when the cloud isn't configured, so the local-first app is
// unaffected. Anyone: Discover pulls published programs from every creator. Signed in: your
// programs (and their creator media) push after changes, your snapshot stays current for the
// coach and connector, and programs outside assistants suggested arrive in Studio as drafts.
import { useEffect } from "react";
import { CLOUD } from "./cloud";
import { claimSuggestion, cloudUser, deleteProgram, pullPrograms, pullSuggestions, pushProgram, pushSnapshot, uploadMedia } from "./cloudAuth";
import { health, useHealth } from "./health";
import { market, useMarket, type Program } from "./market";
import { getMedia } from "./mediaStore";
import { buildSnapshot, daysFromSuggestion } from "./snapshot";
import type { Store } from "./useStore";
import { loadVault } from "./vault";

const PUSH_DELAY = 5000;
const PUSHED_KEY = "followset-cloud-pushed";

function pushedAt(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PUSHED_KEY) || "{}");
  } catch {
    return {};
  }
}
function markPushed(id: string, at: number) {
  try {
    localStorage.setItem(PUSHED_KEY, JSON.stringify({ ...pushedAt(), [id]: at }));
  } catch {
    /* storage blocked: it re-pushes next time, which is harmless */
  }
}

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/mp4": "m4a", "audio/webm": "webm", "audio/mpeg": "mp3", "audio/ogg": "ogg" };

/** Upload the program's on-device media, swap in the public URLs, then upsert the program. */
async function publishProgram(p: Program): Promise<Program> {
  const urls = new Map<string, string>();
  const up = async (ref: string | undefined) => {
    if (!ref?.startsWith("local:") || urls.has(ref)) return;
    const blob = await getMedia(ref);
    if (blob) urls.set(ref, await uploadMedia(blob, `${p.id}/${ref.slice(6)}.${EXT[blob.type.split(";")[0]] ?? "bin"}`));
  };
  if (p.published) for (const w of Object.values(p.days)) for (const g of w?.groups ?? []) for (const it of g.items) await Promise.all([up(it.videoRef), up(it.voiceRef)]);
  const swap = (ref?: string) => (ref && urls.get(ref)) || ref;
  const days: Program["days"] = {};
  for (const [d, w] of Object.entries(p.days) as [keyof Program["days"], NonNullable<Program["days"][keyof Program["days"]]>][])
    days[d] = { ...w, groups: w.groups.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, videoRef: swap(it.videoRef), voiceRef: swap(it.voiceRef) })) })) };
  const out = { ...p, days };
  await pushProgram(out);
  return out;
}

/** Delete locally, and from the cloud when it was ever pushed. A failed cloud delete is reported, not hidden. */
export async function removeProgram(id: string): Promise<boolean> {
  const wasPushed = !!pushedAt()[id];
  market.remove(id);
  if (!wasPushed || !CLOUD.configured || !cloudUser()) return true;
  try {
    await deleteProgram(id);
    return true;
  } catch {
    return false;
  }
}

/** Published programs from other creators, merged into the local list (yours stay as they are). */
export async function pullCloudPrograms(): Promise<void> {
  const me = cloudUser()?.id;
  const mine = new Set(market.all().filter((p) => market.isMine(p)).map((p) => p.id));
  // Never let a remote row replace one of your own programs, even if someone reused its id.
  const remote = (await pullPrograms()).filter((p) => p.creator.id !== me && !mine.has(p.id));
  if (!remote.length) return;
  const byId = new Map(remote.map((p) => [p.id, p]));
  const local = market.all().filter((p) => !p.builtin && !byId.has(p.id));
  market.replacePrograms([...local, ...remote]);
}

async function importSuggestions(toast: (t: string) => void) {
  const rows = await pullSuggestions();
  if (!rows.length) return;
  const vault = await loadVault().catch(() => []);
  for (const r of rows) {
    const d = market.draft();
    market.save({ ...d, title: r.program.title, summary: r.program.summary, tags: ["AI suggested"], days: daysFromSuggestion(r.program, vault) });
    await claimSuggestion(r.id);
  }
  toast(rows.length === 1 ? `New suggested program in Studio: ${rows[0].program.title}` : `${rows.length} suggested programs are in Studio`);
}

export function useCloudSync(store: Store, toast: (t: string) => void) {
  const h = useHealth();
  const m = useMarket();
  const on = CLOUD.configured && !!cloudUser();

  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => {
      pushSnapshot(buildSnapshot(store.ref.current, health.get(), market.active())).catch(() => {
        /* offline or signed out: the next change retries */
      });
    }, PUSH_DELAY);
    return () => clearTimeout(t);
  }, [on, store.state, h, m.activeId, store.ref]);

  // Push your programs that changed since their last push (publish, edits, unpublish).
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(async () => {
      const done = pushedAt();
      for (const p of market.all().filter((x) => market.isMine(x) && (x.published || done[x.id]) && x.updatedAt > (done[x.id] ?? 0))) {
        try {
          const out = await publishProgram(p);
          if (out !== p && JSON.stringify(out.days) !== JSON.stringify(p.days)) market.save(out);
          markPushed(p.id, market.find(p.id).updatedAt);
          if (p.published && !done[p.id]) toast(`${p.title} is live for everyone`);
        } catch {
          /* retried on the next change */
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [on, m.programs, toast]);

  useEffect(() => {
    if (!on) return;
    const pull = () => void importSuggestions(toast).catch(() => {});
    pull();
    const vis = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [on, toast]);
}
