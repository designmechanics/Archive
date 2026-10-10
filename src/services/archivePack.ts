import { ZipFileInfo, ZipPack } from '../types';

/**
 * Archives other than zip, opened in the browser itself: rar, 7z, tar, tar.gz, gz, bz2, xz, iso,
 * cab. Uses libarchive.js (libarchive as WebAssembly, MIT) in a web worker; its worker bundle and
 * .wasm are copied to /libarchive/ by scripts/copy-vendor.mjs. Loaded only when such a file is
 * dropped (zipService `packFromFile` decides which files come here). Files on disk do not: the
 * server reads those with 7-Zip.
 */

let archiveLib: Promise<any> | null = null;
function loadLib(): Promise<any> {
  if (!archiveLib) {
    archiveLib = import('libarchive.js').then((m: any) => {
      const Archive = m.Archive || m.default?.Archive;
      Archive.init({ workerUrl: '/libarchive/worker-bundle.js' });
      return Archive;
    });
  }
  return archiveLib;
}

/** A ZipPack over any archive libarchive can read. Throws when it cannot be read or is encrypted. */
export async function createPackFromArchive(name: string, blob: Blob): Promise<ZipPack> {
  const Archive = await loadLib();
  const archive = await Archive.open(blob instanceof File ? blob : new File([blob], name));
  if (await archive.hasEncryptedData()) throw new Error('password protected');

  // [{ file: CompressedFile { name, size, extract() }, path: 'folder/' }]
  const rows: { file: any; path: string }[] = await archive.getFilesArray();
  const entries = new Map<string, any>();
  const list: ZipFileInfo[] = [];
  for (const { file, path } of rows) {
    const full = `${path || ''}${file.name}`;
    if (/(^|\/)__MACOSX\/|(^|\/)\.DS_Store$/i.test(full)) continue;
    entries.set(full, file);
    list.push({ path: full, size: file.size || 0 });
  }

  const extracted = new Map<string, Promise<File>>(); // each entry is unpacked once
  const get = (p: string): Promise<File | null> => {
    const ent = entries.get(p);
    if (!ent) return Promise.resolve(null);
    if (!extracted.has(p)) extracted.set(p, ent.extract());
    return extracted.get(p)!;
  };

  return {
    name,
    size: blob.size,
    list,
    rawBlob: blob,
    has(p: string) {
      return entries.has(p);
    },
    async text(p: string) {
      const f = await get(p);
      return f ? await f.text() : '';
    },
    async b64(p: string) {
      const f = await get(p);
      if (!f) return '';
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    async blob(p: string) {
      return (await get(p)) || new Blob();
    }
  };
}
