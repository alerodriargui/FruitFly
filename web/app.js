'use strict';
(() => {
const $=id=>document.getElementById(id), D=window.BRAIN_DATA;
if(!D){$('loading').textContent='Faltan los datos. Ejecuta visualizar.cmd para generarlos.';return;}
const canvas=$('brain'), gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
if(!gl){$('loading').textContent='WebGL no está disponible. Activa la aceleración gráfica del navegador.';return;}
const fmt=n=>n.toLocaleString('es-ES');
$('total').textContent=fmt(D.total);$('active').textContent=fmt(D.active);
$('coverage').textContent=`Se sitúan ${fmt(D.nodes.length)} de ${fmt(D.total)} neuronas: ${fmt(D.somas)} somas y ${fmt(D.nodes.length-D.somas)} puntos de referencia. ${D.missing} sin coordenadas. Actividad situada: ${D.activeLocated}/${D.active} neuronas.`;
const names={central:'Cerebro central',optic:'Lóbulos ópticos',sensory:'Sensoriales',ascending:'Ascendentes',descending:'Descendentes',motor:'Motoras',visual_projection:'Proyección visual',visual_centrifugal:'Centrífugas visuales',unknown:'Sin clasificar'};
D.classes.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=names[c]||c;$('region').append(o);});
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 p;attribute vec4 c;attribute float s;uniform vec2 angle;uniform float zoom,aspect,dpr;varying vec4 color;void main(){float a=cos(angle.x),b=sin(angle.x),u=cos(angle.y),v=sin(angle.y);vec3 q=vec3(a*p.x+b*p.z,p.y,-b*p.x+a*p.z);q=vec3(q.x,u*q.y-v*q.z,v*q.y+u*q.z);float perspective=3.5/(3.5-q.z);gl_Position=vec4(q.x*zoom*perspective/aspect,q.y*zoom*perspective,q.z*0.2,1.0);gl_PointSize=s*dpr*perspective;color=c;}`));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec4 color;uniform bool lines;void main(){if(lines){gl_FragColor=color;return;}float r=length(gl_PointCoord-vec2(0.5))*2.0;if(r>1.0)discard;gl_FragColor=vec4(color.rgb,color.a*(1.0-r*r));}`));
gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const loc={};for(const k of ['angle','zoom','aspect','dpr','lines'])loc[k]=gl.getUniformLocation(program,k);
const attrs={p:gl.getAttribLocation(program,'p'),c:gl.getAttribLocation(program,'c'),s:gl.getAttribLocation(program,'s')};
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);
const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
D.nodes.forEach(n=>{for(let j=0;j<3;j++){mins[j]=Math.min(mins[j],n[j+1]);maxs[j]=Math.max(maxs[j],n[j+1]);}});
const center=mins.map((x,j)=>(x+maxs[j])/2),scale=Math.max(...maxs.map((x,j)=>x-mins[j]))/2;
// FAFB x/y/z to a frontal display: x horizontal, -y up, z depth, isotropic micrometres.
const positions=D.nodes.map(n=>[(n[1]-center[0])/scale,-(n[2]-center[1])/scale,(n[3]-center[2])/scale]);
const idMap=new Map(D.nodes.map((n,i)=>[n[0],i]));
let yaw=0,pitch=0,zoom=1.25,selected=-1,time=0,playing=false,last=0,visible=[],dirty=true;
const base=gl.createBuffer(),overlay=gl.createBuffer(),lineBuffer=gl.createBuffer();let baseCount=0,lineCount=0;
function vertex(arr,i,c,size){arr.push(...positions[i],...c,size);}
function eligible(i){const n=D.nodes[i],r=$('region').value,m=$('mode').value;return(r==='all'||n[4]===Number(r))&&(m==='anatomy'||(m==='activity'&&n[8].length>0)||(m==='stimulus'&&n[9]));}
function rebuild(){visible=[];const data=[];for(let i=0;i<D.nodes.length;i++){if(!eligible(i))continue;visible.push(i);const n=D.nodes[i];let c=n[9]?[1,.35,.6,.8]:n[8].length?[1,.57,.23,.85]:[.22,.64,.78,.22];vertex(data,i,c,n[9]?4:n[8].length?3.3:1.65);}
baseCount=visible.length;gl.bindBuffer(gl.ARRAY_BUFFER,base);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
const lines=[];if($('edges').checked)for(const [a,b,w]of D.edges){if(!eligible(a)||!eligible(b))continue;const c=w>=0?[.95,.57,.24,.14]:[.49,.42,1,.2];vertex(lines,a,c,1);vertex(lines,b,c,1);}lineCount=lines.length/8;gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.STATIC_DRAW);
$('visible').textContent=`${fmt(baseCount)} puntos visibles`;dirty=false;}
function drawBuffer(buffer,count,lines){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [k,size,offset]of [['p',3,0],['c',4,12],['s',1,28]]){gl.enableVertexAttribArray(attrs[k]);gl.vertexAttribPointer(attrs[k],size,gl.FLOAT,false,32,offset);}gl.uniform1i(loc.lines,lines?1:0);gl.drawArrays(lines?gl.LINES:gl.POINTS,0,count);}
function recent(n){if($('condition').value==='rest')return false;return n[8].some(t=>t<=time&&time-t<5);}
function render(now){const dt=Math.min((now-last)||0,100);last=now;if(playing){time=(time+dt*.01)%D.duration;$('time').value=time;}if($('rotate').checked)yaw+=dt*.0001;if(dirty)rebuild();
const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
gl.uniform2f(loc.angle,yaw,pitch);gl.uniform1f(loc.zoom,zoom*Math.min(1,(w/h)/1.4));gl.uniform1f(loc.aspect,w/h);gl.uniform1f(loc.dpr,dpr);
if(lineCount)drawBuffer(lineBuffer,lineCount,true);drawBuffer(base,baseCount,false);
const lights=[];let firing=0;for(const i of visible){if(recent(D.nodes[i])){vertex(lights,i,[1,.88,.53,.95],8);firing++;}}if(selected>=0&&eligible(selected))vertex(lights,selected,[.5,1,.89,1],12);
gl.bindBuffer(gl.ARRAY_BUFFER,overlay);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lights),gl.DYNAMIC_DRAW);drawBuffer(overlay,lights.length/8,false);
$('clock').textContent=time.toFixed(1)+' ms';$('events').textContent=`${firing} neuronas con impulso en los últimos 5 ms · ${$('condition').value==='rest'?'Reposo: 0 impulsos':fmt(D.spikes)+' impulsos registrados'}`;
window.viewerState={ready:true,visible:baseCount,time,playing,selected:selected<0?null:D.nodes[selected][0],lineCount,condition:$('condition').value};requestAnimationFrame(render);}
function select(i){selected=i;const n=D.nodes[i],box=$('detail');box.replaceChildren();const title=document.createElement('strong');title.textContent=n[5];box.append(title,document.createElement('br'));box.append(document.createTextNode(`ID ${n[0]}`),document.createElement('br'));box.append(document.createTextNode(`${names[D.classes[n[4]]]||D.classes[n[4]]} · ${n[6]} · ${n[7]?'soma':'punto de referencia'}`),document.createElement('br'));box.append(document.createTextNode(`${n[8].length} impulsos en la prueba${n[9]?' · estímulo directo':''}`),document.createElement('br'));const a=document.createElement('a');a.href='https://codex.flywire.ai/app/cell_details?data_version=783&root_id='+encodeURIComponent(n[0]);a.target='_blank';a.rel='noreferrer';a.textContent='Abrir ficha en FlyWire ↗';box.append(a);$('neuronId').value=n[0];}
let drag=null;canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,moved:false};});canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.ox,e.clientY-drag.oy)>4)drag.moved=true;yaw+=dx*.006;pitch=Math.max(-1.55,Math.min(1.55,pitch+dy*.006));drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved)return;const rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;let best=-1,dist=144;const a=Math.cos(yaw),b=Math.sin(yaw),u=Math.cos(pitch),v=Math.sin(pitch);for(const i of visible){const [x,y,z]=positions[i],xx=a*x+b*z,zz=-b*x+a*z,yy=u*y-v*zz,depth=v*y+u*zz,p=3.5/(3.5-depth),fit=zoom*Math.min(1,(rect.width/rect.height)/1.4),px=rect.width/2+xx*fit*p*rect.height/2,py=rect.height/2-yy*fit*p*rect.height/2,d=(px-mx)**2+(py-my)**2;if(d<dist){dist=d;best=i;}}if(best>=0)select(best);});canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.3,Math.min(6,zoom*Math.exp(-e.deltaY*.001)));},{passive:false});
function pause(){playing=false;$('play').textContent='▶ Reproducir';}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Ⅱ Pausar':'▶ Reproducir';};$('time').max=D.duration;$('time').oninput=()=>{pause();time=Number($('time').value);};
for(const id of ['region','mode','edges'])$(id).onchange=()=>dirty=true;
$('condition').onchange=()=>{time=0;$('time').value=0;};
$('reset').onclick=()=>{yaw=pitch=0;zoom=1.25;$('rotate').checked=false;};$('side').onclick=()=>{yaw=Math.PI/2;pitch=0;};
$('search').onsubmit=e=>{e.preventDefault();const i=idMap.get($('neuronId').value.trim());if(i===undefined){$('detail').textContent='No se encuentra ese ID entre las neuronas con coordenadas del modelo.';return;}$('region').value='all';$('mode').value='anatomy';dirty=true;select(i);};
$('loading').hidden=true;requestAnimationFrame(render);
})();
