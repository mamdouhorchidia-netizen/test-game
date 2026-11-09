// Gravity Janitor - rendering, input, menus. Rules live in sim.js.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('c'), g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1;

  var NAMES = ['Orientation Day', 'Break Room', 'Someone Microwaved Fish', 'Hydroponics (Bananas)', 'Two Chutes, No Excuses',
    'Chairman Meow\'s Quarters', 'Cat Nap Deck', 'Do Not Recycle The Cat', 'Litter Box Annex', 'Whisker Hazard', 'Two Cats, One Janitor',
    'Sticky Situation', 'Spilled Smoothie Bay', 'Goo Lab B', 'Gum Under Everything', 'Syrup Storage', 'The Floor Is Jam',
    'Zoomba Showroom', 'Contrarian Corridor', 'It Came With A Warranty', 'Vacuum vs. Cat', 'Wrong-Way Wing', 'Customer Support Deck',
    'Zoomba Uprising (Minor)', 'Reactor Snack Bar', 'Captain\'s Messy Cabin', 'Zero-G Food Court', 'The Big Sweep', 'Overtime',
    'Employee Of The Millennium'];
  var TIPS = {
    0: 'Swipe to flip gravity. Everything falls that way. Get the trash into the chute.',
    1: 'Things slide until they hit something. Use the walls.',
    5: 'This is Chairman Meow. He must NOT go down the chute. He knows where you sleep.',
    11: 'Green goo is sticky: anything that slides onto it stops right there.',
    17: 'The Zoomba is contrary. It falls the WRONG way, and it is too wide for the chute.'
  };
  var WIN = ['Spotless. The void is impressed.', 'Clean! HR has upgraded you to "adequate".', 'Trash: gone. Dignity: mostly intact.',
    'The chute says thank you. It can\'t talk. Probably.', 'Gravity did the work. You take the credit.',
    'You missed a spot. Kidding. There are no spots in space.', 'Another deck saved from mild untidiness.'];
  var FAIL = ['Chairman Meow took the chute. He is fine. He is FURIOUS.', 'The cat has been recycled into the laundry tube. Expect a complaint.',
    'Cat: 0. Chute: 1. Paperwork: 47 pages.', 'He landed in the sock bin. He will remember this.'];
  var MEOW = ['MROW.', 'HISS.', 'Rude.', 'Unbelievable.', 'I\'m telling the captain.', '...really?', 'Again?!'];
  var GRAV = { U: 'Gravity: up', D: 'Gravity: down', L: 'Gravity: left', R: 'Gravity: right' };

  // ---------- save ----------
  var save = { stars: [], sound: true };
  try { var raw = localStorage.getItem('gj-save'); if (raw) save = JSON.parse(raw); } catch (e) {}
  if (!save.stars) save.stars = [];
  function persist() { try { localStorage.setItem('gj-save', JSON.stringify(save)); } catch (e) {} }
  function unlocked() { var n = 0; while (n < LEVELS.length && save.stars[n]) n++; return Math.min(n, LEVELS.length - 1); }

  // ---------- sound ----------
  var ac = null;
  function audio() {
    if (!save.sound) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(type, f0, f1, dur, vol, delay) {
    var a = audio(); if (!a) return;
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), v = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(v); v.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  var sfx = {
    whoosh: function () { tone('sawtooth', 320, 110, 0.16, 0.05); },
    thunk: function () { tone('sine', 150, 55, 0.1, 0.25); },
    bump: function () { tone('square', 90, 70, 0.07, 0.06); },
    ding: function () { tone('triangle', 880, 880, 0.09, 0.14); tone('triangle', 1320, 1320, 0.16, 0.14, 0.08); },
    meow: function () { tone('sawtooth', 620, 980, 0.12, 0.09); tone('sawtooth', 980, 380, 0.4, 0.09, 0.12); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, f, 0.2, 0.13, i * 0.1); }); },
    tap: function () { tone('sine', 660, 660, 0.04, 0.06); }
  };
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // ---------- state ----------
  var S = { screen: 'title', idx: 0, level: null, objs: [], hist: [], moves: 0, dir: null, anim: null, queued: null,
    done: false, hint: null, bubble: null, shake: 0, land: {}, parts: [], hinted: false };
  var stars = [];
  for (var i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3, p: Math.random() * 6.3 });
  var drift = { x: 0, y: 0 };

  function show(name) {
    S.screen = name;
    ['title', 'play', 'levels', 'over'].forEach(function (id) {
      $(id).className = 'screen' + (id === name || (name === 'over' && id === 'play') ? ' on' : '');
    });
  }

  function startLevel(i) {
    S.idx = i; S.level = Sim.parse(LEVELS[i].rows); S.objs = Sim.cloneObjs(S.level.objs);
    S.hist = []; S.moves = 0; S.dir = null; S.anim = null; S.queued = null; S.done = false; S.hint = null;
    S.bubble = null; S.land = {}; S.parts = []; S.hinted = false;
    $('deck').textContent = 'Deck ' + (i < 9 ? '0' : '') + (i + 1);
    $('name').textContent = NAMES[i] || '';
    $('tip').textContent = TIPS[i] || '';
    $('par').textContent = 'Par ' + LEVELS[i].par;
    hud(); show('play');
  }
  function hud() {
    $('moves').textContent = S.moves;
    $('grav').textContent = S.dir ? GRAV[S.dir] : 'Gravity: off (budget cuts)';
  }

  function tickAt(t) {
    var v0 = 7, a = 110, vm = 30, tv = (vm - v0) / a;
    return t < tv ? v0 * t + 0.5 * a * t * t : v0 * tv + 0.5 * a * tv * tv + vm * (t - tv);
  }

  function doMove(dir) {
    if (S.screen !== 'play' || S.done) return;
    if (S.anim) { S.queued = dir; return; }
    S.hint = null;
    var before = Sim.cloneObjs(S.objs), res = Sim.move(S.level, S.objs, dir);
    if (!res.moved) { S.dir = dir; hud(); sfx.bump(); S.shake = 3; return; }
    S.hist.push({ objs: before, dir: S.dir, moves: S.moves });
    S.moves++; S.dir = dir; hud(); sfx.whoosh();
    if (S.idx > 1 || S.moves > 1) $('tip').textContent = TIPS[S.idx] && S.moves < 2 ? TIPS[S.idx] : '';
    var last = {}, bin = {};
    for (var id in res.tracks) {
      var tr = res.tracks[id], l = 0;
      for (var k = 1; k < tr.length; k++) if (tr[k][0] !== tr[k - 1][0] || tr[k][1] !== tr[k - 1][1]) l = k;
      last[id] = l;
    }
    res.binned.forEach(function (b) { bin[b.id] = b; });
    S.anim = { res: res, t0: performance.now(), last: last, bin: bin, fired: {}, f: 0,
      end: res.ticks + (res.binned.length ? 1.4 : 0.05) };
  }

  function finishAnim() {
    var res = S.anim.res; S.anim = null;
    if (res.lost) { S.done = true; S.queued = null; setTimeout(function () { result(false); }, 550); return; }
    if (res.won) { S.done = true; S.queued = null; setTimeout(function () { result(true); }, 450); return; }
    if (S.queued) { var q = S.queued; S.queued = null; doMove(q); }
  }

  function undo() {
    if (S.anim || !S.hist.length) return;
    var h = S.hist.pop(); S.objs = h.objs; S.dir = h.dir; S.moves = h.moves; S.done = false; S.hint = null; S.bubble = null;
    hud(); sfx.tap();
  }

  function hint() {
    if (S.anim || S.done) return;
    var r = Sim.solve(S.level, S.objs, 150000);
    S.hinted = true; sfx.tap();
    if (r.path) S.hint = { dir: r.path[0], t0: performance.now() };
    else $('tip').textContent = 'No clean way out from here. Try Undo or Retry.';
  }

  function result(won) {
    var par = LEVELS[S.idx].par, n = 0, last = S.idx === LEVELS.length - 1;
    $('card').className = won ? 'win' : 'fail';
    if (won) {
      n = S.moves <= par ? 3 : S.moves <= par + 2 ? 2 : 1;
      if ((save.stars[S.idx] || 0) < n) { save.stars[S.idx] = n; persist(); }
      $('verdict').textContent = last ? 'Promoted!' : 'Spotless!';
      $('line').textContent = last ? 'Every deck is clean. You are officially Employee of the Millennium. The prize is more decks. There are no more decks.'
        : WIN[(S.idx + S.moves) % WIN.length];
      $('stat').textContent = S.moves + ' moves · par ' + par + (n < 3 ? ' · 3 stars at par' : '');
      $('oMain').textContent = last ? 'All decks' : 'Next deck'; $('oA').textContent = 'Replay';
      sfx.win(); buzz(40);
    } else {
      $('verdict').textContent = 'Cat-astrophe';
      $('line').textContent = FAIL[(S.idx + S.moves) % FAIL.length];
      $('stat').textContent = 'No cats were harmed. One was offended.';
      $('oMain').textContent = 'Undo that'; $('oA').textContent = 'Retry';
    }
    var html = '';
    for (var k = 0; k < 3; k++) html += k < n ? '<b>★</b>' : '★';
    $('stars').innerHTML = html; $('stars').style.display = won ? '' : 'none';
    S.won = won; show('over');
  }

  function buildGrid() {
    var open = unlocked(), sum = 0, html = '';
    for (var k = 0; k < LEVELS.length; k++) {
      var st = save.stars[k] || 0; sum += st;
      var cls = k > open ? 'locked' : k === open && !st ? 'next' : '';
      html += '<button data-i="' + k + '" class="' + cls + '">' + (k + 1) + '<small>' +
        (k > open ? '' : '★★★'.slice(0, st)) + '</small></button>';
    }
    $('grid').innerHTML = html;
    $('total').textContent = '★ ' + sum + ' / ' + LEVELS.length * 3;
  }
  function openLevels() { buildGrid(); show('levels'); }

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function circle(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 6.2832); }

  // All sprites draw in a unit cell centred on 0,0 (cell spans -0.5..0.5).
  function drawTrash(kind) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (kind === 0) { // crumpled paper
      g.fillStyle = '#e9edf7'; g.beginPath();
      [[-.3, -.1], [-.14, -.32], [.12, -.3], [.31, -.12], [.27, .17], [.06, .32], [-.2, .27]].forEach(function (p, i) { i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
      g.closePath(); g.fill();
      g.strokeStyle = '#9aa6c6'; g.lineWidth = .035; g.beginPath();
      g.moveTo(-.14, -.32); g.lineTo(-.02, -.05); g.lineTo(.27, .17); g.moveTo(-.02, -.05); g.lineTo(-.2, .27); g.moveTo(.12, -.3); g.lineTo(.1, -.12); g.stroke();
    } else if (kind === 1) { // soda can
      g.rotate(-.3); g.fillStyle = '#ff5c8a'; rr(-.19, -.3, .38, .6, .07); g.fill();
      g.fillStyle = '#cfd8ee'; rr(-.19, -.3, .38, .1, .04); g.fill(); rr(-.19, .22, .38, .08, .04); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-.19, -.02); g.lineTo(.19, -.12); g.lineTo(.19, .0); g.lineTo(-.19, .1); g.closePath(); g.fill();
    } else if (kind === 2) { // banana peel
      g.strokeStyle = '#ffd23f'; g.lineWidth = .15; g.beginPath(); g.arc(0, -.34, .46, .55, 2.6); g.stroke();
      g.strokeStyle = '#f2b705'; g.lineWidth = .1; g.beginPath(); g.moveTo(0, .1); g.quadraticCurveTo(.02, -.14, .16, -.26); g.stroke();
      g.fillStyle = '#6b4a1e'; circle(.17, -.28, .05); g.fill(); circle(-.38, -.08, .04); g.fill(); circle(.38, -.08, .04); g.fill();
    } else if (kind === 3) { // fish bone
      g.rotate(.35); g.strokeStyle = '#e9edf7'; g.lineWidth = .05; g.beginPath(); g.moveTo(-.2, 0); g.lineTo(.24, 0);
      [-.06, .06, .17].forEach(function (x) { g.moveTo(x, -.13); g.lineTo(x, .13); }); g.stroke();
      g.fillStyle = '#e9edf7'; g.beginPath(); g.moveTo(-.12, 0); g.lineTo(-.36, -.17); g.lineTo(-.36, .17); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(.24, 0); g.lineTo(.38, -.14); g.lineTo(.38, .14); g.closePath(); g.fill();
      g.fillStyle = '#0b1020'; circle(-.27, -.02, .035); g.fill();
    } else { // pizza slice
      g.fillStyle = '#ffc83d'; g.beginPath(); g.moveTo(0, .34); g.lineTo(-.3, -.22); g.lineTo(.3, -.22); g.closePath(); g.fill();
      g.strokeStyle = '#c9812c'; g.lineWidth = .1; g.beginPath(); g.moveTo(-.3, -.24); g.lineTo(.3, -.24); g.stroke();
      g.fillStyle = '#e5484d'; circle(-.08, -.08, .06); g.fill(); circle(.11, -.04, .055); g.fill(); circle(0, .13, .05); g.fill();
    }
  }
  function drawCat(angry) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = '#ff9f43'; g.beginPath(); g.moveTo(-.3, -.08); g.lineTo(-.27, -.36); g.lineTo(-.06, -.24); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(.3, -.08); g.lineTo(.27, -.36); g.lineTo(.06, -.24); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(0, .03, .33, .29, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#fff3e0'; g.beginPath(); g.ellipse(0, .14, .15, .11, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#12203f';
    if (angry) { g.beginPath(); g.ellipse(-.13, .0, .055, .03, .35, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(.13, .0, .055, .03, -.35, 0, 6.2832); g.fill(); }
    else { g.beginPath(); g.ellipse(-.13, -.01, .045, .06, 0, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(.13, -.01, .045, .06, 0, 0, 6.2832); g.fill(); }
    g.strokeStyle = '#12203f'; g.lineWidth = .04; g.beginPath();
    g.moveTo(-.22, -.11); g.lineTo(-.06, -.06); g.moveTo(.22, -.11); g.lineTo(.06, -.06); g.stroke();
    g.fillStyle = '#ff5c8a'; g.beginPath(); g.moveTo(-.035, .1); g.lineTo(.035, .1); g.lineTo(0, .14); g.closePath(); g.fill();
    g.lineWidth = .022; g.beginPath(); g.moveTo(0, .14); g.lineTo(0, .18); g.moveTo(-.06, .21); g.quadraticCurveTo(0, .16, .06, .21); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = .018; g.beginPath();
    g.moveTo(-.2, .13); g.lineTo(-.42, .09); g.moveTo(-.2, .17); g.lineTo(-.41, .2); g.moveTo(.2, .13); g.lineTo(.42, .09); g.moveTo(.2, .17); g.lineTo(.41, .2); g.stroke();
    // space helmet
    g.strokeStyle = 'rgba(160,230,255,.55)'; g.lineWidth = .035; circle(0, -.01, .43); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .03; g.beginPath(); g.arc(0, -.01, .37, 3.6, 4.3); g.stroke();
  }
  function drawZoomba(t, dir) {
    g.fillStyle = '#1b2748'; circle(0, 0, .39); g.fill();
    g.strokeStyle = '#36e3ff'; g.lineWidth = .045; circle(0, 0, .39); g.stroke();
    g.fillStyle = '#2b3a67'; circle(0, 0, .25); g.fill();
    var blink = 0.6 + 0.4 * Math.sin(t / 220);
    g.fillStyle = 'rgba(255,92,138,' + blink + ')'; circle(0, 0, .09); g.fill();
    if (dir) { // little arrow: where it will go (against gravity)
      var d = Sim.DIRS[dir]; g.save(); g.rotate(Math.atan2(-d[1], -d[0]));
      g.fillStyle = '#36e3ff'; g.beginPath(); g.moveTo(.33, 0); g.lineTo(.2, -.09); g.lineTo(.2, .09); g.closePath(); g.fill(); g.restore();
    }
  }
  function drawChute(t) {
    var grd = g.createRadialGradient(0, 0, .05, 0, 0, .42);
    grd.addColorStop(0, '#000'); grd.addColorStop(.7, '#070b1a'); grd.addColorStop(1, '#1a2548');
    g.fillStyle = grd; circle(0, 0, .42); g.fill();
    g.lineWidth = .075; g.strokeStyle = '#ffc83d'; circle(0, 0, .4); g.stroke();
    g.strokeStyle = '#141a2e'; g.setLineDash([.105, .105]); g.lineDashOffset = -t / 900; circle(0, 0, .4); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(54,227,255,.35)'; g.lineWidth = .03;
    for (var k = 0; k < 3; k++) { g.beginPath(); var a = t / 500 + k * 2.094; g.arc(0, 0, .12 + k * .07, a, a + 1.6); g.stroke(); }
  }
  function drawGoo(t, seed) {
    g.fillStyle = 'rgba(124,255,107,.85)'; g.beginPath();
    for (var k = 0; k <= 16; k++) {
      var a = k / 16 * 6.2832, r = .33 + .05 * Math.sin(a * 3 + seed) + .025 * Math.sin(a * 5 + t / 600 + seed);
      k ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(230,255,225,.8)'; circle(-.11, -.1, .06); g.fill(); circle(.1, .08, .035); g.fill();
  }

  function layout() {
    var L = S.level, top = 118 + ($('tip').textContent ? 58 : 0), bottom = 92;
    var cs = Math.floor(Math.min((W - 20) / L.w, (H - top - bottom) / L.h, 92));
    return { cs: cs, ox: Math.round((W - cs * L.w) / 2), oy: Math.round(top + (H - top - bottom - cs * L.h) / 2) };
  }

  function drawBoard(now) {
    var L = S.level, lay = layout(), cs = lay.cs, x, y;
    var sx = 0, sy = 0;
    if (S.shake > 0.2) { sx = (Math.random() - .5) * S.shake; sy = (Math.random() - .5) * S.shake; S.shake *= 0.85; }
    g.save(); g.translate(lay.ox + sx, lay.oy + sy);

    g.fillStyle = 'rgba(13,20,42,.92)'; rr(cs * .35, cs * .35, cs * (L.w - .7), cs * (L.h - .7), cs * .3); g.fill();
    for (y = 0; y < L.h; y++) for (x = 0; x < L.w; x++) {
      var c = L.grid[y][x];
      if (c === '#') continue;
      g.fillStyle = (x + y) % 2 ? '#16224a' : '#131d40'; rr(x * cs + 1.5, y * cs + 1.5, cs - 3, cs - 3, cs * .14); g.fill();
    }
    // faint gravity chevrons on the floor
    if (S.dir) {
      var d = Sim.DIRS[S.dir], ph = (now / 700) % 1;
      g.strokeStyle = 'rgba(54,227,255,.10)'; g.lineWidth = cs * .06; g.lineCap = 'round'; g.lineJoin = 'round';
      for (y = 1; y < L.h - 1; y++) for (x = 1; x < L.w - 1; x++) {
        if (L.grid[y][x] !== '.' ) continue;
        g.save(); g.translate((x + .5 + d[0] * (ph - .5) * .3) * cs, (y + .5 + d[1] * (ph - .5) * .3) * cs); g.rotate(Math.atan2(d[1], d[0]));
        g.beginPath(); g.moveTo(-cs * .08, -cs * .14); g.lineTo(cs * .08, 0); g.lineTo(-cs * .08, cs * .14); g.stroke(); g.restore();
      }
    }
    for (y = 0; y < L.h; y++) for (x = 0; x < L.w; x++) {
      var ch = L.grid[y][x];
      if (ch === '#') {
        g.fillStyle = '#2b3a67'; rr(x * cs + 1, y * cs + 1, cs - 2, cs - 2, cs * .16); g.fill();
        g.fillStyle = '#3a4d86'; rr(x * cs + 1, y * cs + 1, cs - 2, cs * .42, cs * .16); g.fill();
        g.fillStyle = '#2f4074'; rr(x * cs + cs * .14, y * cs + cs * .14, cs * .72, cs * .72, cs * .1); g.fill();
        g.fillStyle = '#50639e'; circle(x * cs + cs * .24, y * cs + cs * .24, cs * .035); g.fill(); circle(x * cs + cs * .76, y * cs + cs * .76, cs * .035); g.fill();
      } else if (ch === 'O' || ch === 'g') {
        g.save(); g.translate((x + .5) * cs, (y + .5) * cs); g.scale(cs, cs);
        ch === 'O' ? drawChute(now) : drawGoo(now, x * 7 + y * 3); g.restore();
      }
    }

    // objects
    var A = S.anim, f = A ? A.f : 0, i, o;
    for (i = 0; i < S.objs.length; i++) {
      o = S.objs[i];
      var px = o.x, py = o.y, scale = 1, rot = 0, tr = A && A.res.tracks[o.id];
      if (tr) {
        var k0 = Math.min(Math.floor(f), tr.length - 1), k1 = Math.min(k0 + 1, tr.length - 1), u = Math.min(f - k0, 1);
        px = tr[k0][0] + (tr[k1][0] - tr[k0][0]) * u; py = tr[k0][1] + (tr[k1][1] - tr[k0][1]) * u;
        var b = A.bin[o.id];
        if (b && f >= b.tick) { var q = Math.min((f - b.tick) / 1.3, 1); scale = 1 - q; rot = q * 5; px = tr[b.tick][0]; py = tr[b.tick][1]; }
      } else if (o.gone) continue;
      if (scale <= 0.01) continue;
      g.save(); g.translate((px + .5) * cs, (py + .5) * cs); g.scale(cs * scale, cs * scale); g.rotate(rot);
      var lt = S.land[o.id];
      if (lt && now - lt < 200 && S.dir) {
        var e = (1 - (now - lt) / 200) * .2, dd = Sim.DIRS[S.dir];
        g.translate(dd[0] * e * .5, dd[1] * e * .5); g.scale(dd[0] ? 1 - e : 1 + e, dd[1] ? 1 - e : 1 + e);
      }
      if (o.t === 't') { g.rotate(Math.sin(now / 900 + o.id * 2) * .08); drawTrash((o.id + S.idx) % 5); }
      else if (o.t === 'c') drawCat(S.moves > 0);
      else drawZoomba(now + o.id * 400, S.dir);
      g.restore();
    }

    // particles
    for (i = S.parts.length - 1; i >= 0; i--) {
      var p = S.parts[i]; p.life -= 0.03; if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy; g.globalAlpha = p.life; g.fillStyle = p.c; circle((p.x + .5) * cs, (p.y + .5) * cs, cs * .05 * p.life + 1); g.fill();
    }
    g.globalAlpha = 1;

    // cat speech bubble
    if (S.bubble && now - S.bubble.t0 < 1500) {
      var bx = (S.bubble.x + .5) * cs, by = S.bubble.y * cs - 6, al = Math.min(1, (1500 - (now - S.bubble.t0)) / 300);
      g.globalAlpha = al; g.font = '800 ' + Math.max(13, cs * .24) + 'px "Trebuchet MS", sans-serif';
      var tw = g.measureText(S.bubble.text).width + 18, bh = Math.max(24, cs * .42);
      bx = Math.max(tw / 2 + 2, Math.min(cs * L.w - tw / 2 - 2, bx)); by = Math.max(bh + 2, by);
      g.fillStyle = '#fff'; rr(bx - tw / 2, by - bh, tw, bh, bh / 2); g.fill();
      g.fillStyle = '#12203f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.bubble.text, bx, by - bh / 2 + 1);
      g.globalAlpha = 1;
    }

    // hint arrow
    if (S.hint) {
      var ht = (now - S.hint.t0) / 1000;
      if (ht > 2.4) S.hint = null;
      else {
        var hd = Sim.DIRS[S.hint.dir], pulse = (ht * 1.6) % 1, sz = Math.min(cs * 1.5, 120);
        g.save(); g.translate(cs * L.w / 2 + hd[0] * pulse * sz * .6, cs * L.h / 2 + hd[1] * pulse * sz * .6); g.rotate(Math.atan2(hd[1], hd[0]));
        g.globalAlpha = .9 * (1 - pulse * .7); g.fillStyle = '#ffc83d'; g.shadowColor = '#ffc83d'; g.shadowBlur = 24;
        g.beginPath(); g.moveTo(sz * .5, 0); g.lineTo(0, -sz * .42); g.lineTo(0, -sz * .16); g.lineTo(-sz * .5, -sz * .16);
        g.lineTo(-sz * .5, sz * .16); g.lineTo(0, sz * .16); g.lineTo(0, sz * .42); g.closePath(); g.fill(); g.restore();
      }
    }
    g.restore();
  }

  function stepAnim(now) {
    var A = S.anim; if (!A) return;
    A.f = tickAt(Math.max(0, now - A.t0) / 1000);
    var id, landed = false;
    for (id in A.last) {
      if (A.fired[id]) continue;
      var b = A.bin[id], at = b ? b.tick : A.last[id];
      if (A.f < at) continue;
      A.fired[id] = true;
      var tr = A.res.tracks[id], pos = tr[Math.min(at, tr.length - 1)];
      if (b) {
        if (b.t === 'c') { sfx.meow(); buzz([60, 40, 120]); } else { sfx.ding(); buzz(15); }
        for (var k = 0; k < 10; k++) S.parts.push({ x: pos[0], y: pos[1], vx: (Math.random() - .5) * .09, vy: (Math.random() - .5) * .09, life: 1, c: b.t === 'c' ? '#ff5c8a' : '#ffc83d' });
      } else if (at > 0) {
        landed = true; S.land[id] = now;
        var o = S.objs[id];
        if (o.t === 'c' && Math.random() < .6) S.bubble = { x: pos[0], y: pos[1], text: MEOW[Math.floor(Math.random() * MEOW.length)], t0: now };
      }
    }
    if (landed) { sfx.thunk(); S.shake = Math.max(S.shake, 5); }
    if (A.f >= A.end) finishAnim();
  }

  function frame(now) {
    if (S.anim) stepAnim(now);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1230'); bg.addColorStop(1, '#070b1a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    var d = S.screen === 'title' || !S.dir ? [0.15, 0.3] : Sim.DIRS[S.dir];
    drift.x += d[0] * 0.0006; drift.y += d[1] * 0.0006;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], x = (((s.x + drift.x * s.r) % 1) + 1) % 1, y = (((s.y + drift.y * s.r) % 1) + 1) % 1;
      g.globalAlpha = .35 + .35 * Math.sin(now / 700 + s.p); g.fillStyle = i % 7 ? '#cfe0ff' : '#36e3ff';
      circle(x * W, y * H, s.r); g.fill();
    }
    g.globalAlpha = 1;
    if (S.screen === 'title') {
      var t = now / 1000, cx = W / 2, cy = H * .14, u = Math.min(W, H) * .16;
      g.save(); g.translate(cx - u * 1.3 + Math.sin(t) * 6, cy + Math.cos(t * .8) * 8); g.scale(u, u); g.rotate(t * .5); drawTrash(2); g.restore();
      g.save(); g.translate(cx + Math.sin(t * .7) * 5, cy - Math.sin(t) * 6); g.scale(u * 1.2, u * 1.2); g.rotate(Math.sin(t * .6) * .25); drawCat(true); g.restore();
      g.save(); g.translate(cx + u * 1.3 + Math.cos(t) * 6, cy + Math.sin(t * .9) * 8); g.scale(u, u); g.rotate(-t * .4); drawTrash(1); g.restore();
    } else if (S.level && (S.screen === 'play' || S.screen === 'over')) drawBoard(now);
    requestAnimationFrame(frame);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }

  // ---------- input ----------
  var touch = null;
  window.addEventListener('pointerdown', function (e) {
    audio();
    if (S.screen === 'play' && !e.target.closest('#bar')) touch = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  window.addEventListener('pointermove', function (e) {
    if (!touch || e.pointerId !== touch.id) return;
    var dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    touch = null;
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
  });
  window.addEventListener('pointerup', function () { touch = null; });
  window.addEventListener('pointercancel', function () { touch = null; });
  window.addEventListener('keydown', function (e) {
    var m = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' }[e.key];
    if (m) doMove(m); else if (e.key === 'z') undo(); else if (e.key === 'r' && S.level) startLevel(S.idx);
  });
  function tap(id, fn) { $(id).addEventListener('click', function () { sfx.tap(); fn(); }); }
  tap('btnPlay', function () { startLevel(unlocked()); });
  tap('btnDecks', openLevels);
  tap('btnBack', function () { show('title'); });
  tap('bUndo', undo);
  tap('bRetry', function () { startLevel(S.idx); });
  tap('bHint', hint);
  tap('bDecks', openLevels);
  tap('bSound', function () { save.sound = !save.sound; persist(); soundBtn(); if (save.sound) sfx.ding(); });
  tap('oMain', function () {
    if (!S.won) { show('play'); undo(); }
    else if (S.idx === LEVELS.length - 1) openLevels();
    else startLevel(S.idx + 1);
  });
  tap('oA', function () { startLevel(S.idx); });
  tap('oB', openLevels);
  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.className === 'locked') return;
    sfx.tap(); startLevel(+b.getAttribute('data-i'));
  });
  function soundBtn() { $('bSound').className = 'caps' + (save.sound ? '' : ' off'); }

  // Android back button: returns true when the game handled it.
  window.gjBack = function () {
    if (S.screen === 'over') { openLevels(); return true; }
    if (S.screen === 'play') { openLevels(); return true; }
    if (S.screen === 'levels') { show('title'); return true; }
    return false;
  };
  window.gjPause = function (paused) { if (ac) { paused ? ac.suspend() : (save.sound && ac.resume()); } };
  document.addEventListener('visibilitychange', function () { window.gjPause(document.hidden); });
  window.addEventListener('resize', resize);

  window.GJ = { S: S, startLevel: startLevel, doMove: doMove, save: save }; // handy for tests
  resize(); soundBtn(); requestAnimationFrame(frame);
})();
