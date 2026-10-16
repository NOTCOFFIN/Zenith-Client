import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AccountSummary, GameProfile, LaunchStatus, LauncherSettings, ProgressEvent } from "../shared/types";
import { api, type AppInfo } from "./api";

interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}

interface Store {
  info: AppInfo | null;
  settings: LauncherSettings | null;
  profiles: GameProfile[];
  accounts: AccountSummary[];
  progress: ProgressEvent | null;
  launch: LaunchStatus;
  logs: string[];
  toasts: Toast[];
  updateSettings: (patch: Partial<LauncherSettings>) => Promise<void>;
  reloadAccounts: () => Promise<void>;
  reloadProfiles: () => Promise<void>;
  toast: (kind: Toast["kind"], text: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [profiles, setProfiles] = useState<GameProfile[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [launch, setLaunch] = useState<LaunchStatus>({ state: "idle", profileId: null, pid: null, exitCode: null, message: null, logFile: null });
  const [logs, setLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const reloadAccounts = useCallback(async () => setAccounts(await api.accounts.list()), []);
  const reloadProfiles = useCallback(async () => setProfiles(await api.profiles.list()), []);

  useEffect(() => {
    void api.appInfo().then(setInfo);
    void api.settings.get().then(setSettings);
    void reloadProfiles();
    void reloadAccounts();
    void api.launch.status().then(setLaunch);
    const offs = [
      api.onProgress((e) => setProgress(e.stage === "done" ? null : e)),
      api.onLaunchStatus((s) => {
        setLaunch(s);
        if (s.state !== "preparing") setProgress(null);
      }),
      api.onLaunchLog((line) => setLogs((l) => (l.length > 500 ? [...l.slice(-400), line] : [...l, line])))
    ];
    return () => offs.forEach((off) => off());
  }, [reloadAccounts, reloadProfiles]);

  const updateSettings = useCallback(async (patch: Partial<LauncherSettings>) => {
    setSettings(await api.settings.update(patch));
  }, []);

  return (
    <Ctx.Provider value={{ info, settings, profiles, accounts, progress, launch, logs, toasts, updateSettings, reloadAccounts, reloadProfiles, toast }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(err);
}
