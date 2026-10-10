// Copies third-party runtime files that must be served as static assets into public/.
// Run automatically after `npm install` (postinstall) and before the dev server.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function copyDir(from, to, keep) {
  if (!fs.existsSync(from)) {
    console.warn(`[vendor] missing ${from}, skipped`);
    return;
  }
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (!keep(name)) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (fs.statSync(src).isFile()) {
      if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) fs.copyFileSync(src, dst);
    }
  }
}

// Ruffle (Flash emulator) for the SWF viewer
copyDir(
  path.join(root, 'node_modules', '@ruffle-rs', 'ruffle'),
  path.join(root, 'public', 'ruffle'),
  (n) => /\.(js|wasm)$/.test(n) && !n.endsWith('.map')
);

// three.js decoders for compressed 3D models (Draco, Meshopt, Basis/KTX2)
const jsm = path.join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');
copyDir(path.join(jsm, 'draco', 'gltf'), path.join(root, 'public', 'draco'), () => true);
copyDir(path.join(jsm, 'basis'), path.join(root, 'public', 'basis'), () => true);

// libarchive.js worker + WebAssembly: rar, 7z, tar, gz, iso... dropped into the browser
copyDir(
  path.join(root, 'node_modules', 'libarchive.js', 'dist'),
  path.join(root, 'public', 'libarchive'),
  (n) => n === 'worker-bundle.js' || n === 'libarchive.wasm'
);

console.log('[vendor] static assets ready');
