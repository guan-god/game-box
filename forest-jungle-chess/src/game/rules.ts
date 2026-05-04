import { COLS, DENS, RIVER, ROWS, TRAPS } from './constants';import { GameState, Move, Piece } from './types';
const inb=(r:number,c:number)=>r>=0&&r<ROWS&&c>=0&&c<COLS;const key=(r:number,c:number)=>`${r},${c}`;const riverSet=new Set(RIVER.map(x=>key(x[0],x[1])));
export const isRiverCell=(r:number,c:number)=>riverSet.has(key(r,c));
export const isTrapCell=(r:number,c:number)=>[...TRAPS.blue,...TRAPS.red].some(([rr,cc])=>rr===r&&cc===c);
export const isDenCell=(r:number,c:number)=> (r===DENS.blue[0]&&c===DENS.blue[1])||(r===DENS.red[0]&&c===DENS.red[1]);
export const isOwnDen=(p:Piece,r:number,c:number)=>p.side==='red'?r===DENS.red[0]&&c===DENS.red[1]:r===DENS.blue[0]&&c===DENS.blue[1];
export const isEnemyDen=(p:Piece,r:number,c:number)=>p.side==='red'?r===DENS.blue[0]&&c===DENS.blue[1]:r===DENS.red[0]&&c===DENS.red[1];
const at=(b:Piece[],r:number,c:number)=>b.find(p=>p.alive&&p.row===r&&p.col===c);
const trappedRank=(d:Piece)=> (d.side==='red'&&TRAPS.red.some(([r,c])=>r===d.row&&c===d.col))||(d.side==='blue'&&TRAPS.blue.some(([r,c])=>r===d.row&&c===d.col))?0:d.rank;
export const canCapture=(board:Piece[],a:Piece,d:Piece,g:GameState)=>{if(a.side===d.side)return false; if(a.type!=='rat'&&isRiverCell(d.row,d.col))return false; if(a.type==='rat'&&isRiverCell(a.row,a.col)&&!isRiverCell(d.row,d.col)&&d.type==='elephant')return false; if(a.type==='rat'&&d.type==='elephant')return true; if(a.type==='elephant'&&d.type==='rat'&&!g.config.elephantCanEatRat)return false; return a.rank>=trappedRank(d);};
export const isRatBlockingRiverJump=(board:Piece[],from:[number,number],to:[number,number])=>{const [fr,fc]=from,[tr,tc]=to; if(fr===tr){const min=Math.min(fc,tc),max=Math.max(fc,tc); for(let c=min+1;c<max;c++) if(isRiverCell(fr,c)&&at(board,fr,c)?.type==='rat') return true;} else if(fc===tc){const min=Math.min(fr,tr),max=Math.max(fr,tr); for(let r=min+1;r<max;r++) if(isRiverCell(r,fc)&&at(board,r,fc)?.type==='rat') return true;} return false;};
export const getJumpMoveForLionTiger=(board:Piece[],p:Piece,d:[number,number])=>{if(!(p.type==='lion'||p.type==='tiger'))return null; let r=p.row+d[0],c=p.col+d[1]; if(!inb(r,c)||!isRiverCell(r,c))return null; while(inb(r,c)&&isRiverCell(r,c)){r+=d[0];c+=d[1];} if(!inb(r,c))return null; if(isRatBlockingRiverJump(board,[p.row,p.col],[r,c]))return null; return [r,c] as [number,number];};
export const canMoveTo=(board:Piece[],p:Piece,t:[number,number],g:GameState)=>{const [r,c]=t;if(!inb(r,c)||isOwnDen(p,r,c))return false; const occ=at(board,r,c); if(occ?.side===p.side)return false; const dr=Math.abs(r-p.row),dc=Math.abs(c-p.col); const one=dr+dc===1;
if(!one){
  const j=getJumpMoveForLionTiger(board,p,[Math.sign(r-p.row),Math.sign(c-p.col)] as [number,number]);
  if(!j||j[0]!==r||j[1]!==c) return false;
}
if(p.type!=='rat'&&one&&isRiverCell(r,c))return false;
if(!occ) return true; return canCapture(board,p,occ,g);
};
export const getLegalMoves=(board:Piece[],p:Piece,g:GameState)=>{const dirs:[[number,number],[number,number],[number,number],[number,number]]=[[1,0],[-1,0],[0,1],[0,-1]];const out:Move[]=[]; for(const d of dirs){const nr=p.row+d[0],nc=p.col+d[1]; if(canMoveTo(board,p,[nr,nc],g)){const cap=at(board,nr,nc);out.push({pieceId:p.id,from:[p.row,p.col],to:[nr,nc],captureId:cap?.id});} const j=getJumpMoveForLionTiger(board,p,d); if(j&&canMoveTo(board,p,j,g)){const cap=at(board,j[0],j[1]); out.push({pieceId:p.id,from:[p.row,p.col],to:j,captureId:cap?.id,jump:true});}}
return out;};
export const applyMove=(board:Piece[],m:Move,g:GameState)=>{const nb=board.map(p=>({...p}));const p=nb.find(x=>x.id===m.pieceId)!; if(m.captureId){const d=nb.find(x=>x.id===m.captureId)!; d.alive=false; g.captured[d.side].push(d); g.noCapture=0;} else g.noCapture++; p.row=m.to[0];p.col=m.to[1];g.moves.push(m); const gain=!!m.captureId; if(gain&&g.extraTurn!==p.side){g.extraTurn=p.side; g.turn=p.side;} else {g.extraTurn=undefined; g.turn=g.turn==='red'?'blue':'red';} return nb;};
export const checkWinner=(board:Piece[],g:GameState)=>{const red=board.filter(p=>p.alive&&p.side==='red'),blue=board.filter(p=>p.alive&&p.side==='blue'); if(red.some(p=>isEnemyDen(p,p.row,p.col)))return 'red'; if(blue.some(p=>isEnemyDen(p,p.row,p.col)))return 'blue'; if(!red.length)return 'blue'; if(!blue.length)return 'red'; const t=board.filter(p=>p.alive&&p.side===g.turn); if(!t.some(p=>getLegalMoves(board,p,g).length)) return g.turn==='red'?'blue':'red'; if(g.config.draw80&&g.noCapture>=80)return 'draw'; return undefined;};
