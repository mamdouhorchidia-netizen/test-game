// Generates app/src/main/assets/levels.js: random rooms, kept only when the
// solver proves them solvable and every gadget in the room actually matters.
// Usage: node tools/gen-levels.js
'use strict';
const fs = require('fs');
const path = require('path');
const Sim = require('../app/src/main/assets/sim.js');

let seed = 20991109;
function rnd() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

function connected(g) {
  const h = g.length, w = g[0].length;
  let start = null, total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] !== '#') { total++; start = start || [x, y]; }
  const seen = new Set([start[1] * w + start[0]]), st = [start];
  while (st.length) {
    const [x, y] = st.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * w + nx;
      if (g[ny][nx] !== '#' && !seen.has(k)) { seen.add(k); st.push([nx, ny]); }
    }
  }
  return seen.size === total;
}

function candidate(spec) {
  const w = spec.w + 2, h = spec.h + 2;
  const g = [];
  for (let y = 0; y < h; y++) {
    g.push([]);
    for (let x = 0; x < w; x++) g[y].push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.');
  }
  const free = () => {
    for (let n = 0; n < 200; n++) {
      const x = ri(1, w - 2), y = ri(1, h - 2);
      if (g[y][x] === '.') return [x, y];
    }
    return null;
  };
  const put = (ch, n) => { for (let i = 0; i < n; i++) { const p = free(); if (p) g[p[1]][p[0]] = ch; } };
  put('#', Math.round(spec.w * spec.h * spec.walls));
  if (!connected(g)) return null;
  put('O', spec.chutes); put('g', spec.goo || 0);
  put('t', spec.trash); put('c', spec.cat || 0); put('z', spec.zoomba || 0);
  return g.map(r => r.join(''));
}

const solveLen = (rows, depth) => {
  const lv = Sim.parse(rows);
  const r = Sim.solve(lv, lv.objs, 30000, depth);
  return r.path === null ? null : r;
};
const without = (rows, ch, to) => rows.map(r => r.split(ch).join(to || '.'));

// A gadget "matters" when deleting it changes the shortest solution.
function gadgetsMatter(rows, len) {
  for (const ch of ['c', 'g', 'z']) {
    if (!rows.some(r => r.includes(ch))) continue;
    const alt = solveLen(without(rows, ch), len);
    if (alt && alt.path.length === len) return false;
  }
  return true;
}

function pick(spec) {
  let best = null;
  for (let n = 0; n < spec.tries; n++) {
    const rows = candidate(spec);
    if (!rows) continue;
    const r = solveLen(rows, spec.len);
    if (!r || r.path.length !== spec.len) continue;
    if (!gadgetsMatter(rows, spec.len)) continue;
    if (!best || r.explored > best.explored) best = { rows, path: r.path, explored: r.explored };
  }
  if (!best) throw new Error('no level for ' + JSON.stringify(spec));
  return best;
}

const T = 1500;
const specs = [
  // Orientation: trash only
  { w: 4, h: 4, walls: 0.00, chutes: 1, trash: 1, len: 2, tries: 300 },
  { w: 4, h: 5, walls: 0.10, chutes: 1, trash: 2, len: 3, tries: T },
  { w: 5, h: 5, walls: 0.12, chutes: 1, trash: 2, len: 4, tries: T },
  { w: 5, h: 6, walls: 0.12, chutes: 1, trash: 3, len: 4, tries: T },
  { w: 5, h: 6, walls: 0.14, chutes: 2, trash: 3, len: 5, tries: T },
  // The cat
  { w: 4, h: 5, walls: 0.08, chutes: 1, trash: 1, cat: 1, len: 3, tries: T },
  { w: 5, h: 5, walls: 0.10, chutes: 1, trash: 2, cat: 1, len: 4, tries: T },
  { w: 5, h: 6, walls: 0.12, chutes: 1, trash: 2, cat: 1, len: 5, tries: T },
  { w: 5, h: 6, walls: 0.12, chutes: 2, trash: 3, cat: 1, len: 5, tries: T },
  { w: 6, h: 6, walls: 0.12, chutes: 1, trash: 3, cat: 1, len: 6, tries: T },
  { w: 6, h: 7, walls: 0.12, chutes: 2, trash: 3, cat: 2, len: 6, tries: T },
  // Goo
  { w: 5, h: 5, walls: 0.08, chutes: 1, trash: 1, goo: 1, len: 3, tries: T },
  { w: 5, h: 6, walls: 0.10, chutes: 1, trash: 2, goo: 2, len: 4, tries: T },
  { w: 5, h: 6, walls: 0.10, chutes: 1, trash: 2, goo: 2, cat: 1, len: 5, tries: T },
  { w: 6, h: 6, walls: 0.10, chutes: 1, trash: 3, goo: 2, cat: 1, len: 6, tries: T },
  { w: 6, h: 7, walls: 0.12, chutes: 2, trash: 3, goo: 3, cat: 1, len: 6, tries: T },
  { w: 6, h: 7, walls: 0.12, chutes: 1, trash: 3, goo: 3, cat: 1, len: 7, tries: T },
  // Zoomba
  { w: 5, h: 5, walls: 0.08, chutes: 1, trash: 1, zoomba: 1, len: 3, tries: T },
  { w: 5, h: 6, walls: 0.10, chutes: 1, trash: 2, zoomba: 1, len: 4, tries: T },
  { w: 5, h: 6, walls: 0.10, chutes: 1, trash: 2, zoomba: 1, cat: 1, len: 5, tries: T },
  { w: 6, h: 6, walls: 0.10, chutes: 1, trash: 3, zoomba: 1, cat: 1, len: 6, tries: T },
  { w: 6, h: 7, walls: 0.12, chutes: 2, trash: 3, zoomba: 1, goo: 1, len: 6, tries: T },
  { w: 6, h: 7, walls: 0.12, chutes: 1, trash: 3, zoomba: 1, goo: 2, cat: 1, len: 7, tries: T },
  { w: 6, h: 7, walls: 0.12, chutes: 2, trash: 4, zoomba: 2, cat: 1, len: 7, tries: T },
  // Everything at once
  { w: 6, h: 8, walls: 0.12, chutes: 2, trash: 4, zoomba: 1, goo: 2, cat: 1, len: 8, tries: T },
  { w: 6, h: 8, walls: 0.12, chutes: 1, trash: 3, zoomba: 2, goo: 2, cat: 1, len: 8, tries: T },
  { w: 6, h: 8, walls: 0.13, chutes: 2, trash: 4, zoomba: 1, goo: 2, cat: 2, len: 9, tries: T },
  { w: 6, h: 8, walls: 0.13, chutes: 1, trash: 4, zoomba: 2, goo: 3, cat: 1, len: 9, tries: T },
  { w: 6, h: 8, walls: 0.13, chutes: 2, trash: 5, zoomba: 2, goo: 2, cat: 2, len: 10, tries: T },
  { w: 6, h: 8, walls: 0.13, chutes: 1, trash: 4, zoomba: 2, goo: 3, cat: 2, len: 11, tries: T },
];

const levels = specs.map((s, i) => {
  const lv = pick(s);
  console.log(`level ${i + 1}: ${lv.path} (explored ${lv.explored})`);
  return { rows: lv.rows, par: lv.path.length };
});

const out = '// Generated by tools/gen-levels.js - do not edit by hand.\nvar LEVELS = ' +
  JSON.stringify(levels, null, 1).replace(/\[\s+("[^\]]*?")\s+\]/gs, (m, a) => '[\n   ' + a.replace(/\s*\n\s*/g, '\n   ') + '\n  ]') + ';\n';
fs.writeFileSync(path.join(__dirname, '../app/src/main/assets/levels.js'), out);
console.log('wrote', levels.length, 'levels');
