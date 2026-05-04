import { ReactNode } from 'react';
export default function BoardCell({cls,onClick,children}:{cls:string;onClick:()=>void;children?:ReactNode}){return <button className={`cell ${cls}`} onClick={onClick}>{children}</button>}
