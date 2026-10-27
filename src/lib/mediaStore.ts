// Creator media (Studio videos and voice notes). Local refs look like "local:<id>" and live in
// IndexedDB "followset-media"; once Supabase Storage is connected, refs are https URLs.
import { useEffect, useState } from "react";

const DB = "followset-media";
const STORE = "blobs";

interface Row {
  id: string;
  blob: Blob;
  at: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser can't store media."));
      return;
    }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Media store couldn't open"));
  });
}

export async function putMedia(blob: Blob): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, blob, at: Date.now() } satisfies Row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Media didn't save"));
  });
  return `local:${id}`;
}

export async function getMedia(ref: string): Promise<Blob | null> {
  if (!ref.startsWith("local:")) return null;
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(ref.slice(6));
    req.onsuccess = () => resolve((req.result as Row | undefined)?.blob ?? null);
    req.onerror = () => reject(req.error ?? new Error("Media couldn't be read"));
  });
}

export async function deleteMedia(ref: string): Promise<void> {
  if (!ref.startsWith("local:")) return;
  const db = await open();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(ref.slice(6));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** A playable URL for a media ref: object URL for local blobs, the URL itself for remote ones. */
export function useMediaUrl(ref: string | undefined): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!ref) {
      setUrl("");
      return;
    }
    if (!ref.startsWith("local:")) {
      setUrl(ref);
      return;
    }
    let alive = true;
    let made = "";
    getMedia(ref)
      .then((b) => {
        if (!alive || !b) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      })
      .catch(() => setUrl(""));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [ref]);
  return url;
}

/** Best recording format this browser supports (Safari records mp4, Chrome webm). */
export function recorderType(kind: "video" | "audio"): string | undefined {
  const R = (window as unknown as { MediaRecorder?: { isTypeSupported(t: string): boolean } }).MediaRecorder;
  if (!R) return undefined;
  const options =
    kind === "video"
      ? ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"]
      : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return options.find((t) => R.isTypeSupported(t));
}

export function canRecord(): boolean {
  return typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;
}
