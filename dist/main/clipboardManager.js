"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotClipboard = snapshotClipboard;
exports.restoreClipboard = restoreClipboard;
const electron_1 = require("electron");
function snapshotClipboard() {
    const formats = electron_1.clipboard.availableFormats();
    const buffers = formats.map((format) => ({
        format,
        buffer: electron_1.clipboard.readBuffer(format)
    }));
    return {
        text: electron_1.clipboard.readText(),
        html: electron_1.clipboard.readHTML(),
        rtf: electron_1.clipboard.readRTF(),
        image: electron_1.clipboard.readImage(),
        formats: buffers
    };
}
function restoreClipboard(snapshot) {
    electron_1.clipboard.write({
        text: snapshot.text,
        html: snapshot.html,
        rtf: snapshot.rtf,
        image: snapshot.image || electron_1.nativeImage.createEmpty()
    });
    for (const item of snapshot.formats) {
        electron_1.clipboard.writeBuffer(item.format, item.buffer);
    }
}
