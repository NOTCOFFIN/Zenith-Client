import { useEffect, useState } from "react";
import type { DeviceCodeInfo } from "../../shared/types";
import { api } from "../api";
import { errorText, useStore } from "../store";

export function AccountsPage() {
  const { accounts, settings, reloadAccounts, updateSettings, toast, info } = useStore();
  const [code, setCode] = useState<DeviceCodeInfo | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [offlineName, setOfflineName] = useState("");

  useEffect(() => api.onDeviceCode(setCode), []);

  const signIn = async () => {
    setSigningIn(true);
    try {
      const acc = await api.accounts.loginMicrosoft();
      toast("success", `Signed in as ${acc.username}`);
      await reloadAccounts();
      await updateSettings({ selectedAccountId: acc.id });
    } catch (err) {
      toast("error", errorText(err));
    } finally {
      setSigningIn(false);
      setCode(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Accounts</h1>
          <p className="muted">Sign in with Microsoft. Zenith never sees your password; tokens are encrypted with your operating system's credential storage.</p>
        </div>
        <button className="btn primary" onClick={signIn} disabled={signingIn || !info?.msClientConfigured}>{signingIn ? "Waiting for sign-in…" : "Add Microsoft account"}</button>
      </header>

      {!info?.msClientConfigured && (
        <p className="error">Microsoft sign-in is not configured for this build (missing Azure client ID). See docs/AUTHENTICATION.md.</p>
      )}

      {code && (
        <section className="card glass device-code">
          <h2>Finish signing in</h2>
          <p>Open <button className="link" onClick={() => api.openExternal(code.verificationUri)}>{code.verificationUri}</button> and enter this code:</p>
          <div className="code">{code.userCode}</div>
          <div className="row-actions">
            <button className="btn" onClick={() => navigator.clipboard.writeText(code.userCode)}>Copy code</button>
            <button className="btn ghost" onClick={() => api.accounts.cancelLogin()}>Cancel</button>
          </div>
        </section>
      )}

      <section className="card glass">
        <h2>Your accounts</h2>
        {accounts.length === 0 && <p className="muted">No accounts yet.</p>}
        <div className="account-list">
          {accounts.map((a) => (
            <div key={a.id} className={`account ${settings?.selectedAccountId === a.id ? "active" : ""}`}>
              <img src={`https://mc-heads.net/avatar/${a.uuid}/48`} alt="" width={48} height={48} />
              <div className="account-body">
                <strong>{a.username}</strong>
                <span className="muted small">{a.type === "microsoft" ? "Microsoft account" : "Offline development account"}</span>
              </div>
              <div className="row-actions">
                {settings?.selectedAccountId === a.id ? <span className="badge ok">Active</span> : <button className="btn small" onClick={() => updateSettings({ selectedAccountId: a.id })}>Use</button>}
                {a.type === "microsoft" && (
                  <button className="btn small ghost" onClick={async () => { try { await api.accounts.refresh(a.id); toast("success", "Session refreshed"); await reloadAccounts(); } catch (err) { toast("error", errorText(err)); } }}>Refresh</button>
                )}
                <button className="btn small danger" onClick={async () => { await api.accounts.remove(a.id); await reloadAccounts(); }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {info?.devOffline && (
        <section className="card glass">
          <h2>Development: offline account</h2>
          <p className="muted">Only shown with ZENITH_DEV_OFFLINE=1. For local testing in singleplayer; cannot join online-mode servers.</p>
          <form className="toolbar" onSubmit={async (e) => { e.preventDefault(); try { await api.accounts.addOfflineDev(offlineName); setOfflineName(""); await reloadAccounts(); } catch (err) { toast("error", errorText(err)); } }}>
            <input className="input" placeholder="Username" value={offlineName} onChange={(e) => setOfflineName(e.target.value)} />
            <button className="btn" type="submit">Add</button>
          </form>
        </section>
      )}
    </div>
  );
}
