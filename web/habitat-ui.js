'use strict';
(()=>{
const $=id=>document.getElementById(id),frame=$('simulation');let api=null;
function ready(fn){return()=>{if(api)fn();};}
$('mode').onchange=ready(()=>api.mode($('mode').value==='auto'));
$('pause').onclick=ready(()=>api.pause());$('reset').onclick=ready(()=>api.reset());$('center').onclick=ready(()=>api.center());
$('speed').onchange=ready(()=>api.speed($('speed').value));$('friction').oninput=ready(()=>{api.friction($('friction').value);$('frictionValue').textContent='×'+Number($('friction').value).toFixed(2).replace('.',',');});
for(const b of document.querySelectorAll('[data-key]'))b.onclick=ready(()=>{api.move(b.dataset.key);$('mode').value='manual';});
addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(document.activeElement.tagName))return;const key=e.key.toLowerCase(),map={arrowup:'w',arrowleft:'a',arrowright:'d',arrowdown:'s'};if(api&&('wasdq'.includes(key)&&key.length===1||map[key])){e.preventDefault();api.move(map[key]||key);$('mode').value='manual';}});
const started=Date.now();setInterval(()=>{
try{api=frame.contentWindow.habitat||null;}catch(e){}
if(!api){if(Date.now()-started>90000)$('status').textContent='La carga está tardando. Revisa la conexión local o recarga la página.';return;}
const state=api.state();window.habitatState=state;$('simTime').textContent=state.simulationTime.toFixed(2)+' s';$('distance').textContent=state.distance.toFixed(2)+' mm';$('contacts').textContent=state.contacts;$('joints').textContent=state.joints+' / '+state.actuators;$('pause').textContent=state.paused?'▶ Continuar':'Ⅱ Pausar';$('mode').value=state.automatic?'auto':'manual';$('status').textContent=state.finished?'Recorrido completado · puedes reiniciar':state.paused?'Simulación pausada':state.automatic?'Exploración automática · ruta programada':'Control manual · W A S D · Q para detener';if(!state.finite)$('status').textContent='La física encontró un error. Reinicia la simulación.';
},150);
})();
