// Builds native/psd-wasm (PhotoCraft's PSD reader as WebAssembly) and copies the result to
// server/vendor/psd.wasm, which is committed so running the app never needs Rust.
// Needs Rust ≥ 1.95 with the wasm32-unknown-unknown target. Usage: node scripts/build-psd-wasm.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = path.join(root, 'native', 'psd-wasm', 'Cargo.toml');
// Rust embeds source file paths in panic messages; rewrite them so the committed .wasm carries no
// local folder names (home directory, user name)
const cargoHome = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
const remap = [`--remap-path-prefix=${cargoHome}=/cargo`, `--remap-path-prefix=${root}=/archive`, `--remap-path-prefix=${os.homedir()}=/home`];
const r = spawnSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown', '--manifest-path', manifest], {
  stdio: 'inherit',
  env: { ...process.env, RUSTFLAGS: [process.env.RUSTFLAGS, ...remap].filter(Boolean).join(' ') }
});
if (r.status !== 0) process.exit(r.status || 1);

const built = path.join(root, 'native', 'psd-wasm', 'target', 'wasm32-unknown-unknown', 'release', 'archive_psd_wasm.wasm');
const dest = path.join(root, 'server', 'vendor', 'psd.wasm');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(built, dest);
console.log(`psd.wasm: ${(fs.statSync(dest).size / 1024).toFixed(0)} KB → ${path.relative(root, dest)}`);

// Refuse to leave a build that still names a local folder
const text = fs.readFileSync(dest).toString('latin1');
const leaks = [os.homedir(), root, os.userInfo().username].filter((s) => s && s.length > 2 && text.includes(s));
if (leaks.length) {
  fs.rmSync(dest);
  console.error(`psd.wasm removed: it still contains local paths (${leaks.join(', ')})`);
  process.exit(1);
}
