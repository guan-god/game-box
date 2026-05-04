import { CardType, GameState } from './types';
const rand=(arr:CardType[])=>[...arr].sort(()=>Math.random()-.5).slice(0,4);
export const createGameState=(mode:GameState['mode']='pvp'):GameState=>({turn:'red',moves:[],captured:{red:[],blue:[]},noCapture:0,mode,ai:'normal',config:{elephantCanEatRat:false,draw80:true},powerUsed:[],cards:{red:rand(['shield','stealth','combo','mystery','combo']),blue:rand(['shield','stealth','combo','mystery','stealth'])}});
