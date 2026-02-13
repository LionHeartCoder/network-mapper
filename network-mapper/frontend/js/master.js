document.addEventListener('DOMContentLoaded', async ()=>{
  const map = L.map('map').setView([38.0, -78.5], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);

  // simple: fetch buildings from backend (expect lat/lon fields)
  try{
    let res = await fetch('/api/buildings');
    if(res.ok){
      let buildings = await res.json();
      buildings.forEach(b=>{
        if(b.lat && b.lon){
          let m = L.marker([b.lat,b.lon]).addTo(map).bindPopup(`<b>${b.name}</b>`);
        }
      })
    }
  }catch(e){console.warn('failed to load buildings', e)}
});
