import { useState, type ReactNode } from "react";
import { mediaFor } from "../lib/media";
import { Icon } from "./Icon";

/** Circular progress ring. value 0–1. */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = "var(--lime)",
  track = "var(--track)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .35s ease" }}
        />
      </svg>
      {children !== undefined && <div className="ring-in">{children}</div>}
    </div>
  );
}

/** Still-frame thumbnail for an exercise, with a monogram when there is no media. */
export function Thumb({ name, size = 48 }: { name: string; size?: number }) {
  const m = mediaFor(name);
  const [bad, setBad] = useState(false);
  if (!m || bad)
    return (
      <span className="thumb mono" style={{ width: size, height: size }}>
        {name.slice(0, 1)}
      </span>
    );
  return (
    <img
      className={m.illustration ? "thumb ill" : "thumb"}
      src={m.still}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setBad(true)}
    />
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  step,
  unit,
  disabled,
  inputMode = "decimal",
  testid,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  unit?: string;
  disabled?: boolean;
  inputMode?: "decimal" | "numeric";
  testid?: string;
  placeholder?: string;
}) {
  const bump = (d: number) => {
    const n = parseFloat(value);
    const base = Number.isFinite(n) ? n : 0;
    onChange(String(Math.max(0, +(base + d).toFixed(2))));
  };
  return (
    <div className={disabled ? "stepper off" : "stepper"}>
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => bump(-step)} disabled={disabled}>
          <Icon name="minus" />
        </button>
        <label className="stepper-val">
          <input
            data-testid={testid}
            aria-label={label}
            inputMode={inputMode}
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
            onFocus={(e) => e.currentTarget.select()}
          />
          {unit && <small>{unit}</small>}
        </label>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => bump(step)} disabled={disabled}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, testid }: { checked: boolean; onChange: (v: boolean) => void; label: string; testid?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testid}
      className={checked ? "switch on" : "switch"}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}
