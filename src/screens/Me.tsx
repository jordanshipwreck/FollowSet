import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Sheet, Toggle } from "../components/ui";
import { iso } from "../lib/dates";
import { say } from "../lib/device";
import { DRIVE, lastSynced, signOut, wasSignedIn } from "../lib/drive";
import { addPhoto, deletePhoto, download, listPhotos, photosZip, POSES, type Photo } from "../lib/photos";
import { mergeStates, parseState } from "../lib/store";
import type { Store } from "../lib/useStore";

function BlobImg({ blob, alt }: { blob: Blob; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? <img src={url} alt={alt} /> : null;
}

function syncedLabel(s: string): string {
  if (!s) return "Never synced";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "Never synced" : `Synced ${d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

export function Me({
  store,
  sync,
  syncMsg,
  toast,
}: {
  store: Store;
  sync: (interactive: boolean) => Promise<void>;
  syncMsg: string;
  toast: (t: string) => void;
}) {
  const { state, setSettings, commit, ref, saveFailed } = store;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoErr, setPhotoErr] = useState("");
  const [cam, setCam] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(wasSignedIn);
  const video = useRef<HTMLVideoElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const today = iso();

  const refresh = () =>
    listPhotos()
      .then((p) => {
        setPhotos(p);
        const dates = [...new Set(p.map((x) => x.date))].sort();
        setA((v) => v || dates[0] || "");
        setB((v) => v || dates[dates.length - 1] || "");
      })
      .catch((e: Error) => setPhotoErr(e.message || "Photos couldn't be read on this browser."));

  useEffect(() => {
    void refresh();
    return () => stopCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCam() {
    const s = video.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (video.current) video.current.srcObject = null;
    setCam(null);
  }

  async function startCam(pose: string) {
    setPhotoErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhotoErr("This browser has no camera stream. Use Upload.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setCam(pose);
      setTimeout(() => {
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => setPhotoErr("Camera didn't start. Use Upload."));
        }
      }, 0);
    } catch {
      setPhotoErr("Camera needs permission. Use Upload instead.");
    }
  }

  async function shutter() {
    const v = video.current;
    if (!v || !cam) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 720;
    c.height = v.videoHeight || 960;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.86));
    if (blob) {
      await addPhoto(today, cam, blob);
      await refresh();
      toast("Photo saved");
    }
    stopCam();
  }

  function exportJson() {
    download(new Blob([JSON.stringify(ref.current, null, 2)], { type: "application/json" }), `followset-${today}.json`);
  }

  async function importJson(f: File) {
    try {
      const parsed = parseState(JSON.parse(await f.text()));
      if (!parsed) throw new Error("bad");
      const { state: merged, changed } = mergeStates(ref.current, parsed);
      commit(merged);
      toast(changed ? "Imported. Newer sessions from the file were merged in." : "Nothing new in that file.");
    } catch {
      toast("That file isn't a Followset export.");
    }
  }

  const latest = (pose: string) => photos.find((p) => p.pose === pose);
  const dates = [...new Set(photos.map((p) => p.date))].sort();

  return (
    <div className="screen">
      <header className="page-head">
        <h1>You</h1>
        <p className="muted">Photos, sync, and settings</p>
      </header>

      {saveFailed && <div className="callout warn">This browser blocked local save. Export JSON before you leave.</div>}

      <section className="card" data-testid="settings">
        <span className="eyebrow">Workout</span>
        <div className="set-row">
          <div>
            <strong>Voice cues</strong>
            <p className="muted small">Reads each move, counts rest down, and listens for reps.</p>
          </div>
          <Toggle label="Voice cues" testid="voice-toggle" checked={state.settings.voice} onChange={(v) => {
            setSettings({ voice: v });
            if (v) say("Voice cues on.", true);
          }} />
        </div>
        <div className="set-row">
          <div>
            <strong>Weight step</strong>
            <p className="muted small">How much the + and − buttons move the weight.</p>
          </div>
          <div className="seg">
            {[2.5, 5, 10].map((s) => (
              <button type="button" key={s} className={state.settings.weightStep === s ? "on" : ""} onClick={() => setSettings({ weightStep: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Appearance</span>
        <div className="set-row">
          <div>
            <strong>Theme</strong>
            <p className="muted small">System follows your phone's light or dark setting.</p>
          </div>
          <div className="seg" data-testid="theme">
            {(["system", "light", "dark"] as const).map((t) => (
              <button type="button" key={t} className={state.settings.theme === t ? "on" : ""} onClick={() => setSettings({ theme: t })}>
                {t === "system" ? "Auto" : t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Backup</span>
        <p className="muted small">
          Logs live on this phone. Google Drive keeps a copy in {DRIVE.folder}/{DRIVE.file} and merges sessions from your other devices.
        </p>
        <p className="small" data-testid="last-synced">
          <Icon name="cloud" size={16} /> {syncedLabel(lastSynced())}
        </p>
        {syncMsg && <p className="muted small">{syncMsg}</p>}
        <div className="row">
          <button
            type="button"
            className="btn accent"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await sync(true);
              setSignedIn(wasSignedIn());
              setBusy(false);
            }}
          >
            <Icon name="cloud" size={18} /> {signedIn ? "Sync now" : "Sign in with Google"}
          </button>
          {signedIn && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                signOut();
                setSignedIn(false);
                toast("Signed out of Drive");
              }}
            >
              Sign out
            </button>
          )}
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={exportJson}>
            <Icon name="download" size={18} /> Export JSON
          </button>
          <button type="button" className="btn ghost" onClick={() => importRef.current?.click()}>
            <Icon name="upload" size={18} /> Import JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="card" data-testid="photos">
        <div className="group-head">
          <span className="eyebrow">Progress photos</span>
          <span className="muted small">{photos.length} saved</span>
        </div>
        <p className="muted small">Same light, same spot, same time of day. Photos stay on this phone.</p>
        {photoErr && <div className="callout warn">{photoErr}</div>}
        <div className="poses">
          {POSES.map((p) => {
            const l = latest(p.id);
            return (
              <div className="pose" key={p.id}>
                <div className="pose-img">{l ? <BlobImg blob={l.blob} alt={p.label} /> : <Icon name="user" size={30} />}</div>
                <strong>{p.label}</strong>
                <p className="muted small">{l ? l.date : p.hint}</p>
                <div className="row tight">
                  <label className="btn ghost sm">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        try {
                          await addPhoto(today, p.id, f);
                          await refresh();
                          toast("Photo saved");
                        } catch (err) {
                          setPhotoErr((err as Error).message);
                        }
                      }}
                    />
                  </label>
                  <button type="button" className="btn ghost sm" onClick={() => void startCam(p.id)}>
                    <Icon name="camera" size={16} />
                  </button>
                  {l && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Delete ${p.label} photo`}
                      onClick={async () => {
                        await deletePhoto(l.id);
                        await refresh();
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="row">
          <button type="button" className="btn ghost" disabled={dates.length < 2} onClick={() => setCompare(true)}>
            Compare dates
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!photos.length}
            onClick={async () => download(await photosZip(photos), "followset-photos.zip")}
          >
            <Icon name="download" size={18} /> Export zip
          </button>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">App</span>
        <p className="muted small">
          Build {__BUILD_ID__}. If something looks stuck after an update, reset the cache. Logs and photos stay.
        </p>
        <button
          type="button"
          className="btn ghost"
          onClick={async () => {
            try {
              const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
              await Promise.all(regs.map((r) => r.unregister()));
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            } catch {
              /* best effort */
            }
            location.reload();
          }}
        >
          Reset app cache
        </button>
      </section>

      {cam && (
        <div className="overlay cam">
          <video ref={video} playsInline muted />
          <p className="muted">{POSES.find((p) => p.id === cam)?.hint}</p>
          <div className="row center">
            <button type="button" className="btn ghost" onClick={stopCam}>
              Cancel
            </button>
            <button type="button" className="btn accent big" onClick={() => void shutter()}>
              <Icon name="camera" /> Shutter
            </button>
          </div>
        </div>
      )}

      {compare && (
        <Sheet title="Compare" onClose={() => setCompare(false)}>
          <div className="edit-grid">
            <label className="field">
              <span>Before</span>
              <select value={a} onChange={(e) => setA(e.target.value)}>
                {dates.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>After</span>
              <select value={b} onChange={(e) => setB(e.target.value)}>
                {dates.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          {POSES.map((p) => {
            const pa = photos.find((x) => x.pose === p.id && x.date === a);
            const pb = photos.find((x) => x.pose === p.id && x.date === b);
            if (!pa && !pb) return null;
            return (
              <div key={p.id}>
                <p className="eyebrow">{p.label}</p>
                <div className="compare">
                  {pa ? <BlobImg blob={pa.blob} alt={`${p.label} ${a}`} /> : <p className="muted">None on {a}</p>}
                  {pb ? <BlobImg blob={pb.blob} alt={`${p.label} ${b}`} /> : <p className="muted">None on {b}</p>}
                </div>
              </div>
            );
          })}
        </Sheet>
      )}
    </div>
  );
}
