import { useEffect, useRef, useState } from "react";
import { canRecord, recorderType } from "../lib/mediaStore";
import { Icon } from "./Icon";
import { Sheet } from "./ui";

/**
 * Records a short demo video (camera) or voice note (mic), or takes a file instead.
 * Calls onSave with the blob; the caller stores it.
 */
export function Recorder({
  kind,
  title,
  onSave,
  onClose,
}: {
  kind: "video" | "audio";
  title: string;
  onSave: (b: Blob) => void;
  onClose: () => void;
}) {
  const max = kind === "video" ? 30 : 20;
  const [phase, setPhase] = useState<"idle" | "live" | "rec" | "review">("idle");
  const [err, setErr] = useState("");
  const [sec, setSec] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const live = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);
  const facing = useRef<"user" | "environment">("user");

  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      clearInterval(tick.current);
      stopStream();
    },
    [],
  );
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  async function openDevice() {
    setErr("");
    try {
      stopStream();
      stream.current = await navigator.mediaDevices.getUserMedia(
        kind === "video" ? { video: { facingMode: facing.current, width: { ideal: 720 } }, audio: true } : { audio: true },
      );
      if (live.current && kind === "video") {
        live.current.srcObject = stream.current;
        live.current.muted = true;
        await live.current.play().catch(() => {});
      }
      setPhase("live");
    } catch {
      setErr(kind === "video" ? "Camera needs permission. You can upload a video instead." : "Microphone needs permission.");
    }
  }

  function start() {
    if (!stream.current) return;
    chunks.current = [];
    const type = recorderType(kind);
    const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      setBlob(new Blob(chunks.current, { type: r.mimeType || type || (kind === "video" ? "video/webm" : "audio/webm") }));
      stopStream();
      setPhase("review");
    };
    rec.current = r;
    r.start(250);
    setSec(0);
    setPhase("rec");
    const t0 = Date.now();
    tick.current = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSec(s);
      if (s >= max) stop();
    }, 200);
  }

  function stop() {
    clearInterval(tick.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }

  return (
    <Sheet
      title={title}
      onClose={() => {
        stop();
        stopStream();
        onClose();
      }}
    >
      <div className={`recorder ${kind}`}>
        {kind === "video" && (
          <div className="rec-stage">
            {phase === "review" && url ? (
              <video src={url} controls playsInline loop autoPlay muted />
            ) : (
              <video ref={live} playsInline muted />
            )}
            {phase === "rec" && (
              <span className="rec-badge">
                <i /> {sec}s / {max}s
              </span>
            )}
          </div>
        )}
        {kind === "audio" && (
          <div className="rec-audio">
            <div className={phase === "rec" ? "rec-orb on" : "rec-orb"}>
              <Icon name="mic" size={34} />
            </div>
            {phase === "rec" && (
              <p className="dotnum">
                0:{String(sec).padStart(2, "0")} / 0:{max}
              </p>
            )}
            {phase === "review" && url && <audio src={url} controls />}
            {phase !== "rec" && phase !== "review" && (
              <p className="muted small">Say what you'd tell someone mid-set: tempo, what to feel, a push for the last reps.</p>
            )}
          </div>
        )}
        {err && <p className="callout warn">{err}</p>}

        <div className="stack">
          {phase === "idle" && canRecord() && (
            <button type="button" className="btn accent wide" onClick={() => void openDevice()}>
              <Icon name={kind === "video" ? "camera" : "mic"} size={18} /> {kind === "video" ? "Open camera" : "Use microphone"}
            </button>
          )}
          {phase === "live" && (
            <div className="row center">
              {kind === "video" && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    facing.current = facing.current === "user" ? "environment" : "user";
                    void openDevice();
                  }}
                >
                  Flip
                </button>
              )}
              <button type="button" className="rec-btn" aria-label="Start recording" onClick={start}>
                <i />
              </button>
            </div>
          )}
          {phase === "rec" && (
            <div className="row center">
              <button type="button" className="rec-btn on" aria-label="Stop recording" onClick={stop}>
                <i />
              </button>
            </div>
          )}
          {phase === "review" && blob && (
            <div className="row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setBlob(null);
                  void openDevice();
                }}
              >
                Retake
              </button>
              <button type="button" className="btn accent" style={{ flex: 1 }} onClick={() => onSave(blob)}>
                <Icon name="check" size={18} /> Use this
              </button>
            </div>
          )}
          {(phase === "idle" || phase === "live") && (
            <label className="btn ghost wide">
              <Icon name="upload" size={18} /> Upload a {kind === "video" ? "video" : "recording"}
              <input
                type="file"
                accept={kind === "video" ? "video/*" : "audio/*"}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 60 * 1024 * 1024) {
                    setErr("That file is over 60 MB. Trim it to a short clip.");
                    return;
                  }
                  stopStream();
                  setBlob(f);
                  setPhase("review");
                }}
              />
            </label>
          )}
          {!canRecord() && phase === "idle" && <p className="muted small">This browser can't record. Upload a clip instead.</p>}
        </div>
      </div>
    </Sheet>
  );
}
