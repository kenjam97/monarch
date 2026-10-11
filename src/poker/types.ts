export type Card = string;
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type ActionKind = 'small-blind' | 'big-blind' | 'ante' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'return' | 'deal' | 'show' | 'collect';
export interface Seat { seat: number; name: string; stack: number; position: Position; cards: Card[] }
export interface Action { index: number; street: Street; kind: ActionKind; player?: string; amount: number; to?: number; cards?: Card[]; allIn?: boolean; text: string }
export interface Hand { id: string; date: string; table: string; button: number; smallBlind: number; bigBlind: number; currency: string; hero: string; seats: Seat[]; actions: Action[]; board: Card[]; raw: string; totalPot: number; rake: number; heroNet: number; warnings: string[]; sessionId?: string }
export interface ReplaySeat extends Seat { remaining: number; bet: number; invested: number; collected: number; folded: boolean; revealed: Card[]; lastAction: string }
export interface Snapshot { street: Street; board: Card[]; pot: number; seats: ReplaySeat[]; currentBet: number; last?: Action; count: number }
export const POSITIONS: Position[] = ['UTG','HJ','CO','BTN','SB','BB'];
export const ENGINE_VERSION = '1.0.0';
