import { Piece } from './types';import { RANK } from './constants';
const mk=(side:'red'|'blue',type:any,row:number,col:number,id:string):Piece=>({id,side,type,rank:RANK[type],row,col,alive:true,shield:type==='elephant',stealth:type==='cat',combo:type==='tiger'||type==='lion',hasAttacked:false});
export const createInitialBoard=():Piece[]=>[
mk('red','elephant',6,0,'re'),mk('red','wolf',6,2,'rw'),mk('red','leopard',6,4,'rl'),mk('red','rat',6,6,'rr'),mk('red','cat',7,1,'rc'),mk('red','dog',7,5,'rd'),mk('red','tiger',8,0,'rt'),mk('red','lion',8,6,'rli'),
mk('blue','lion',0,0,'bli'),mk('blue','tiger',0,6,'bt'),mk('blue','dog',1,1,'bd'),mk('blue','cat',1,5,'bc'),mk('blue','rat',2,0,'br'),mk('blue','leopard',2,2,'bl'),mk('blue','wolf',2,4,'bw'),mk('blue','elephant',2,6,'be')];
