
const DB_NAME='libreta_control_cuadrilla_pwa_v1',DB_VERSION=1;
const TARIFA_HECTAREA=4350;
const DEFAULTS={clave:'5969',pieza:'4350',labor:'Deshoja'};
const SETTINGS={block:'bloque_actual',area:'area_supervision_total',email:'correo_reporte'};
const DRAFT_KEY='cuadrilla_modular_form_draft_v1_4_0';
let db,deferredPrompt=null;
const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const fmt2=n=>Number(n||0).toFixed(2);
const money=n=>'₡'+Math.round(Number(n||0)).toLocaleString('es-CR');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('workers'))d.createObjectStore('workers',{keyPath:'id',autoIncrement:true});if(!d.objectStoreNames.contains('records')){const s=d.createObjectStore('records',{keyPath:'id',autoIncrement:true});s.createIndex('date','date',{unique:false})}if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'})};r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error)})}
const store=(n,m='readonly')=>db.transaction(n,m).objectStore(n);
function getAll(n){return new Promise((res,rej)=>{const r=store(n).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function add(n,o){return new Promise((res,rej)=>{const r=store(n,'readwrite').add(o);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(n,o){return new Promise((res,rej)=>{const r=store(n,'readwrite').put(o);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function del(n,id){return new Promise((res,rej)=>{const r=store(n,'readwrite').delete(Number(id));r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function getSetting(k,f=''){return new Promise((res,rej)=>{const r=store('settings').get(k);r.onsuccess=()=>res(r.result?.value??f);r.onerror=()=>rej(r.error)})}
const setSetting=(k,v)=>put('settings',{key:k,value:v});

function towerOptions(){
  const opts=['<option value="">Seleccione</option>'];
  for(let i=1;i<=129;i++){const txt=String(i).padStart(2,'0');opts.push(`<option value="${i}">${txt}</option>`)}
  $('torreInicio').innerHTML=opts.join('');
  $('torreFin').innerHTML=opts.join('');
}
function minutesBetween(a,b){if(!a||!b)return 0;let [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number);let s=ah*60+am,e=bh*60+bm;if(e<s)e+=1440;return Math.max(0,e-s)}
function humanMinutes(m){m=Math.round(Number(m||0));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')} min`}
function calc(){
  const a=Number($('torreInicio').value),b=Number($('torreFin').value);
  const towers=a&&b?Math.abs(b-a)+1:0;
  const minutes=minutesBetween($('horaInicio').value,$('horaFin').value);
  const hectares=towers/10;
  return{minutes,hours:minutes/60,towers,hectares,amount:hectares*TARIFA_HECTAREA};
}
function updateCalc(){
  const c=calc();
  $('hoursHuman').textContent=humanMinutes(c.minutes);
  $('hoursDecimal').textContent=`${fmt2(c.hours)} horas`;
  $('towerCount').textContent=c.towers;
  $('hectares').textContent=fmt2(c.hectares);
  $('amount').textContent=money(c.amount);
  const opt=$('workerSelect').selectedOptions[0];
  $('pvWorker').textContent=opt?.dataset?.name||'—';
  $('pvLabor').textContent=`${$('labor').value||'—'} · ${$('pieza').value||'—'}`;
  $('pvHours').textContent=humanMinutes(c.minutes);
  $('pvTowers').textContent=c.towers?`${String($('torreInicio').value).padStart(2,'0')} → ${String($('torreFin').value).padStart(2,'0')}`:'—';
  $('pvHa').textContent=`${fmt2(c.hectares)} ha`;
  $('pvAmount').textContent=money(c.amount);
}
function saveDraft(){
  const ids=['fecha','workerSelect','clave','cuadrilla','pieza','labor','horaInicio','horaFin','torreInicio','torreFin'];
  const d={};ids.forEach(id=>d[id]=$(id).value);
  localStorage.setItem(DRAFT_KEY,JSON.stringify(d));
}
function restoreDraft(){
  try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!d)return;Object.entries(d).forEach(([k,v])=>{if($(k))$(k).value=v})}catch{}
}
function clearDraft(){localStorage.removeItem(DRAFT_KEY)}
function resetForm(keepDate=true){
  const date=keepDate?($('fecha').value||today()):today();
  $('recordForm').reset();
  $('fecha').value=date;$('clave').value=DEFAULTS.clave;$('pieza').value=DEFAULTS.pieza;$('labor').value=DEFAULTS.labor;
  clearDraft();updateCalc();
}
async function savePersistentField(inputId,key,isNumber=false){
  const input=$(inputId);
  const raw=input.value.trim();
  if(!raw)return alert('Ingrese un valor antes de guardar.');
  if(isNumber&&(!Number.isFinite(Number(raw))||Number(raw)<0))return alert('Ingrese un área válida.');
  await setSetting(key,isNumber?Number(raw):raw);
  await loadSettings();
  alert(isNumber?'Área total de supervisión guardada.':'Bloque actual guardado.');
}
async function loadSettings(){
  const block=await getSetting(SETTINGS.block,''),area=await getSetting(SETTINGS.area,''),email=await getSetting(SETTINGS.email,'');
  $('blockInput').value=block;$('areaInput').value=area;$('emailInput').value=email;
  $('blockInput').readOnly=false;
  $('areaInput').readOnly=false;
}

async function renderWorkers(){
  const workers=(await getAll('workers')).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const q=$('workerSearch').value.trim().toLowerCase();
  const filtered=workers.filter(w=>[w.name,w.code,w.team].join(' ').toLowerCase().includes(q));
  $('workerSelect').innerHTML='<option value="">Seleccione</option>'+workers.map(w=>`<option value="${w.id}" data-name="${esc(w.name)}">${esc(w.name)}</option>`).join('');
  $('workerList').innerHTML=filtered.length?filtered.map(w=>`<div class="worker-card"><div><h5>${esc(w.name)}</h5><p>Clave ${esc(w.code||DEFAULTS.clave)} · ${esc(w.team||'Sin cuadrilla')}</p></div><button class="delete-worker" type="button" data-delete-worker="${w.id}">Borrar</button></div>`).join(''):'<div class="empty">No hay trabajadores registrados.</div>';
}
async function onWorkerChange(){
  const id=Number($('workerSelect').value);
  if(id){const w=(await getAll('workers')).find(x=>x.id===id);if(w){$('clave').value=w.code||DEFAULTS.clave;$('cuadrilla').value=w.team||''}}
  saveDraft();updateCalc();
}
function currentRecord(){
  const c=calc(),opt=$('workerSelect').selectedOptions[0];
  return{
    date:$('fecha').value,workerId:Number($('workerSelect').value),workerName:opt?.dataset?.name||'',
    code:$('clave').value.trim(),team:$('cuadrilla').value.trim(),piece:$('pieza').value.trim(),labor:$('labor').value.trim(),
    startTime:$('horaInicio').value,endTime:$('horaFin').value,minutes:c.minutes,hours:c.hours,
    towerStart:String($('torreInicio').value).padStart(2,'0'),towerEnd:String($('torreFin').value).padStart(2,'0'),
    totalTowers:c.towers,hectares:c.hectares,amount:c.amount,createdAt:new Date().toISOString()
  };
}
function entryHtml(r){
  const mins=Number(r.minutes??Math.round(Number(r.hours||0)*60));
  return `<div class="entry-card">
    <div><strong>${esc(r.workerName||'—')}</strong><small>${esc(r.labor||DEFAULTS.labor)} · Pieza ${esc(r.piece||DEFAULTS.pieza)}</small></div>
    <div><strong>${esc(r.startTime||'—')}–${esc(r.endTime||'—')}</strong><small>${humanMinutes(mins)}</small></div>
    <div><strong>${esc(r.towerStart||'—')}–${esc(r.towerEnd||'—')}</strong><small>${Number(r.totalTowers||0)} torres</small></div>
    <div><strong>${fmt2(r.hectares)} ha</strong><small>${money(r.amount??Number(r.hectares||0)*TARIFA_HECTAREA)}</small></div>
  </div>`;
}
async function renderDaily(){
  const date=$('jornadaDate').value||today();$('jornadaDate').value=date;
  const rows=(await getAll('records')).filter(r=>r.date===date).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  $('dailyEntries').innerHTML=rows.length?rows.map(entryHtml).join(''):'<div class="empty">No hay registros para esta fecha.</div>';
  const mins=rows.reduce((s,r)=>s+Number(r.minutes??Math.round(Number(r.hours||0)*60)),0);
  const towers=rows.reduce((s,r)=>s+Number(r.totalTowers||0),0);
  const ha=rows.reduce((s,r)=>s+Number(r.hectares||0),0);
  const amount=rows.reduce((s,r)=>s+Number(r.amount??Number(r.hectares||0)*TARIFA_HECTAREA),0);
  $('dailyHours').textContent=humanMinutes(mins);$('dailyTowers').textContent=towers;$('dailyHa').textContent=`${fmt2(ha)} ha`;$('dailyAmount').textContent=money(amount);
}
async function undoLast(){
  const date=$('jornadaDate').value||today();
  const rows=(await getAll('records')).filter(r=>r.date===date).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const last=rows.at(-1);if(!last)return alert('No hay registros para deshacer.');
  if(confirm(`¿Eliminar el último registro de ${last.workerName}?`)){await del('records',last.id);await renderDaily();await renderReport()}
}

function compactReportRow(r){
  const mins=Number(r.minutes??Math.round(Number(r.hours||0)*60));
  return{
    worker:`${r.workerName||'—'}\nClave: ${r.code||'—'} · ${r.team||'Sin cuadrilla'}`,
    schedule:`${r.startTime||'—'} - ${r.endTime||'—'}\n${humanMinutes(mins)}`,
    work:`${r.labor||DEFAULTS.labor}\nPieza: ${r.piece||DEFAULTS.pieza}`,
    towers:`${r.towerStart||'—'} - ${r.towerEnd||'—'}\n${Number(r.totalTowers||0)} torres`,
    hectares:fmt2(r.hectares),
    amount:money(r.amount??Number(r.hectares||0)*TARIFA_HECTAREA)
  };
}
function compactRowHtml(r){
  const c=compactReportRow(r),cell=v=>{const p=String(v).split('\n');return `<strong>${esc(p[0])}</strong>${p.slice(1).map(x=>`<small>${esc(x)}</small>`).join('')}`};
  return `<tr><td>${cell(c.worker)}</td><td>${cell(c.schedule)}</td><td>${cell(c.work)}</td><td>${cell(c.towers)}</td><td><strong>${esc(c.hectares)}</strong></td><td><strong>${esc(c.amount)}</strong></td></tr>`;
}
function compactTotalsHtml(r){return `<tr><td><strong>TOTALES</strong><small>${r.workers} trabajador${r.workers===1?'':'es'}</small></td><td><strong>${humanMinutes(r.mins)}</strong></td><td>—</td><td><strong>${r.towers}</strong><small>torres</small></td><td><strong>${fmt2(r.ha)}</strong></td><td><strong>${money(r.amount)}</strong></td></tr>`}
async function renderReport(){
  const date=$('reportDate').value||today();$('reportDate').value=date;
  const rows=(await getAll('records')).filter(r=>r.date===date);
  const block=await getSetting(SETTINGS.block,''),area=await getSetting(SETTINGS.area,'');
  const normalized=rows.map(r=>({...r,minutes:Number(r.minutes??Math.round(Number(r.hours||0)*60)),amount:Number(r.amount??Number(r.hectares||0)*TARIFA_HECTAREA)}));
  const report={date,rows:normalized,block:rows[0]?.block||block||'Sin definir',area:rows[0]?.supervisionArea!==undefined&&rows[0]?.supervisionArea!==''?`${fmt2(rows[0].supervisionArea)} ha`:(area!==''?`${fmt2(area)} ha`:'Sin definir')};
  report.mins=normalized.reduce((s,r)=>s+r.minutes,0);report.towers=normalized.reduce((s,r)=>s+Number(r.totalTowers||0),0);report.ha=normalized.reduce((s,r)=>s+Number(r.hectares||0),0);report.amount=normalized.reduce((s,r)=>s+r.amount,0);report.workers=new Set(normalized.map(r=>r.workerId||r.workerName)).size;
  $('reportContext').innerHTML=`<strong>Marco Tulio Castillo · Capataz deshoja</strong><br>Bloque: ${esc(report.block)} · Área de supervisión: ${esc(report.area)}<br>Fecha: ${esc(report.date)} · Tarifa: ₡4.350 por hectárea`;
  $('reportWorkers').textContent=report.workers;$('reportHours').textContent=humanMinutes(report.mins);$('reportTowers').textContent=report.towers;$('reportHa').textContent=`${fmt2(report.ha)} ha`;$('reportAmount').textContent=money(report.amount);
  $('reportTableBody').innerHTML=normalized.length?normalized.map(compactRowHtml).join(''):'<tr><td colspan="6">No hay registros para esta fecha.</td></tr>';
  $('reportTableFoot').innerHTML=normalized.length?compactTotalsHtml(report):'';
  return report;
}
function compactExportRows(rows){
  const br=v=>esc(String(v)).replace(/\n/g,'<br>');
  return rows.map(r=>{const c=compactReportRow(r);return `<tr><td>${br(c.worker)}</td><td>${br(c.schedule)}</td><td>${br(c.work)}</td><td>${br(c.towers)}</td><td>${esc(c.hectares)}</td><td>${esc(c.amount)}</td></tr>`}).join('');
}
function compactExportTotal(r){return `<tr class="total"><td>TOTALES<br>${r.workers} trabajador${r.workers===1?'':'es'}</td><td>${humanMinutes(r.mins)}</td><td>—</td><td>${r.towers} torres</td><td>${fmt2(r.ha)}</td><td>${money(r.amount)}</td></tr>`}
function downloadBlob(content,type,filename){const blob=new Blob(['\ufeff'+content],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
async function exportWord(){
  const r=await renderReport();
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:A4 portrait;margin:12mm}body{font-family:Arial;color:#1f2a25}h1{font-size:18pt;color:#173f36;margin:0}.meta{font-size:8.5pt;line-height:1.5;margin:8pt 0;border-bottom:2px solid #173f36;padding-bottom:7pt}.kpis{width:100%;border-collapse:separate;border-spacing:3pt;margin:7pt 0}.kpis td{background:#f1f6f3;border:1px solid #dce7e1;padding:6pt;text-align:center}.kpis small{display:block;font-size:6.5pt}.kpis strong{font-size:9pt;color:#173f36}table.data{width:100%;border-collapse:collapse;table-layout:fixed}table.data th{background:#eaf1ed;border:1px solid #cad7d0;padding:5pt 3pt;font-size:7pt}table.data td{border:1px solid #d9e2dd;padding:5pt 3pt;font-size:7.5pt;vertical-align:top;word-wrap:break-word}table.data th:nth-child(1){width:23%}table.data th:nth-child(2){width:15%}table.data th:nth-child(3){width:22%}table.data th:nth-child(4){width:17%}table.data th:nth-child(5){width:9%}table.data th:nth-child(6){width:14%}.total{background:#fff6d3;font-weight:bold}</style></head><body><h1>Libreta de Control de Cuadrilla</h1><div class="meta"><strong>Capataz:</strong> Marco Tulio Castillo, capataz deshoja<br><strong>Bloque:</strong> ${esc(r.block)} · <strong>Área:</strong> ${esc(r.area)}<br><strong>Fecha:</strong> ${esc(r.date)} · <strong>Tarifa:</strong> ₡4.350/ha</div><table class="kpis"><tr><td><small>Trabajadores</small><strong>${r.workers}</strong></td><td><small>Horas</small><strong>${humanMinutes(r.mins)}</strong></td><td><small>Torres</small><strong>${r.towers}</strong></td><td><small>Ha</small><strong>${fmt2(r.ha)}</strong></td><td><small>Monto</small><strong>${money(r.amount)}</strong></td></tr></table><table class="data"><thead><tr><th>Trabajador</th><th>Horario</th><th>Labor / Pieza</th><th>Torres</th><th>Ha</th><th>Monto</th></tr></thead><tbody>${compactExportRows(r.rows)}</tbody><tfoot>${compactExportTotal(r)}</tfoot></table></body></html>`;
  downloadBlob(html,'application/msword',`reporte_cuadrilla_${r.date}.doc`);
}
async function exportExcel(){
  const r=await renderReport();
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Arial;font-size:10pt}td,th{border:1px solid #c9d4ce;padding:7px;vertical-align:top}.title{font-size:17pt;font-weight:bold;color:#173f36}.meta{background:#eef4f1;font-weight:bold}.head{background:#173f36;color:#fff;font-weight:bold}.kpi{background:#eef4f1;font-weight:bold;text-align:center}.total{background:#fff6d3;font-weight:bold}</style></head><body><table><tr><td colspan="6" class="title">Libreta de Control de Cuadrilla</td></tr><tr><td colspan="6" class="meta">Capataz: Marco Tulio Castillo, capataz deshoja</td></tr><tr><td colspan="3" class="meta">Fecha: ${esc(r.date)}</td><td colspan="3" class="meta">Bloque: ${esc(r.block)}</td></tr><tr><td colspan="3" class="meta">Área: ${esc(r.area)}</td><td colspan="3" class="meta">Tarifa: ₡4.350/ha</td></tr><tr><td class="kpi">Trabajadores<br>${r.workers}</td><td class="kpi">Horas<br>${humanMinutes(r.mins)}</td><td class="kpi">Torres<br>${r.towers}</td><td class="kpi">Ha<br>${fmt2(r.ha)}</td><td colspan="2" class="total">Monto<br>${money(r.amount)}</td></tr><tr><th class="head">Trabajador</th><th class="head">Horario</th><th class="head">Labor / Pieza</th><th class="head">Torres</th><th class="head">Ha</th><th class="head">Monto</th></tr>${compactExportRows(r.rows)}${compactExportTotal(r)}</table></body></html>`;
  downloadBlob(html,'application/vnd.ms-excel',`reporte_cuadrilla_${r.date}.xls`);
}
async function shareReport(){
  const r=await renderReport(),email=await getSetting(SETTINGS.email,'');
  const text=`Libreta de Control de Cuadrilla\nFecha: ${r.date}\nCapataz: Marco Tulio Castillo, capataz deshoja\nBloque: ${r.block}\nÁrea: ${r.area}\nHoras: ${humanMinutes(r.mins)}\nTorres: ${r.towers}\nHectáreas: ${fmt2(r.ha)}\nMonto: ${money(r.amount)}`;
  if(navigator.share){try{await navigator.share({title:`Reporte cuadrilla ${r.date}`,text});return}catch{}}
  location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Reporte cuadrilla '+r.date)}&body=${encodeURIComponent(text)}`;
}
function switchView(id){
  document.querySelectorAll('.module').forEach(s=>s.classList.toggle('active',s.id===id));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  const meta={inicio:['Control de bloque','Configuración principal y trabajadores.'],jornada:['Jornada','Registro diario de horas y torres.'],reportes:['Reportes','Vista previa y exportación uniforme.'],ajustes:['Ajustes','Correo e instalación de la aplicación.']};
  $('pageTitle').textContent=meta[id][0];$('pageDesc').textContent=meta[id][1];
  if(id==='reportes')renderReport();if(id==='jornada')renderDaily();window.scrollTo({top:0,behavior:'smooth'});
}
function updateConnection(){const on=navigator.onLine;$('connectionDot').classList.toggle('online',on);$('connectionLabel').textContent=on?'En línea':'Sin conexión';$('connectionText').textContent=on?'En línea':'Trabajando sin conexión'}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('blockEditBtn').addEventListener('click',()=>savePersistentField('blockInput',SETTINGS.block,false));
$('areaEditBtn').addEventListener('click',()=>savePersistentField('areaInput',SETTINGS.area,true));
$('workerSearch').addEventListener('input',renderWorkers);
$('addWorkerBtn').addEventListener('click',async()=>{const name=$('workerName').value.trim();if(!name)return alert('Ingrese el nombre del trabajador.');await add('workers',{name,code:$('workerCode').value.trim()||DEFAULTS.clave,team:$('workerTeam').value.trim(),labor:DEFAULTS.labor});$('workerName').value='';$('workerTeam').value='';$('workerCode').value=DEFAULTS.clave;await renderWorkers()});
$('workerList').addEventListener('click',async e=>{const id=e.target.dataset.deleteWorker;if(id&&confirm('¿Borrar este trabajador de la base local?')){await del('workers',id);await renderWorkers()}});
$('workerSelect').addEventListener('change',onWorkerChange);
['fecha','clave','cuadrilla','pieza','labor','horaInicio','horaFin','torreInicio','torreFin'].forEach(id=>$(id).addEventListener('input',()=>{saveDraft();updateCalc()}));
$('recordForm').addEventListener('submit',async e=>{e.preventDefault();const r=currentRecord();if(!r.workerId)return alert('Seleccione un trabajador.');if(!r.startTime||!r.endTime)return alert('Ingrese hora inicio y hora fin.');if(!Number($('torreInicio').value)||!Number($('torreFin').value))return alert('Seleccione torre inicial y torre final.');r.block=await getSetting(SETTINGS.block,'');r.supervisionArea=await getSetting(SETTINGS.area,'');r.encargado='Marco Tulio Castillo, capataz deshoja';await add('records',r);resetForm(true);$('jornadaDate').value=r.date;await renderDaily();await renderReport()});
$('clearFormBtn').addEventListener('click',()=>{if(confirm('¿Limpiar el formulario actual?'))resetForm(true)});
$('jornadaDate').addEventListener('change',renderDaily);$('undoLastBtn').addEventListener('click',undoLast);
$('reportDate').addEventListener('change',renderReport);$('shareReportBtn').addEventListener('click',shareReport);$('printReportBtn').addEventListener('click',()=>window.print());$('wordReportBtn').addEventListener('click',exportWord);$('excelReportBtn').addEventListener('click',exportExcel);
$('saveEmailBtn').addEventListener('click',async()=>{await setSetting(SETTINGS.email,$('emailInput').value.trim());alert('Correo guardado.')});
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false;$('installBtnInside').hidden=false});
async function install(){if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true;$('installBtnInside').hidden=true}
$('installBtn').addEventListener('click',install);$('installBtnInside').addEventListener('click',install);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

(async()=>{
  await openDB();towerOptions();$('fecha').value=today();$('jornadaDate').value=today();$('reportDate').value=today();
  await loadSettings();await renderWorkers();restoreDraft();
  if(!$('fecha').value)$('fecha').value=today();if(!$('clave').value)$('clave').value=DEFAULTS.clave;if(!$('pieza').value)$('pieza').value=DEFAULTS.pieza;if(!$('labor').value)$('labor').value=DEFAULTS.labor;
  updateCalc();await renderDaily();await renderReport();updateConnection();
})();
