export default function ProgressBar({value,total}:{value:number,total:number}){return <div className='progress'><div className='bar' style={{width:`${(value/total)*100}%`}} /></div>}
