export type Side='red'|'blue';export type PieceType='elephant'|'lion'|'tiger'|'leopard'|'wolf'|'dog'|'cat'|'rat';
export type Piece={id:string;side:Side;type:PieceType;rank:number;row:number;col:number;alive:boolean};
export type Move={pieceId:string;from:[number,number];to:[number,number];captureId?:string;jump?:boolean};
export type RuleConfig={elephantCanEatRat:boolean;draw80:boolean};
export type GameMode='pvp'|'pve'|'demo';export type AIDifficulty='easy'|'normal'|'hard';
export type GameState={turn:Side;winner?:Side|'draw';moves:Move[];captured:{red:Piece[];blue:Piece[]};noCapture:number;mode:GameMode;ai:AIDifficulty;config:RuleConfig;powerUsed:string[]};
