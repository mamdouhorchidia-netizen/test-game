// Fails if any Close Call scene's stored best set-up is not really the best.
'use strict';
const fs = require('fs');
const path = require('path');
const Sim = require('../closecall/src/main/assets/sim.js');
const src = fs.readFileSync(path.join(__dirname, '../closecall/src/main/assets/levels.js'), 'utf8');
const LEVELS = new Function(src + '; return LEVELS;')();
let bad = 0;
LEVELS.forEach((l, i) => {
  const a = Sim.analyze(l), r = Sim.run(l, l.sol, false);
  const ok = a.wins > 0 && a.best === l.best && r.result === 'close' && r.thrill === l.best &&
    Sim.run(l, {}, false).result !== 'close';
  if (!ok) { bad++; console.log(`scene ${i + 1}: stored best ${l.best}, solver best ${a.best}, stored set-up gives ${r.result}/${r.thrill}`); }
});
console.log(`${LEVELS.length - bad}/${LEVELS.length} scenes OK`);
process.exit(bad ? 1 : 0);
