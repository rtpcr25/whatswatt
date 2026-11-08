import type {Block} from './engine';
export function canReport(block:Block,now:number){return block.actionable&&block.end<=now&&block.start<block.end}
export function overlaps(a:Block,b:Block){return a.mode===b.mode&&a.start<b.end&&a.end>b.start}
export function contribution(block:Block,response:string,start:number,end:number,key:'cad'|'co2'){if(!canReport(block,end))return 0;const fraction=Math.max(0,Math.min(block.end,end)-Math.max(block.start,start))/(block.end-block.start);return block[key]*fraction*(response==='yes'?1:response==='partly'?.5:0)}
