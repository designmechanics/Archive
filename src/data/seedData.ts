import { AssetEntry, AssetType } from '../types';

export const CATS: string[] = [
  "Effects",
  "Buttons",
  "Loaders",
  "Backgrounds",
  "Transitions",
  "Typography",
  "Layouts",
  "Scroll",
  "Physics",
  "Shaders",
  "Routines/utils",
  "Experiments"
];

export const KINDS: Record<AssetType, [string, string]> = {
  code: ["HTML/CSS/JS", "live sandbox"],
  zip: ["ZIP", "package"],
  svg: ["SVG", "vector"],
  font: ["OTF", "typeface"],
  video: ["MP4", "stock video"],
  photo: ["JPG", "stock photo"],
  psd: ["PSD", "photoshop"],
  ai: ["AI", "illustrator"],
  prproj: ["PRPROJ", "premiere"],
  icon: ["SVG SET", "icon set"],
  file: ["FILE", "file"]
};

export const EXT = {
  img: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"],
  vid: ["mp4", "webm", "mov", "m4v"],
  aud: ["mp3", "wav", "ogg", "m4a"],
  font: ["ttf", "otf", "woff", "woff2"],
  text: ["html", "htm", "css", "js", "mjs", "json", "md", "txt", "xml", "csv", "glsl", "frag", "vert", "ts", "jsx", "scss"]
};

export const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  json: "application/json",
  pdf: "application/pdf",
  md: "text/markdown"
};

export function extOf(p: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(p || "");
  return m ? m[1].toLowerCase() : "";
}

export function isIn(k: keyof typeof EXT, p: string): boolean {
  return EXT[k].indexOf(extOf(p)) >= 0;
}

export function fmtSize(n: number): string {
  return n > 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : n > 1024
    ? (n / 1024).toFixed(1) + " KB"
    : n + " B";
}

export function typeFromExt(x: string): AssetType {
  if (["html", "htm", "css", "js", "mjs"].indexOf(x) >= 0) return "code";
  if (x === "svg") return "svg";
  if (EXT.font.indexOf(x) >= 0) return "font";
  if (EXT.vid.indexOf(x) >= 0 || EXT.aud.indexOf(x) >= 0) return "video";
  if (EXT.img.indexOf(x) >= 0) return "photo";
  if (x === "psd" || x === "ai" || x === "prproj") return x as AssetType;
  return "file";
}

export const THEMES = {
  light: {
    bg: "#f2f2f3",
    surface: "#ffffff",
    ink: "#1d1f20",
    inkc: "29,31,32",
    well: "#e3e4e6",
    tint: "#eef6ff",
    "tint-ink": "#2c455d",
    rail: "#1d2d3d"
  },
  mid: {
    bg: "#7391b0",
    surface: "#b3c9df",
    ink: "#0f1b27",
    inkc: "15,27,39",
    well: "#6384a6",
    tint: "#d3e4f5",
    "tint-ink": "#16263a",
    rail: "#182636"
  },
  dark: {
    bg: "#10161d",
    surface: "#1b242e",
    ink: "#e9edf2",
    inkc: "233,237,242",
    well: "#0b1016",
    tint: "#233447",
    "tint-ink": "#b5d9fd",
    rail: "#1a2a3b"
  }
};

const S1 = "<" + "script>", S2 = "<" + "/script>";

export const DEMOS: string[] = [
  `<style>
    body{margin:0;height:100%;display:grid;place-items:center;background:var(--bg,#f2f2f3)}
    .b{width:78px;height:78px;background:#5980a6;animation:m 2.4s cubic-bezier(.6,0,.4,1) infinite}
    @keyframes m{
      0%,100%{border-radius:42% 58% 55% 45%;transform:rotate(0) scale(1)}
      33%{border-radius:60% 40% 35% 65%;transform:rotate(120deg) scale(1.12)}
      66%{border-radius:35% 65% 60% 40%;transform:rotate(240deg) scale(.92)}
    }
  </style><div class="b"></div>`,

  `<style>
    body{margin:0;height:100%;display:grid;place-items:center;background:var(--bg,#f2f2f3)}
    button{padding:16px 34px;border:0;border-radius:14px;font:600 17px/1 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#f2f2f3;background:linear-gradient(180deg,#6b91b6,#5980a6);box-shadow:0 3px 0 #416180,0 10px 22px rgba(65,97,128,.34);cursor:pointer;transition:transform .1s}
  </style><button id="b">Magnetic</button>` +
    S1 +
    `var b=document.getElementById('b');
    window.addEventListener('pointermove',function(e){
      var r=b.getBoundingClientRect(),
          dx=e.clientX-r.left-r.width/2,
          dy=e.clientY-r.top-r.height/2,
          d=Math.hypot(dx,dy),
          k=Math.max(0,1-d/260);
      b.style.transform='translate('+dx*k*.34+'px,'+dy*k*.34+'px) scale('+(1+k*.06)+')';
    });` +
    S2,

  `<style>
    body{margin:0;height:100%;overflow:hidden;background:var(--rail,#1d2d3d);display:grid;place-items:center}
    .w{width:100%;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
    .t{display:flex;gap:34px;width:max-content;animation:s 9s linear infinite;font:700 34px/1 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#b5d9fd}
    @keyframes s{to{transform:translateX(-50%)}}
  </style><div class="w"><div class="t"><span>ARCHIVE</span><span>·</span><span>INDEX</span><span>·</span><span>POOL</span><span>·</span><span>ARCHIVE</span><span>·</span><span>INDEX</span><span>·</span><span>POOL</span><span>·</span></div></div>`,

  `<style>
    body{margin:0;height:100%;background:var(--bg,#f2f2f3);display:grid;place-items:center;overflow:hidden}
    .g{width:240px;height:150px;border-radius:18px;filter:blur(26px);background:conic-gradient(from 0deg,#5980a6,#b5d9fd,#2c455d,#94bce3,#5980a6);animation:r 7s linear infinite}
    @keyframes r{to{transform:rotate(1turn) scale(1.1)}}
  </style><div class="g"></div>`
];

const RAW: [string, string, AssetType, string, string, string][] = [
  ["Gooey blob morph loader", "Loaders", "code", "own · 2019 rebuild", "2024-11-02", "gsap"],
  ["Magnetic cursor button", "Buttons", "code", "own", "2025-02-14", "gsap"],
  ["Chromatic split hover", "Effects", "code", "own", "2025-06-08", ""],
  ["Infinite marquee ticker", "Transitions", "code", "own", "2023-08-19", ""],
  ["Liquid page wipe", "Transitions", "code", "own", "2025-01-30", "gsap · flip"],
  ["Elastic drawer spring", "Physics", "code", "own", "2024-04-11", "gsap"],
  ["Scroll-linked parallax stack", "Scroll", "code", "own", "2024-09-27", "scrolltrigger"],
  ["Card deck peel physics", "Physics", "code", "own", "2025-03-05", "matter.js"],
  ["Noise displacement bg", "Backgrounds", "code", "own", "2022-12-01", "three.js"],
  ["Aurora mesh gradient", "Backgrounds", "code", "own", "2025-05-21", ""],
  ["Halftone dither shader", "Shaders", "code", "own", "2024-02-16", "glsl"],
  ["Refraction glass panel", "Shaders", "code", "own", "2025-07-12", "glsl"],
  ["Variable weight scroller", "Typography", "code", "own", "2024-06-30", ""],
  ["Kinetic headline splitter", "Typography", "code", "own", "2025-04-02", "splittype"],
  ["Bento grid auto-packer", "Layouts", "code", "own", "2025-02-01", ""],
  ["Masonry with FLIP reflow", "Layouts", "code", "own", "2024-10-14", "gsap · flip"],
  ["Sticky column choreography", "Scroll", "code", "own", "2023-11-23", "scrolltrigger"],
  ["Squish press micro-state", "Buttons", "code", "own", "2025-08-04", ""],
  ["Segmented toggle slide", "Buttons", "code", "own", "2024-07-19", ""],
  ["Skeleton shimmer set", "Loaders", "code", "own", "2023-05-09", ""],
  ["Orbit spinner trio", "Loaders", "code", "own", "2022-09-14", ""],
  ["Ken Burns crossfader", "Transitions", "code", "own", "2024-01-08", ""],
  ["Ripple reveal mask", "Effects", "code", "own", "2025-06-25", ""],
  ["Text scramble decode", "Typography", "code", "own", "2023-03-17", ""],
  ["Debounce / throttle kit", "Routines/utils", "code", "own", "2021-10-04", ""],
  ["Easing curve library", "Routines/utils", "code", "own", "2022-04-22", ""],
  ["Viewport unit polyfill", "Routines/utils", "code", "own", "2020-08-30", ""],
  ["Colour ramp generator", "Routines/utils", "code", "own", "2024-12-11", "culori"],
  ["Springy tag cluster", "Physics", "code", "own", "2025-07-30", "gsap"],
  ["Pointer trail smear", "Experiments", "code", "own", "2025-08-18", ""],
  ["CRT scanline overlay", "Experiments", "code", "own", "2021-06-06", ""],
  ["Isometric hover city", "Experiments", "code", "own", "2023-09-02", "three.js"],
  ["Neo-brutal button pack.zip", "Buttons", "zip", "own", "2024-03-28", ""],
  ["Loader collection 40x.zip", "Loaders", "zip", "own", "2023-07-15", ""],
  ["Scroll demos 2024.zip", "Scroll", "zip", "own", "2024-12-02", "scrolltrigger"],
  ["Shader playground.zip", "Shaders", "zip", "own", "2025-05-05", "glsl"],
  ["Grain texture pack", "Backgrounds", "photo", "own · shot 2019", "2019-11-19", ""],
  ["Concrete macro plates", "Backgrounds", "photo", "own", "2020-02-26", ""],
  ["Slow smoke plates 4K", "Backgrounds", "video", "own", "2022-01-15", ""],
  ["Ink bloom transitions 4K", "Transitions", "video", "own", "2023-04-06", ""],
  ["Title sequence build", "Transitions", "prproj", "own", "2024-08-21", "premiere"],
  ["Poster mechanicals v7", "Layouts", "psd", "own", "2021-03-11", "photoshop"],
  ["Editorial grid masters", "Layouts", "ai", "own", "2022-06-17", "illustrator"],
  ["Duotone treatment rig", "Effects", "psd", "own", "2023-10-29", "photoshop"],
  ["Blueprint corner marks", "Effects", "svg", "own", "2025-01-12", ""],
  ["Hatching pattern set", "Backgrounds", "svg", "own", "2024-05-16", ""],
  ["Thin-stroke UI icons 220", "Layouts", "icon", "own", "2025-03-22", ""],
  ["Media control glyphs", "Buttons", "icon", "own", "2024-02-09", ""],
  ["Grotesk Condensed VF", "Typography", "font", "licensed", "2024-04-30", ""],
  ["Mono Technical 400/700", "Typography", "font", "licensed", "2023-01-24", ""],
  ["Display Stencil Wide", "Typography", "font", "licensed", "2025-06-01", ""],
  ["Motion timing cheatsheet", "Routines/utils", "svg", "own", "2022-11-08", ""],
  ["Failed morph attempts", "Experiments", "zip", "own", "2021-01-27", "gsap"],
  ["Rotary dial input", "Experiments", "code", "own", "2025-08-26", "gsap"]
];

import { getRichDemo } from './richDemos';

const ZIP_PACK_IDS: Record<string, string> = {
  'Neo-brutal button pack.zip': 'pack_neobrutal',
  'Loader collection 40x.zip': 'pack_loaders',
  'Scroll demos 2024.zip': 'pack_scroll',
  'Shader playground.zip': 'pack_shaders',
  'Failed morph attempts': 'pack_morph'
};

export function getInitialSeedEntries(): AssetEntry[] {
  return RAW.map((r, i) => {
    const title = r[0];
    const packId = ZIP_PACK_IDS[title] || null;
    const realDemo = getRichDemo(title) || DEMOS[i % DEMOS.length];

    return {
      id: "a" + i,
      title: title,
      cat: r[1],
      type: r[2],
      author: r[3],
      date: r[4],
      deps: r[5],
      size: (1 + ((i * 37) % 92) / 10).toFixed(1) + " MB",
      demo: realDemo,
      fileCount: r[2] === "zip" ? 5 : 1,
      exts: r[2] === "zip" ? ["html", "css", "js"] : [r[2]],
      thumb: null,
      packId: packId,
      search: r[0] + " " + r[1] + " " + r[3] + " " + r[5]
    };
  });
}
