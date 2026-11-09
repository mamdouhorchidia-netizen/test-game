// Close Call - pure game rules. Shared by the game, the level generator and the checker.
//
// The set is a strip of rows*6 tiles. REX starts on tile 0 and walks one tile per beat
// to the last tile. Tiles hold one thing each:
//   L laser      -1 HP, stays armed                      thrill +1
//   B barrel     -2 HP, blasts REX 2 tiles forward, once thrill +3
//   N banana     REX slides 3 tiles forward, once
//   T trampoline REX bounces 2 tiles back, once
//   F superfan   REX stops for one beat to sign, once
//   D donut      +1 HP, once
//   P pillow     pads the next hit completely, once
//   C<n> crusher slams on every n-th beat: -2 HP          thrill +3 (near miss: +2)
// A take is a hit when REX reaches the end with exactly 1 HP.
(function (root) {
  'use strict';
  var COLS = 6;

  function run(level, placed, rec) {
    var n = level.rows * COLS, c = new Array(n), k, i;
    for (i = 0; i < n; i++) c[i] = '';
    for (k in level.fix) c[k] = level.fix[k];
    for (k in placed) c[k] = placed[k];
    var hp = level.hp, th = 0, t = 0, pos = 0, shield = false, dead = false, guard = 0, ev = rec ? [] : null;
    function hit(d) { if (shield) { shield = false; return true; } hp -= d; return false; }
    while (pos < n - 1 && !dead && guard++ < 400) {
      t++;
      if (ev) ev.push({ k: 'walk', a: pos, b: pos + 1, t: t });
      pos++;
      var chain = true;
      while (chain && !dead) {
        chain = false;
        if (pos >= n - 1) { pos = n - 1; break; }
        var x = c[pos];
        if (!x) break;
        var ch = x.charAt(0), at = pos, blocked = false, e = null;
        if (ch === 'L') { blocked = hit(1); th += 1; e = { k: 'laser' }; }
        else if (ch === 'B') { c[pos] = ''; blocked = hit(2); th += 3; if (hp > 0) { pos = Math.min(pos + 2, n - 1); chain = true; } e = { k: 'barrel', to: pos }; }
        else if (ch === 'N') { c[pos] = ''; pos = Math.min(pos + 3, n - 1); chain = true; e = { k: 'banana', to: pos }; }
        else if (ch === 'T') { c[pos] = ''; pos = Math.max(pos - 2, 0); chain = true; e = { k: 'tramp', to: pos }; }
        else if (ch === 'F') { c[pos] = ''; t++; e = { k: 'fan', t: t }; }
        else if (ch === 'D') { c[pos] = ''; hp++; e = { k: 'donut' }; }
        else if (ch === 'P') { c[pos] = ''; shield = true; e = { k: 'pillow' }; }
        else if (ch === 'C') {
          var p = +x.slice(1);
          if (t % p === 0) { blocked = hit(2); th += 3; e = { k: 'crush' }; }
          else if ((t + 1) % p === 0 || (t - 1) % p === 0) { th += 2; e = { k: 'miss' }; }
        }
        if (hp <= 0) dead = true;
        if (ev && e) { e.p = at; e.hp = hp; e.th = th; e.blocked = blocked; e.shield = shield; ev.push(e); }
      }
    }
    var result = dead ? 'dead' : hp === 1 ? 'close' : 'safe';
    if (ev) ev.push({ k: 'end', p: pos, result: result, hp: hp, th: th });
    return { result: result, hp: hp, thrill: th, events: ev };
  }

  function freeTiles(level) {
    var n = level.rows * COLS, out = [];
    for (var i = 1; i < n - 1; i++) if (!level.fix[i]) out.push(i);
    return out;
  }

  // Tries every way of placing the inventory. Returns
  // { total, wins, best, min, sol } where sol is a highest-thrill winning set-up.
  function analyze(level) {
    var free = freeTiles(level), props = [], k, i;
    for (k in level.inv) for (i = 0; i < level.inv[k]; i++) props.push(k);
    props.sort();
    var used = {}, placed = {}, out = { total: 0, wins: 0, best: -1, min: 1e9, sol: null }, choice = [];
    function go(idx) {
      if (idx === props.length) {
        out.total++;
        var r = run(level, placed, false);
        if (r.result === 'close') {
          out.wins++;
          if (r.thrill < out.min) out.min = r.thrill;
          if (r.thrill > out.best) { out.best = r.thrill; out.sol = JSON.parse(JSON.stringify(placed)); }
        }
        return;
      }
      var same = idx > 0 && props[idx - 1] === props[idx], prev = same ? choice[idx - 1] : -2;
      choice[idx] = -1; go(idx + 1);              // leave this prop in the truck
      if (same && prev === -1) return;            // identical props: keep tile order increasing
      for (var f = 0; f < free.length; f++) {
        var tile = free[f];
        if (used[tile] || (same && tile <= prev)) continue;
        used[tile] = true; placed[tile] = props[idx]; choice[idx] = tile;
        go(idx + 1);
        used[tile] = false; delete placed[tile];
      }
    }
    go(0);
    return out;
  }

  var Sim = { COLS: COLS, run: run, analyze: analyze, freeTiles: freeTiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.Sim = Sim;
})(this);
