import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { registerIpc } from "./ipc";

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#07080c",
    title: "Zenith Client",
    frame: false,
    titleBarStyle: "hidden",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isDev || !url.startsWith(process.env.VITE_DEV_SERVER_URL!)) e.preventDefault();
  });
  if (isDev) void win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else void win.loadFile(join(__dirname, "../../dist-renderer/index.html"));
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    const win = createWindow();
    registerIpc(win);
    app.on("second-instance", () => {
      if (win.isMinimized()) win.restore();
      win.focus();
    });
  });
  app.on("window-all-closed", () => app.quit());
}
