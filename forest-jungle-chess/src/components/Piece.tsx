import { EMOJI } from '../game/constants';import { Piece as TP } from '../game/types';
const CN={elephant:'象',lion:'狮',tiger:'虎',leopard:'豹',wolf:'狼',dog:'狗',cat:'猫',rat:'鼠'} as const;
export default function Piece({p,selected}:{p:TP;selected:boolean}){return <div className={`piece ${p.side} ${selected?'sel':''}`} title={`${CN[p.type]} 等级${p.rank}`}><span>{EMOJI[p.type]}</span><b>{CN[p.type]}</b><small>{p.rank}</small><em>{p.shield&&'🛡️'}{p.stealth&&!p.hasAttacked&&'🥷'}{p.combo&&'⚔️'}</em></div>}
