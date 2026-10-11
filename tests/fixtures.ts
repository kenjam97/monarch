import { SAMPLE_HAND } from '../src/import/sample';
export const river=SAMPLE_HAND.replaceAll('DEMO-RIVER-001','TEST-RIVER-001');
export const preflop=`Poker Hand #TEST-PREFLOP-002: Hold'em No Limit ($0.01/$0.02) - 2026/10/01 19:35:00
Table 'Practice 01' 6-max Seat #4 is the button
Seat 1: Player1 ($2 in chips)
Seat 2: Player2 ($2 in chips)
Seat 3: Player3 ($2 in chips)
Seat 4: Hero ($2 in chips)
Seat 5: Player5 ($2 in chips)
Seat 6: Player6 ($2 in chips)
Player5: posts small blind $0.01
Player6: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Player1: folds
Player2: folds
Player3: folds
Hero: raises $0.03 to $0.05
Player5: folds
Player6: folds
Uncalled bet ($0.03) returned to Hero
Hero collected $0.05 from pot
*** SUMMARY ***
Total pot $0.05 | Rake $0
`;
export const headsUp=`Poker Hand #TEST-HU-003: Hold'em No Limit ($0.01/$0.02) - 2026/10/01 20:40:00
Table 'Heads Up' 6-max Seat #1 is the button
Seat 1: Hero ($2 in chips)
Seat 4: Opponent ($2 in chips)
Hero: posts small blind $0.01
Opponent: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [Ks Kc]
Hero: raises $0.03 to $0.05
Opponent: raises $0.13 to $0.18
Hero: raises $1.82 to $2 and is all-in
Opponent: calls $1.82 and is all-in
*** FLOP *** [2h 3h 4d]
*** TURN *** [2h 3h 4d] [9c]
*** RIVER *** [2h 3h 4d 9c] [Th]
*** SHOWDOWN ***
Hero: shows [Ks Kc]
Opponent: shows [As Ah]
Opponent collected $3.80 from pot
*** SUMMARY ***
Total pot $4 | Rake $0.20
`;
export const sidePot=`Poker Hand #TEST-SIDE-004: Hold'em No Limit ($0.01/$0.02) - 2026/10/01 20:50:00
Table 'Side Pots' 6-max Seat #1 is the button
Seat 1: Hero ($1 in chips)
Seat 2: Short ($0.50 in chips)
Seat 3: Deep ($2 in chips)
Short: posts small blind $0.01
Deep: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [As Ah]
Hero: raises $0.98 to $1 and is all-in
Short: calls $0.49 and is all-in
Deep: calls $0.98
*** FLOP *** [2h 3h 4d]
*** TURN *** [2h 3h 4d] [9c]
*** RIVER *** [2h 3h 4d 9c] [Th]
*** SHOWDOWN ***
Hero: shows [As Ah]
Short: shows [5s 6s]
Deep: shows [Ks Kc]
Short collected $1.43 from main pot
Hero collected $0.95 from side pot
*** SUMMARY ***
Total pot $2.50 | Rake $0.12
`;
