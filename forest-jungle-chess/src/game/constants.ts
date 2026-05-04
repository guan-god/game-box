import { PieceType } from './types';
export const ROWS=9,COLS=7;export const RIVER=[[3,1],[3,2],[3,4],[3,5],[4,1],[4,2],[4,4],[4,5],[5,1],[5,2],[5,4],[5,5]];export const DENS={blue:[0,3],red:[8,3]} as const;export const TRAPS={blue:[[0,2],[0,4],[1,3]],red:[[8,2],[8,4],[7,3]]} as const;
export const RANK:Record<PieceType,number>={elephant:8,lion:7,tiger:6,leopard:5,wolf:4,dog:3,cat:2,rat:1};
export const EMOJI={elephant:'🐘',lion:'🦁',tiger:'🐯',leopard:'🐆',wolf:'🐺',dog:'🐶',cat:'🐱',rat:'🐭'};
