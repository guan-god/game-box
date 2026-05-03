export type LevelProps={levelSeed:number;randomEvent:{rename:boolean;jitter:boolean;sus:boolean;scan:number};onPass:()=>void;onFail:(m:string)=>void;onPrank:(m:string)=>void;addHint:()=>void};
