document.addEventListener('DOMContentLoaded', async ()=>{
  const DEVICE_TYPES_KEY = 'nmDeviceTypesV1';
  const TYPE_ICON_MAP_KEY = 'nmTypeIconMapV1';
  const DEFAULT_DEVICE_TYPES = ['switch', 'ap', 'camera', 'phone'];

  const grid = document.getElementById('grid');
  const filter = document.getElementById('filter');
  const targetSel = document.getElementById('targetSelect');
  const typeAddInput = document.getElementById('typeAddInput');
  const typeAddBtn = document.getElementById('typeAddBtn');
  const typeRemoveSelect = document.getElementById('typeRemoveSelect');
  const typeRemoveBtn = document.getElementById('typeRemoveBtn');
  const statusMsg = document.getElementById('statusMsg');

  let icons = [];
  let deviceTypes = loadDeviceTypes();

  function slugifyType(raw){
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function humanizeType(type){
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

  function loadTypeIconMap(){
    const parsed = safeParseJSON(localStorage.getItem(TYPE_ICON_MAP_KEY) || '{}', {});
    return (parsed && typeof parsed === 'object') ? parsed : {};
  }

  function saveTypeIconMap(map){
    localStorage.setItem(TYPE_ICON_MAP_KEY, JSON.stringify(map || {}));
    localStorage.setItem('iconVersion', String(Date.now()));
  }

  function shortenIconName(filename){
    const raw = String(filename || '');
    let name = raw.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
    name = name.replace(/^\d+[_-]*/, '');
    name = name.replace(/^device[_-]*/, '');
    name = name.replace(/[_-](admindown|critical|major|minor|unknown|unmanaged|unreachable|warning|default|normal)$/, '');
    name = name.replace(/[_-](16|24|32|48|64|96|128|256|512)$/, '');
    name = name.replace(/[_-](16|24|32|48|64|96|128|256|512)$/, '');
    name = name.replace(/[_-]+/g, ' ').trim();
    if(!name) name = raw.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
    name = name.split(' ').map(p=>p ? (p[0].toUpperCase() + p.slice(1)) : '').join(' ').trim();
    if(name.length > 24) name = name.slice(0, 23) + '…';
    return name || 'Icon';
  }

  function setStatus(msg, isError){
    statusMsg.textContent = msg || '';
    statusMsg.style.color = isError ? '#b00020' : '#1e5b9a';
  }

  function renderTypeControls(){
    const current = slugifyType(targetSel.value) || deviceTypes[0] || 'switch';
    targetSel.innerHTML = '';
    typeRemoveSelect.innerHTML = '';

    deviceTypes.forEach((type)=>{
      const label = humanizeType(type);

      const tOpt = document.createElement('option');
      tOpt.value = type;
      tOpt.textContent = label;
      targetSel.appendChild(tOpt);

      const rOpt = document.createElement('option');
      rOpt.value = type;
      rOpt.textContent = label;
      typeRemoveSelect.appendChild(rOpt);
    });

    targetSel.value = deviceTypes.includes(current) ? current : deviceTypes[0];
    typeRemoveSelect.value = targetSel.value;
  }

  function mapIconToType(iconFile, targetType){
    const target = slugifyType(targetType);
    if(!target || !iconFile) return;
    const map = loadTypeIconMap();
    map[target] = iconFile;
    saveTypeIconMap(map);
    setStatus(`Mapped "${shortenIconName(iconFile)}" to "${humanizeType(target)}".`, false);
  }

  function renderIcons(){
    const q = (filter.value || '').toLowerCase().trim();
    const targetType = slugifyType(targetSel.value);
    const iconMap = loadTypeIconMap();
    const activeIcon = iconMap[targetType] || '';

    const filtered = icons.filter((icon)=>{
      const friendly = shortenIconName(icon).toLowerCase();
      return !q || icon.toLowerCase().includes(q) || friendly.includes(q);
    });

    grid.innerHTML = '';
    if(!filtered.length){
      grid.textContent = 'No icons match your filter.';
      return;
    }

    filtered.forEach((icon)=>{
      const div = document.createElement('div');
      div.className = 'icon-card';

      const img = document.createElement('img');
      img.src = '/icons/standard/' + encodeURIComponent(icon);
      img.alt = icon;
      div.appendChild(img);

      const name = document.createElement('div');
      name.className = 'icon-name';
      name.textContent = shortenIconName(icon);
      name.title = icon;
      div.appendChild(name);

      const file = document.createElement('div');
      file.className = 'icon-file';
      file.textContent = icon;
      file.title = icon;
      div.appendChild(file);

      const actions = document.createElement('div');
      actions.className = 'icon-actions';
      const applyBtn = document.createElement('button');
      applyBtn.textContent = (activeIcon === icon) ? 'Selected' : 'Use';
      applyBtn.addEventListener('click', ()=>{
        mapIconToType(icon, targetType);
        renderIcons();
      });
      actions.appendChild(applyBtn);
      div.appendChild(actions);

      grid.appendChild(div);
    });
  }

  async function loadIcons(){
    grid.textContent = 'Loading...';
    setStatus('Loading icon library...', false);
    try{
      const res = await fetch('/api/icons/list');
      if(!res.ok) throw new Error('Failed to load icon list');
      icons = await res.json();
      setStatus(`Loaded ${icons.length} icons.`, false);
      renderIcons();
    }catch(err){
      console.warn('icon load failed', err);
      icons = [];
      grid.textContent = 'Failed to load icons.';
      setStatus('Could not load icon list from server.', true);
    }
  }

  targetSel.addEventListener('change', ()=>{
    typeRemoveSelect.value = targetSel.value;
    renderIcons();
  });
  typeRemoveSelect.addEventListener('change', ()=>{ targetSel.value = typeRemoveSelect.value; renderIcons(); });
  filter.addEventListener('input', renderIcons);

  typeAddBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const value = slugifyType(typeAddInput.value);
    if(!value) return setStatus('Enter a valid device type name.', true);
    if(deviceTypes.includes(value)) return setStatus(`"${humanizeType(value)}" already exists.`, true);
    deviceTypes.push(value);
    saveDeviceTypes();
    targetSel.value = value;
    renderTypeControls();
    renderIcons();
    typeAddInput.value = '';
    setStatus(`Added "${humanizeType(value)}".`, false);
  });

  typeRemoveBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const value = slugifyType(typeRemoveSelect.value);
    if(!value) return;
    if(deviceTypes.length <= 1) return setStatus('Keep at least one device type.', true);
    deviceTypes = deviceTypes.filter(t => t !== value);
    saveDeviceTypes();

    const map = loadTypeIconMap();
    if(map[value]){
      delete map[value];
      saveTypeIconMap(map);
    }

    renderTypeControls();
    renderIcons();
    setStatus(`Removed "${humanizeType(value)}".`, false);
  });

  window.addEventListener('storage', (e)=>{
    if(e.key === DEVICE_TYPES_KEY){
      deviceTypes = loadDeviceTypes();
      renderTypeControls();
      renderIcons();
    }
    if(e.key === TYPE_ICON_MAP_KEY || e.key === 'iconVersion'){
      renderIcons();
    }
  });

  renderTypeControls();
  await loadIcons();
});
