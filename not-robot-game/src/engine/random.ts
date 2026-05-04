export const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export const createSeededRandom=(seed:number)=>{let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296)};
export const randomInt=(a:number,b:number,r=Math.random)=>Math.floor(r()*(b-a+1))+a;
export const randomChoice=<T,>(arr:T[],r=Math.random)=>arr[Math.floor(r()*arr.length)];
export const shuffle=<T,>(arr:T[],r=Math.random)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const pickMany=<T,>(arr:T[],n:number,r=Math.random)=>shuffle(arr,r).slice(0,n);
