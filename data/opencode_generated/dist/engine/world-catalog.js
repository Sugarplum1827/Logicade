const search=document.getElementById('world-search');
const genre=document.getElementById('world-genre');
const unit=document.getElementById('world-unit');
const cards=[...document.querySelectorAll('.world-card')];
const result=document.getElementById('world-result');
const empty=document.getElementById('world-empty');
const params=new URLSearchParams(location.search);
search.value=params.get('q')||params.get('topic')?.replaceAll('_',' ')||'';
if([...genre.options].some(o=>o.value===params.get('genre')))genre.value=params.get('genre');
if([...unit.options].some(o=>o.value===params.get('unit')))unit.value=params.get('unit');
let progress={};try{progress=JSON.parse(localStorage.getItem('logicade.cp1-worlds.v2')||'{}');}catch{/* Optional browser storage. */}
document.querySelectorAll('[data-challenge]').forEach(a=>{if(progress[a.dataset.challenge]?.mastered){a.classList.add('mastered');a.title+=' · Mastered';}});
function apply(){
  const q=search.value.trim().toLowerCase();let count=0;
  cards.forEach(card=>{card.hidden=!(card.dataset.search.includes(q)&&(!genre.value||card.dataset.genre===genre.value)&&(!unit.value||card.dataset.unit===unit.value));if(!card.hidden)count++;});
  result.textContent=`${count} worlds · ${count*10} CP1 labs${Object.keys(progress).length?` · ${Object.values(progress).filter(p=>p.mastered).length} labs mastered on this device`:''}`;
  empty.hidden=count>0;
  const url=new URL(location.href);url.search='';if(q)url.searchParams.set('q',search.value.trim());if(genre.value)url.searchParams.set('genre',genre.value);if(unit.value)url.searchParams.set('unit',unit.value);history.replaceState(null,'',url);
}
search.addEventListener('input',apply);genre.addEventListener('change',apply);unit.addEventListener('change',apply);
document.getElementById('world-reset').addEventListener('click',()=>{search.value='';genre.value='';unit.value='';apply();search.focus();});
document.getElementById('world-random').addEventListener('click',()=>{const available=cards.filter(c=>!c.hidden);if(available.length)location.href=available[Math.floor(Math.random()*available.length)].querySelector('.world-card-cover').href;});
apply();
