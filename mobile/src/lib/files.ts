import { Directory, File, Paths } from "expo-file-system";
import type { LocalFile } from "./types";

/**
 * Attachments are copied into the app's own storage when picked, so an
 * email waiting in the outbox still has its files after the picker's
 * temporary copies are cleaned up.
 */
const dir = () => {
  const d = new Directory(Paths.document, "outbox-files");
  if (!d.exists) d.create({ intermediates: true });
  return d;
};

export function keepFile(file: LocalFile): LocalFile {
  try {
    const source = new File(file.uri);
    const target = new File(dir(), `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${file.name.replace(/[^\w.\- ]/g, "_")}`);
    source.copy(target);
    return { ...file, uri: target.uri, size: file.size ?? target.size };
  } catch {
    return file;
  }
}

export function dropFiles(files: LocalFile[] | undefined): void {
  for (const f of files ?? []) {
    try {
      if (f.uri.includes("/outbox-files/")) new File(f.uri).delete();
    } catch {
      // already gone
    }
  }
}
