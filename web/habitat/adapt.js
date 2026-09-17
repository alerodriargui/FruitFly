// FruitFly integration. Only steering, presentation and explicitly selected
// friction multipliers are changed. CPG, gait tables and MuJoCo stepping are upstream.
import { OrbitControls } from './wasm/shared/vendor/three/OrbitControls.js';
import * as THREE from 'three';
export function attachHabitat(game, setSpeed) {
  const g=game, controls=new OrbitControls(g.camera,g.renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=1.8;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.48;
  let automatic=true,paused=false,friction=1,waypoint=0,previous=null,distance=0,cameraPrevious=null,finished=false;
  const route=[[10,2],[20,-2],[30,2],[40,-2],[51,2]];
  const pairFriction=Float64Array.from(g.model.pair_friction),geomFriction=Float64Array.from(g.model.geom_friction);
  const style=document.createElement('style');style.textContent='#levels,#hud,#help{display:none!important}#stats{top:15px;right:15px;color:#a8c7b9;background:#102320ba;padding:8px 10px;border-radius:7px;font-size:11px}';document.head.append(style);
  // Restore biological mesh colours (the outreach UI recolours legs by control group).
  for(const item of g.meshGroup.userData.items){const rgba=g.meta.geom_rgba[item.g];if(rgba)item.mesh.material.color.setRGB(rgba[0],rgba[1],rgba[2],THREE.SRGBColorSpace);}
  g.scene.fog.color.setHex(0x102224);g.renderer.setClearColor(0x102224,1);
  g.groundMat.color.setHex(0x69745b);
  function position(){const b=g.bodyId;return[g.data.xpos[b*3],g.data.xpos[b*3+1],g.data.xpos[b*3+2]];}
  function centerCamera(){const[x,y,z]=position();controls.target.set(x,y,z+.15);g.camera.position.set(x-4,y-5,z+3.2);cameraPrevious=[x,y,z];controls.update();}
  function begin(){g.phase='running';document.getElementById('overlay').classList.add('hidden');paused=false;finished=false;}
  g._showReady=begin;
  g._finishRun=()=>{g.phase='finished';finished=true;g.input.resetGains();};
  g._updateCamera=()=>{
    const pos=position(),[x,y,z]=pos;
    if(cameraPrevious){g.camera.position.x+=x-cameraPrevious[0];g.camera.position.y+=y-cameraPrevious[1];controls.target.x+=x-cameraPrevious[0];controls.target.y+=y-cameraPrevious[1];}
    cameraPrevious=pos;controls.update();
    if(previous&&g.phase==='running')distance+=Math.hypot(x-previous[0],y-previous[1]);previous=pos;
    if(automatic&&g.phase==='running'){
      if(waypoint<route.length-1&&x>route[waypoint][0]-.5)waypoint++;
      const[tx,ty]=route[waypoint],b=g.bodyId,yaw=Math.atan2(g.data.xmat[b*9+3],g.data.xmat[b*9]);
      const desired=Math.atan2(ty-y,tx-x),error=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
      const turn=Math.max(-.42,Math.min(.42,error*.65));g.input.gainL=.85-turn;g.input.gainR=.85+turn;
    }
  };
  const api={
    state(){return{ready:true,automatic,paused,finished,simulationTime:g.simTime,position:position(),distance,contacts:g.data.ncon,joints:g.model.njnt,actuators:g.model.nu,timestep:g.dt,friction,waypoint,finite:Array.from(g.data.qpos).every(Number.isFinite),gains:[g.input.gainL,g.input.gainR],source:'NeuroMechFly / MuJoCo; CPG locomotion; engineered waypoint steering; no connectome brain'};},
    mode(auto){automatic=Boolean(auto);g.input.resetGains();},
    pause(){paused=!paused;g.phase=paused?'paused':finished?'finished':'running';},
    reset(){g._resetSim();waypoint=0;distance=0;previous=null;begin();centerCamera();},
    center:centerCamera,
    speed(value){if([.05,.1,.2,.3].includes(Number(value)))setSpeed(Number(value));},
    friction(value){const f=Number(value);if(!Number.isFinite(f)||f<.1||f>2)return;friction=f;for(let i=0;i<pairFriction.length;i++)g.model.pair_friction[i]=pairFriction[i]*(i%5<2?f:1);for(let i=0;i<geomFriction.length;i++)g.model.geom_friction[i]=geomFriction[i]*(i%3===0?f:1);},
    move(key){automatic=false;g.input._cpgKey(key);},
    // Diagnostics for integration tests, never used to generate movement.
    contactFriction(){return Array.from(g.model.pair_friction.slice(0,5));}
  };
  window.habitat=api;
  // Keep the documented CPG mode; upstream level-switch keys are not exposed here.
  addEventListener('keydown',e=>{if(['1','2','3','i','o','p',' '].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();if(e.key===' ')api.reset();}},true);
  addEventListener('keydown',e=>{if(['w','a','s','d','q','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()))automatic=false;});
  centerCamera();begin();
}
