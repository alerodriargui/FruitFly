'use strict';
importScripts('flappy-circuit.js','flappy-engine.js');
let trainer=new FlyEngine.Trainer(42),running=false,timer=null;
function tick(){timer=null;if(!running)return;try{postMessage({type:'generation',...trainer.generationStep()});if(running)timer=setTimeout(tick,30);}catch(e){running=false;postMessage({type:'error',message:String(e)});}}
onmessage=e=>{const m=e.data;if(m.type==='start'){if(!running){running=true;timer=setTimeout(tick,0);}}else if(m.type==='pause'){running=false;if(timer!==null)clearTimeout(timer);timer=null;postMessage({type:'paused'});}else if(m.type==='reset'){running=false;if(timer!==null)clearTimeout(timer);trainer=new FlyEngine.Trainer(42);postMessage({type:'reset',baseline:trainer.baseline});}else if(m.type==='restore'){if(Array.isArray(m.weights)&&m.weights.length===17&&m.weights.every(Number.isFinite)){trainer.best=Float64Array.from(m.weights);trainer.mean=Float64Array.from(m.weights);trainer.bestFit=FlyEngine.evaluate(m.weights,FlyEngine.TRAIN_SEEDS,3600).fitness;}}};
postMessage({type:'ready',baseline:trainer.baseline});
