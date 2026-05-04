import { EMOJI } from '../game/constants';import { Piece as TP } from '../game/types';
export default function Piece({p,selected}:{p:TP;selected:boolean}){return <div className={`piece ${p.side} ${selected?'sel':''}`} title={`${p.type} ${p.rank}`}>{EMOJI[p.type]}<small>{p.rank}</small></div>}
