/**
 * Real, authentic interactive demos for code experiments and UI effects.
 * Each demo is fully self-contained HTML/CSS/JS ready to run in the sandboxed iframe.
 */

const S1 = '<' + 'script>', S2 = '<' + '/script>';

export const RICH_DEMOS: Record<string, string> = {
  // 1. Gooey blob morph loader
  'Gooey blob morph loader': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: var(--bg, #10161d);
    overflow: hidden;
    filter: contrast(20);
  }
  .blobs {
    position: relative;
    width: 140px;
    height: 140px;
    filter: blur(10px);
  }
  .blob {
    position: absolute;
    width: 60px;
    height: 60px;
    background: #5980a6;
    border-radius: 50%;
  }
  .b1 { animation: m1 2.8s cubic-bezier(0.77, 0, 0.175, 1) infinite; }
  .b2 { animation: m2 2.8s cubic-bezier(0.77, 0, 0.175, 1) infinite; background: #94bce3; }
  .b3 { animation: m3 2.8s cubic-bezier(0.77, 0, 0.175, 1) infinite; background: #b5d9fd; }
  @keyframes m1 {
    0%, 100% { transform: translate(10px, 10px) scale(1); }
    33% { transform: translate(70px, 20px) scale(1.2); }
    66% { transform: translate(30px, 70px) scale(0.85); }
  }
  @keyframes m2 {
    0%, 100% { transform: translate(70px, 40px) scale(1.1); }
    33% { transform: translate(20px, 70px) scale(0.9); }
    66% { transform: translate(65px, 15px) scale(1.25); }
  }
  @keyframes m3 {
    0%, 100% { transform: translate(40px, 60px) scale(0.9); }
    33% { transform: translate(40px, 10px) scale(1.15); }
    66% { transform: translate(15px, 35px) scale(1.05); }
  }
</style>
</head>
<body>
  <div class="blobs">
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="blob b3"></div>
  </div>
</body>
</html>`,

  // 2. Magnetic cursor button
  'Magnetic cursor button': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: var(--bg, #10161d);
    font-family: 'Barlow Condensed', system-ui, sans-serif;
    user-select: none;
  }
  .wrap {
    padding: 60px;
  }
  button {
    padding: 18px 40px;
    border: 0;
    border-radius: 14px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #f2f2f3;
    background: linear-gradient(180deg, #6b91b6, #416180);
    box-shadow: 0 4px 0 #2c455d, 0 12px 24px rgba(44,69,93,0.4);
    cursor: pointer;
    will-change: transform;
    transition: transform 0.12s ease-out;
  }
  .hint {
    margin-top: 18px;
    text-align: center;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #94bce3;
    opacity: 0.7;
  }
</style>
</head>
<body>
  <div class="wrap">
    <button id="btn">Magnetic Pull</button>
    <div class="hint">Move cursor near button</div>
  </div>
  ${S1}
    const btn = document.getElementById('btn');
    window.addEventListener('pointermove', (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const maxDist = 240;

      if (dist < maxDist) {
        const factor = Math.pow(1 - dist / maxDist, 1.8);
        const tx = dx * factor * 0.45;
        const ty = dy * factor * 0.45;
        btn.style.transform = \`translate(\${tx}px, \${ty}px) scale(\${1 + factor * 0.08})\`;
      } else {
        btn.style.transform = 'translate(0px, 0px) scale(1)';
      }
    });
    window.addEventListener('pointerleave', () => {
      btn.style.transform = 'translate(0px, 0px) scale(1)';
    });
  ${S2}
</body>
</html>`,

  // 3. Chromatic split hover
  'Chromatic split hover': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: var(--bg, #10161d);
    color: #e9edf2;
    font-family: 'Barlow Condensed', system-ui, sans-serif;
    user-select: none;
  }
  .chroma {
    position: relative;
    font-size: 58px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .chroma span {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s;
  }
  .red { color: #ff3366; mix-blend-mode: screen; opacity: 0; }
  .cyan { color: #00eeff; mix-blend-mode: screen; opacity: 0; }
</style>
</head>
<body>
  <div class="chroma" id="target">
    CHROMATIC
    <span class="red" id="r">CHROMATIC</span>
    <span class="cyan" id="c">CHROMATIC</span>
  </div>
  ${S1}
    const t = document.getElementById('target');
    const r = document.getElementById('r');
    const c = document.getElementById('c');
    t.addEventListener('pointermove', (e) => {
      const rect = t.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.15;
      const y = (e.clientY - rect.top - rect.height / 2) * 0.15;
      r.style.opacity = '0.9';
      c.style.opacity = '0.9';
      r.style.transform = \`translate(\${x}px, \${y}px)\`;
      c.style.transform = \`translate(\${-x}px, \${-y}px)\`;
    });
    t.addEventListener('pointerleave', () => {
      r.style.opacity = '0';
      c.style.opacity = '0';
      r.style.transform = 'translate(0, 0)';
      c.style.transform = 'translate(0, 0)';
    });
  ${S2}
</body>
</html>`,

  // 4. Infinite marquee ticker
  'Infinite marquee ticker': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: var(--rail, #1a2a3b);
    overflow: hidden;
  }
  .marquee {
    width: 100%;
    overflow: hidden;
    user-select: none;
    mask-image: linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent);
  }
  .track {
    display: flex;
    gap: 40px;
    width: max-content;
    animation: scroll 12s linear infinite;
    font-family: 'Barlow Condensed', system-ui, sans-serif;
    font-weight: 700;
    font-size: 38px;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #b5d9fd;
  }
  .track:hover { animation-play-state: paused; }
  .dot { color: #5980a6; }
  @keyframes scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
</style>
</head>
<body>
  <div class="marquee">
    <div class="track">
      <span>ARCHIVE</span><span class="dot">✦</span>
      <span>REDISCOVERY</span><span class="dot">✦</span>
      <span>INTERFACE</span><span class="dot">✦</span>
      <span>EXPERIMENTS</span><span class="dot">✦</span>
      <span>ARCHIVE</span><span class="dot">✦</span>
      <span>REDISCOVERY</span><span class="dot">✦</span>
      <span>INTERFACE</span><span class="dot">✦</span>
      <span>EXPERIMENTS</span><span class="dot">✦</span>
    </div>
  </div>
</body>
</html>`,

  // 5. Aurora mesh gradient
  'Aurora mesh gradient': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    background: #0b1016;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .aurora {
    position: relative;
    width: 320px;
    height: 220px;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    background: #10161d;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(40px);
    opacity: 0.85;
    mix-blend-mode: screen;
  }
  .o1 { width: 180px; height: 180px; background: #5980a6; top: -30px; left: -30px; animation: p1 6s ease-in-out infinite alternate; }
  .o2 { width: 160px; height: 160px; background: #b5d9fd; bottom: -20px; right: -20px; animation: p2 7s ease-in-out infinite alternate; }
  .o3 { width: 140px; height: 140px; background: #2c455d; top: 30px; right: 20px; animation: p3 5s ease-in-out infinite alternate; }
  @keyframes p1 { 100% { transform: translate(60px, 40px) scale(1.2); } }
  @keyframes p2 { 100% { transform: translate(-50px, -30px) scale(1.15); } }
  @keyframes p3 { 100% { transform: translate(-30px, 40px) scale(0.85); } }
</style>
</head>
<body>
  <div class="aurora">
    <div class="orb o1"></div>
    <div class="orb o2"></div>
    <div class="orb o3"></div>
  </div>
</body>
</html>`,

  // 6. Halftone dither shader
  'Halftone dither shader': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: #0b1016;
    overflow: hidden;
  }
  canvas {
    border-radius: 14px;
    box-shadow: 0 14px 38px rgba(0,0,0,0.6);
  }
</style>
</head>
<body>
  <canvas id="c" width="340" height="220"></canvas>
  ${S1}
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    let t = 0;
    let mx = 170, my = 110;

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
    });

    function draw() {
      t += 0.04;
      ctx.fillStyle = '#0f161f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const step = 14;
      for (let x = step / 2; x < canvas.width; x += step) {
        for (let y = step / 2; y < canvas.height; y += step) {
          const d = Math.hypot(x - mx, y - my);
          const wave = Math.sin(d * 0.06 - t);
          const r = Math.max(1, (wave * 0.5 + 0.5) * (step * 0.48));
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = \`rgba(181, 217, 253, \${(wave * 0.4 + 0.6).toFixed(2)})\`;
          ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  ${S2}
</body>
</html>`,

  // 7. Text scramble decode
  'Text scramble decode': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: var(--bg, #10161d);
    color: #e9edf2;
    font-family: ui-monospace, Menlo, monospace;
    user-select: none;
  }
  .container {
    text-align: center;
  }
  .text {
    font-size: 26px;
    letter-spacing: .12em;
    font-weight: 700;
    color: #b5d9fd;
  }
  button {
    margin-top: 24px;
    padding: 10px 20px;
    border: 1px solid #416180;
    border-radius: 10px;
    background: #1d2d3d;
    color: #e9edf2;
    font-family: inherit;
    font-size: 11px;
    letter-spacing: .12em;
    text-transform: uppercase;
    cursor: pointer;
  }
  button:hover { background: #2c455d; }
</style>
</head>
<body>
  <div class="container">
    <div class="text" id="el">SYSTEM INITIALIZED</div>
    <button id="btn">Scramble Again</button>
  </div>
  ${S1}
    const words = ["SYSTEM INITIALIZED", "REDISCOVERY ENGINE", "NEURAL INDEX v2.4", "ARCHIVE PERSISTENCE", "INTERACTION CHOREOGRAPHY"];
    let wordIdx = 0;
    const chars = '!<>-_\\\\/[]{}—=+*^?#________';
    const el = document.getElementById('el');
    const btn = document.getElementById('btn');

    function scramble(newText) {
      const oldText = el.innerText;
      const length = Math.max(oldText.length, newText.length);
      const queue = [];
      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 20);
        const end = start + Math.floor(Math.random() * 20);
        queue.push({ from, to, start, end, char: '' });
      }

      let frame = 0;
      function update() {
        let output = '';
        let complete = 0;
        for (let i = 0; i < queue.length; i++) {
          let { from, to, start, end, char } = queue[i];
          if (frame >= end) {
            complete++;
            output += to;
          } else if (frame >= start) {
            if (!char || Math.random() < 0.28) {
              char = chars[Math.floor(Math.random() * chars.length)];
              queue[i].char = char;
            }
            output += \`<span style="color:#5980a6">\${char}</span>\`;
          } else {
            output += from;
          }
        }
        el.innerHTML = output;
        if (complete < queue.length) {
          frame++;
          requestAnimationFrame(update);
        }
      }
      update();
    }

    btn.addEventListener('click', () => {
      wordIdx = (wordIdx + 1) % words.length;
      scramble(words[wordIdx]);
    });
  ${S2}
</body>
</html>`,

  // 8. Easing curve library
  'Easing curve library': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: var(--bg, #10161d);
    font-family: ui-monospace, Menlo, monospace;
    color: #e9edf2;
  }
  .card {
    width: 320px;
    padding: 20px;
    border-radius: 14px;
    background: #182636;
    border: 1px solid rgba(148,188,227,0.2);
  }
  .track {
    height: 32px;
    background: rgba(148,188,227,0.08);
    border-radius: 8px;
    margin: 10px 0;
    position: relative;
  }
  .ball {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #5980a6, #b5d9fd);
    position: absolute;
    left: 0;
  }
  .t1 .ball { animation: run 2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
  .t2 .ball { animation: run 2s cubic-bezier(0.68, -0.6, 0.32, 1.6) infinite; background: linear-gradient(135deg, #749dc4, #94bce3); }
  .t3 .ball { animation: run 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
  @keyframes run {
    0% { left: 0; }
    60%, 100% { left: calc(100% - 32px); }
  }
  .label { font-size: 10px; color: #94bce3; letter-spacing: .08em; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="card">
    <div class="label">expo.out (0.16, 1, 0.3, 1)</div>
    <div class="track t1"><div class="ball"></div></div>
    <div class="label">elastic.out (0.68, -0.6, 0.32, 1.6)</div>
    <div class="track t2"><div class="ball"></div></div>
    <div class="label">power2.inOut (0.4, 0, 0.2, 1)</div>
    <div class="track t3"><div class="ball"></div></div>
  </div>
</body>
</html>`,

  // 9. Pointer trail smear
  'Pointer trail smear': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    background: #0b1016;
    overflow: hidden;
  }
  canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
  <canvas id="c"></canvas>
  ${S1}
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const points = [];
    window.addEventListener('pointermove', (e) => {
      points.push({ x: e.clientX, y: e.clientY, age: 0 });
    });

    function loop() {
      ctx.fillStyle = 'rgba(11, 16, 22, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        p.age += 1;
        const radius = Math.max(1, 24 - p.age * 0.8);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = \`hsl(\${205 + p.age * 2}, 65%, 65%)\`;
        ctx.fill();
      }

      while (points.length && points[0].age > 30) points.shift();
      requestAnimationFrame(loop);
    }
    loop();
  ${S2}
</body>
</html>`,

  // 10. Rotary dial input
  'Rotary dial input': `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    height: 100vh;
    display: grid;
    place-items: center;
    background: var(--bg, #10161d);
    font-family: 'Barlow Condensed', system-ui, sans-serif;
    color: #e9edf2;
    user-select: none;
  }
  .dial-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .dial {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: #182636;
    border: 3px solid #5980a6;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.15);
    position: relative;
    cursor: grab;
  }
  .dial:active { cursor: grabbing; }
  .pip {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #b5d9fd;
    top: 14px;
    left: calc(50% - 5px);
  }
  .val {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: .06em;
    color: #94bce3;
  }
</style>
</head>
<body>
  <div class="dial-wrap">
    <div class="dial" id="dial"><div class="pip"></div></div>
    <div class="val" id="val">0°</div>
  </div>
  ${S1}
    const dial = document.getElementById('dial');
    const val = document.getElementById('val');
    let angle = 0;
    let dragging = false;

    dial.addEventListener('pointerdown', (e) => {
      dragging = true;
      dial.setPointerCapture(e.pointerId);
    });

    dial.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = dial.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = Math.atan2(e.clientY - cy, e.clientX - cx);
      let deg = Math.round((rad * 180 / Math.PI) + 90);
      if (deg < 0) deg += 360;
      angle = deg;
      dial.style.transform = \`rotate(\${angle}deg)\`;
      val.innerText = \`\${angle}°\`;
    });

    dial.addEventListener('pointerup', () => { dragging = false; });
  ${S2}
</body>
</html>`
};

export function getRichDemo(title: string): string | null {
  return RICH_DEMOS[title] || null;
}
