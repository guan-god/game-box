import { useState } from 'react';
export default function HintBox({ hints, addHint }:{hints:[string,string]; addHint:()=>void}) { const [step,setStep]=useState(0); return <div><button className='btn subtle' onClick={()=>{if(step<2){setStep(step+1);addHint();}}}>提示</button>{step>0&&<p className='hint'>💡 {hints[Math.min(step-1,1)]}</p>}</div>; }
