// Fails if any shipped level is unsolvable or its par is not the shortest solution.
'use strict';
const fs = require('fs');
const path = require('path');
const Sim = require('../app/src/main/assets/sim.js');
const src = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/levels.js'), 'utf8');
const LEVELS = new Function(src + '; return LEVELS;')();
let bad = 0;
LEVELS.forEach((l, i) => {
  const lv = Sim.parse(l.rows), r = Sim.solve(lv, lv.objs);
  if (!r.path || r.path.length !== l.par) { bad++; console.log(`level ${i + 1}: par ${l.par}, solver says ${r.path}`); }
});
console.log(`${LEVELS.length - bad}/${LEVELS.length} levels OK`);
process.exit(bad ? 1 : 0);
