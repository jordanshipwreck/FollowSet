import { useState, type ReactNode } from "react";
import { mediaFor } from "../lib/media";
import { Icon } from "./Icon";

/** Ring drawn as radial ticks, like the reference's dotted gauges. value 0–1. */
export function TickRing({
  value,
  size = 64,
  ticks = 60,
  length = 7,
  width = 2,
  on = "var(--lime)",
  off = "var(--tick-off)",
  children,
}: {
  value: number;
  size?: number;
  ticks?: number;
  length?: number;
  width?: number;
  on?: string;
  off?: string;
  children?: ReactNode;
}) {
  const v = Math.max(0, Math.min(1, value));
  const lit = Math.round(v * ticks);
  const c = size / 2;
  const r1 = c - 1;
  const r0 = r1 - length;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          return (
            <line
              key={i}
              x1={c + r0 * cos}
              y1={c + r0 * sin}
              x2={c + r1 * cos}
              y2={c + r1 * sin}
              stroke={i < lit ? on : off}
              strokeWidth={width}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {children !== undefined && <div className="ring-in">{children}</div>}
    </div>
  );
}

/** Row of dots, filled up to `filled`. The reference uses these as tiny progress meters. */
export function DotRow({ total, filled, max = 12 }: { total: number; filled: number; max?: number }) {
  const n = Math.min(total, max);
  const f = total > max ? Math.round((filled / total) * n) : filled;
  return (
    <span className="dots" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={i < f ? "on" : ""} />
      ))}
    </span>
  );
}

/** Big thin numeral with a small trailing unit: 12,340 lb. */
export function Num({ value, unit, className = "" }: { value: ReactNode; unit?: string; className?: string }) {
  return (
    <span className={`num ${className}`}>
      {value}
      {unit && <sup>{unit}</sup>}
    </span>
  );
}

/** White glass stat card: icon chip, label, big number, a footer slot, optional ↗ action. */
export function StatCard({
  icon,
  label,
  value,
  unit,
  foot,
  onOpen,
  tone,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  unit?: string;
  foot?: ReactNode;
  onOpen?: () => void;
  tone?: "lime" | "rose" | "dark";
}) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <div className="stat-top">
        <span className="ico">
          <Icon name={icon} size={16} />
        </span>
        {onOpen && (
          <button type="button" className="arrow" aria-label={`Open ${label}`} onClick={onOpen}>
            <Icon name="arrowUp" size={16} />
          </button>
        )}
      </div>
      <span className="label">{label}</span>
      <Num value={value} unit={unit} />
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

/** Pill with a round knob on the left, after the reference's "Pay in full" control. */
export function KnobButton({
  label,
  onClick,
  disabled,
  icon = "arrow",
  testid,
  tone = "lime",
  ariaLabel,
}: {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: string;
  testid?: string;
  tone?: "lime" | "dark" | "glass";
  ariaLabel?: string;
}) {
  return (
    <button type="button" className={`knob ${tone}`} data-testid={testid} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      <span className="knob-dot">
        <Icon name={icon} size={20} />
      </span>
      <span className="knob-label">{label}</span>
      <span className="knob-trail" aria-hidden="true">
        <Icon name="right" size={14} />
        <Icon name="right" size={14} />
      </span>
    </button>
  );
}

/** Soft blurred color glows behind the page. */
export function Aura({ image }: { image?: string }) {
  return (
    <div className="aura" aria-hidden="true">
      {image ? <img src={image} alt="" /> : null}
      <i className="a1" />
      <i className="a2" />
      <i className="a3" />
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
        <i className="grab" aria-hidden="true" />
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
      <span className="label">{label}</span>
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
        {unit && <sup>{unit}</sup>}
      </label>
      <div className="stepper-row">
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => bump(-step)} disabled={disabled}>
          <Icon name="minus" size={18} />
        </button>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => bump(step)} disabled={disabled}>
          <Icon name="plus" size={18} />
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

/** Black-active pill tabs, as in the reference's "Karma / Credits / Money" switcher. */
export function Pills<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="pilltabs" role="tablist">
      {options.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}
