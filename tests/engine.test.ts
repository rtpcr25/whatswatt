import {test} from 'node:test';import assert from 'node:assert/strict';
import {plan,sample,demoForecast,demoNow,validProfile,range,alerts} from '../src/engine.ts';
const demo=demoForecast();
const f={...demo,hours:demo.hours.map(h=>({...h,temp:2}))};
test('gas: modest empty-home setbacks and positive modeled savings',()=>{const bs=plan(sample,f);assert(bs.some(b=>b.period==='away'&&b.target===20));assert(bs.reduce((a,b)=>a+b.cad,0)>0);assert(bs.every(b=>b.target>=18));});
test('occupied household does not get away setbacks',()=>{assert(!plan({...sample,others:'yes'},f).some(b=>b.period==='away'));assert(!plan({...sample,others:'varies'},f).some(b=>b.period==='away'));});
test('heat pumps remain stable and save zero from setbacks',()=>{const bs=plan({...sample,heat:'pump'},f);assert(bs.every(b=>b.target===21));assert.equal(bs.reduce((a,b)=>a+b.cad,0),0)});
test('baseboard gets reasonable away reductions',()=>{assert(plan({...sample,heat:'electric'},f).some(b=>b.period==='away'&&b.target===19))});
test('building control never produces actionable heating savings',()=>{const bs=plan({...sample,control:'building'},f);assert(bs.every(b=>!b.actionable));assert.equal(bs.reduce((a,b)=>a+b.cad,0),0)});
test('no AC never creates fictional controls or consumption',()=>{const hot={...f,hours:f.hours.map(h=>({...h,temp:33}))};for(const cool of ['none','fan']){const bs=plan({...sample,cool},hot);assert(bs.every(b=>!b.actionable&&b.energy===0&&b.baseline===0))}assert(alerts(hot).some(a=>a.id.startsWith('heat')))});
test('extreme cold suppresses setbacks',()=>{const cold={...f,hours:f.hours.map(h=>({...h,temp:-20}))};assert(plan(sample,cold).every(b=>b.target===21));assert(alerts(cold).length>0)});
test('validation and formatting',()=>{assert(validProfile(sample));assert(!validProfile({...sample,temp:NaN}));assert(!validProfile({...sample,wake:'99:00'}));assert.equal(range(10,'$'),'$6–$16')});
test('demo contains ended Thursday block and no future feedback needed',()=>{const bs=plan(sample,f);assert(bs.some(b=>b.period==='away'&&b.end===Date.parse('2026-11-05T17:00:00-05:00')&&b.end<demoNow))});
import {canReport,contribution,overlaps} from '../src/impact.ts';
test('feedback accepts only ended blocks; partly is half, no is zero',()=>{const b=plan(sample,f).find(b=>b.period==='away')!;assert(!canReport(b,b.end-1));assert(canReport(b,b.end));assert.equal(contribution(b,'yes',b.start,b.end,'cad'),b.cad);assert.equal(contribution(b,'partly',b.start,b.end,'cad'),b.cad*.5);assert.equal(contribution(b,'no',b.start,b.end,'cad'),0);assert(overlaps(b,{...b,id:'new'}));assert(!overlaps(b,{...b,start:b.end,end:b.end+1000}))});

test('small dollar estimates use honest upper bounds instead of zero-dollar labels',()=>{assert.equal(range(0,'$'),'Less than $1');assert.equal(range(.2,'$'),'Less than $1');assert.equal(range(1,'$'),'Less than $2');assert.equal(range(0),'0');assert.equal(range(NaN,'$'),'Unavailable')});

test('minus-15 demo week raises demand and keeps comfort stable at cold threshold',()=>{
  assert.equal(demo.hours.length,168);
  assert(demo.hours.every(h=>h.temp===-15));
  const coldPlan=plan(sample,demo),mildPlan=plan(sample,f);
  assert(coldPlan.every(b=>b.target===21&&b.mode==='heating'));
  assert(coldPlan.reduce((sum,b)=>sum+b.baseline,0)>mildPlan.reduce((sum,b)=>sum+b.baseline,0));
  assert.equal(coldPlan.reduce((sum,b)=>sum+b.cad,0),0);
  assert.equal(coldPlan.reduce((sum,b)=>sum+b.co2,0),0);
  assert(alerts(demo).some(a=>a.id.startsWith('cold')));
});
