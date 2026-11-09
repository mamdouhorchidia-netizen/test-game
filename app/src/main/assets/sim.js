// Gravity Janitor - pure game rules. Shared by the game and the level generator.
// Level rows use: '#' wall, '.' floor, 'O' chute, 'g' goo,
// 't' trash, 'c' cat, 'z' Zoomba (slides AGAINST gravity).
(function (root) {
  'use strict';
  var DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

  function parse(rows) {
    var h = rows.length, w = rows[0].length, grid = [], objs = [];
    for (var y = 0; y < h; y++) {
      var line = [];
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x];
        if (ch === 't' || ch === 'c' || ch === 'z') {
          objs.push({ id: objs.length, t: ch, x: x, y: y, gone: false });
          line.push('.');
        } else line.push(ch);
      }
      grid.push(line);
    }
    return { w: w, h: h, grid: grid, objs: objs };
  }

  function cloneObjs(objs) {
    return objs.map(function (o) { return { id: o.id, t: o.t, x: o.x, y: o.y, gone: o.gone }; });
  }

  // Applies one gravity change. Mutates objs. Returns
  // { ticks, tracks: {id: [[x,y] per tick]}, binned: [{id,tick}], moved, won, lost }
  function move(level, objs, dir) {
    var d = DIRS[dir], dx = d[0], dy = d[1], w = level.w, grid = level.grid;
    var occ = {}, stuck = {}, tracks = {}, binned = [], i, o;
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      if (!o.gone) { occ[o.y * w + o.x] = o; tracks[o.id] = [[o.x, o.y]]; }
    }
    var normal = objs.filter(function (q) { return !q.gone && q.t !== 'z'; });
    var contra = objs.filter(function (q) { return !q.gone && q.t === 'z'; });
    normal.sort(function (a, b) { return (b.x * dx + b.y * dy) - (a.x * dx + a.y * dy); });
    contra.sort(function (a, b) { return (a.x * dx + a.y * dy) - (b.x * dx + b.y * dy); });
    var order = normal.concat(contra), tick = 0, any = false, movedNow = true;
    while (movedNow) {
      movedNow = false; tick++;
      for (i = 0; i < order.length; i++) {
        o = order[i];
        if (o.gone || stuck[o.id]) continue;
        var s = o.t === 'z' ? -1 : 1, nx = o.x + dx * s, ny = o.y + dy * s;
        var cell = grid[ny][nx];
        if (cell === '#' || occ[ny * w + nx]) continue;
        delete occ[o.y * w + o.x];
        o.x = nx; o.y = ny; movedNow = true; any = true;
        if (cell === 'O' && o.t !== 'z') { o.gone = true; binned.push({ id: o.id, t: o.t, tick: tick }); }
        else { occ[ny * w + nx] = o; if (cell === 'g') stuck[o.id] = true; }
      }
      for (i = 0; i < order.length; i++) {
        o = order[i];
        tracks[o.id].push([o.x, o.y]);
      }
    }
    var lost = false, trashLeft = 0;
    for (i = 0; i < objs.length; i++) {
      if (objs[i].t === 'c' && objs[i].gone) lost = true;
      if (objs[i].t === 't' && !objs[i].gone) trashLeft++;
    }
    return { ticks: tick - 1, tracks: tracks, binned: binned, moved: any, won: !lost && trashLeft === 0, lost: lost };
  }

  function key(objs) {
    var parts = { t: [], c: [], z: [] };
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      if (!o.gone) parts[o.t].push(o.y * 64 + o.x);
    }
    parts.t.sort(); parts.c.sort(); parts.z.sort();
    return parts.t.join(',') + '|' + parts.c.join(',') + '|' + parts.z.join(',');
  }

  // Breadth-first search for the shortest clean-up. Returns
  // { path: 'DLU...' | null, explored } ; path '' means already clean.
  function solve(level, objs, maxStates, maxDepth) {
    maxStates = maxStates || 200000; maxDepth = maxDepth || 99;
    var start = cloneObjs(objs), seen = {}, queue = [{ objs: start, path: '' }], head = 0;
    seen[key(start)] = true;
    var names = ['U', 'D', 'L', 'R'];
    if (!start.some(function (o) { return o.t === 't' && !o.gone; })) return { path: '', explored: 0 };
    while (head < queue.length && head < maxStates) {
      var cur = queue[head++];
      if (cur.path.length >= maxDepth) break;
      for (var i = 0; i < 4; i++) {
        var next = cloneObjs(cur.objs), r = move(level, next, names[i]);
        if (!r.moved || r.lost) continue;
        if (r.won) return { path: cur.path + names[i], explored: head };
        var k = key(next);
        if (seen[k]) continue;
        seen[k] = true;
        queue.push({ objs: next, path: cur.path + names[i] });
      }
    }
    return { path: null, explored: head };
  }

  var Sim = { DIRS: DIRS, parse: parse, cloneObjs: cloneObjs, move: move, key: key, solve: solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.Sim = Sim;
})(this);
