import { clipboard, nativeImage } from "electron";

export type ClipboardSnapshot = {
  text: string;
  html: string;
  rtf: string;
  image: Electron.NativeImage;
  formats: { format: string; buffer: Buffer }[];
};

export function snapshotClipboard(): ClipboardSnapshot {
  const formats = clipboard.availableFormats();
  const buffers = formats.map((format) => ({
    format,
    buffer: clipboard.readBuffer(format)
  }));

  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: clipboard.readImage(),
    formats: buffers
  };
}

export function restoreClipboard(snapshot: ClipboardSnapshot) {
  clipboard.write({
    text: snapshot.text,
    html: snapshot.html,
    rtf: snapshot.rtf,
    image: snapshot.image || nativeImage.createEmpty()
  });

  for (const item of snapshot.formats) {
    clipboard.writeBuffer(item.format, item.buffer);
  }
}
