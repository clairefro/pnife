import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { createMainIpc } from "./mainIpc";

const isDev = !app.isPackaged;

function getPreloadPath() {
  return path.join(__dirname, "..", "preload", "preload.js");
}

function getRendererUrl() {
  if (isDev) {
    return process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
  }
  return `file://${path.join(__dirname, "..", "renderer", "index.html")}`;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  await win.loadURL(getRendererUrl());

  createMainIpc({ ipcMain, win });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
