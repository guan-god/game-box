import { ReactNode } from 'react';
export default function LevelCard({children,shake}:{children:ReactNode;shake:boolean}){return <section className={`glass card ${shake?'shake':''}`}>{children}</section>}
