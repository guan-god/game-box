export const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
export const randomInt=(min:number,max:number,rng=Math.random)=>Math.floor(rng()*(max-min+1))+min;
export const randomChoice=<T,>(array:T[],rng=Math.random)=>array[Math.floor(rng()*array.length)];
export const shuffle=<T,>(array:T[],rng=Math.random)=>{const a=[...array];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const pickMany=<T,>(array:T[],count:number,rng=Math.random)=>shuffle(array,rng).slice(0,Math.min(count,array.length));
export const createSeededRandom=(seed:number)=>{let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
