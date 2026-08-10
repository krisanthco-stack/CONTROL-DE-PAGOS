const ENCARGADO_FIJO = 'Marco Tulio Castillo, capataz deshoja';
    const TARIFA_HECTAREA = 4350;
    const DB_NAME = 'libreta_control_cuadrilla_pwa_v1';
    const DB_VERSION = 1;
    const SETTINGS = { bloque: 'bloque_actual', area: 'area_supervision_total', email: 'correo_reporte' };
    let db, deferredPrompt = null;

    const $ = (id) => document.getElementById(id);
    const today = () => new Date().toISOString().slice(0,10);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#039;'}[m]));
    const fmt2 = (n) => Number(n || 0).toFixed(2);

    function showView(view){
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const section = document.getElementById(view);
      if(section) section.classList.add('active');
      document.querySelectorAll(`.nav-btn[data-view="${view}"]`).forEach(b => b.classList.add('active'));
      const meta = {
        inicio:['Control de bloque','Capataz, bloque, área total de supervisión y base de trabajadores.'],
        jornada:['Jornada','Registro rápido en campo y resultados por trabajador.'],
        reportes:['Reportes','Generación, descarga y envío del informe final.'],
        ajustes:['Ajustes','Configuración del correo para los reportes.']
      };
      $('pageTitle').textContent = meta[view][0];
      $('pageDesc').textContent = meta[view][1];
      if(view === 'reportes') renderReports();
    }

    async function openDB(){
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const d = e.target.result;
          if(!d.objectStoreNames.contains('workers')){
            const s = d.createObjectStore('workers', { keyPath: 'id', autoIncrement: true });
            s.createIndex('name', 'name', { unique: false });
          }
          if(!d.objectStoreNames.contains('records')){
            const s = d.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
            s.createIndex('date', 'date', { unique: false });
          }
          if(!d.objectStoreNames.contains('settings')){
            d.createObjectStore('settings', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => { db = req.result; resolve(db); };
        req.onerror = () => reject(req.error);
      });
    }

    function txStore(name, mode='readonly'){
      return db.transaction(name, mode).objectStore(name);
    }
    function getAll(store){
      return new Promise((resolve, reject) => {
        const req = txStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }
    function put(store, obj){
      return new Promise((resolve, reject) => {
        const req = txStore(store, 'readwrite').put(obj);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    function add(store, obj){
      return new Promise((resolve, reject) => {
        const req = txStore(store, 'readwrite').add(obj);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    function removeItem(store, id){
      return new Promise((resolve, reject) => {
        const req = txStore(store, 'readwrite').delete(Number(id));
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    }
    async function getSetting(key, fallback=''){
      return new Promise((resolve, reject) => {
        const req = txStore('settings').get(key);
        req.onsuccess = () => resolve(req.result?.value ?? fallback);
        req.onerror = () => reject(req.error);
      });
    }
    async function setSetting(key, value){
      return put('settings', { key, value });
    }

    function parseTower(value){
      const s = String(value || '').trim().toUpperCase();
      if(!s) return null;
      const m = s.match(/^(.*?)(\d+)$/);
      if(!m) return null;
      return { prefix: m[1].replace(/[\s_-]+$/,''), number: Number(m[2]) };
    }
    function computeTowers(start, end){
      const a = parseTower(start);
      const b = parseTower(end);
      if(!a || !b || a.prefix !== b.prefix) return 0;
      return Math.abs(b.number - a.number) + 1;
    }

    function computeHours(start, end){
      if(!start || !end) return 0;
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      if([sh, sm, eh, em].some(Number.isNaN)) return 0;
      let startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;
      if(endMin < startMin) endMin += 24 * 60;
      return Math.max(0, (endMin - startMin) / 60);
    }

    function formatCRC(value){
      return '₡' + Math.round(Number(value || 0)).toLocaleString('es-CR');
    }

    function aggregateByWorker(rows){
      const map = new Map();
      rows.forEach(r => {
        const key = `${r.workerId}|${r.workerName}`;
        if(!map.has(key)){
          map.set(key, {
            workerName: r.workerName,
            code: r.code,
            team: r.team,
            towers: 0,
            hectares: 0,
            hours: 0,
            amount: 0,
            details: new Set()
          });
        }
        const item = map.get(key);
        item.towers += Number(r.totalTowers || 0);
        item.hectares += Number(r.hectares || 0);
        item.hours += Number(r.hours || 0);
        item.amount += Number(r.amount ?? (Number(r.hectares || 0) * TARIFA_HECTAREA));
        if(r.activity) item.details.add(r.activity);
      });
      return [...map.values()].sort((a,b) => a.workerName.localeCompare(b.workerName));
    }

    async function refreshWorkerSelect(){
      const workers = await getAll('workers');
      $('workerSelect').innerHTML = '<option value="">Seleccione…</option>' + workers
        .sort((a,b)=>a.name.localeCompare(b.name))
        .map(w => `<option value="${w.id}">${esc(w.name)} · ${esc(w.code)}</option>`).join('');
    }

    async function renderWorkers(){
      const workers = await getAll('workers');
      await refreshWorkerSelect();
      const q = $('workerSearch').value.trim().toLowerCase();
      const filtered = workers.filter(w => [w.name,w.code,w.team,w.labor].join(' ').toLowerCase().includes(q));

      $('workerList').innerHTML = filtered.length ? filtered.map(w => `
        <div class="worker-item">
          <div>
            <h4>${esc(w.name)}</h4>
            <p><strong>Clave:</strong> ${esc(w.code)} · <strong>Cuadrilla:</strong> ${esc(w.team)}</p>
            <p><strong>Labor base:</strong> ${esc(w.labor || '—')}</p>
          </div>
          <div class="mini-actions">
            <button class="btn secondary" onclick="editWorker(${w.id})">Editar</button>
            <button class="btn danger" onclick="deleteWorker(${w.id})">Eliminar</button>
          </div>
        </div>
      `).join('') : '<div class="empty">No hay trabajadores registrados.</div>';
    }

    window.editWorker = async (id) => {
      const workers = await getAll('workers');
      const w = workers.find(x => x.id === id);
      if(!w) return;
      $('workerId').value = w.id;
      $('workerName').value = w.name;
      $('workerCode').value = w.code;
      $('workerTeam').value = w.team;
      $('workerLabor').value = w.labor || '';
      showView('inicio');
      window.scrollTo({ top:0, behavior:'smooth' });
    };

    window.deleteWorker = async (id) => {
      if(confirm('¿Eliminar este trabajador de la base local?')){
        await removeItem('workers', id);
        await renderAll();
      }
    };

    async function workerAutofill(){
      const workers = await getAll('workers');
      const w = workers.find(x => x.id === Number($('workerSelect').value));
      $('claveAuto').value = w?.code || '';
      $('cuadrillaAuto').value = w?.team || '';
      $('laborAuto').value = w?.labor || '';
    }

    function updateComputedResult(){
      const towers = computeTowers($('torreInicial').value, $('torreFinal').value);
      const hectares = towers / 10;
      const hours = computeHours($('horaInicio').value, $('horaFinal').value);
      const amount = hectares * TARIFA_HECTAREA;
      $('torresCalc').textContent = towers;
      $('haCalc').textContent = fmt2(hectares);
      $('horasCalc').textContent = fmt2(hours);
      $('montoCalc').textContent = formatCRC(amount);
    }

    async function renderDaily(){
      const date = $('jornadaDate').value || today();
      $('jornadaDate').value = date;
      const records = (await getAll('records')).filter(r => r.date === date).sort((a,b)=>a.workerName.localeCompare(b.workerName));
      const block = await getSetting(SETTINGS.bloque, '');
      $('recordsTable').innerHTML = records.length ? records.map(r => `
        <tr>
          <td>${esc(r.date)}</td>
          <td>${esc(r.block || block || 'Sin definir')}</td>
          <td>${esc(r.workerName)}</td>
          <td>${esc(r.code)}</td>
          <td>${esc(r.team)}</td>
          <td>${esc(r.labor)}</td>
          <td>${esc(r.startTime || '')}</td>
          <td>${esc(r.endTime || '')}</td>
          <td>${fmt2(r.hours || 0)}</td>
          <td>${esc(r.towerStart)}</td>
          <td>${esc(r.towerEnd)}</td>
          <td>${esc(r.totalTowers)}</td>
          <td>${fmt2(r.hectares)}</td>
          <td>${formatCRC(r.amount ?? (Number(r.hectares || 0) * TARIFA_HECTAREA))}</td>
          <td>${esc(r.activity)}</td>
        </tr>
      `).join('') : '<tr><td colspan="15" class="empty">No hay registros para esta fecha.</td></tr>';

      const agg = aggregateByWorker(records);
      $('jornadaSummary').innerHTML = agg.length ? agg.map(a => `
        <div class="summary-card">
          <h4>${esc(a.workerName)}</h4>
          <p><strong>Clave:</strong> ${esc(a.code)} · <strong>Cuadrilla:</strong> ${esc(a.team)}</p>
          <p><strong>Total torres:</strong> ${a.towers}</p>
          <p><strong>Total hectáreas:</strong> ${fmt2(a.hectares)} ha</p>
          <p><strong>Total horas:</strong> ${fmt2(a.hours)}</p>
          <p><strong>Monto:</strong> ${formatCRC(a.amount)}</p>
          <p><strong>Detalle:</strong> ${esc([...a.details].join(' | ') || '—')}</p>
        </div>
      `).join('') : '<div class="empty">Sin resultados para la fecha seleccionada.</div>';
    }


    async function renderReports(){
      const date = $('reportDate').value || today();
      $('reportDate').value = date;
      const rows = (await getAll('records')).filter(r => r.date === date).sort((a,b)=>a.workerName.localeCompare(b.workerName));
      const currentBlock = await getSetting(SETTINGS.bloque, '');
      const currentArea = await getSetting(SETTINGS.area, '');
      const block = rows.length ? (rows[0].block || currentBlock) : currentBlock;
      const area = rows.length ? (rows[0].supervisionArea ?? currentArea) : currentArea;
      $('reportBlockText').textContent = block || 'Sin definir';
      $('reportAreaText').textContent = area !== '' && area !== null ? `${fmt2(area)} ha` : 'Sin definir';

      $('reportRows').innerHTML = rows.length ? rows.map(r => `
        <tr>
          <td>${esc(r.workerName)}</td><td>${esc(r.code)}</td><td>${esc(r.team)}</td><td>${esc(r.labor)}</td>
          <td>${esc(r.startTime || '')}</td><td>${esc(r.endTime || '')}</td><td>${fmt2(r.hours || 0)}</td>
          <td>${esc(r.piece)}</td><td>${esc(r.work)}</td><td>${esc(r.cable)}</td><td>${esc(r.terrain)}</td>
          <td>${esc(r.towerStart)}</td><td>${esc(r.towerEnd)}</td><td>${esc(r.totalTowers)}</td>
          <td>${fmt2(r.hectares)}</td><td>${formatCRC(r.amount ?? (Number(r.hectares || 0) * TARIFA_HECTAREA))}</td><td>${esc(r.activity)}</td>
        </tr>
      `).join('') : '<tr><td colspan="17" class="empty">No hay registros para la fecha seleccionada.</td></tr>';

      const agg = aggregateByWorker(rows);
      $('reportTotals').innerHTML = agg.length ? agg.map(a => `
        <tr>
          <td>${esc(a.workerName)}</td><td>${esc(a.code)}</td><td>${esc(a.team)}</td>
          <td><strong>${fmt2(a.hours)}</strong></td>
          <td><strong>${a.towers}</strong></td><td><strong>${fmt2(a.hectares)} ha</strong></td>
          <td><strong>${formatCRC(a.amount)}</strong></td>
          <td>${esc([...a.details].join(' | ') || '—')}</td>
        </tr>
      `).join('') : '<tr><td colspan="8" class="empty">No hay totales para esta fecha.</td></tr>';
    }

    async function renderAll(){
      await renderWorkers();
      await renderDaily();
      await renderReports();
      await loadSettingsIntoUI();
    }

    async function loadSettingsIntoUI(){
      const block = await getSetting(SETTINGS.bloque, '');
      const area = await getSetting(SETTINGS.area, '');
      const email = await getSetting(SETTINGS.email, '');

      $('inicioBlockInput').value = block || '';
      $('supervisionAreaInput').value = area === '' ? '' : area;
      $('emailInput').value = email || '';
      $('reportBlockText').textContent = block || 'Sin definir';
      $('reportAreaText').textContent = area === '' ? 'Sin definir' : `${fmt2(area)} ha`;

      setPersistentFieldState('inicioBlockInput', 'blockEditBtn', Boolean(block));
      setPersistentFieldState('supervisionAreaInput', 'areaEditBtn', area !== '' && area !== null);
    }

    function setPersistentFieldState(inputId, buttonId, saved){
      const input = $(inputId);
      const button = $(buttonId);
      input.readOnly = saved;
      button.textContent = saved ? 'Editar' : 'Guardar';
      button.classList.toggle('secondary', saved);
      button.classList.toggle('primary', !saved);
    }

    async function handlePersistentEdit(inputId, buttonId, settingKey, type='text'){
      const input = $(inputId);
      const button = $(buttonId);

      if(input.readOnly){
        input.readOnly = false;
        input.focus();
        button.textContent = 'Guardar';
        button.classList.remove('secondary');
        button.classList.add('primary');
        return;
      }

      const raw = input.value.trim();
      if(!raw){
        alert(type === 'number' ? 'Ingrese el área total de supervisión.' : 'Ingrese el bloque actual.');
        return;
      }

      if(type === 'number' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)){
        alert('Ingrese un área válida.');
        return;
      }

      await setSetting(settingKey, type === 'number' ? Number(raw) : raw);
      await loadSettingsIntoUI();
      await renderReports();
      alert(type === 'number'
        ? 'Área total de supervisión guardada. Permanecerá vigente hasta que sea editada.'
        : 'Bloque actual guardado. Permanecerá vigente hasta que sea editado.');
    }

    function buildRowsForDate(rows){
      return rows.map(r => [
        r.date,
        r.block || '',
        r.supervisionArea ?? '',
        ENCARGADO_FIJO,
        r.workerName,
        r.code,
        r.team,
        r.labor,
        r.startTime || '',
        r.endTime || '',
        fmt2(r.hours || 0),
        r.piece,
        r.work,
        r.cable,
        r.terrain,
        r.towerStart,
        r.towerEnd,
        r.totalTowers,
        fmt2(r.hectares),
        Math.round(Number(r.amount ?? (Number(r.hectares || 0) * TARIFA_HECTAREA))),
        r.activity
      ]);
    }

    function buildEmailText(date, block, area, rows){
      const agg = aggregateByWorker(rows);
      let text = `Libreta de Control de Cuadrilla
Fecha: ${date}
Encargado del bloque: ${ENCARGADO_FIJO}
Bloque: ${block || 'Sin definir'}
Área total de supervisión: ${area !== '' && area !== null ? fmt2(area) + ' ha' : 'Sin definir'}

`;
      text += 'Totales por trabajador:\n';
      if(!agg.length){
        text += '- Sin registros para la fecha seleccionada.\n';
      } else {
        agg.forEach(a => {
          text += `- ${a.workerName} | Horas: ${fmt2(a.hours)} | Torres: ${a.towers} | Hectáreas: ${fmt2(a.hectares)} | Monto: ${formatCRC(a.amount)} | Detalle: ${[...a.details].join(' | ')}\n`;
        });
      }
      return text;
    }

    async function getReportRows(){
      const date = $('reportDate').value || today();
      const rows = (await getAll('records')).filter(r => r.date === date).sort((a,b)=>a.workerName.localeCompare(b.workerName));
      const currentBlock = await getSetting(SETTINGS.bloque, '');
      const currentArea = await getSetting(SETTINGS.area, '');
      const block = rows.length ? (rows[0].block || currentBlock) : currentBlock;
      const area = rows.length ? (rows[0].supervisionArea ?? currentArea) : currentArea;
      return { date, rows, block, area };
    }

    async function exportCSV(){
      const { date, rows } = await getReportRows();
      const headers = ['Fecha','Bloque','Área total de supervisión (ha)','Encargado del bloque','Trabajador','Clave','Cuadrilla','Labor','Hora inicial','Hora final','Horas','Pieza','Obra','Cable','Terreno','Torre inicial','Torre final','Torres','Hectáreas','Monto CRC','Actividad'];
      const body = buildRowsForDate(rows);
      const csv = [headers, ...body]
        .map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `control_cuadrilla_${date}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    async function exportWord(){
      const { date, rows, block, area } = await getReportRows();
      const rowHtml = rows.map(r => `
        <tr>
          <td>${esc(r.workerName)}</td><td>${esc(r.code)}</td><td>${esc(r.team)}</td><td>${esc(r.labor)}</td>
          <td>${esc(r.startTime || '')}</td><td>${esc(r.endTime || '')}</td><td>${fmt2(r.hours || 0)}</td>
          <td>${esc(r.piece)}</td><td>${esc(r.work)}</td><td>${esc(r.cable)}</td><td>${esc(r.terrain)}</td>
          <td>${esc(r.towerStart)}</td><td>${esc(r.towerEnd)}</td><td>${esc(r.totalTowers)}</td>
          <td>${fmt2(r.hectares)}</td><td>${formatCRC(r.amount ?? (Number(r.hectares || 0) * TARIFA_HECTAREA))}</td><td>${esc(r.activity)}</td>
        </tr>`).join('');
      const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body{font-family:Arial;padding:18px} table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #999;padding:6px;font-size:10pt;vertical-align:top} h2{margin:0 0 8px}
        p{margin:0 0 6px}
      </style></head><body>
      <h2>Libreta de Control de Cuadrilla</h2>
      <p><strong>Encargado del bloque:</strong> ${esc(ENCARGADO_FIJO)}</p>
      <p><strong>Bloque:</strong> ${esc(block || 'Sin definir')}</p>
      <p><strong>Área total de supervisión:</strong> ${area !== '' && area !== null ? esc(fmt2(area)) + ' ha' : 'Sin definir'}</p>
      <p><strong>Fecha:</strong> ${esc(date)}</p>
      <table><tr>
      <th>Trabajador</th><th>Clave</th><th>Cuadrilla</th><th>Labor</th><th>Hora inicial</th><th>Hora final</th><th>Horas</th><th>Pieza</th><th>Obra</th><th>Cable</th><th>Terreno</th><th>Torre inicial</th><th>Torre final</th><th>Torres</th><th>Hectáreas</th><th>Monto</th><th>Actividad</th>
      </tr>${rowHtml}</table></body></html>`;
      const blob = new Blob(['\ufeff' + doc], { type: 'application/msword' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `control_cuadrilla_${date}.doc`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    async function sendByEmail(){
      const { date, rows, block, area } = await getReportRows();
      const to = await getSetting(SETTINGS.email, '');
      const subject = encodeURIComponent(`Reporte Libreta de Control de Cuadrilla - ${date}`);
      const body = encodeURIComponent(buildEmailText(date, block, area, rows));
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
      if(navigator.share){
        try{
          await navigator.share({
            title: `Reporte de cuadrilla ${date}`,
            text: buildEmailText(date, block, area, rows)
          });
          return;
        }catch(e){}
      }
      window.location.href = mailto;
    }

    function updateOnlineState(){
      $('onlineState').textContent = navigator.onLine ? 'En línea' : 'Sin conexión';
      $('onlineState').className = 'online-state ' + (navigator.onLine ? 'ok' : 'off');
    }

    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
    $('syncBtn').addEventListener('click', () => renderAll());
    $('jornadaDate').addEventListener('change', renderDaily);
    $('reportDate').addEventListener('change', renderReports);
    $('workerSearch').addEventListener('input', renderWorkers);
    $('workerSelect').addEventListener('change', workerAutofill);
    $('torreInicial').addEventListener('input', updateComputedResult);
    $('torreFinal').addEventListener('input', updateComputedResult);
    $('horaInicio').addEventListener('input', updateComputedResult);
    $('horaFinal').addEventListener('input', updateComputedResult);
    $('csvBtn').addEventListener('click', exportCSV);
    $('wordBtn').addEventListener('click', exportWord);
    $('printBtn').addEventListener('click', () => window.print());
    $('emailBtn').addEventListener('click', sendByEmail);
    $('blockEditBtn').addEventListener('click', () => handlePersistentEdit('inicioBlockInput', 'blockEditBtn', SETTINGS.bloque, 'text'));
    $('areaEditBtn').addEventListener('click', () => handlePersistentEdit('supervisionAreaInput', 'areaEditBtn', SETTINGS.area, 'number'));

    $('clearWorkerBtn').addEventListener('click', () => {
      $('workerId').value = '';
      $('workerForm').reset();
    });

    $('workerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const obj = {
        name: $('workerName').value.trim(),
        code: $('workerCode').value.trim(),
        team: $('workerTeam').value.trim(),
        labor: $('workerLabor').value.trim()
      };
      if($('workerId').value) obj.id = Number($('workerId').value);
      await put('workers', obj);
      $('workerForm').reset();
      $('workerId').value = '';
      await renderAll();
      alert('Trabajador guardado correctamente.');
    });

    $('clearRecordBtn').addEventListener('click', () => {
      $('recordForm').reset();
      $('fecha').value = today();
      $('recordId').value = '';
      $('torresCalc').textContent = '0';
      $('haCalc').textContent = '0.00';
      $('horasCalc').textContent = '0.00';
      $('montoCalc').textContent = '₡0';
      $('claveAuto').value = '';
      $('cuadrillaAuto').value = '';
      $('laborAuto').value = '';
    });

    $('recordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const workers = await getAll('workers');
      const worker = workers.find(w => w.id === Number($('workerSelect').value));
      if(!worker){ alert('Seleccione un trabajador.'); return; }

      const totalTowers = computeTowers($('torreInicial').value, $('torreFinal').value);
      const hectares = totalTowers / 10;
      const hours = computeHours($('horaInicio').value, $('horaFinal').value);
      const amount = hectares * TARIFA_HECTAREA;
      const block = await getSetting(SETTINGS.bloque, '');
      const supervisionArea = await getSetting(SETTINGS.area, '');

      const rec = {
        date: $('fecha').value,
        workerId: worker.id,
        workerName: worker.name,
        code: worker.code,
        team: worker.team,
        labor: $('laborAuto').value.trim(),
        startTime: $('horaInicio').value,
        endTime: $('horaFinal').value,
        hours,
        piece: $('pieza').value.trim(),
        work: $('obra').value.trim(),
        cable: $('cable').value.trim(),
        terrain: $('terreno').value.trim(),
        towerStart: $('torreInicial').value.trim(),
        towerEnd: $('torreFinal').value.trim(),
        totalTowers,
        hectares,
        amount,
        activity: $('actividad').value.trim(),
        block,
        supervisionArea,
        encargado: ENCARGADO_FIJO,
        createdAt: new Date().toISOString()
      };

      if($('recordId').value){
        rec.id = Number($('recordId').value);
        await put('records', rec);
      }else{
        await add('records', rec);
      }

      const keepDate = $('fecha').value;
      $('recordForm').reset();
      $('fecha').value = keepDate || today();
      $('torresCalc').textContent = '0';
      $('haCalc').textContent = '0.00';
      $('horasCalc').textContent = '0.00';
      $('montoCalc').textContent = '₡0';
      $('claveAuto').value = '';
      $('cuadrillaAuto').value = '';
      $('laborAuto').value = '';
      $('recordId').value = '';

      await renderAll();
      alert('Registro diario guardado correctamente.');
    });

    $('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await setSetting(SETTINGS.email, $('emailInput').value.trim());
      await loadSettingsIntoUI();
      alert('Correo de reportes guardado.');
    });

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      $('installBtn').style.display = 'inline-flex';
    });

    $('installBtn').addEventListener('click', async () => {
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      $('installBtn').style.display = 'none';
    });

    if('serviceWorker' in navigator){
      window.addEventListener('load', async () => {
        try{ await navigator.serviceWorker.register('./sw.js'); }catch(e){}
      });
    }

    (async function init(){
      await openDB();
      $('fecha').value = today();
      $('jornadaDate').value = today();
      $('reportDate').value = today();
      updateOnlineState();
      await renderAll();
    })();
