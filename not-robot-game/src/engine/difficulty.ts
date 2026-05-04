export const diff=(mode:'standard'|'endless',idx:number)=>mode==='endless'?1+Math.floor(idx/5):1;
