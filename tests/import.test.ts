import { describe,it,expect } from 'vitest';
import { ggParser,parseHand,cents } from '../src/import/gg';
import { river,preflop,headsUp,sidePot } from './fixtures';
import { metrics,reviewCandidates,archetype,blankMetrics } from '../src/analysis/analysis';
import { defaultRanges } from '../src/poker/ranges';
describe('GGPoker cash fixtures',()=>{
 it.each([river,preflop,headsUp,sidePot])('parses and reconciles cash history',raw=>{const h=parseHand(raw);expect(h.id).toMatch(/^TEST-/);expect(h.hero).toBe('Hero');expect(h.raw).toBe(raw);expect(h.actions.length).toBeGreaterThan(5);});
 it('handles BOM, CRLF, leading spaces, multiple hands and non-hero dealt lines',()=>{const text='\uFEFF  '+river.replaceAll('\n','\r\n  ').replace('Dealt to Hero','Dealt to Player1\r\n  Dealt to Hero')+'\r\n\r\n'+preflop;const p=ggParser.parse(text);expect(p.issues).toEqual([]);expect(p.hands).toHaveLength(2);});
 it('supports alternate header and whitespace between stakes',()=>{expect(parseHand(preflop.replace('Poker Hand','GGPoker Hand').replace('$0.01/$0.02','$0.01 / $0.02')).bigBlind).toBe(2);});
 it('keeps valid hands when another is malformed',()=>{const p=ggParser.parse(river+'\n'+preflop.replace('Total pot $0.05','Total pot $0.50'));expect(p.hands).toHaveLength(1);expect(p.issues).toHaveLength(1);expect(p.issues[0].raw).toContain('TEST-PREFLOP');});
 it.each([
 ['duplicate cards',river.replace('8d 8c','As 8c')],['missing summary',river.slice(0,river.indexOf('*** SUMMARY'))],['payout mismatch',river.replace('collected $1.18','collected $1.08')],['unknown action',river.replace('Hero: calls $0.36','Hero: dances $0.36')],['stack underflow',river.replace('Hero ($2','Hero ($0.10')],['multi-board',river.replace('*** FLOP ***','*** FIRST FLOP ***')],['cashout',river+'\nEV Cashout $1'],['tournament',river.replace("Hold'em", "Tournament #123 Hold'em")],['invalid date',river.replace('2026/10/01','2026/02/31')],['wrong board',river.replace('[Qs 8h 4s] [2c]','[Qs 8h 4s] [2c 3d]')],
 ])('quarantines %s',(_name,raw)=>{const p=ggParser.parse(raw);expect(p.hands).toHaveLength(0);expect(p.issues[0].message.length).toBeGreaterThan(0);});
 it('reports unsupported input',()=>expect(ggParser.parse('This is not a poker hand.').issues).toHaveLength(1));
 it('rejects dealt/shown contradictions and illegal betting sequences',()=>{for(const raw of [river.replace('Hero: shows [As Qd]','Hero: shows [Ac Qd]'),river.replace('Hero: calls $0.36','Hero: calls $0.35'),river.replace('Hero: calls $0.36','Hero: checks')])expect(ggParser.parse(raw).issues).toHaveLength(1);});
 it('uses integer cents including thousands',()=>{expect(cents('$1,234.56')).toBe(123456);expect(cents('0.02')).toBe(2);expect(()=>cents('$0.001')).toThrow();});
});
describe('stats and cautious review selection',()=>{
 it('uses opportunities for 3bet and steal',()=>{const h=parseHand(headsUp),hero=metrics(h),opp=metrics(h,'Opponent');expect(hero.vpip).toBe(1);expect(hero.pfr).toBe(1);expect(hero.threeBetOpp).toBe(0);expect(opp.threeBetOpp).toBe(1);expect(opp.threeBet).toBe(1);expect(hero.steal).toBe(1);});
 it('counts flop and turn cbets, river investment and payout outcome',()=>{const m=metrics(parseHand(river));expect(m.cbetFlop).toBe(1);expect(m.cbetTurn).toBe(1);expect(m.cbetFlopOpp).toBe(1);expect(m.riverCalls).toBe(1);expect(m.riverInvested).toBe(18);expect(m.riverCallShowdowns).toBe(1);expect(m.riverCallWins).toBe(0);expect(m.netBB).toBe(-30.5);});
 it('gives all-in hands a flop and showdown observation',()=>{const m=metrics(parseHand(headsUp));expect(m.sawFlop).toBe(1);expect(m.showdown).toBe(1);expect(m.cbetFlopOpp).toBe(0);});
 it('does not mark a river call correct because of result',()=>{const h=parseHand(river),items=reviewCandidates(h,defaultRanges());expect(items.find(c=>c.category==='river')?.reason).toContain('before seeing the result');expect(items.find(c=>c.category==='river')?.reason).not.toContain('lost');});
 it('refuses confident classification on tiny samples',()=>expect(archetype({...blankMetrics(),hands:20,vpip:18,pfr:1}).name).toBe('Unknown'));
});
