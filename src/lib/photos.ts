// Progress photos live in IndexedDB "fitty-photos" (store "photos"). They never leave the phone
// unless exported as a zip.

export const POSES = [
  { id: "front-relaxed", label: "Front, relaxed", hint: "Arms at your sides. Feet under your hips. Look at the camera." },
  { id: "front-double-bi", label: "Front double-bi", hint: "Elbows up, fists near the shoulders. Don't lean back." },
  { id: "side-l", label: "Left side", hint: "Left side toward the camera. Arm slightly off the hip so the silhouette shows." },
  { id: "side-r", label: "Right side", hint: "Right side toward the camera. Same stance as the left." },
  { id: "back", label: "Back, relaxed", hint: "Back to the camera, arms at your sides, head neutral." },
  { id: "back-double-bi", label: "Back double-bi", hint: "Back to the camera, elbows up, squeeze the shoulder blades lightly." },
] as const;

export interface Photo {
  id: string;
  date: string;
  pose: string;
  blob: Blob;
  at: number;
}

const DB = "fitty-photos";
const STORE = "photos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Photos need IndexedDB, which this browser does not provide."));
      return;
    }
    const t = setTimeout(() => reject(new Error("IndexedDB timed out")), 4000);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => {
      clearTimeout(t);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(t);
      reject(req.error ?? new Error("Photos couldn't open"));
    };
    req.onblocked = () => {
      clearTimeout(t);
      reject(new Error("IndexedDB is blocked"));
    };
  });
}

export async function listPhotos(): Promise<Photo[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as Photo[]).sort((a, b) => b.at - a.at));
    req.onerror = () => reject(req.error ?? new Error("Photos couldn't be read"));
  });
}

export async function addPhoto(date: string, pose: string, blob: Blob): Promise<void> {
  const db = await open();
  const p: Photo = { id: `${date}|${pose}|${Date.now()}`, date, pose, blob, at: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(p);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Photo didn't save"));
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Photo didn't delete"));
  });
}

// ---------- Minimal store-only zip writer ----------

const CRC = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[i] = c;
}
export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files: { name: string; data: Uint8Array }[]): Blob {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const enc = new TextEncoder();
  const local: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(10, time, true);
    h.setUint16(12, date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, f.data.length, true);
    h.setUint32(22, f.data.length, true);
    h.setUint16(26, name.length, true);
    local.push(h.buffer, name, f.data as BlobPart);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.data.length, true);
    c.setUint32(24, f.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    centralSize += 46 + name.length;
    offset += 30 + name.length + f.data.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...local, ...central, end.buffer], { type: "application/zip" });
}

export async function photosZip(photos: Photo[]): Promise<Blob> {
  const files = [];
  for (const p of photos) {
    const ext = p.blob.type.includes("png") ? "png" : "jpg";
    files.push({ name: `${p.date}/${p.pose}-${p.at}.${ext}`, data: new Uint8Array(await p.blob.arrayBuffer()) });
  }
  return zip(files);
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
