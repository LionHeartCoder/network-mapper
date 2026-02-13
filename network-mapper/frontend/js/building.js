document.addEventListener('DOMContentLoaded', ()=>{
  const uploadForm = document.getElementById('uploadForm');
  const floorplanArea = document.getElementById('floorplanArea');
  const fpSelect = document.getElementById('floorplanSelect');
  const loadBtn = document.getElementById('loadFloorplanBtn');
  const refreshBtn = document.getElementById('refreshFloorplansBtn');
  const undoBtn = document.getElementById('undoBtn');

  const propsPanel = document.getElementById('propsPanel');
  const propName = document.getElementById('propName');
  const propType = document.getElementById('propType');
  const propNote = document.getElementById('propNote');
  const propSave = document.getElementById('propSave');
  const propDelete = document.getElementById('propDelete');
  const propClose = document.getElementById('propClose');

  let currentEditingId = null;
  const undoStack = [];
  const redoStack = [];
  const DEVICE_TYPES_KEY = 'nmDeviceTypesV1';
  const TYPE_ICON_MAP_KEY = 'nmTypeIconMapV1';
  const DEFAULT_DEVICE_TYPES = ['switch', 'ap', 'camera', 'phone'];

  const paletteTypes = document.getElementById('paletteTypes');
  const deviceTypeAddInput = document.getElementById('deviceTypeAddInput');
  const addDeviceTypeBtn = document.getElementById('addDeviceTypeBtn');
  const removeDeviceTypeSelect = document.getElementById('removeDeviceTypeSelect');
  const removeDeviceTypeBtn = document.getElementById('removeDeviceTypeBtn');

  let selectedPlacementType = 'switch';
  let deviceTypes = [];

  function titleFromType(type){
    const parts = slugifyType(type).split('-').filter(Boolean);
    return parts.map(p=>p[0] ? p[0].toUpperCase() + p.slice(1) : '').join(' ') || 'Device';
  }

  function safeParseJSON(raw, fallback){
    try{ return JSON.parse(raw); }catch(e){ return fallback; }
  }

  function loadDeviceTypes(){
    const fromStore = safeParseJSON(localStorage.getItem(DEVICE_TYPES_KEY) || '[]', []);
    const seed = (Array.isArray(fromStore) && fromStore.length) ? fromStore : DEFAULT_DEVICE_TYPES;
    const seen = new Set();
    const out = [];
    seed.forEach((t)=>{
      const v = slugifyType(t);
      if(v && !seen.has(v)){ seen.add(v); out.push(v); }
    });
    return out.length ? out : [...DEFAULT_DEVICE_TYPES];
  }

  function saveDeviceTypes(){
    localStorage.setItem(DEVICE_TYPES_KEY, JSON.stringify(deviceTypes));
  }

  function ensureTypeExists(type){
    const t = slugifyType(type) || 'device';
    if(!deviceTypes.includes(t)){
      deviceTypes.push(t);
      saveDeviceTypes();
      renderDeviceTypeControls();
    }
    return t;
  }

  function pushHistory(action){
    // push to undo stack and clear redo (standard behavior)
    undoStack.push(action);
    redoStack.length = 0;
    renderHistory();
  }

  function renderHistory(){
    const list = document.getElementById('historyList');
    if(!list) return;
    list.innerHTML = '';
    // render last 50 actions with newest first
    [...undoStack].slice(-50).reverse().forEach((a, idx)=>{
      const li = document.createElement('li');
      let msg = '';
      if(a.type==='move') msg = `Move: device ${a.id} to (${(a.next.x||0).toFixed(2)}, ${(a.next.y||0).toFixed(2)})`;
      if(a.type==='create') msg = `Create: device ${a.id}`;
      if(a.type==='delete') msg = `Delete: device ${a.id}`;
      if(a.type==='update') msg = `Update: device ${a.id}`;
      li.innerHTML = `<div>${msg}</div><div class='meta'>${new Date(a.ts||Date.now()).toLocaleString()}</div>`;
      list.appendChild(li);
    });
    // update history counters or other UI if needed
    const histCount = document.getElementById('historyCount');
    if(histCount) histCount.textContent = undoStack.length;
  }

  // Undo/redo relies on API `prev` and `snapshot` payloads from PUT/DELETE to reverse client actions safely.
  async function performUndo(){
    const action = undoStack.pop();
    if(!action) return showToast('Nothing to undo','error');
    try{
      if(action.type==='move'){
        const id = action.id;
        const prev = action.prev;
        const r = await fetch('/api/devices/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({x: prev.x, y: prev.y})});
        if(r.ok){ const m = document.querySelector(`.marker[data-id='${id}']`); if(m){ m.style.left = (prev.x*100)+'%'; m.style.top = (prev.y*100)+'%'; } showToast('Move undone','success'); }
        else showToast('Undo failed','error');
        // push to redo
        redoStack.push(action);
      }else if(action.type==='create'){
        // undo creation by deleting the device
        const id = action.id;
        const r = await fetch('/api/devices/'+id, {method:'DELETE'});
        if(r.ok){ document.querySelector(`.marker[data-id='${id}']`)?.remove(); showToast('Creation undone','success'); }
        else showToast('Undo delete failed','error');
        redoStack.push(action);
      }else if(action.type==='delete'){
        // undo delete by restoring from snapshot. Prefer server-side restore which
        // attempts to preserve the original DB id; fall back to POST /api/devices.
        const snap = action.snapshot;
        try{
          if(snap && snap.id){
            const r = await fetch('/api/devices/restore', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({snapshot: snap})});
            if(r.ok){
              const jr = await r.json();
              const restoredId = jr.id;
              const payload = {name: snap.name, device_type: snap.device_type, ip: snap.ip, note: snap.note, x: snap.x, y: snap.y, floorplan_id: snap.floorplan_id, mac: snap.mac || null, room: snap.room || null};
              const d = {id: restoredId, name: payload.name, device_type: payload.device_type, x: payload.x, y: payload.y};
              const m = createMarkerElement(d);
              document.getElementById('floorWrap').appendChild(m);
              showToast('Delete undone (restored)','success');
              // redo should delete the restored id
              redoStack.push({type:'delete', id: String(restoredId), snapshot: payload});
              return;
            }
          }
        }catch(e){ console.warn('restore endpoint failed, falling back to create', e); }
        // fallback: create a new device
        const payload = {name: snap.name, device_type: snap.device_type, ip: snap.ip, note: snap.note, x: snap.x, y: snap.y, floorplan_id: snap.floorplan_id, mac: snap.mac || null, room: snap.room || null}
        const r2 = await fetch('/api/devices', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        if(r2.ok){ const j = await r2.json(); const d = {id:j.id, name: payload.name, device_type: payload.device_type, x: payload.x, y: payload.y}; const m = createMarkerElement(d); document.getElementById('floorWrap').appendChild(m); showToast('Delete undone (restored)','success');
          // for redo we need to refer to new id
          redoStack.push({type:'delete', id: j.id, snapshot: payload});
        }else{ showToast('Restore failed','error'); }
      }else if(action.type==='update'){
        // revert to previous values
        const id = action.id;
        const prev = action.prev;
        const r = await fetch('/api/devices/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(prev)});
        if(r.ok){ const m = document.querySelector(`.marker[data-id='${id}']`); if(m){ m.title = prev.name || m.title; setMarkerIcon(m, prev.device_type); m.style.left = ((prev.x||0)*100)+'%'; m.style.top = ((prev.y||0)*100)+'%'; } showToast('Update undone','success'); redoStack.push(action);} else showToast('Undo failed','error');
      }
    }catch(e){ console.warn('performUndo error', e); showToast('Undo error','error'); }
    renderHistory();
  }

  // Redo reapplies the same action payload shape returned by the API snapshot semantics above.
  async function performRedo(){
    const action = redoStack.pop();
    if(!action) return showToast('Nothing to redo','error');
    try{
      if(action.type==='move'){
        // reapply move
        const id = action.id; const next = action.next;
        const r = await fetch('/api/devices/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({x: next.x, y: next.y})});
        if(r.ok){ const m = document.querySelector(`.marker[data-id='${id}']`); if(m){ m.style.left = (next.x*100)+'%'; m.style.top = (next.y*100)+'%'; } showToast('Redo move','success'); undoStack.push(action); }
      }else if(action.type==='create'){
        // re-create (redo create) - use payload if available
        const payload = action.payload || {};
        const r = await fetch('/api/devices', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        if(r.ok){ const j = await r.json(); const d = {id:j.id, name: payload.name, device_type: payload.device_type, x: payload.x, y: payload.y}; const m = createMarkerElement(d); document.getElementById('floorWrap').appendChild(m); showToast('Redo create','success'); undoStack.push({type:'create', id: j.id, payload: payload}); }
      }else if(action.type==='delete'){
        // redo delete - delete the id present in action
        const id = action.id;
        const r = await fetch('/api/devices/'+id, {method:'DELETE'});
        if(r.ok){ document.querySelector(`.marker[data-id='${id}']`)?.remove(); showToast('Redo delete','success'); undoStack.push(action); }
      }else if(action.type==='update'){
        // reapply update (apply action.next)
        const id = action.id; const next = action.next;
        const r = await fetch('/api/devices/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(next)});
        if(r.ok){ const m = document.querySelector(`.marker[data-id='${id}']`); if(m){ m.title = next.name || m.title; setMarkerIcon(m, next.device_type); m.style.left = ((next.x||0)*100)+'%'; m.style.top = ((next.y||0)*100)+'%'; } showToast('Redo update','success'); undoStack.push(action);} }
    }catch(e){ console.warn('redo error', e); showToast('Redo error','error'); }
    renderHistory();
  }

  // history panel buttons
  document.getElementById('histUndo')?.addEventListener('click', (e)=>{ e.preventDefault(); performUndo(); });
  document.getElementById('histRedo')?.addEventListener('click', (e)=>{ e.preventDefault(); performRedo(); });
  document.getElementById('histClear')?.addEventListener('click', (e)=>{ e.preventDefault(); undoStack.length = 0; redoStack.length = 0; renderHistory(); showToast('History cleared','success'); });

  // history panel collapse toggle
  const historyPanel = document.getElementById('historyPanel');
  const historyToggle = document.getElementById('historyToggle');
  function setHistoryCollapsed(collapsed){
    if(!historyPanel) return;
    historyPanel.classList.toggle('collapsed', !!collapsed);
    if(historyToggle) historyToggle.textContent = collapsed ? '▸' : '−';
    try{ localStorage.setItem('historyPanelCollapsed', collapsed ? '1' : '0'); }catch(e){}
  }
  historyToggle?.addEventListener('click', (e)=>{ e.preventDefault(); setHistoryCollapsed(!historyPanel.classList.contains('collapsed')); });
  // restore from localStorage
  try{ if(localStorage.getItem('historyPanelCollapsed') === '1') setHistoryCollapsed(true); }catch(e){}

  // Make history panel draggable and persist position
  (function(){
    if(!historyPanel) return;
    // restore saved position (if any)
    try{
      const stored = localStorage.getItem('historyPanelPos');
      if(stored){ const pos = JSON.parse(stored); if(pos && typeof pos.x === 'number' && typeof pos.y === 'number'){ historyPanel.style.left = pos.x + 'px'; historyPanel.style.top = pos.y + 'px'; } }
    }catch(e){/* ignore */}

    const header = historyPanel.querySelector('h3');
    if(!header) return;
    header.style.touchAction = 'none';

    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    header.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      header.setPointerCapture(ev.pointerId);
      dragging = true;
      startX = ev.clientX; startY = ev.clientY;
      const rect = historyPanel.getBoundingClientRect();
      // ensure left/top are in px so we can update them
      startLeft = rect.left; startTop = rect.top;
      window.addEventListener('pointermove', onPointerMove);
    });

    function onPointerMove(e){
      if(!dragging) return;
      const dx = e.clientX - startX; const dy = e.clientY - startY;
      const newLeft = Math.max(6, Math.min(window.innerWidth - historyPanel.offsetWidth - 6, startLeft + dx));
      const newTop = Math.max(6, Math.min(window.innerHeight - historyPanel.offsetHeight - 6, startTop + dy));
      historyPanel.style.left = newLeft + 'px'; historyPanel.style.top = newTop + 'px';
    }

    header.addEventListener('pointerup', (ev)=>{
      if(dragging){
        dragging = false;
        header.releasePointerCapture && header.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        try{ localStorage.setItem('historyPanelPos', JSON.stringify({x: parseInt(historyPanel.style.left||0), y: parseInt(historyPanel.style.top||0)})); }catch(e){}
      }
    });

    // also save position on window resize to keep it in bounds
    window.addEventListener('resize', ()=>{
      try{
        const rect = historyPanel.getBoundingClientRect();
        const x = Math.max(6, Math.min(window.innerWidth - historyPanel.offsetWidth - 6, rect.left));
        const y = Math.max(6, Math.min(window.innerHeight - historyPanel.offsetHeight - 6, rect.top));
        historyPanel.style.left = x + 'px'; historyPanel.style.top = y + 'px';
        localStorage.setItem('historyPanelPos', JSON.stringify({x,y}));
      }catch(e){}
    });
  })();
  async function loadFloorplans(){
    const [fpsRes, bsRes] = await Promise.all([fetch('/api/floorplans'), fetch('/api/buildings')]);
    const fps = await fpsRes.json();
    const bs = await bsRes.json();
    const bMap = Object.fromEntries(bs.map(b=>[b.id,b]));
    fpSelect.innerHTML = '';
    fps.forEach(f=>{ const opt = document.createElement('option'); opt.value = f.id; opt.innerText = `${bMap[f.building_id]?.name || f.building_id} — ${f.filename}`; fpSelect.appendChild(opt)});
  }

  async function loadFloorplanById(fpId){
    const fpsRes = await fetch('/api/floorplans');
    const fps = await fpsRes.json();
    const fp = fps.find(x=>String(x.id)===String(fpId));
    if(!fp) return alert('floorplan not found');
    floorplanArea.innerHTML = `<p>Loaded: ${fp.filename}</p><div id='floorWrap' style='position:relative;display:inline-block'><img id='floorImage' src='/uploads/${fp.filename}' style='max-width:100%;display:block'></div>`;
    floorplanArea.setAttribute('data-floorplan-id', fp.id);

    const img = document.getElementById('floorImage');
    img.addEventListener('click', onImageClick);

    await placeExistingMarkers(fp.id);
    // ensure markers refresh their icons in case the icon set changed recently
    try{ refreshAllMarkerIcons(); }catch(e){}
  }

  async function placeExistingMarkers(fpId){
    const devicesRes = await fetch('/api/devices');
    const devices = await devicesRes.json();
    const fpDevices = devices.filter(d=>d.floorplan_id==fpId);
    const wrap = document.getElementById('floorWrap');
    wrap.querySelectorAll('.marker')?.forEach(n=>n.remove());
    fpDevices.forEach(d=>{ const m = createMarkerElement(d); wrap.appendChild(m); });
  }

  function getIconPath(type, ext='svg'){ return `/icons/${(type||'device')}.${ext}`; }
  function getIconVersion(){ return localStorage.getItem('iconVersion') || '' }
  function bumpIconVersion(){ const v = String(Date.now()); try{ localStorage.setItem('iconVersion', v); }catch(e){} return v }

  function slugifyType(raw){
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeDeviceType(raw){
    const t = slugifyType(raw);
    if(!t) return 'device';
    if(['switch','ap','camera','phone','device'].includes(t)) return t;

    if(/(^|-)ap($|-)|access-point|wireless|wifi|wlan|wlc/.test(t)) return 'ap';
    if(/camera|cctv|webcam|telepresence|video/.test(t)) return 'camera';
    if(/phone|voip|voice|handset|ata/.test(t)) return 'phone';
    if(/switch|router|firewall|gateway|core|distribution|idf|mdf|nexus|catalyst|asa/.test(t)) return 'switch';
    return 'device';
  }

  function getIconCandidates(rawType){
    const raw = slugifyType(rawType);
    const normalized = normalizeDeviceType(rawType);
    const seen = new Set();
    const out = [];
    [raw, normalized, 'device'].forEach((v)=>{
      if(v && !seen.has(v)){ seen.add(v); out.push(v); }
    });
    return out;
  }

  function getTypeIconMap(){
    const parsed = safeParseJSON(localStorage.getItem(TYPE_ICON_MAP_KEY) || '{}', {});
    return (parsed && typeof parsed === 'object') ? parsed : {};
  }

  function safeIconBasename(name){
    return String(name || '').replace(/\\/g, '/').split('/').pop();
  }

  function getMappedIconFilename(type){
    const map = getTypeIconMap();
    const key = slugifyType(type);
    const fallbackKey = normalizeDeviceType(type);
    return safeIconBasename(map[key] || map[fallbackKey] || '');
  }

  function setMarkerIcon(marker, type){
    const img = document.createElement('img');
    img.alt = type || 'device';
    // Append cache-bust query param so browsers re-fetch when icons change.
    const ver = getIconVersion() || String(Date.now());
    const candidates = getIconCandidates(type);
    const mappedIcon = getMappedIconFilename(type);
    const sources = [];

    if(mappedIcon){
      sources.push('/icons/standard/' + encodeURIComponent(mappedIcon) + '?t=' + encodeURIComponent(ver));
    }
    candidates.forEach((t)=>{
      sources.push(getIconPath(t, 'svg') + '?t=' + encodeURIComponent(ver));
      sources.push(getIconPath(t, 'png') + '?t=' + encodeURIComponent(ver));
    });

    let idx = 0;
    img.onerror = ()=>{
      idx += 1;
      if(idx >= sources.length) return;
      img.src = sources[idx];
    };
    img.src = sources[0] || (getIconPath('device', 'svg') + '?t=' + encodeURIComponent(ver));

    marker.innerHTML = '';
    marker.appendChild(img);
    Array.from(marker.classList)
      .filter(c => c.startsWith('type-'))
      .forEach(c => marker.classList.remove(c));
    marker.classList.add('type-' + normalizeDeviceType(type));
    try{ marker.setAttribute('data-type', type || 'device'); }catch(e){}
  }

  function refreshAllMarkerIcons(){ document.querySelectorAll('.marker').forEach(m=>{ const t = m.getAttribute('data-type') || Array.from(m.classList).find(c=>c.startsWith('type-'))?.replace('type-','') || 'device'; setMarkerIcon(m, t); }); }
  window.__nmTestHelpers = window.__nmTestHelpers || {};
  window.__nmTestHelpers.refreshAllMarkerIcons = refreshAllMarkerIcons;

  // listen for storage events (e.g., icon/type updates from icon picker in other tab)
  window.addEventListener('storage', (e)=>{
    if(e.key === 'iconVersion' || e.key === TYPE_ICON_MAP_KEY){
      try{ refreshAllMarkerIcons(); }catch(err){console.warn('refreshAllMarkerIcons failed', err); }
    }
    if(e.key === DEVICE_TYPES_KEY){
      deviceTypes = loadDeviceTypes();
      if(!deviceTypes.includes(selectedPlacementType)) selectedPlacementType = deviceTypes[0] || 'device';
      renderDeviceTypeControls();
    }
  });

  function createMarkerElement(d){
    const marker = document.createElement('div');
    marker.className = 'marker';
    setMarkerIcon(marker, d.device_type);
    marker.title = d.name || '';
    marker.style.left = ((d.x||0)*100)+'%';
    marker.style.top = ((d.y||0)*100)+'%';
    marker.setAttribute('data-id', d.id);
    marker.setAttribute('data-type', d.device_type || 'device');

    // pointer drag handling
    let dragging = false;
    let pointerId = null;
    let lastPos = {x: d.x || 0, y: d.y || 0};

    marker.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      marker.setPointerCapture(ev.pointerId);
      dragging = true; pointerId = ev.pointerId;
      marker.classList.add('dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, {once:true});

      function onPointerMove(e){
        if(!dragging || e.pointerId!==pointerId) return;
        const img = document.getElementById('floorImage');
        const rect = img.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        let y = (e.clientY - rect.top) / rect.height;
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        marker.style.left = (x*100)+'%'; marker.style.top = (y*100)+'%';
      }

      async function onPointerUp(e){
        if(e.pointerId!==pointerId) return;
        dragging = false; marker.classList.remove('dragging');
        const img = document.getElementById('floorImage');
        const rect = img.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        let y = (e.clientY - rect.top) / rect.height;
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        // push to undo stack if changed
        const id = marker.getAttribute('data-id');
        const prev = {x: lastPos.x, y: lastPos.y};
        const changed = prev.x !== x || prev.y !== y;
        if(changed){
          const act = {type:'move', id, prev, next:{x,y}, ts: Date.now()};
          pushHistory(act);
          // save
          try{ await fetch('/api/devices/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({x,y})}); lastPos = {x,y}; }
          catch(err){console.warn('save failed', err);}
        }
        window.removeEventListener('pointermove', onPointerMove);
      }
    });

    // single click opens properties panel
    marker.addEventListener('click', (ev)=>{
      ev.preventDefault();
      openPropsPanel(marker.getAttribute('data-id'));
    });

    // right-click to delete (also available from panel)
    marker.addEventListener('contextmenu', async (ev)=>{
      ev.preventDefault();
      if(!confirm('Delete this device?')) return;
      const id = marker.getAttribute('data-id');
      try{
        // fetch snapshot then delete so we can undo
        const sres = await fetch('/api/devices/'+id);
        const snap = sres.ok ? await sres.json() : null;
        const r = await fetch('/api/devices/'+id, {method:'DELETE'});
        if(r.ok){ marker.remove(); pushHistory({type:'delete', id, snapshot: snap, ts: Date.now()}); showToast('Deleted','success'); }
      }catch(e){console.warn('delete failed', e)}
    });

    return marker;
  }

  // image click used for placement: open creation modal with coords
  let pendingPlace = false;
  const newDeviceBtn = document.getElementById('newDeviceBtn');
  newDeviceBtn?.addEventListener('click', ()=>{
    pendingPlace = true; newDeviceBtn.innerText = 'Click map to place...';
    showToast(`Click on the floorplan to place a ${titleFromType(selectedPlacementType)}`, 'success');
  });

  async function onImageClick(e){
    const img = document.getElementById('floorImage');
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const fpId = floorplanArea.getAttribute('data-floorplan-id');
    // building id helper
    const buildingName = uploadForm.elements['building'].value;
    let buildingId = null;
    try{ const res = await fetch('/api/buildings'); const bs = await res.json(); const b = bs.find(b=>b.name===buildingName); buildingId = b?.id || null;}catch(e){console.warn('failed to resolve building id', e)}

    // open modal for new device (if pendingPlace or click-to-place after image click)
    openCreateModal({x, y, fpId, buildingId});
    // reset pendingPlace state
    if(pendingPlace){ pendingPlace = false; newDeviceBtn.innerText = 'New Device'; }
  }

  // Modal and toast helpers
  const deviceModal = document.getElementById('deviceModal');
  const deviceId = document.getElementById('deviceId');
  const deviceName = document.getElementById('deviceName');
  const deviceType = document.getElementById('deviceType');
  const deviceIP = document.getElementById('deviceIP');
  const deviceMAC = document.getElementById('deviceMAC');
  const deviceRoom = document.getElementById('deviceRoom');
  const deviceNote = document.getElementById('deviceNote');
  const deviceX = document.getElementById('deviceX');
  const deviceY = document.getElementById('deviceY');
  const deviceFP = document.getElementById('deviceFP');
  const deviceSave = document.getElementById('deviceSave');
  const deviceCancel = document.getElementById('deviceCancel');
  const toastContainer = document.getElementById('toastContainer');

  function showToast(msg, type=''){
    const t = document.createElement('div'); t.className = 'toast ' + (type||''); t.innerText = msg;
    toastContainer.appendChild(t);
    setTimeout(()=>{ t.remove(); }, 3500);
  }

  function renderDeviceTypeControls(){
    const active = slugifyType(selectedPlacementType) || 'device';
    const modalSelected = slugifyType(deviceType.value) || active;
    const propSelected = slugifyType(propType.value) || active;

    if(deviceType){
      deviceType.innerHTML = '';
      deviceTypes.forEach((t)=>{
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = titleFromType(t);
        deviceType.appendChild(opt);
      });
      deviceType.value = deviceTypes.includes(modalSelected) ? modalSelected : (deviceTypes[0] || 'device');
    }

    if(propType){
      propType.innerHTML = '';
      deviceTypes.forEach((t)=>{
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = titleFromType(t);
        propType.appendChild(opt);
      });
      propType.value = deviceTypes.includes(propSelected) ? propSelected : (deviceTypes[0] || 'device');
    }

    if(paletteTypes){
      paletteTypes.innerHTML = '';
      deviceTypes.forEach((t)=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = titleFromType(t);
        btn.dataset.type = t;
        btn.style.marginRight = '.4rem';
        if(t === active) btn.style.fontWeight = '700';
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          selectedPlacementType = t;
          renderDeviceTypeControls();
        });
        paletteTypes.appendChild(btn);
      });
    }

    if(removeDeviceTypeSelect){
      removeDeviceTypeSelect.innerHTML = '';
      deviceTypes.forEach((t)=>{
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = titleFromType(t);
        removeDeviceTypeSelect.appendChild(opt);
      });
      removeDeviceTypeSelect.value = deviceTypes.includes(active) ? active : (deviceTypes[0] || 'device');
    }
  }

  deviceTypes = loadDeviceTypes();
  selectedPlacementType = deviceTypes[0] || 'switch';
  renderDeviceTypeControls();
  deviceType?.addEventListener('change', ()=>{
    selectedPlacementType = ensureTypeExists(deviceType.value);
    renderDeviceTypeControls();
  });

  addDeviceTypeBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    const t = slugifyType(deviceTypeAddInput?.value);
    if(!t) return showToast('Enter a valid type name', 'error');
    if(deviceTypes.includes(t)) return showToast('Type already exists', 'error');
    deviceTypes.push(t);
    saveDeviceTypes();
    selectedPlacementType = t;
    if(deviceTypeAddInput) deviceTypeAddInput.value = '';
    renderDeviceTypeControls();
    showToast(`Added type: ${titleFromType(t)}`, 'success');
  });

  removeDeviceTypeBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    const t = slugifyType(removeDeviceTypeSelect?.value);
    if(!t) return;
    if(deviceTypes.length <= 1) return showToast('Keep at least one type', 'error');
    deviceTypes = deviceTypes.filter(x => x !== t);
    if(selectedPlacementType === t) selectedPlacementType = deviceTypes[0] || 'device';
    saveDeviceTypes();

    const iconMap = getTypeIconMap();
    if(iconMap[t]){
      delete iconMap[t];
      localStorage.setItem(TYPE_ICON_MAP_KEY, JSON.stringify(iconMap));
      bumpIconVersion();
    }

    renderDeviceTypeControls();
    refreshAllMarkerIcons();
    showToast(`Removed type: ${titleFromType(t)}`, 'success');
  });

  function openCreateModal({x,y,fpId,buildingId,existing}){
    // if editing existing, existing contains device object
    if(existing?.device_type) ensureTypeExists(existing.device_type);
    selectedPlacementType = slugifyType(existing?.device_type || selectedPlacementType || deviceTypes[0] || 'device');
    deviceId.value = existing?.id || '';
    deviceName.value = existing?.name || '';
    deviceType.value = selectedPlacementType;
    deviceIP.value = existing?.ip || '';
    deviceMAC.value = existing?.mac || '';
    deviceRoom.value = existing?.room || existing?.note || '';
    deviceNote.value = existing?.note || '';
    deviceX.value = (x||existing?.x||0);
    deviceY.value = (y||existing?.y||0);
    deviceFP.value = fpId || existing?.floorplan_id || '';
    deviceModal.classList.remove('hidden');
    deviceName.focus();
  }

  function closeModal(){ deviceModal.classList.add('hidden'); deviceId.value=''; deviceName.value=''; deviceIP.value=''; deviceMAC.value=''; deviceRoom.value=''; deviceNote.value=''; }

  deviceCancel.addEventListener('click', (e)=>{ e.preventDefault(); closeModal(); });

  // save-button UI elements
  const deviceSaveText = document.getElementById('deviceSaveText');
  const deviceSaveSpinner = document.getElementById('deviceSaveSpinner');
  const deviceSaveResult = document.getElementById('deviceSaveResult');

  // validation helpers
  function clearErrors(){
    ['deviceName','deviceType','deviceIP','deviceMAC','deviceRoom','deviceNote'].forEach(id=>{ const el = document.getElementById(id); el && el.classList.remove('invalid-field'); const err = document.getElementById(id+'Error'); if(err) err.textContent = ''; });
    // reset save result
    deviceSaveResult.className = 'hidden'; deviceSaveResult.textContent = '';
  }

  // Keyboard shortcuts: N => start place, Esc => cancel placement
  document.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase() === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){
      pendingPlace = true; newDeviceBtn.innerText = 'Click map to place...'; showToast(`Click on the floorplan to place a ${titleFromType(selectedPlacementType)} (Esc to cancel)`,'success');
    }
    if(e.key === 'Escape'){
      if(pendingPlace){ pendingPlace = false; newDeviceBtn.innerText = 'New Device'; showToast('Placement cancelled','error'); }
    }
  });
  function setFieldError(el, msg){ if(!el) return; el.classList.add('invalid-field'); const err = document.getElementById(el.id + 'Error'); if(err) err.textContent = msg; }

  function isValidIPv4(ip){ const v = ip.trim(); const re = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/; return re.test(v); }
  function isValidIPv6(ip){ // basic IPv6 check
    const v = ip.trim(); return /^[0-9a-fA-F:]+$/.test(v) && v.includes(':');
  }
  function isValidIP(ip){ if(!ip) return true; return isValidIPv4(ip) || isValidIPv6(ip); }
  function isValidMAC(mac){ if(!mac) return true; const v = mac.trim(); return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(v) || /^[0-9A-Fa-f]{12}$/.test(v); }

  function validateDeviceForm(){
    clearErrors();
    let ok = true;
    if(!deviceName.value.trim()){ setFieldError(deviceName, 'Name is required'); ok = false; }
    if(!deviceType.value){ setFieldError(deviceType, 'Type is required'); ok = false; }
    if(deviceIP.value.trim() && !isValidIP(deviceIP.value.trim())){ setFieldError(deviceIP, 'Invalid IP address'); ok = false; }
    if(deviceMAC.value.trim() && !isValidMAC(deviceMAC.value.trim())){ setFieldError(deviceMAC, 'Invalid MAC format'); ok = false; }
    if(deviceRoom.value.trim().length > 32){ setFieldError(deviceRoom, 'Room exceeds 32 characters'); ok = false; }
    return ok;
  }

  // live validation for IP/MAC and room count
  const deviceIPIcon = document.getElementById('deviceIPIcon');
  const deviceIPIconInvalid = document.getElementById('deviceIPIconInvalid');
  const deviceMACIcon = document.getElementById('deviceMACIcon');
  const deviceMACIconInvalid = document.getElementById('deviceMACIconInvalid');
  const deviceRoomCount = document.getElementById('deviceRoomCount');

  deviceIP.addEventListener('input', ()=>{
    const v = deviceIP.value.trim();
    if(!v){ deviceIPIcon.classList.add('hidden'); deviceIPIconInvalid.classList.add('hidden'); document.getElementById('deviceIPError').textContent=''; deviceIP.classList.remove('invalid-field'); return; }
    if(isValidIP(v)){ deviceIPIcon.classList.remove('hidden'); deviceIPIconInvalid.classList.add('hidden'); document.getElementById('deviceIPError').textContent=''; deviceIP.classList.remove('invalid-field'); } else { deviceIPIcon.classList.add('hidden'); deviceIPIconInvalid.classList.remove('hidden'); setFieldError(deviceIP, 'Invalid IP address'); }
  });

  deviceMAC.addEventListener('input', ()=>{
    const v = deviceMAC.value.trim();
    if(!v){ deviceMACIcon.classList.add('hidden'); deviceMACIconInvalid.classList.add('hidden'); document.getElementById('deviceMACError').textContent=''; deviceMAC.classList.remove('invalid-field'); return; }
    if(isValidMAC(v)){ deviceMACIcon.classList.remove('hidden'); deviceMACIconInvalid.classList.add('hidden'); document.getElementById('deviceMACError').textContent=''; deviceMAC.classList.remove('invalid-field'); } else { deviceMACIcon.classList.add('hidden'); deviceMACIconInvalid.classList.remove('hidden'); setFieldError(deviceMAC, 'Invalid MAC format'); }
  });

  deviceRoom.addEventListener('input', ()=>{
    const v = deviceRoom.value || '';
    deviceRoomCount.textContent = `${v.length}/32`;
    if(v.length > 32){ setFieldError(deviceRoom, 'Room exceeds 32 characters'); } else { document.getElementById('deviceRoomError').textContent=''; deviceRoom.classList.remove('invalid-field'); }
  });

  // ensure counts update when modal opens
  function updateRoomCount(){ deviceRoomCount.textContent = `${(deviceRoom.value||'').length}/32`; }


  deviceSave.addEventListener('click', async (e)=>{
    e.preventDefault();
    if(!validateDeviceForm()) return showToast('Fix validation errors','error');
    const id = deviceId.value;
    const payload = {
      name: deviceName.value.trim(),
      device_type: ensureTypeExists(deviceType.value),
      ip: deviceIP.value.trim() || null,
      note: deviceNote.value.trim() || null,
      x: parseFloat(deviceX.value),
      y: parseFloat(deviceY.value),
      floorplan_id: deviceFP.value || null,
      mac: deviceMAC.value.trim() || null,
      room: deviceRoom.value.trim() || null
    };
    try{
      // UI: disable save, show spinner
      deviceSave.disabled = true; deviceSaveText.innerText = 'Saving...'; deviceSaveSpinner.classList.remove('hidden'); deviceSaveResult.classList.add('hidden');
      selectedPlacementType = payload.device_type;
      renderDeviceTypeControls();
      if(id){
        // update
        const r = await fetch('/api/devices/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        const jr = await r.json();
        if(r.ok){
          // push history (server returns previous state in jr.prev)
          pushHistory({type:'update', id, prev: jr.prev, next: payload, ts: Date.now()});
          // update marker in DOM
          const m = document.querySelector(`.marker[data-id='${id}']`);
          if(m){ m.title = payload.name; m.setAttribute('data-type', payload.device_type); setMarkerIcon(m, payload.device_type); m.style.left = ((payload.x||0)*100)+'%'; m.style.top = ((payload.y||0)*100)+'%'; }
          deviceSaveSpinner.classList.add('hidden'); deviceSaveResult.classList.remove('hidden'); deviceSaveResult.className = 'success'; deviceSaveResult.textContent = '✔'; setTimeout(()=>{ deviceSaveResult.className = 'hidden'; deviceSaveResult.textContent = ''; deviceSave.disabled = false; deviceSaveText.innerText = 'Save'; }, 1200);
          showToast('Updated','success'); closeModal();
        }else{ deviceSaveSpinner.classList.add('hidden'); deviceSaveResult.classList.remove('hidden'); deviceSaveResult.className = 'error'; deviceSaveResult.textContent = '✖'; deviceSave.disabled = false; deviceSaveText.innerText = 'Save'; showToast('Update failed','error'); }
      }else{
        // create
        const r = await fetch('/api/devices', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        const j = await r.json();
        if(r.ok){
          // add marker
          const d = {id:j.id, name: payload.name, device_type: payload.device_type, x: payload.x, y: payload.y};
          const m = createMarkerElement(d);
          document.getElementById('floorWrap').appendChild(m);
          // push create action to history (include payload for redo)
          pushHistory({type:'create', id: j.id, payload: d, ts: Date.now()});
          deviceSaveSpinner.classList.add('hidden'); deviceSaveResult.classList.remove('hidden'); deviceSaveResult.className = 'success'; deviceSaveResult.textContent = '✔'; setTimeout(()=>{ deviceSaveResult.className = 'hidden'; deviceSaveResult.textContent = ''; deviceSave.disabled = false; deviceSaveText.innerText = 'Save'; }, 1200);
          showToast('Created','success');
          closeModal();
        }else{ deviceSaveSpinner.classList.add('hidden'); deviceSaveResult.classList.remove('hidden'); deviceSaveResult.className = 'error'; deviceSaveResult.textContent = '✖'; deviceSave.disabled = false; deviceSaveText.innerText = 'Save'; showToast('Create failed','error'); }
      }
    }catch(err){ console.warn('save error', err); deviceSaveSpinner.classList.add('hidden'); deviceSaveResult.classList.remove('hidden'); deviceSaveResult.className = 'error'; deviceSaveResult.textContent = '✖'; deviceSave.disabled = false; deviceSaveText.innerText = 'Save'; showToast('Save error','error'); }
  });

  // allow properties panel to open modal for editing
  const propEdit = document.getElementById('propEdit');
  propEdit?.addEventListener('click', async ()=>{
    if(!currentEditingId) return;
    const res = await fetch('/api/devices'); const devices = await res.json(); const d = devices.find(x=>String(x.id)===String(currentEditingId));
    if(d){ openCreateModal({existing: d}); propsPanel.classList.add('hidden'); try{ document.querySelector(`.marker[data-id='${currentEditingId}']`)?.setAttribute('data-type', d.device_type || 'device'); }catch(e){} }
  });

  // undo button uses consolidated history
  undoBtn.addEventListener('click', (e)=>{ e.preventDefault(); performUndo(); });

  // upload handler
  uploadForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(uploadForm);
    const r = await fetch('/api/floorplans', {method:'POST', body: fd});
    const j = await r.json();
    if(r.ok){ await loadFloorplans(); fpSelect.value = j.id; await loadFloorplanById(j.id); }
    else{ alert('Upload failed: ' + JSON.stringify(j)); }
  });

  loadBtn.addEventListener('click', async ()=>{ const id = fpSelect.value; if(id) await loadFloorplanById(id); });
  refreshBtn.addEventListener('click', loadFloorplans);

  // add a small 'Refresh Icons' control to force icon reloads (helps when browser cache persists)
  const refreshIconsBtn = document.createElement('button'); refreshIconsBtn.id = 'refreshIconsBtn'; refreshIconsBtn.style.marginLeft = '8px'; refreshIconsBtn.innerText = 'Refresh Icons';
  refreshIconsBtn.addEventListener('click', () => { const ver = bumpIconVersion(); try{ refreshAllMarkerIcons(); showToast('Icons refreshed', 'success'); }catch(e){console.warn(e); showToast('Refresh failed','error'); } });
  refreshBtn.parentNode && refreshBtn.parentNode.insertBefore(refreshIconsBtn, refreshBtn.nextSibling);

  // properties panel actions
  async function openPropsPanel(id){
    currentEditingId = id;
    const res = await fetch('/api/devices');
    const devices = await res.json();
    const d = devices.find(x=>String(x.id)===String(id));
    if(!d) return alert('device not found');
    ensureTypeExists(d.device_type || 'device');
    propName.value = d.name || '';
    propType.value = slugifyType(d.device_type || 'device');
    propNote.value = d.note || '';
    propsPanel.classList.remove('hidden');
  }
  function closePropsPanel(){ propsPanel.classList.add('hidden'); currentEditingId = null; }

  propClose.addEventListener('click', closePropsPanel);
  propSave.addEventListener('click', async ()=>{
    if(!currentEditingId) return;
    const payload = {name: propName.value, device_type: ensureTypeExists(propType.value), note: propNote.value};
    try{
      const r = await fetch('/api/devices/'+currentEditingId, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(r.ok){
        const jr = await r.json();
        // push history with previous values returned from server
        pushHistory({type:'update', id: currentEditingId, prev: jr.prev, next: payload, ts: Date.now()});
        // update marker visuals
        const m = document.querySelector(`.marker[data-id='${currentEditingId}']`);
        if(m){ m.title = propName.value; setMarkerIcon(m, propType.value); }
        selectedPlacementType = payload.device_type;
        renderDeviceTypeControls();
        closePropsPanel();
      }else{ alert('Save failed'); }
    }catch(e){console.warn('save failed', e)}
  });

  propDelete.addEventListener('click', async ()=>{
    if(!currentEditingId) return;
    if(!confirm('Delete this device?')) return;
    try{
      const sres = await fetch('/api/devices/'+currentEditingId);
      const snap = sres.ok ? await sres.json() : null;
      const r = await fetch('/api/devices/'+currentEditingId, {method:'DELETE'});
      if(r.ok){ document.querySelector(`.marker[data-id='${currentEditingId}']`)?.remove(); pushHistory({type:'delete', id: currentEditingId, snapshot: snap, ts: Date.now()}); closePropsPanel(); }
    }catch(e){console.warn('delete failed', e)}
  });

  // undo button - uses centralized history undo
  undoBtn.addEventListener('click', (e)=>{ e.preventDefault(); performUndo(); });

  // initial load
  renderHistory();
  loadFloorplans();
});
