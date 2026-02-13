async function checkHealth(){
  try{
    let r = await fetch('/api/health');
    let j = await r.json();
    document.getElementById('status').innerText = 'Backend: ' + (j.status || 'unknown');
  }catch(e){
    document.getElementById('status').innerText = 'Backend unreachable';
  }
}
checkHealth();
