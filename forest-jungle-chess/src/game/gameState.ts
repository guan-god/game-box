import { GameState } from './types';
export const createGameState=(mode:GameState['mode']='pvp'):GameState=>({turn:'red',moves:[],captured:{red:[],blue:[]},noCapture:0,mode,ai:'normal',config:{elephantCanEatRat:false,draw80:true},powerUsed:[]});
