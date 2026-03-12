"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("pnife", {
    providers: {
        list: () => electron_1.ipcRenderer.invoke("pnife:providers:list"),
        upsert: (provider) => electron_1.ipcRenderer.invoke("pnife:providers:upsert", provider),
        delete: (id) => electron_1.ipcRenderer.invoke("pnife:providers:delete", id),
        setDefault: (id) => electron_1.ipcRenderer.invoke("pnife:providers:setDefault", id)
    },
    tools: {
        list: () => electron_1.ipcRenderer.invoke("pnife:tools:list"),
        save: (tools) => electron_1.ipcRenderer.invoke("pnife:tools:save", tools)
    },
    pipeline: {
        run: (pipeline, context) => electron_1.ipcRenderer.invoke("pnife:pipeline:run", pipeline, context)
    },
    activity: {
        onEvent: (callback) => {
            const listener = (_event, event) => callback(event);
            electron_1.ipcRenderer.on("pnife:activity:event", listener);
            return () => electron_1.ipcRenderer.removeListener("pnife:activity:event", listener);
        }
    }
});
