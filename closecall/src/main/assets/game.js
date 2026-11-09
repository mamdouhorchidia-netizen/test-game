// Close Call - rendering, input, menus. Rules live in sim.js.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('c'), g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, COLS = Sim.COLS;

  var NAMES = ['Robot Walks Into A Laser', 'The Mildly Perilous Hallway', 'Something Explodes (Finally)', 'Explosions II: More Explosions',
    'Craft Services', 'The Snack Break Shootout', 'Mind Your Head', 'Hydraulic Press Conference', 'Flat Robot Society',
    'A Slippery Slope', 'Peel Out', 'Potassium Run', 'Meet The Fans', 'Autograph Under Fire', 'Fan Service',
    'Soft Landing', 'Pillow Talk', 'Method Acting', 'Bounce Back', 'What Goes Up', 'Rewind, Reshoot', 'The Third Act',
    'Director\'s Cut', 'The Sequel Nobody Survived'];
  var TIPS = {
    0: 'Tap a tile to place the laser, then press ACTION. REX must finish with exactly 1 HP.',
    1: 'Too few lasers: boring. Too many: no star. Tap a placed prop to take it back.',
    2: 'Barrels hit for 2 HP and blast REX two tiles forward. He skips the tile in between.',
    4: 'Donuts give +1 HP. The star insists on them. You cannot move studio fixtures.',
    6: 'Crushers slam on every N-th beat. REX takes one step per beat: tile 6 is beat 6.',
    9: 'Banana peel: REX slides three tiles forward and skips the two in between.',
    12: 'A superfan stops REX for one beat. Everything after happens one beat later.',
    15: 'The pillow pads the next hit completely. The audience still counts the thrill.',
    18: 'Trampoline: REX bounces two tiles BACK and walks that stretch again.'
  };
  var PROP = { L: 'Laser', B: 'Barrel', N: 'Banana', F: 'Fan', T: 'Bounce' };
  var ORDER = ['L', 'B', 'N', 'F', 'T'];
  var REVIEW = {
    close: [['I gasped. Twice.', 'The Daily Orbit'], ['Edge of my seat. I have no seat. I floated.', 'Zero-G Gazette'],
      ['He should NOT have survived that. Five stars.', 'Mars Weekly'], ['Finally, a robot with something to lose.', 'Cinema Unit 7'],
      ['I spilled my nutrient paste.', 'A Guy In Row 3']],
    safe: [['I have seen scarier screensavers.', 'The Daily Orbit'], ['He was not even singed. Two thumbs down.', 'Mars Weekly'],
      ['A robot goes for a walk. That is the whole film.', 'Cinema Unit 7'], ['My toaster takes bigger risks.', 'A Guy In Row 3']],
    dead: [['The lead actor is now several lead actors.', 'The Daily Orbit'], ['A bold choice to end the film in scene one.', 'Mars Weekly'],
      ['He is fine. They have spare parts.', 'Studio Legal'], ['Technically an ensemble piece now.', 'Cinema Unit 7']]
  };
  var SAY = {
    start: ['My motivation?', 'Is this my good side?', 'I do my own stunts. Sadly.', 'Who wrote this?', 'Rolling? I was born rolling.'],
    laser: ['Ow.', 'Spicy.', 'My agent will hear of this.', 'That tickles. Legally.'],
    barrel: ['WHEEE-', 'Not the face!', 'I JUST got waxed!'], crush: ['Oof.', 'I am shorter now.'], miss: ['I meant to do that.', 'Too slow!'],
    donut: ['Craft services!', 'Sprinkles!'], fan: ['Who do I make it out to?', 'No photos. OK, one.'], pillow: ['Method acting.', 'So soft.'],
    banana: ['Classic.', 'WHOAAA-'], tramp: ['Boing?', 'Again!'], close: ['Nailed it.', 'And... scene.'], safe: ['Too easy.', 'That was it?'], dead: ['I\'M FINE.']
  };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---------- save ----------
  var save = { stars: [], sound: true };
  try { var raw = localStorage.getItem('cc-save'); if (raw) save = JSON.parse(raw); } catch (e) {}
  if (!save.stars) save.stars = [];
  function persist() { try { localStorage.setItem('cc-save', JSON.stringify(save)); } catch (e) {} }
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
    tap: function () { tone('sine', 660, 660, 0.04, 0.06); },
    place: function () { tone('triangle', 420, 620, 0.07, 0.1); },
    lift: function () { tone('triangle', 620, 380, 0.07, 0.08); },
    step: function () { tone('square', 180, 140, 0.04, 0.03); },
    clap: function () { tone('square', 900, 200, 0.05, 0.12); tone('square', 700, 150, 0.06, 0.1, 0.07); },
    laser: function () { tone('sawtooth', 1400, 300, 0.18, 0.08); },
    barrel: function () { tone('sawtooth', 220, 40, 0.45, 0.22); tone('square', 90, 30, 0.5, 0.18); },
    crush: function () { tone('square', 120, 35, 0.3, 0.25); },
    miss: function () { tone('square', 100, 60, 0.12, 0.1); tone('triangle', 900, 1300, 0.12, 0.07, 0.05); },
    donut: function () { tone('triangle', 660, 990, 0.12, 0.12); },
    pillow: function () { tone('sine', 300, 200, 0.2, 0.12); },
    banana: function () { tone('sine', 300, 900, 0.3, 0.1); },
    tramp: function () { tone('sine', 200, 700, 0.15, 0.12); tone('sine', 700, 300, 0.2, 0.08, 0.15); },
    fan: function () { tone('triangle', 880, 1100, 0.08, 0.08); tone('triangle', 1100, 1320, 0.1, 0.08, 0.1); },
    dead: function () { tone('sawtooth', 400, 50, 0.7, 0.2); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone('triangle', f, f, 0.2, 0.13, i * 0.09); }); },
    boo: function () { tone('sawtooth', 220, 150, 0.5, 0.1); tone('sawtooth', 160, 110, 0.6, 0.1, 0.25); }
  };
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // ---------- state ----------
  var S = { screen: 'title', idx: 0, level: null, placed: {}, sel: null, take: 1, mode: 'edit',
    ev: null, ei: 0, et: 0, fast: false, hp: 0, th: 0, shield: false, gone: {}, beat: 0, beatAt: -1e9,
    hero: { tile: 0, x: 0, y: 0, rot: 0, hurt: -1e9, dead: false }, bubble: null, floats: [], parts: [], shake: 0, flash: {}, last: null, glow: null };

  function show(name) {
    S.screen = name;
    ['title', 'play', 'levels', 'over'].forEach(function (id) {
      $(id).className = 'screen' + (id === name || (name === 'over' && id === 'play') ? ' on' : '');
    });
  }

  function invLeft(type) {
    var n = S.level.inv[type] || 0;
    for (var k in S.placed) if (S.placed[k] === type) n--;
    return n;
  }

  function startLevel(i) {
    S.idx = i; S.level = LEVELS[i]; S.placed = {}; S.take = 1; S.sel = null;
    $('scene').textContent = 'Scene ' + (i + 1);
    $('name').textContent = NAMES[i] || '';
    $('tip').textContent = TIPS[i] || '';
    buildTray(); toEdit(); show('play');
  }

  function toEdit() {
    S.mode = 'edit'; S.ev = null; S.gone = {}; S.hp = S.level.hp; S.th = 0; S.shield = false; S.beat = 0; S.beatAt = -1e9;
    S.hero = { tile: 0, x: 0, y: 0, rot: 0, hurt: -1e9, dead: false }; S.bubble = null; S.floats = []; S.fast = false;
    document.body.className = '';
    $('go').textContent = 'Action!';
    meters(); tray();
  }

  function meters() {
    var L = S.level, html = '<b class="caps">HP</b>', n = Math.max(L.hp, S.hp);
    for (var i = 0; i < n; i++) html += '<i class="' + (i >= S.hp ? 'off' : S.hp === 1 ? 'last' : '') + '"></i>';
    $('hp').innerHTML = html;
    $('thv').textContent = S.th + ' / ' + L.best;
    $('fill').style.width = Math.min(100, S.th / L.best * 100) + '%';
    $('mark').style.left = (L.t2 >= L.best ? 200 : L.t2 / L.best * 100) + '%';
    $('take').textContent = (S.mode === 'play' ? '● Rec · ' : '') + 'Take ' + S.take;
  }

  function buildTray() {
    var html = '';
    ORDER.forEach(function (t) {
      if (S.level.inv[t]) html += '<button data-t="' + t + '"><canvas width="80" height="80"></canvas><span class="caps">' + PROP[t] + '</span><em></em></button>';
    });
    $('props').innerHTML = html;
    Array.prototype.forEach.call($('props').querySelectorAll('button'), function (b) {
      var c = b.querySelector('canvas').getContext('2d'), keep = g;
      g = c; g.translate(40, 40); g.scale(76, 76); drawThing(b.getAttribute('data-t'), 0, false, 0); g = keep;
    });
  }
  function tray() {
    if (!S.sel || invLeft(S.sel) <= 0) { S.sel = null; ORDER.forEach(function (t) { if (!S.sel && S.level.inv[t] && invLeft(t) > 0) S.sel = t; }); }
    Array.prototype.forEach.call($('props').querySelectorAll('button'), function (b) {
      var t = b.getAttribute('data-t'), n = invLeft(t);
      b.className = (t === S.sel ? 'sel' : '') + (n <= 0 ? ' out' : '');
      b.querySelector('em').textContent = n;
    });
  }

  // ---------- layout ----------
  function layout() {
    var L = S.level, top = 128 + ($('tip').textContent ? 62 : 0), bottom = 150;
    var cs = Math.floor(Math.min((W - 20) / COLS, (H - top - bottom) / (L.rows * 1.3), 78));
    var rh = cs * 1.3;
    return { cs: cs, rh: rh, ox: Math.round((W - cs * COLS) / 2), oy: Math.round(top + (H - top - bottom - rh * L.rows) / 2) };
  }
  function tileXY(i, lay) { // centre of the tile's cell
    var r = Math.floor(i / COLS), c = i % COLS, col = r % 2 ? COLS - 1 - c : c;
    return { x: lay.ox + (col + .5) * lay.cs, y: lay.oy + r * lay.rh + lay.cs * .62, r: r };
  }
  function tileAt(px, py) {
    var lay = layout(), n = S.level.rows * COLS;
    for (var i = 0; i < n; i++) {
      var p = tileXY(i, lay);
      if (Math.abs(px - p.x) <= lay.cs / 2 && py >= p.y - lay.cs * .62 && py <= p.y + lay.rh - lay.cs * .62) return i;
    }
    return -1;
  }

  // ---------- edit actions ----------
  function tapTile(i) {
    var n = S.level.rows * COLS;
    if (i <= 0 || i >= n - 1) return;
    if (S.placed[i]) { S.sel = S.placed[i]; delete S.placed[i]; sfx.lift(); tray(); return; }
    if (S.level.fix[i]) { S.flash[i] = performance.now(); sfx.tap(); return; }
    if (!S.sel || invLeft(S.sel) <= 0) { sfx.tap(); return; }
    S.placed[i] = S.sel; S.flash[i] = performance.now(); sfx.place(); buzz(10); tray();
  }
  function hint() {
    var sol = S.level.sol, k;
    for (k in S.placed) if (sol[k] !== S.placed[k]) { delete S.placed[k]; S.flash[k] = performance.now(); sfx.lift(); tray(); return; }
    for (k in sol) if (S.placed[k] !== sol[k]) { S.placed[k] = sol[k]; S.glow = { tile: +k, t0: performance.now() }; sfx.place(); tray(); return; }
    $('tip').textContent = 'That is the best set-up I know. Press ACTION!';
  }

  // ---------- playback ----------
  var DUR = { walk: 300, laser: 260, barrel: 560, banana: 520, tramp: 560, crush: 460, miss: 360, fan: 760, donut: 260, pillow: 280, end: 500 };
  function action() {
    if (S.mode === 'play') { S.take++; toEdit(); sfx.tap(); return; }
    var r = Sim.run(S.level, S.placed, true);
    S.mode = 'play'; S.ev = r.events; S.ei = -1; S.et = 0; S.last = r;
    document.body.className = 'rolling'; $('go').textContent = 'Cut!';
    S.hp = S.level.hp; S.th = 0; S.gone = {}; S.shield = false; S.beat = 0;
    S.hero = { tile: 0, x: 0, y: 0, rot: 0, hurt: -1e9, dead: false };
    say(pickOne(SAY.start)); sfx.clap(); meters(); nextEvent(performance.now());
  }
  function say(text) { S.bubble = { text: text, t0: performance.now() }; }
  function floatText(tile, text, color) { S.floats.push({ tile: tile, text: text, color: color, t0: performance.now() }); }
  function burst(tile, color, n) {
    for (var i = 0; i < n; i++) S.parts.push({ tile: tile, x: 0, y: 0, vx: (Math.random() - .5) * .16, vy: -Math.random() * .16, life: 1, c: color });
  }

  function nextEvent(now) {
    S.ei++; S.et = now;
    var e = S.ev[S.ei]; if (!e) return;
    var prevTh = S.th;
    if (e.k === 'walk') { sfx.step(); return; }
    if (e.th !== undefined) S.th = e.th;
    if (e.hp !== undefined && e.k !== 'end') {
      if (e.hp < S.hp) { S.hero.hurt = now; S.shake = e.k === 'laser' ? 5 : 12; buzz(e.k === 'laser' ? 20 : 60); }
      S.hp = e.hp;
    }
    if (e.shield !== undefined) S.shield = e.shield;
    if (S.th > prevTh) floatText(e.p, '+' + (S.th - prevTh) + ' thrill', '#ffd23f');
    if (e.blocked) floatText(e.p, 'Padded!', '#fff4e0');
    if (e.k === 'laser') { sfx.laser(); burst(e.p, '#ff4d4d', 6); }
    else if (e.k === 'barrel') { S.gone[e.p] = true; sfx.barrel(); burst(e.p, '#ffd23f', 18); burst(e.p, '#ff4d4d', 10); }
    else if (e.k === 'banana') { S.gone[e.p] = true; sfx.banana(); }
    else if (e.k === 'tramp') { S.gone[e.p] = true; sfx.tramp(); }
    else if (e.k === 'crush') { sfx.crush(); burst(e.p, '#a79bb8', 10); }
    else if (e.k === 'miss') { sfx.miss(); floatText(e.p, 'Near miss!', '#2ee6c8'); }
    else if (e.k === 'fan') { S.gone[e.p] = true; sfx.fan(); S.beat = e.t; S.beatAt = now; }
    else if (e.k === 'donut') { S.gone[e.p] = true; sfx.donut(); floatText(e.p, '+1 HP', '#2ee6c8'); }
    else if (e.k === 'pillow') { S.gone[e.p] = true; sfx.pillow(); }
    else if (e.k === 'end') {
      if (e.result === 'dead') { S.hero.dead = true; sfx.dead(); burst(e.p, '#2ee6c8', 16); burst(e.p, '#fff4e0', 10); S.shake = 14; }
      say(pickOne(SAY[e.result]));
    }
    if (SAY[e.k] && e.k !== 'end' && Math.random() < .55) say(pickOne(SAY[e.k]));
    meters();
  }

  function stepPlay(now) {
    var e = S.ev[S.ei]; if (!e) return;
    var d = DUR[e.k] / (S.fast ? 3 : 1), u = Math.min(1, (now - S.et) / d), lay = layout();
    var a, b, H0 = S.hero;
    if (e.k === 'walk') {
      a = tileXY(e.a, lay); b = tileXY(e.b, lay);
      if (a.r === b.r) { H0.x = a.x + (b.x - a.x) * u; H0.y = a.y; } else { H0.x = a.x; H0.y = a.y + (b.y - a.y) * u * u; }
      H0.rot = 0; H0.tile = u < .5 ? e.a : e.b;
    } else if (e.k === 'barrel' || e.k === 'banana' || e.k === 'tramp') {
      a = tileXY(e.p, lay); b = tileXY(e.to, lay);
      H0.x = a.x + (b.x - a.x) * u; H0.y = a.y + (b.y - a.y) * u;
      if (e.k === 'banana') H0.rot = -1.2 * Math.sin(u * 3.14);
      else { H0.y -= Math.sin(u * 3.14) * lay.cs * .75; H0.rot = u * 6.2832 * (e.k === 'tramp' ? -1 : 1); }
      H0.tile = u < .5 ? e.p : e.to;
    } else { a = tileXY(e.p, lay); H0.x = a.x; H0.y = a.y; H0.rot = 0; H0.tile = e.p; }
    if (u >= 1) {
      if (e.k === 'walk') { S.beat = e.t; S.beatAt = now; }
      if (e.k === 'end') { S.ev = null; finish(e.result); return; }
      nextEvent(now);
    }
  }

  function finish(result) {
    var L = S.level, won = result === 'close', n = 0, last = S.idx === LEVELS.length - 1, r = pickOne(REVIEW[result]);
    $('card').className = won ? 'win' : 'fail';
    if (won) {
      n = S.th >= L.best ? 3 : S.th >= L.t2 ? 2 : 1;
      if ((save.stars[S.idx] || 0) < n) { save.stars[S.idx] = n; persist(); }
      $('verdict').textContent = 'Close call!';
      $('stat').textContent = 'Take ' + S.take + ' · thrill ' + S.th + ' of ' + L.best + (n < 3 ? ' · a wilder set-up earns 3 stars' : '');
      $('oMain').textContent = last ? 'That\'s a wrap' : 'Next scene'; $('oA').textContent = n < 3 ? 'Reshoot' : 'Replay';
      sfx.win(); buzz(40);
    } else {
      $('verdict').textContent = result === 'dead' ? 'Cut! Cut!' : 'Too safe';
      $('stat').textContent = result === 'dead' ? 'REX ran out of HP. He needs to finish with exactly 1.'
        : 'REX finished with ' + S.last.hp + ' HP. The audience wants exactly 1.';
      $('oMain').textContent = 'Fix the set'; $('oA').textContent = 'Clear set';
      sfx.boo();
    }
    var html = '';
    for (var k = 0; k < 3; k++) html += k < n ? '<b>★</b>' : '★';
    $('stars').innerHTML = html; $('stars').style.display = won ? '' : 'none';
    $('quote').textContent = '“' + r[0] + '”'; $('by').textContent = '— ' + r[1];
    S.won = won;
    setTimeout(function () { if (S.screen === 'play' && S.mode === 'play' && !S.ev) show('over'); }, 650);
  }

  function buildGrid() {
    var open = unlocked(), sum = 0, html = '';
    for (var k = 0; k < LEVELS.length; k++) {
      var st = save.stars[k] || 0; sum += st;
      var cls = k > open ? 'locked' : k === open && !st ? 'next' : '';
      html += '<button data-i="' + k + '" class="' + cls + '">' + (k + 1) + '<small>' + (k > open ? '' : '★★★'.slice(0, st)) + '</small></button>';
    }
    $('grid').innerHTML = html;
    $('total').textContent = '★ ' + sum + ' / ' + LEVELS.length * 3;
  }
  function openLevels() { if (S.level) toEdit(); buildGrid(); show('levels'); }

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function circle(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 6.2832); }

  // Sprites draw in a unit cell centred on 0,0; the floor is at y = +0.38.
  function drawThing(x, now, slam, id) {
    var ch = x.charAt(0);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (ch === 'L') {
      g.fillStyle = '#6b6180'; rr(-.14, .26, .28, .12, .04); g.fill(); rr(-.14, -.42, .28, .12, .04); g.fill();
      var fl = .7 + .3 * Math.sin(now / 60 + id);
      g.strokeStyle = 'rgba(255,77,77,' + (.35 * fl) + ')'; g.lineWidth = .16; g.beginPath(); g.moveTo(0, -.3); g.lineTo(0, .26); g.stroke();
      g.strokeStyle = '#ff4d4d'; g.lineWidth = .06; g.beginPath(); g.moveTo(0, -.3); g.lineTo(0, .26); g.stroke();
      g.strokeStyle = '#ffe1e1'; g.lineWidth = .02; g.beginPath(); g.moveTo(0, -.3); g.lineTo(0, .26); g.stroke();
    } else if (ch === 'B') {
      g.fillStyle = '#d93636'; rr(-.22, -.2, .44, .58, .08); g.fill();
      g.fillStyle = '#8f1f1f'; g.fillRect(-.22, -.06, .44, .05); g.fillRect(-.22, .2, .44, .05);
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(0, -.02); g.lineTo(.11, .17); g.lineTo(-.11, .17); g.closePath(); g.fill();
      g.fillStyle = '#2a0b0b'; g.fillRect(-.012, .05, .024, .07); circle(0, .145, .014); g.fill();
      g.strokeStyle = '#fff4e0'; g.lineWidth = .03; g.beginPath(); g.moveTo(.08, -.2); g.quadraticCurveTo(.1, -.34, .2, -.33); g.stroke();
      g.fillStyle = '#ffd23f'; circle(.2 + Math.sin(now / 90) * .01, -.33, .04 + .015 * Math.sin(now / 70)); g.fill();
    } else if (ch === 'N') {
      g.translate(0, .2);
      g.strokeStyle = '#ffd23f'; g.lineWidth = .13; g.beginPath(); g.arc(0, -.3, .4, .6, 2.54); g.stroke();
      g.strokeStyle = '#f2b705'; g.lineWidth = .09; g.beginPath(); g.moveTo(0, .09); g.quadraticCurveTo(.02, -.1, .14, -.2); g.stroke();
      g.fillStyle = '#6b4a1e'; circle(.15, -.22, .045); g.fill(); circle(-.33, -.07, .035); g.fill(); circle(.33, -.07, .035); g.fill();
    } else if (ch === 'T') {
      g.strokeStyle = '#6b6180'; g.lineWidth = .05; g.beginPath(); g.moveTo(-.3, .14); g.lineTo(-.36, .38); g.moveTo(.3, .14); g.lineTo(.36, .38); g.stroke();
      g.strokeStyle = '#a79bb8'; g.lineWidth = .025; g.beginPath(); g.moveTo(-.1, .16);
      for (var s = 0; s < 5; s++) g.lineTo(s % 2 ? -.1 : .1, .2 + s * .04); g.stroke();
      g.strokeStyle = '#2ee6c8'; g.lineWidth = .08; g.beginPath(); g.moveTo(-.36, .12); g.quadraticCurveTo(0, .2, .36, .12); g.stroke();
      g.fillStyle = '#2ee6c8'; g.beginPath(); g.moveTo(-.12, -.08); g.lineTo(-.26, .02); g.lineTo(-.12, .08) ; g.closePath(); g.fill();
      g.fillRect(-.14, -.02, .2, .04);
    } else if (ch === 'F') {
      var hop = Math.abs(Math.sin(now / 180 + id)) * .05;
      g.translate(0, -hop);
      g.fillStyle = '#8be36b'; rr(-.13, .08, .26, .3, .08); g.fill();
      g.beginPath(); g.ellipse(0, -.1, .22, .19, 0, 0, 6.2832); g.fill();
      g.strokeStyle = '#8be36b'; g.lineWidth = .03; g.beginPath(); g.moveTo(-.1, -.26); g.lineTo(-.16, -.38); g.moveTo(.1, -.26); g.lineTo(.16, -.38); g.stroke();
      circle(-.16, -.39, .03); g.fill(); circle(.16, -.39, .03); g.fill();
      g.fillStyle = '#15111c'; g.beginPath(); g.ellipse(-.09, -.11, .055, .075, 0, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(.09, -.11, .055, .075, 0, 0, 6.2832); g.fill();
      g.fillStyle = '#fff'; circle(-.075, -.135, .02); g.fill(); circle(.105, -.135, .02); g.fill();
      g.fillStyle = '#fff4e0'; g.save(); g.translate(.2, .14); g.rotate(.2); g.fillRect(-.09, -.11, .18, .22);
      g.fillStyle = '#ff4d4d'; g.beginPath(); g.moveTo(0, .05); g.bezierCurveTo(-.1, -.03, -.03, -.09, 0, -.03); g.bezierCurveTo(.03, -.09, .1, -.03, 0, .05); g.fill(); g.restore();
    } else if (ch === 'D') {
      g.translate(0, Math.sin(now / 400 + id) * .03);
      g.fillStyle = '#c98b4a'; circle(0, .05, .26); g.fill();
      g.fillStyle = '#ff7ab8'; g.beginPath(); g.arc(0, .03, .25, 3.3, 6.12); g.quadraticCurveTo(.12, .14, 0, .08); g.quadraticCurveTo(-.14, .16, -.247, -.01); g.fill();
      g.fillStyle = '#15111c'; circle(0, .05, .08); g.fill();
      [['#ffd23f', -.13, -.08, .5], ['#2ee6c8', .1, -.1, -.6], ['#fff', .02, -.14, 1.2], ['#fff', -.17, .0, 0], ['#ffd23f', .17, -.02, .9]].forEach(function (p) {
        g.save(); g.translate(p[1], p[2]); g.rotate(p[3]); g.fillStyle = p[0]; g.fillRect(-.03, -.01, .06, .022); g.restore();
      });
    } else if (ch === 'P') {
      g.fillStyle = '#fff4e0'; g.beginPath(); g.moveTo(-.3, .08);
      g.quadraticCurveTo(-.36, -.12, -.26, -.14); g.quadraticCurveTo(0, -.2, .26, -.14); g.quadraticCurveTo(.36, -.12, .3, .08);
      g.quadraticCurveTo(.36, .36, .26, .34); g.quadraticCurveTo(0, .38, -.26, .34); g.quadraticCurveTo(-.36, .36, -.3, .08); g.fill();
      g.strokeStyle = '#8fd3ff'; g.lineWidth = .035; g.beginPath(); g.moveTo(-.12, -.13); g.lineTo(-.12, .33); g.moveTo(.12, -.13); g.lineTo(.12, .33); g.stroke();
    } else if (ch === 'C') {
      var ext = slam ? .5 : 0;
      g.fillStyle = '#6b6180'; g.fillRect(-.06, -.5, .12, .2 + ext);
      g.save(); g.translate(0, ext);
      g.fillStyle = '#4a4458'; rr(-.34, -.36, .68, .26, .05); g.fill();
      g.save(); g.beginPath(); g.rect(-.34, -.16, .68, .08); g.clip();
      g.fillStyle = '#ffd23f'; g.fillRect(-.34, -.16, .68, .08); g.fillStyle = '#15111c';
      for (var q = -4; q < 5; q++) { g.beginPath(); g.moveTo(q * .16, -.16); g.lineTo(q * .16 + .08, -.16); g.lineTo(q * .16, -.08); g.lineTo(q * .16 - .08, -.08); g.closePath(); g.fill(); }
      g.restore();
      g.save(); g.scale(.01, .01); g.fillStyle = '#ffd23f'; g.font = '900 20px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('×' + x.slice(1), 0, -25); g.restore();
      g.restore();
    }
  }

  function drawRex(now, walking, hurt, shield, dead) {
    if (dead) return;
    g.lineJoin = 'round'; g.lineCap = 'round';
    var ph = walking ? Math.sin(now / 55) : 0;
    g.strokeStyle = '#a79bb8'; g.lineWidth = .07;
    g.beginPath(); g.moveTo(-.08, .16); g.lineTo(-.08 + ph * .09, .36); g.moveTo(.08, .16); g.lineTo(.08 - ph * .09, .36); g.stroke();
    g.fillStyle = hurt ? '#ff4d4d' : '#2ee6c8'; rr(-.19, -.12, .38, .32, .08); g.fill();
    g.fillStyle = hurt ? '#ffb3b3' : '#c8fff5'; rr(-.17, -.42, .34, .28, .08); g.fill();
    g.fillStyle = '#15111c'; rr(-.15, -.35, .3, .1, .04); g.fill();              // sunglasses
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-.11, -.33, .06, .02); g.fillRect(.04, -.33, .06, .02);
    g.strokeStyle = '#15111c'; g.lineWidth = .025; g.beginPath(); g.moveTo(-.05, -.2); g.quadraticCurveTo(.01, -.17, .07, -.21); g.stroke();
    g.strokeStyle = '#a79bb8'; g.lineWidth = .03; g.beginPath(); g.moveTo(0, -.42); g.lineTo(0, -.5); g.stroke();
    g.fillStyle = '#ffd23f'; circle(0, -.52, .04); g.fill();
    g.fillStyle = '#ff4d4d'; g.beginPath(); g.moveTo(-.19, -.12); g.lineTo(.19, -.12); g.lineTo(.12, -.04); g.lineTo(-.26 - ph * .03, .06); g.closePath(); g.fill(); // scarf
    g.fillStyle = '#ffd23f'; g.beginPath();                                       // star on chest
    for (var i = 0; i < 10; i++) { var a = i * .6283 - 1.57, r = i % 2 ? .035 : .08; g.lineTo(.04 + Math.cos(a) * r, .08 + Math.sin(a) * r); }
    g.closePath(); g.fill();
    if (shield) { g.strokeStyle = 'rgba(255,244,224,.8)'; g.lineWidth = .04; g.setLineDash([.08, .06]); circle(0, -.04, .5); g.stroke(); g.setLineDash([]); }
  }

  function drawSet(now) {
    var L = S.level, lay = layout(), cs = lay.cs, n = L.rows * COLS, i, p;
    var sx = 0, sy = 0;
    if (S.shake > 0.3) { sx = (Math.random() - .5) * S.shake; sy = (Math.random() - .5) * S.shake; S.shake *= 0.86; }
    g.save(); g.translate(sx, sy);

    for (var r = 0; r < L.rows; r++) {
      var fy = lay.oy + r * lay.rh + cs;
      g.fillStyle = 'rgba(34,27,46,.75)'; g.fillRect(lay.ox, fy - cs, cs * COLS, cs);
      g.fillStyle = '#4a4458'; rr(lay.ox - 5, fy, cs * COLS + 10, 9, 4); g.fill();
      g.fillStyle = '#5d5670'; g.fillRect(lay.ox - 2, fy + 1, cs * COLS + 4, 2.5);
      g.strokeStyle = '#3d3350'; g.lineWidth = 3;
      for (var b = 0; b <= COLS; b += 2) { g.beginPath(); g.moveTo(lay.ox + b * cs, fy + 9); g.lineTo(lay.ox + b * cs, fy + lay.rh - cs); g.stroke(); }
      if (r < L.rows - 1) { // drop arrow to the next floor
        var ax = r % 2 ? lay.ox + cs * .5 : lay.ox + cs * (COLS - .5), ay = fy + (lay.rh - cs) * .5 + 5;
        g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(ax - 7, ay - 5); g.lineTo(ax + 7, ay - 5); g.lineTo(ax, ay + 5); g.closePath(); g.fill();
      }
    }
    g.font = '800 ' + Math.max(9, cs * .16) + 'px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (i = 0; i < n; i++) {
      p = tileXY(i, lay);
      var cx = p.x, top = p.y - cs * .62;
      g.strokeStyle = 'rgba(61,51,80,.7)'; g.lineWidth = 1; g.strokeRect(cx - cs / 2 + .5, top + .5, cs - 1, cs - 1);
      var fl = S.flash[i] ? 1 - (now - S.flash[i]) / 350 : 0;
      if (fl > 0) { g.fillStyle = 'rgba(46,230,200,' + fl * .35 + ')'; g.fillRect(cx - cs / 2, top, cs, cs); }
      if (S.glow && S.glow.tile === i && now - S.glow.t0 < 2200) {
        g.strokeStyle = 'rgba(255,210,63,' + (.5 + .5 * Math.sin(now / 90)) + ')'; g.lineWidth = 3; g.strokeRect(cx - cs / 2 + 2, top + 2, cs - 4, cs - 4);
      }
      g.fillStyle = i === 0 || i === n - 1 ? '#ffd23f' : S.beat === i && S.mode === 'play' ? '#fff4e0' : 'rgba(167,155,184,.5)';
      if (i > 0) g.fillText(i === n - 1 ? 'CUT' : i, cx, top + cs * .2);
      var x = S.placed[i] || L.fix[i];
      if (i === n - 1) { // clapperboard
        g.save(); g.translate(cx, p.y); g.scale(cs, cs);
        g.fillStyle = '#fff4e0'; rr(-.24, .0, .48, .32, .04); g.fill();
        g.save(); g.translate(-.24, .0); g.rotate(S.mode === 'play' ? 0 : -.35); g.fillStyle = '#15111c'; g.fillRect(0, -.1, .48, .1);
        g.fillStyle = '#ffd23f'; for (var k = 0; k < 3; k++) { g.beginPath(); g.moveTo(.04 + k * .16, -.1); g.lineTo(.12 + k * .16, -.1); g.lineTo(.08 + k * .16, 0); g.lineTo(k * .16, 0); g.closePath(); g.fill(); }
        g.restore(); g.fillStyle = '#15111c'; g.fillRect(-.18, .1, .36, .03); g.fillRect(-.18, .19, .24, .03); g.restore();
      }
      if (!x || S.gone[i]) continue;
      var mine = !!S.placed[i];
      if (mine && S.mode === 'edit') { g.fillStyle = 'rgba(46,230,200,.13)'; g.fillRect(cx - cs / 2 + 2, top + 2, cs - 4, cs - 4); }
      var slam = x.charAt(0) === 'C' && S.mode === 'play' && S.beat > 0 && S.beat % +x.slice(1) === 0 && now - S.beatAt < 260 / (S.fast ? 2 : 1);
      g.save(); g.translate(cx, p.y); g.scale(cs, cs); drawThing(x, now, slam, i); g.restore();
      if (!mine && S.mode === 'edit') { g.fillStyle = '#6b6180'; circle(cx - cs / 2 + 8, top + cs - 8, 3); g.fill(); circle(cx + cs / 2 - 8, top + cs - 8, 3); g.fill(); }
    }

    // REX
    var Hh = S.hero, hp0 = tileXY(0, lay);
    var hx = S.mode === 'play' ? Hh.x : hp0.x, hy = S.mode === 'play' ? Hh.y : hp0.y;
    var row = Math.floor(Hh.tile / COLS), e = S.ev && S.ev[S.ei];
    g.save(); g.translate(hx, hy - (S.mode === 'edit' ? Math.abs(Math.sin(now / 500)) * 2 : 0)); g.scale(cs * (row % 2 ? -1 : 1), cs); g.rotate(Hh.rot);
    drawRex(now, e && e.k === 'walk', now - Hh.hurt < 260, S.shield && S.mode === 'play', Hh.dead);
    g.restore();

    // particles
    for (i = S.parts.length - 1; i >= 0; i--) {
      var q = S.parts[i]; q.life -= 0.025; if (q.life <= 0) { S.parts.splice(i, 1); continue; }
      q.x += q.vx; q.y += q.vy; q.vy += .008; p = tileXY(q.tile, lay);
      g.globalAlpha = q.life; g.fillStyle = q.c; g.fillRect(p.x + q.x * cs - 3, p.y + q.y * cs - 3, 6, 6);
    }
    g.globalAlpha = 1;
    // floating texts
    g.font = '900 ' + Math.max(12, cs * .22) + 'px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
    for (i = S.floats.length - 1; i >= 0; i--) {
      var f = S.floats[i], ft = (now - f.t0) / 1000; if (ft > 1) { S.floats.splice(i, 1); continue; }
      p = tileXY(f.tile, lay); g.globalAlpha = 1 - ft * ft; g.fillStyle = '#15111c';
      var fx = Math.max(50, Math.min(W - 50, p.x)), fy2 = p.y - cs * .55 - ft * cs * .5 - (i % 2) * 14;
      g.fillText(f.text.toUpperCase(), fx + 1.5, fy2 + 1.5); g.fillStyle = f.color; g.fillText(f.text.toUpperCase(), fx, fy2);
    }
    g.globalAlpha = 1;
    // speech bubble
    if (S.bubble && now - S.bubble.t0 < 1500) {
      var al = Math.min(1, (1500 - (now - S.bubble.t0)) / 250);
      g.globalAlpha = al; g.font = '800 ' + Math.max(12, cs * .2) + 'px "Trebuchet MS", sans-serif';
      var tw = g.measureText(S.bubble.text).width + 18, bh = 26;
      var bx = Math.max(tw / 2 + 6, Math.min(W - tw / 2 - 6, hx)), by = hy - cs * .66;
      g.fillStyle = '#fff4e0'; rr(bx - tw / 2, by - bh, tw, bh, 13); g.fill();
      g.beginPath(); g.moveTo(hx - 5, by - 1); g.lineTo(hx + 5, by - 1); g.lineTo(hx, by + 6); g.closePath(); g.fill();
      g.fillStyle = '#15111c'; g.textBaseline = 'middle'; g.fillText(S.bubble.text, bx, by - bh / 2 + 1); g.textBaseline = 'alphabetic';
      g.globalAlpha = 1;
    }
    g.restore();
  }

  function frame(now) {
    if (S.mode === 'play' && S.ev && S.screen === 'play') stepPlay(now);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = '#15111c'; g.fillRect(0, 0, W, H);
    // studio spotlights
    for (var i = 0; i < 3; i++) {
      var lx = W * (.15 + i * .35) + Math.sin(now / 2600 + i * 2) * 30;
      var grd = g.createLinearGradient(lx, 0, lx, H * .8);
      grd.addColorStop(0, 'rgba(255,210,63,.10)'); grd.addColorStop(1, 'rgba(255,210,63,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(lx - 8, 0); g.lineTo(lx + 8, 0); g.lineTo(lx + W * .28, H * .8); g.lineTo(lx - W * .28, H * .8); g.closePath(); g.fill();
    }
    if (S.screen === 'title') {
      var u = Math.min(W, H) * .2, cy = H * .15;
      g.save(); g.translate(W / 2 - u * 1.25, cy + u * .1); g.scale(u, u); drawThing('B', now, false, 0); g.restore();
      g.save(); g.translate(W / 2, cy + Math.abs(Math.sin(now / 300)) * -8); g.scale(u * 1.25, u * 1.25); drawRex(now, true, false, false, false); g.restore();
      g.save(); g.translate(W / 2 + u * 1.25, cy + u * .1); g.scale(u, u); drawThing('L', now, false, 0); g.restore();
    } else if (S.level && (S.screen === 'play' || S.screen === 'over')) drawSet(now);
    requestAnimationFrame(frame);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }

  // ---------- input ----------
  cv.addEventListener('pointerdown', function (e) {
    audio();
    if (S.screen !== 'play') return;
    if (S.mode === 'play') { S.fast = !S.fast; return; }
    var i = tileAt(e.clientX, e.clientY);
    if (i >= 0) tapTile(i);
  });
  $('props').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || S.mode !== 'edit') return;
    S.sel = b.getAttribute('data-t'); sfx.tap(); tray();
  });
  function tap(id, fn) { $(id).addEventListener('click', function () { audio(); fn(); }); }
  tap('btnPlay', function () { sfx.tap(); startLevel(unlocked()); });
  tap('btnScenes', function () { sfx.tap(); openLevels(); });
  tap('btnBack', function () { sfx.tap(); show('title'); });
  tap('go', action);
  tap('bHint', function () { if (S.mode === 'edit') hint(); });
  tap('bClear', function () { if (S.mode === 'edit') { S.placed = {}; sfx.lift(); tray(); } });
  tap('bScenes', function () { sfx.tap(); openLevels(); });
  tap('bSound', function () { save.sound = !save.sound; persist(); soundBtn(); if (save.sound) sfx.place(); });
  tap('oMain', function () {
    sfx.tap();
    if (!S.won) { S.take++; toEdit(); show('play'); }
    else if (S.idx === LEVELS.length - 1) openLevels();
    else startLevel(S.idx + 1);
  });
  tap('oA', function () {
    sfx.tap(); S.take++;
    if (!S.won) S.placed = {};
    toEdit(); show('play');
  });
  tap('oB', function () { sfx.tap(); openLevels(); });
  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.className === 'locked') return;
    sfx.tap(); startLevel(+b.getAttribute('data-i'));
  });
  function soundBtn() { $('bSound').className = 'sm caps' + (save.sound ? '' : ' off'); }

  // Android back button: returns true when the game handled it.
  window.gjBack = function () {
    if (S.screen === 'over' || S.screen === 'play') { openLevels(); return true; }
    if (S.screen === 'levels') { show('title'); return true; }
    return false;
  };
  window.gjPause = function (paused) { if (ac) { paused ? ac.suspend() : (save.sound && ac.resume()); } };
  document.addEventListener('visibilitychange', function () { window.gjPause(document.hidden); });
  window.addEventListener('resize', resize);

  window.CC = { S: S, startLevel: startLevel, tileXY: tileXY, layout: layout, save: save }; // handy for tests
  resize(); soundBtn(); requestAnimationFrame(frame);
})();
