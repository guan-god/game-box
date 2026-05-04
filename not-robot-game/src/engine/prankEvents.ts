import { randomInt } from './random';
export type PrankState={bubble:boolean;disabled:boolean;recommended:number;attract:boolean};
export const nextPrank=(rng:()=>number):PrankState=>({bubble:rng()>0.65,disabled:rng()>0.7,recommended:randomInt(0,5,rng),attract:rng()>0.5});
export const failTexts=['你点到了一个过于积极的按钮。','这个选项只是长得像正确答案。','你相信了系统的推荐。','输入内容在进入系统前发生了变化。','你踩到了系统画出来的坑。'];
