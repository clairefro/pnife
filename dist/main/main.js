"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const mainIpc_1 = require("./mainIpc");
const toolStore_1 = require("./toolStore");
const isDev = !electron_1.app.isPackaged;
function getPreloadPath() {
    return node_path_1.default.join(__dirname, "..", "preload", "preload.js");
}
function getRendererUrl() {
    if (isDev) {
        return process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
    }
    return `file://${node_path_1.default.join(__dirname, "..", "renderer", "index.html")}`;
}
async function createWindow() {
    const win = new electron_1.BrowserWindow({
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
    (0, mainIpc_1.createMainIpc)({ ipcMain: electron_1.ipcMain, win });
}
electron_1.app.whenReady().then(async () => {
    (0, toolStore_1.ensureToolsSeeded)();
    await createWindow();
    electron_1.app.on("activate", async () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
