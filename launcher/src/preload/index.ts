import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as Result<T>;
  if (!res.ok) throw new Error(res.error);
  return res.value;
}

const ALLOWED_EVENTS = new Set(["progress", "launch:status", "launch:log", "auth:deviceCode"]);

contextBridge.exposeInMainWorld("zenith", {
  call,
  on(channel: string, listener: (payload: unknown) => void) {
    if (!ALLOWED_EVENTS.has(channel)) throw new Error(`Event ${channel} is not allowed`);
    const wrapped = (_e: IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
});
