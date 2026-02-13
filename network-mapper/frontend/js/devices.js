async function loadDevices(){
  const t = document.querySelector('#devices tbody');
  t.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
  const res = await fetch('/api/devices');
  const ds = await res.json();
  if(!ds.length){ t.innerHTML = '<tr><td colspan="6">No devices</td></tr>'; return }
  const bRes = await fetch('/api/buildings');
  const bs = await bRes.json();
  const bMap = Object.fromEntries(bs.map(b=>[b.id,b]));
  t.innerHTML = '';
  ds.forEach(d=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.id}</td><td>${d.name}</td><td>${d.ip || ''}</td><td>${d.device_type}</td><td>${bMap[d.building_id]?.name || ''}</td><td><button data-id='${d.id}' data-ip='${d.ip}'>Ping</button></td>`;
    t.appendChild(tr);
  });
  document.querySelectorAll('button[data-id]').forEach(btn=>btn.addEventListener('click', async e=>{
    const ip = btn.getAttribute('data-ip');
    btn.disabled = true;
    btn.innerText = 'Pinging...';
    try{
      const r = await fetch('/api/ping?ip='+encodeURIComponent(ip));
      const j = await r.json();
      alert('Ping result: ' + JSON.stringify(j));
    }catch(err){ alert('Ping failed: ' + err) }
    btn.disabled = false;
    btn.innerText = 'Ping';
  }))
}

document.getElementById('refresh').addEventListener('click', loadDevices);
document.getElementById('importForm').addEventListener('submit', async ev=>{
  ev.preventDefault();
  const fd = new FormData(document.getElementById('importForm'));
  const r = await fetch('/api/devices/import', {method:'POST', body: fd});
  const j = await r.json();
  if(r.ok){ alert('Imported ' + j.created + ' devices'); loadDevices(); } else { alert('Import failed: ' + JSON.stringify(j)); }
});

loadDevices();
