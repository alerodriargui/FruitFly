/* Shared deterministic game + connectome-derived controller, used in worker and replay. */
'use strict';
(function(root){
const C=root.FLY_CIRCUIT;
const CONFIG={width:900,height:540,floor:490,birdX:180,radius:11,gravity:.34,flap:-5.4,speed:2.65,gap:166,spacing:235,pipeWidth:66,maxFrames:7200};
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
class Game{
 constructor(seed=1){this.random=rng(seed);this.y=245;this.vy=0;this.frame=0;this.pipes=[];this.score=0;this.alive=true;this.cooldown=0;this.flaps=0;this.alignment=0;this.won=false;for(let i=0;i<5;i++)this.addPipe(550+i*CONFIG.spacing);}
 addPipe(x){this.pipes.push({x,gapY:145+this.random()*190,passed:false});}
 next(){return this.pipes.find(p=>p.x+CONFIG.pipeWidth>CONFIG.birdX-CONFIG.radius)||this.pipes[this.pipes.length-1];}
 step(flap){if(!this.alive)return;this.frame++;this.cooldown=Math.max(0,this.cooldown-1);if(flap&&this.cooldown===0){this.vy=CONFIG.flap;this.cooldown=7;this.flaps++;}this.vy+=CONFIG.gravity;this.y+=this.vy;
 for(const p of this.pipes){p.x-=CONFIG.speed;if(!p.passed&&p.x+CONFIG.pipeWidth<CONFIG.birdX-CONFIG.radius){p.passed=true;this.score++;}if(CONFIG.birdX+CONFIG.radius>p.x&&CONFIG.birdX-CONFIG.radius<p.x+CONFIG.pipeWidth&&(this.y-CONFIG.radius<p.gapY-CONFIG.gap/2||this.y+CONFIG.radius>p.gapY+CONFIG.gap/2))this.alive=false;}
 if(this.pipes[0].x+CONFIG.pipeWidth<0){this.pipes.shift();this.addPipe(this.pipes[this.pipes.length-1].x+CONFIG.spacing);}if(this.y<CONFIG.radius||this.y>CONFIG.floor-CONFIG.radius)this.alive=false;
 this.alignment+=Math.abs(this.y-this.next().gapY)/CONFIG.height;if(this.frame>=CONFIG.maxFrames){this.won=true;this.alive=false;}}
 features(){const p=this.next(),next=this.pipes[this.pipes.indexOf(p)+1]||p;return[(this.y-p.gapY)/140,this.vy/7,(p.x-CONFIG.birdX)/350,(this.y-245)/245,(next.gapY-p.gapY)/200,1,(CONFIG.floor-this.y)/CONFIG.floor,this.y/CONFIG.floor];}
 fitness(){return this.frame+this.score*120-this.alignment*.2;}
 snapshot(){return{y:this.y,vy:this.vy,frame:this.frame,pipes:this.pipes.map(p=>({...p})),score:this.score,alive:this.alive,won:this.won};}
}
class Brain{
 constructor(){this.state=new Float64Array(C.nodes.length);this.nextState=new Float64Array(C.nodes.length);this.input=new Float64Array(C.nodes.length);this.readout=new Float64Array(17);this.decision=0;this.lastAction=false;}
 reset(){this.state.fill(0);this.nextState.fill(0);this.lastAction=false;}
 encode(game){const f=game.features(),s=this.state,n=this.nextState,input=this.input;input.fill(0);for(const [a,b,w]of C.edges)input[b]+=s[a]*w;
 for(let i=0;i<s.length;i++){const group=i%8;const drive=Math.max(-2,Math.min(2,f[group]));n[i]=Math.tanh(drive*.9+input[i]);}
 this.readout.fill(0);for(let i=0;i<s.length;i++){this.readout[i%8]+=n[i]/24;this.readout[8+i%8]+=n[i]*n[i]/24;}this.readout[16]=1;
 this.state=n;this.nextState=s;return this.readout;}
 act(game,weights){const f=this.encode(game);let sum=0;for(let i=0;i<f.length;i++)sum+=f[i]*weights[i];this.decision=sum;this.lastAction=sum>0;return this.lastAction;}
}
function episode(weights,seed,maxFrames=CONFIG.maxFrames){const game=new Game(seed),brain=new Brain();while(game.alive&&game.frame<maxFrames){const action=game.frame%3===0?brain.act(game,weights):false;game.step(action);}return{fitness:game.fitness(),score:game.score,frames:game.frame};}
function evaluate(weights,seeds,maxFrames=CONFIG.maxFrames){const runs=seeds.map(s=>episode(weights,s,maxFrames));return{fitness:runs.reduce((a,r)=>a+r.fitness,0)/runs.length,score:runs.reduce((a,r)=>a+r.score,0)/runs.length,frames:runs.reduce((a,r)=>a+r.frames,0)/runs.length,runs};}
const TRAIN_SEEDS=[101,202,303],TEST_SEEDS=[7019,8111,9239];
class Trainer{
 constructor(seed=42){this.random=rng(seed);this.mean=new Float64Array(17);this.std=new Float64Array(17).fill(1.5);this.best=new Float64Array(17);this.bestFit=-Infinity;this.generation=0;this.episodes=0;this.history=[];this.baseline=evaluate(this.best,TEST_SEEDS);}
 normal(){return Math.sqrt(-2*Math.log(Math.max(this.random(),1e-9)))*Math.cos(2*Math.PI*this.random());}
 generationStep(){const population=[];for(let k=0;k<26;k++){const weights=k===0?Float64Array.from(this.best):Float64Array.from(this.mean,(m,i)=>m+this.normal()*this.std[i]);const result=evaluate(weights,TRAIN_SEEDS,3600);this.episodes+=TRAIN_SEEDS.length;population.push({weights,...result});}
 population.sort((a,b)=>b.fitness-a.fitness);if(population[0].fitness>this.bestFit){this.bestFit=population[0].fitness;this.best=Float64Array.from(population[0].weights);}
 const elite=population.slice(0,6);for(let i=0;i<17;i++){const m=elite.reduce((a,e)=>a+e.weights[i],0)/elite.length;const variance=elite.reduce((a,e)=>a+(e.weights[i]-m)**2,0)/elite.length;this.mean[i]=.25*this.mean[i]+.75*m;this.std[i]=Math.max(.12,.25*this.std[i]+.75*Math.sqrt(variance));}
 this.generation++;const test=evaluate(this.best,TEST_SEEDS,3600);this.episodes+=TEST_SEEDS.length;const point={generation:this.generation,train:population[0].score,test:test.score,frames:test.frames};this.history.push(point);return{...point,episodes:this.episodes,weights:Array.from(this.best),bestFitness:this.bestFit,baseline:this.baseline,history:this.history.slice(-200),testRuns:test.runs};}
}
root.FlyEngine={CONFIG,Game,Brain,Trainer,rng,evaluate,episode,TRAIN_SEEDS,TEST_SEEDS,circuit:C};
})(typeof self!=='undefined'?self:globalThis);
