import { ZipPack } from '../types';
import { registerPack } from '../services/zipService';

export interface VirtualFile {
  path: string;
  content: string;
  size?: number;
}

export function createVirtualPack(name: string, files: VirtualFile[]): ZipPack {
  const fileMap = new Map<string, string>();
  const list = files.map((f) => {
    fileMap.set(f.path, f.content);
    return {
      path: f.path,
      size: f.size || new Blob([f.content]).size
    };
  });

  const totalSize = list.reduce((acc, curr) => acc + curr.size, 0);

  const pack: ZipPack = {
    name,
    size: totalSize,
    list,
    has: (p: string) => fileMap.has(p),
    text: async (p: string) => fileMap.get(p) || '',
    b64: async (p: string) => {
      const c = fileMap.get(p) || '';
      return btoa(unescape(encodeURIComponent(c)));
    },
    blob: async (p: string) => {
      const c = fileMap.get(p) || '';
      return new Blob([c], { type: 'text/plain' });
    }
  };

  return pack;
}

export function initSeedZipPacks() {
  // 1. Neo-brutal button pack.zip
  const p1 = createVirtualPack('Neo-brutal button pack.zip', [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="grid">
    <button class="btn btn-primary" onclick="press(this)">PRIMARY ACTION</button>
    <button class="btn btn-accent" onclick="press(this)">ACCENT CLICK</button>
    <button class="btn btn-warn" onclick="press(this)">DANGER ZONE</button>
  </div>
  <script src="buttons.js"></script>
</body>
</html>`
    },
    {
      path: 'style.css',
      content: `body {
  margin: 0;
  height: 100vh;
  display: grid;
  place-items: center;
  background: #10161d;
  font-family: 'Barlow Condensed', system-ui, sans-serif;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.btn {
  padding: 14px 28px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  border: 3px solid #1d1f20;
  box-shadow: 4px 4px 0 #1d1f20;
  cursor: pointer;
  transition: transform 0.08s, box-shadow 0.08s;
}
.btn:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #1d1f20;
}
.btn-primary { background: #b5d9fd; color: #10161d; }
.btn-accent { background: #5980a6; color: #f2f2f3; }
.btn-warn { background: #ff5566; color: #ffffff; }`
    },
    {
      path: 'buttons.js',
      content: `function press(el) {
  el.style.transform = 'scale(0.96)';
  setTimeout(() => el.style.transform = '', 120);
}`
    },
    {
      path: 'tokens.json',
      content: JSON.stringify(
        {
          border: '3px solid #1d1f20',
          shadow: '4px 4px 0 #1d1f20',
          radii: '0px',
          palettes: ['#b5d9fd', '#5980a6', '#ff5566']
        },
        null,
        2
      )
    },
    {
      path: 'readme.md',
      content: `# Neo-Brutal Button Pack
High-contrast tactical buttons with sharp corners, hard box-shadows, and micro-press physics.`
    }
  ]);
  registerPack('pack_neobrutal', p1);

  // 2. Loader collection 40x.zip
  const p2 = createVirtualPack('Loader collection 40x.zip', [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="loaders.css">
</head>
<body>
  <div class="deck">
    <div class="loader-box"><div class="spinner"></div><span>SPIN</span></div>
    <div class="loader-box"><div class="pulse-ring"></div><span>PULSE</span></div>
    <div class="loader-box"><div class="radar"></div><span>RADAR</span></div>
  </div>
</body>
</html>`
    },
    {
      path: 'loaders.css',
      content: `body {
  margin: 0;
  height: 100vh;
  display: grid;
  place-items: center;
  background: #10161d;
  color: #e9edf2;
  font-family: ui-monospace, Menlo, monospace;
}
.deck { display: flex; gap: 24px; }
.loader-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  letter-spacing: .12em;
  color: #94bce3;
}
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(148,188,227,0.2);
  border-top-color: #b5d9fd;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.pulse-ring {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #5980a6;
  animation: pulse 1.4s ease-out infinite;
}
.radar {
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 2px solid #5980a6;
  position: relative;
}
.radar::after {
  content: ''; position: absolute; inset: 4px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, #b5d9fd);
  animation: spin 1.2s linear infinite;
}
@keyframes spin { to { transform: rotate(1turn); } }
@keyframes pulse {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}`
    },
    {
      path: 'readme.md',
      content: `# 40x Lightweight CSS Loaders
Zero-dependency SVG and CSS animations tuned for high FPS.`
    }
  ]);
  registerPack('pack_loaders', p2);

  // 3. Scroll demos 2024.zip
  const p3 = createVirtualPack('Scroll demos 2024.zip', [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    overflow-y: scroll;
    background: #0b1016;
    color: #e9edf2;
    font-family: 'Barlow Condensed', sans-serif;
    padding: 24px;
    box-sizing: border-box;
  }
  .card {
    height: 120px;
    margin-bottom: 16px;
    border-radius: 12px;
    background: #182636;
    border: 1px solid #2c455d;
    display: grid;
    place-items: center;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: .05em;
    color: #b5d9fd;
  }
</style>
</head>
<body>
  <div class="card">01 · PINNED HERO</div>
  <div class="card">02 · PARALLAX DEPTH</div>
  <div class="card">03 · HORIZONTAL SCRUB</div>
  <div class="card">04 · VELOCITY SKEW</div>
</body>
</html>`
    },
    {
      path: 'readme.md',
      content: `# Scroll Choreography Demos 2024
ScrollTrigger & FLIP integration patterns for buttery page reflows.`
    }
  ]);
  registerPack('pack_scroll', p3);

  // 4. Shader playground.zip
  const p4 = createVirtualPack('Shader playground.zip', [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; height: 100vh; background: #000; overflow: hidden; }
  canvas { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
  <canvas id="c"></canvas>
  <script>
    const canvas = document.getElementById('c');
    const gl = canvas.getContext('webgl');
    const vs = \`attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }\`;
    const fs = \`
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_res;
      void main() {
        vec2 st = gl_FragCoord.xy / u_res;
        float color = 0.5 + 0.5 * sin(u_time * 2.0 + st.x * 6.0 + st.y * 4.0);
        gl_FragColor = vec4(vec3(0.2, 0.45, 0.7) * color, 1.0);
      }
    \`;
    function createShader(gl, type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');

    function render(time) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uTime, time * 0.001);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  </script>
</body>
</html>`
    },
    {
      path: 'fragment.glsl',
      content: `precision mediump float;
uniform float u_time;
uniform vec2 u_res;
void main() {
  vec2 st = gl_FragCoord.xy / u_res;
  float color = 0.5 + 0.5 * sin(u_time * 2.0 + st.x * 6.0 + st.y * 4.0);
  gl_FragColor = vec4(vec3(0.2, 0.45, 0.7) * color, 1.0);
}`
    },
    {
      path: 'readme.md',
      content: `# GLSL Shader Playground
Live WebGL fragment shaders with time and resolution uniforms.`
    }
  ]);
  registerPack('pack_shaders', p4);

  // 5. Failed morph attempts.zip
  const p5 = createVirtualPack('Failed morph attempts.zip', [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: #10161d;
    color: #b5d9fd;
    font-family: ui-monospace, Menlo, monospace;
    text-align: center;
  }
  svg { width: 140px; height: 140px; }
  path { fill: #5980a6; transition: d 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6); }
  button {
    margin-top: 20px;
    padding: 8px 16px;
    border-radius: 8px;
    background: #2c455d;
    color: #e9edf2;
    border: 0;
    cursor: pointer;
  }
</style>
</head>
<body>
  <div>
    <svg viewBox="0 0 100 100">
      <path id="p" d="M10 10 H90 V90 H10 Z"></path>
    </svg>
    <br>
    <button onclick="toggle()">Morph Shape</button>
  </div>
  <script>
    let star = false;
    function toggle() {
      star = !star;
      const d = star 
        ? "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z"
        : "M10 10 H90 V90 H10 Z";
      document.getElementById('p').setAttribute('d', d);
    }
  </script>
</body>
</html>`
    },
    {
      path: 'readme.md',
      content: `# SVG Path Morph Experiments
Comparison of cubic-bezier path interpolations versus polygon point triangulation.`
    }
  ]);
  registerPack('pack_morph', p5);
}
