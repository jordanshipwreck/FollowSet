import { useState } from "react";
import { CLOUD } from "../lib/cloud";
import { cloudUser, sendCode, signOutCloud, verifyCode } from "../lib/cloudAuth";
import { Icon } from "./Icon";

/** Followset cloud account: email-code sign-in once Supabase is connected. */
export function CloudCard({ toast }: { toast: (t: string) => void }) {
  const [user, setUser] = useState(cloudUser);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await f();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" data-testid="cloud">
      <span className="eyebrow">Followset account</span>
      {!CLOUD.configured ? (
        <p className="muted small">
          Coming with the Followset cloud: one account across phone, tablet, and web, publishing programs to everyone, paid subscriptions, and the Claude coach. Until then everything works on this device.
        </p>
      ) : user ? (
        <>
          <p className="small">
            <Icon name="cloud" size={16} /> Signed in as {user.email}
          </p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              signOutCloud();
              setUser(null);
              toast("Signed out");
            }}
          >
            Sign out
          </button>
        </>
      ) : !sent ? (
        <div className="row">
          <input className="grow" type="email" inputMode="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" className="btn accent" disabled={busy || !/.+@.+\..+/.test(email)} onClick={() => void run(async () => {
            await sendCode(email.trim());
            setSent(true);
          })}>
            Email me a code
          </button>
        </div>
      ) : (
        <div className="row">
          <input className="grow" inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button type="button" className="btn accent" disabled={busy || code.length < 6} onClick={() => void run(async () => {
            await verifyCode(email.trim(), code);
            setUser(cloudUser());
            toast("Signed in");
          })}>
            Sign in
          </button>
        </div>
      )}
      {err && <p className="callout warn">{err}</p>}
    </section>
  );
}
