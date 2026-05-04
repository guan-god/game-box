import { GameState, Move, Piece } from './types';import { getLegalMoves, applyMove, checkWinner } from './rules';
const val=(p:Piece)=>p.rank*10;
const all=(b:Piece[],g:GameState,side:'red'|'blue')=>b.filter(p=>p.alive&&p.side===side).flatMap(p=>getLegalMoves(b,p,g));
const evalPos=(b:Piece[])=>b.filter(p=>p.alive).reduce((s,p)=>s+(p.side==='blue'?val(p):-val(p)),0);
export const pickAIMove=(board:Piece[],g:GameState)=>{const moves=all(board,g,'blue'); if(!moves.length)return null; if(g.ai==='easy') return moves[Math.floor(Math.random()*moves.length)];
const score=(m:Move)=>{const cap=board.find(p=>p.id===m.captureId); let s=cap?cap.rank*20:0; s += (8-m.to[0])*2; return s;};
if(g.ai==='normal') return [...moves].sort((a,b)=>score(b)-score(a))[0];
let best=moves[0],bestv=-1e9; for(const m of moves){const gs=JSON.parse(JSON.stringify(g)) as GameState;const nb=applyMove(board,m,gs); if(checkWinner(nb,gs)==='blue')return m; const opp=all(nb,gs,'red'); let worst=1e9; for(const om of opp){const gs2=JSON.parse(JSON.stringify(gs)) as GameState; const nb2=applyMove(nb,om,gs2); worst=Math.min(worst,evalPos(nb2));} if(worst>bestv){bestv=worst;best=m;}}
return best;};
