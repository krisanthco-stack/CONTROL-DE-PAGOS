
const DB_NAME='libreta_control_cuadrilla_pwa_v1',DB_VERSION=1;
const DRAFT_FORM_KEY='cuadrilla_mobile_form_draft_v1_2',DRAFT_ENTRIES_KEY='cuadrilla_mobile_entries_draft_v1_2';
const TARIFA_HECTAREA=4350,DEFAULTS={clave:'5969',pieza:'4350',labor:'Deshoja'};
const SETTINGS={block:'bloque_actual',area:'area_supervision_total',email:'correo_reporte'};
let db,deferredPrompt=null;
const $=id=>document.getElementById(id),today=()=>new Date().toISOString().slice(0,10),fmt2=n=>Number(n||0).toFixed(2),money=n=>'₡'+Math.round(Number(n||0)).toLocaleString('es-CR');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('workers'))d.createObjectStore('workers',{keyPath:'id',autoIncrement:true});if(!d.objectStoreNames.contains('records'))d.createObjectStore('records',{keyPath:'id',autoIncrement:true});if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'});};r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error)})}
const os=(n,m='readonly')=>db.transaction(n,m).objectStore(n);
function getAll(n){return new Promise((res,rej)=>{const r=os(n).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function add(n,o){return new Promise((res,rej)=>{const r=os(n,'readwrite').add(o);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(n,o){return new Promise((res,rej)=>{const r=os(n,'readwrite').put(o);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function del(n,id){return new Promise((res,rej)=>{const r=os(n,'readwrite').delete(Number(id));r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function getSetting(k,f=''){return new Promise((res,rej)=>{const r=os('settings').get(k);r.onsuccess=()=>res(r.result?.value??f);r.onerror=()=>rej(r.error)})}
const setSetting=(k,v)=>put('settings',{key:k,value:v});

function towerOptions(){const a=['<option value="">Seleccione</option>'];for(let i=1;i<=129;i++){const v=String(i).padStart(2,'0');a.push(`<option value="${i}">${v}</option>`)}$('torreInicio').innerHTML=a.join('');$('torreFin').innerHTML=a.join('')}
function towerCount(a,b){a=Number(a);b=Number(b);return a&&b?Math.abs(b-a)+1:0}
function minutesBetween(a,b){if(!a||!b)return 0;let [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number);let s=ah*60+am,e=bh*60+bm;if(e<s)e+=1440;return Math.max(0,e-s)}
function humanMinutes(m){return `${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')} min`}
function calc(){const minutes=minutesBetween($('horaInicio').value,$('horaFin').value),towers=towerCount($('torreInicio').value,$('torreFin').value),hectares=towers/10;return{minutes,hours:minutes/60,towers,hectares,amount:hectares*TARIFA_HECTAREA}}
function updatePreview(){const c=calc();$('hoursHuman').textContent=humanMinutes(c.minutes);$('hoursDecimal').textContent=`${fmt2(c.hours)} horas`;$('towerCount').textContent=c.towers;$('hectares').textContent=fmt2(c.hectares);$('amount').textContent=money(c.amount);$('previewLabor').textContent=$('labor').value||'—';$('previewPiece').textContent=$('pieza').value||'—';$('previewHours').textContent=humanMinutes(c.minutes);$('previewTowers').textContent=c.towers?`${String($('torreInicio').value).padStart(2,'0')} → ${String($('torreFin').value).padStart(2,'0')}`:'—';$('previewHa').textContent=`${fmt2(c.hectares)} ha`;$('previewAmount').textContent=money(c.amount)}

function saveFormDraft(){const d={fecha:$('fecha').value,workerSelect:$('workerSelect').value,clave:$('clave').value,cuadrilla:$('cuadrilla').value,pieza:$('pieza').value,labor:$('labor').value,horaInicio:$('horaInicio').value,horaFin:$('horaFin').value,torreInicio:$('torreInicio').value,torreFin:$('torreFin').value};localStorage.setItem(DRAFT_FORM_KEY,JSON.stringify(d))}
function restoreFormDraft(){try{const d=JSON.parse(localStorage.getItem(DRAFT_FORM_KEY)||'null');if(!d)return false;Object.entries(d).forEach(([k,v])=>{if($(k))$(k).value=v});return true}catch{return false}}
function resetForm(){const date=$('fecha').value||today();$('fieldForm').reset();$('fecha').value=date;$('clave').value=DEFAULTS.clave;$('pieza').value=DEFAULTS.pieza;$('labor').value=DEFAULTS.labor;$('cuadrilla').value='';localStorage.removeItem(DRAFT_FORM_KEY);updatePreview()}
function drafts(){try{return JSON.parse(localStorage.getItem(DRAFT_ENTRIES_KEY)||'[]')}catch{return[]}}
function setDrafts(a){localStorage.setItem(DRAFT_ENTRIES_KEY,JSON.stringify(a));renderDrafts()}
function currentData(){const c=calc(),opt=$('workerSelect').selectedOptions[0];return{id:Date.now()+Math.random(),date:$('fecha').value,workerId:Number($('workerSelect').value)||null,workerName:opt?.dataset?.name||opt?.textContent||'',code:$('clave').value.trim(),team:$('cuadrilla').value.trim(),piece:$('pieza').value.trim(),labor:$('labor').value.trim(),startTime:$('horaInicio').value,endTime:$('horaFin').value,minutes:c.minutes,hours:c.hours,towerStart:Number($('torreInicio').value)||0,towerEnd:Number($('torreFin').value)||0,totalTowers:c.towers,hectares:c.hectares,amount:c.amount,createdAt:new Date().toISOString()}}
function entryCard(r){const range=r.totalTowers?`${String(r.towerStart).padStart(2,'0')} → ${String(r.towerEnd).padStart(2,'0')}`:'Sin torres';return `<article class="entry-card"><div class="entry-top"><h3>${esc(r.workerName||'Trabajador')}</h3><span class="entry-time">${esc(r.startTime||'—')}–${esc(r.endTime||'—')}</span></div><div class="entry-meta"><span>${esc(r.labor||'—')}</span><span>Pieza ${esc(r.piece||'—')}</span><span>${humanMinutes(Number(r.minutes||0))}</span><span>Torres ${range}</span><span>${fmt2(r.hectares)} ha</span><span>${money(r.amount)}</span></div></article>`}
function renderDrafts(){const a=drafts();$('draftCount').textContent=a.length;$('draftEntries').innerHTML=a.length?a.slice().reverse().map(entryCard).join(''):'<div class="empty-state">Todavía no hay entradas guardadas.</div>';const mins=a.reduce((s,r)=>s+Number(r.minutes||0),0),ha=a.reduce((s,r)=>s+Number(r.hectares||0),0),amt=a.reduce((s,r)=>s+Number(r.amount||0),0);$('draftHours').textContent=humanMinutes(mins);$('draftHa').textContent=`${fmt2(ha)} ha`;$('draftAmount').textContent=money(amt);$('undoLastBtn').disabled=!a.length;$('finalizeBtn').disabled=!a.length}

async function renderWorkers(){const a=(await getAll('workers')).sort((x,y)=>String(x.name).localeCompare(String(y.name)));$('workerSelect').innerHTML='<option value="">Seleccione trabajador</option>'+a.map(w=>`<option value="${w.id}" data-name="${esc(w.name)}">${esc(w.name)}</option>`).join('');$('workerList').innerHTML=a.length?a.map(w=>`<div class="worker-row"><div><strong>${esc(w.name)}</strong><small>Clave ${esc(w.code||DEFAULTS.clave)} · ${esc(w.team||'Sin cuadrilla')}</small></div><button data-delete-worker="${w.id}">Eliminar</button></div>`).join(''):'<div class="empty-state">No hay trabajadores registrados.</div>'}
async function loadSettings(){const b=await getSetting(SETTINGS.block,''),a=await getSetting(SETTINGS.area,''),e=await getSetting(SETTINGS.email,'');$('blockInput').value=b;$('areaInput').value=a;$('emailInput').value=e;$('headerBlock').textContent=b||'Sin definir';$('headerArea').textContent=a!==''?`${fmt2(a)} ha supervisión`:'Área sin definir'}

async function finalize(){const a=drafts();if(!a.length)return;const block=await getSetting(SETTINGS.block,''),area=await getSetting(SETTINGS.area,'');for(const e of a){await add('records',{...e,towerStart:String(e.towerStart).padStart(2,'0'),towerEnd:String(e.towerEnd).padStart(2,'0'),block,supervisionArea:area,encargado:'Marco Tulio Castillo, capataz deshoja',finalizedAt:new Date().toISOString()})}localStorage.removeItem(DRAFT_ENTRIES_KEY);localStorage.removeItem(DRAFT_FORM_KEY);renderDrafts();resetForm();$('reportDate').value=a[0]?.date||today();await renderReport();switchScreen('screenResumen')}

function compactReportRow(r){
  const start=String(r.towerStart||'').padStart(2,'0');
  const end=String(r.towerEnd||'').padStart(2,'0');
  return {
    worker:`${r.workerName||'—'}\nClave: ${r.code||'—'} · ${r.team||'Sin cuadrilla'}`,
    schedule:`${r.startTime||'—'} - ${r.endTime||'—'}\n${humanMinutes(Number(r.minutes||0))}`,
    work:`${r.labor||'Deshoja'}\nPieza: ${r.piece||'4350'}`,
    towers:r.totalTowers?`${start} - ${end}\n${Number(r.totalTowers||0)} torres`:'—',
    hectares:fmt2(r.hectares),
    amount:money(r.amount)
  };
}

function compactRowHtml(r){
  const c=compactReportRow(r);
  const cell=v=>{
    const parts=String(v).split('\n');
    return `<strong>${esc(parts[0])}</strong>${parts.slice(1).map(x=>`<small>${esc(x)}</small>`).join('')}`;
  };
  return `<tr>
    <td>${cell(c.worker)}</td>
    <td>${cell(c.schedule)}</td>
    <td>${cell(c.work)}</td>
    <td>${cell(c.towers)}</td>
    <td><strong>${esc(c.hectares)}</strong></td>
    <td><strong>${esc(c.amount)}</strong></td>
  </tr>`;
}

function compactTotalsHtml(r){
  return `<tr class="total-row">
    <td><strong>TOTALES</strong><small>${r.workers} trabajador${r.workers===1?'':'es'}</small></td>
    <td><strong>${esc(humanMinutes(r.mins))}</strong></td>
    <td><strong>—</strong></td>
    <td><strong>${r.towers}</strong><small>torres</small></td>
    <td><strong>${fmt2(r.ha)}</strong></td>
    <td><strong>${esc(money(r.amount))}</strong></td>
  </tr>`;
}

async function renderReport(){
  const date=$('reportDate').value||today();
  $('reportDate').value=date;
  const rows=(await getAll('records')).filter(r=>r.date===date);
  const block=await getSetting(SETTINGS.block,''),area=await getSetting(SETTINGS.area,'');
  const effectiveBlock=rows[0]?.block||block||'Sin definir';
  const effectiveArea=rows[0]?.supervisionArea!==undefined&&rows[0]?.supervisionArea!==''?fmt2(rows[0].supervisionArea)+' ha':(area!==''?fmt2(area)+' ha':'Sin definir');

  const normalized=rows.map(r=>({
    ...r,
    minutes:Number(r.minutes??Math.round(Number(r.hours||0)*60)),
    amount:Number(r.amount??Number(r.hectares||0)*TARIFA_HECTAREA)
  }));

  // Keep capture order stable; identical data drives every output format.
  const mins=normalized.reduce((s,r)=>s+r.minutes,0);
  const towers=normalized.reduce((s,r)=>s+Number(r.totalTowers||0),0);
  const ha=normalized.reduce((s,r)=>s+Number(r.hectares||0),0);
  const amount=normalized.reduce((s,r)=>s+r.amount,0);
  const workers=new Set(normalized.map(r=>r.workerId||r.workerName)).size;

  const report={
    date,rows:normalized,mins,towers,ha,amount,workers,
    block:effectiveBlock,area:effectiveArea
  };

  $('reportContext').innerHTML=`<strong>Marco Tulio Castillo · Capataz deshoja</strong><br>Bloque: ${esc(report.block)} · Área de supervisión: ${esc(report.area)}<br>Fecha: ${esc(report.date)} · Tarifa: ₡4.350 por hectárea`;
  $('reportWorkers').textContent=workers;
  $('reportHours').textContent=humanMinutes(mins);
  $('reportTowers').textContent=towers;
  $('reportHa').textContent=`${fmt2(ha)} ha`;
  $('reportAmount').textContent=money(amount);

  $('reportList').innerHTML=normalized.length
    ? normalized.map(entryCard).join('')
    : '<div class="empty-state">No hay reporte finalizado para esta fecha.</div>';

  $('reportTableBody').innerHTML=normalized.length
    ? normalized.map(compactRowHtml).join('')
    : '<tr><td colspan="6">No hay registros para esta fecha.</td></tr>';

  $('reportTableFoot').innerHTML=normalized.length?compactTotalsHtml(report):'';

  return report;
}
async function shareReport(){const r=await renderReport(),email=await getSetting(SETTINGS.email,''),body=['Libreta de Control de Cuadrilla',`Fecha: ${r.date}`,'Capataz: Marco Tulio Castillo, capataz deshoja',`Horas: ${humanMinutes(r.mins)}`,`Torres: ${r.towers}`,`Hectáreas: ${fmt2(r.ha)}`,`Monto: ${money(r.amount)}`,'',...r.rows.map(x=>`${x.workerName}: ${humanMinutes(Number(x.minutes??Math.round(Number(x.hours||0)*60)))} · ${x.totalTowers||0} torres · ${fmt2(x.hectares)} ha · ${money(x.amount??Number(x.hectares||0)*TARIFA_HECTAREA)}`)].join('\n');if(navigator.share){try{await navigator.share({title:`Reporte cuadrilla ${r.date}`,text:body});return}catch{}}location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Reporte cuadrilla '+r.date)}&body=${encodeURIComponent(body)}`}
function compactExportRows(rows){
  return rows.map(r=>{
    const c=compactReportRow(r);
    const br=v=>esc(String(v)).replace(/\n/g,'<br>');
    return `<tr>
      <td>${br(c.worker)}</td>
      <td>${br(c.schedule)}</td>
      <td>${br(c.work)}</td>
      <td>${br(c.towers)}</td>
      <td>${esc(c.hectares)}</td>
      <td>${esc(c.amount)}</td>
    </tr>`;
  }).join('');
}

function compactExportTotal(r){
  return `<tr class="total">
    <td>TOTALES<br>${r.workers} trabajador${r.workers===1?'':'es'}</td>
    <td>${esc(humanMinutes(r.mins))}</td>
    <td>—</td>
    <td>${r.towers} torres</td>
    <td>${fmt2(r.ha)}</td>
    <td>${esc(money(r.amount))}</td>
  </tr>`;
}

function downloadBlob(content,type,filename){
  const blob=new Blob(['\ufeff'+content],{type});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

async function exportWord(){
  const r=await renderReport();
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{size:A4 portrait;margin:12mm}
    body{font-family:Arial,sans-serif;color:#1f2a25;margin:0}
    h1{font-size:18pt;color:#153f35;margin:0 0 3pt}
    h2{font-size:10pt;color:#68746f;margin:0 0 9pt;text-transform:uppercase}
    .meta{font-size:8.5pt;line-height:1.5;margin-bottom:10pt;border-bottom:2px solid #153f35;padding-bottom:7pt}
    .kpis{width:100%;border-collapse:separate;border-spacing:3pt;margin:7pt 0 10pt}
    .kpis td{background:#f1f6f3;border:1px solid #dce7e1;padding:6pt;text-align:center}
    .kpis small{display:block;color:#66736d;font-size:6.5pt;text-transform:uppercase}
    .kpis strong{display:block;margin-top:2pt;color:#153f35;font-size:9pt}
    .kpis .totalbox{background:#fff4c5}
    table.data{width:100%;border-collapse:collapse;table-layout:fixed}
    table.data th{background:#eaf1ed;color:#314c40;border:1px solid #cad7d0;padding:5pt 3pt;font-size:7pt}
    table.data td{border:1px solid #d9e2dd;padding:5pt 3pt;vertical-align:top;font-size:7.5pt;line-height:1.3;word-wrap:break-word}
    table.data th:nth-child(1){width:23%} table.data th:nth-child(2){width:15%}
    table.data th:nth-child(3){width:22%} table.data th:nth-child(4){width:17%}
    table.data th:nth-child(5){width:9%} table.data th:nth-child(6){width:14%}
    .total{font-weight:bold;background:#fff4c5}
  </style></head><body>
    <h1>Libreta de Control de Cuadrilla</h1>
    <h2>Reporte diario</h2>
    <div class="meta"><strong>Capataz:</strong> Marco Tulio Castillo, capataz deshoja<br>
      <strong>Bloque:</strong> ${esc(r.block)} &nbsp; · &nbsp;
      <strong>Área de supervisión:</strong> ${esc(r.area)}<br>
      <strong>Fecha:</strong> ${esc(r.date)} &nbsp; · &nbsp;
      <strong>Tarifa:</strong> ₡4.350 por hectárea
    </div>
    <table class="kpis"><tr>
      <td><small>Trabajadores</small><strong>${r.workers}</strong></td>
      <td><small>Horas</small><strong>${humanMinutes(r.mins)}</strong></td>
      <td><small>Torres</small><strong>${r.towers}</strong></td>
      <td><small>Hectáreas</small><strong>${fmt2(r.ha)} ha</strong></td>
      <td class="totalbox"><small>Monto total</small><strong>${money(r.amount)}</strong></td>
    </tr></table>
    <table class="data">
      <thead><tr><th>Trabajador</th><th>Horario</th><th>Labor / Pieza</th><th>Torres</th><th>Ha</th><th>Monto</th></tr></thead>
      <tbody>${compactExportRows(r.rows)}</tbody>
      <tfoot>${compactExportTotal(r)}</tfoot>
    </table>
  </body></html>`;
  downloadBlob(html,'application/msword',`reporte_cuadrilla_${r.date}.doc`);
}

async function exportExcel(){
  const r=await renderReport();
  // SpreadsheetML/HTML-compatible .xls: same six-column report as PDF and Word.
  const html=`<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="UTF-8"><style>
    table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:10pt}
    td,th{border:1px solid #c9d4ce;padding:7px;vertical-align:top}
    .title{font-size:17pt;font-weight:bold;color:#153f35;border:0}
    .subtitle{font-size:10pt;font-weight:bold;color:#65736c;border:0}
    .meta{font-weight:bold;background:#eef4f1}
    .head{background:#153f35;color:#fff;font-weight:bold;text-align:center}
    .kpi{background:#eef4f1;font-weight:bold;text-align:center}
    .money{background:#fff4c5;font-weight:bold}
    .total{background:#fff4c5;font-weight:bold}
  </style></head><body><table>
    <tr><td colspan="6" class="title">Libreta de Control de Cuadrilla</td></tr>
    <tr><td colspan="6" class="subtitle">Reporte diario</td></tr>
    <tr><td colspan="6" class="meta">Capataz: Marco Tulio Castillo, capataz deshoja</td></tr>
    <tr><td colspan="3" class="meta">Fecha: ${esc(r.date)}</td><td colspan="3" class="meta">Bloque: ${esc(r.block)}</td></tr>
    <tr><td colspan="3" class="meta">Área de supervisión: ${esc(r.area)}</td><td colspan="3" class="meta">Tarifa: ₡4.350/ha</td></tr>
    <tr>
      <td class="kpi">Trabajadores<br>${r.workers}</td>
      <td class="kpi">Horas<br>${esc(humanMinutes(r.mins))}</td>
      <td class="kpi">Torres<br>${r.towers}</td>
      <td class="kpi">Hectáreas<br>${fmt2(r.ha)} ha</td>
      <td colspan="2" class="money">Monto total<br>${esc(money(r.amount))}</td>
    </tr>
    <tr><th class="head">Trabajador</th><th class="head">Horario</th><th class="head">Labor / Pieza</th><th class="head">Torres</th><th class="head">Ha</th><th class="head">Monto</th></tr>
    ${compactExportRows(r.rows)}
    ${compactExportTotal(r)}
  </table></body></html>`;
  downloadBlob(html,'application/vnd.ms-excel',`reporte_cuadrilla_${r.date}.xls`);
}

function switchScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='screenResumen')renderReport()}
function updateConnection(){$('onlineBadge').classList.toggle('online',navigator.onLine)}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>switchScreen(b.dataset.screen)));
['fecha','clave','cuadrilla','pieza','labor','horaInicio','horaFin','torreInicio','torreFin'].forEach(id=>$(id).addEventListener('input',()=>{saveFormDraft();updatePreview()}));
$('workerSelect').addEventListener('change',async()=>{const id=Number($('workerSelect').value);if(id){const w=(await getAll('workers')).find(x=>x.id===id);if(w){$('clave').value=w.code||DEFAULTS.clave;$('cuadrilla').value=w.team||''}}saveFormDraft();updatePreview()});
$('fieldForm').addEventListener('submit',e=>{e.preventDefault();const d=currentData();if(!d.workerId)return alert('Seleccione un trabajador.');if(!d.startTime||!d.endTime)return alert('Ingrese hora inicio y hora fin.');if(!d.towerStart||!d.towerEnd)return alert('Seleccione torre inicial y torre final.');const a=drafts();a.push(d);setDrafts(a);resetForm()});
$('undoLastBtn').addEventListener('click',()=>{const a=drafts();if(a.length){a.pop();setDrafts(a)}});
$('finalizeBtn').addEventListener('click',()=>{if(confirm('¿Finalizar el reporte del día?'))finalize()});
$('clearFormBtn').addEventListener('click',()=>{if(confirm('¿Limpiar el formulario actual?'))resetForm()});
$('refreshPreviewBtn').addEventListener('click',updatePreview);
$('reportDate').addEventListener('change',renderReport);$('shareReportBtn').addEventListener('click',shareReport);$('printReportBtn').addEventListener('click',()=>window.print());$('wordReportBtn').addEventListener('click',exportWord);$('excelReportBtn').addEventListener('click',exportExcel);
$('saveSettingsBtn').addEventListener('click',async()=>{await setSetting(SETTINGS.block,$('blockInput').value.trim());await setSetting(SETTINGS.area,$('areaInput').value.trim());await setSetting(SETTINGS.email,$('emailInput').value.trim());await loadSettings();alert('Configuración guardada.')});
$('addWorkerBtn').addEventListener('click',async()=>{const name=$('workerName').value.trim();if(!name)return alert('Ingrese el nombre del trabajador.');await add('workers',{name,code:$('workerCode').value.trim()||DEFAULTS.clave,team:$('workerTeam').value.trim(),labor:DEFAULTS.labor});$('workerName').value='';$('workerTeam').value='';$('workerCode').value=DEFAULTS.clave;await renderWorkers()});
$('workerList').addEventListener('click',async e=>{const id=e.target.dataset.deleteWorker;if(id&&confirm('¿Eliminar trabajador?')){await del('workers',id);await renderWorkers()}});
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});
$('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

(async()=>{await openDB();towerOptions();$('fecha').value=today();$('reportDate').value=today();await renderWorkers();await loadSettings();restoreFormDraft();if(!$('fecha').value)$('fecha').value=today();if(!$('clave').value)$('clave').value=DEFAULTS.clave;if(!$('pieza').value)$('pieza').value=DEFAULTS.pieza;if(!$('labor').value)$('labor').value=DEFAULTS.labor;renderDrafts();updatePreview();updateConnection()})();
