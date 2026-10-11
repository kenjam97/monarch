// Independent canonical category counts over all C(52,5)=2,598,960 hands.
// Run explicitly with npm run test:exhaustive.
import assert from 'node:assert/strict';
import { DECK } from '../src/poker/cards';
import { evaluate } from '../src/poker/evaluator';
const counts=Array(9).fill(0),start=Date.now();
for(let a=0;a<48;a++)for(let b=a+1;b<49;b++)for(let c=b+1;c<50;c++)for(let d=c+1;d<51;d++)for(let e=d+1;e<52;e++)counts[evaluate([DECK[a],DECK[b],DECK[c],DECK[d],DECK[e]]).category]++;
assert.deepEqual(counts,[1302540,1098240,123552,54912,10200,5108,3744,624,40]);
console.log(`PASS: all 2,598,960 five-card hands match canonical category frequencies (${((Date.now()-start)/1000).toFixed(1)} seconds).`);
