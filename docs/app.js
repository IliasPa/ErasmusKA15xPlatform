// Single-file SPA for Erasmus+ KA15x Project Finder
const OWNER = 'IliasPa';
const REPO = 'ErasmusKA15xPlatform';

const DATA_JSON = './data/projects.json';
const FORMS_JSON = './data/forms_by_residence_country.json';

let state = {
  projects: [],
  formsMap: {},
  filters: { year:'', destination:'', myCountry:'', type:'' },
  search: '',
  saved: new Set(JSON.parse(localStorage.getItem('saved')||'[]')),
};

function saveLocal(){ localStorage.setItem('saved', JSON.stringify(Array.from(state.saved))); }

function navigate(hash){ location.hash = hash }

function fetchJSON(){
  return Promise.all([fetch(DATA_JSON).then(r=>r.json()), fetch(FORMS_JSON).then(r=>r.json())]);
}

function el(tag, cls, html){ const d=document.createElement(tag); if(cls) d.className=cls; if(html!==undefined) d.innerHTML=html; return d }

function renderChips(){
  const row = document.getElementById('chipsRow'); row.innerHTML='';
  const chips = [
    {k:'year', label:'Year'},
    {k:'destination', label:'Destination'},
    {k:'myCountry', label:'My Country'},
    {k:'type', label:'Type'}
  ];
  chips.forEach(c=>{
    const chip = el('button','chip'); chip.textContent = `${c.label}${state.filters[c.k]?': '+state.filters[c.k]:''}`;
    if(state.filters[c.k]) chip.classList.add('active');
    chip.addEventListener('click', ()=>openFilterPicker(c.k));
    row.appendChild(chip);
  });
  document.getElementById('filtersCount').textContent = Object.values(state.filters).filter(Boolean).length;
}

function openFilterPicker(key){
  // simple prompt-based picker for brevity (mobile-friendly) — in real app show modal
  const opts = [...new Set(state.projects.map(p=> ({year:p.year,destination:p.destination_country,type:p.type||'KA15'}).map(x=>x[key]||'')).filter(Boolean))];
  const choice = prompt(`Select ${key} (leave empty to clear)\nOptions: ${opts.join(', ')}`, state.filters[key]||'');
  if(choice===null) return;
  state.filters[key] = choice.trim();
  render();
}

function filterProjects(){
  const s = state.search.toLowerCase();
  return state.projects.filter(p=>{
    if(p.status && p.status.toUpperCase()!=='APPROVED') return false;
    if(state.filters.year && p.year!==state.filters.year) return false;
    if(state.filters.destination && p.destination_country!==state.filters.destination) return false;
    if(state.filters.type && (p.type||'')!==state.filters.type) return false;
    if(s){ const hay=[p.title,p.ngo_name,(p.tags||[]).join(' ')].join(' ').toLowerCase(); if(!hay.includes(s)) return false }
    return true;
  })
}

function renderExplore(){
  const view = document.getElementById('view'); view.innerHTML='';
  const list = filterProjects();
  const c = el('div','countline',`${list.length} project(s) found`);
  view.appendChild(c);
  const cards = el('div','cards');
  list.forEach(p=>cards.appendChild(cardForProject(p)));
  view.appendChild(cards);
}

function shortLocation(p){ return (p.destination_country||'') + (p.city? ', '+p.city:'') }

function cardForProject(p){
  const card = el('article','card');
  const media = el('div','media');
  const img = document.createElement('img'); img.src = p.image_url || './assets/placeholder.svg'; img.alt = p.title || '';
  media.className='media'; media.appendChild(img);
  const ka = el('div','ka-badge', p.type || 'KA15'); media.appendChild(ka);
  const bm = el('button','bookmark', state.saved.has(p.id)?'★':'☆'); bm.addEventListener('click',(e)=>{ e.stopPropagation(); toggleSave(p.id,bm); }); media.appendChild(bm);
  card.appendChild(media);
  const body = el('div','body');
  body.appendChild(el('div','meta-cat', (p.category||'').toUpperCase()));
  body.appendChild(el('h3',null,p.title));
  body.appendChild(el('div','loc', shortLocation(p)));
  const pills = el('div','row-pills');
  pills.appendChild(el('div','pill', p.ngo_name));
  pills.appendChild(el('div','pill', (p.spots||'') + ' spots'));
  body.appendChild(pills);
  card.appendChild(body);
  card.addEventListener('click',()=>{ location.hash = '#/project/'+p.id });
  return card;
}

function toggleSave(id,btn){ if(state.saved.has(id)) state.saved.delete(id); else state.saved.add(id); saveLocal(); btn.textContent = state.saved.has(id)?'★':'☆'; }

function renderSaved(){ const view=document.getElementById('view'); view.innerHTML=''; view.appendChild(el('div','countline',`${state.saved.size} project(s) bookmarked`)); const cards=el('div','cards'); state.projects.filter(p=>state.saved.has(p.id)).forEach(p=>cards.appendChild(cardForProject(p))); view.appendChild(cards); }

function renderDetail(id){ const p = state.projects.find(x=>x.id==id); if(!p){ renderExplore(); return; } const view=document.getElementById('view'); view.innerHTML=''; const hero=el('div','hero'); const img=document.createElement('img'); img.src=p.image_url||'./assets/placeholder.svg'; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; hero.appendChild(img); hero.appendChild(el('div','ka-badge',p.type||'KA15')); view.appendChild(hero); const bd=el('div','detail-body'); bd.appendChild(el('h2',null,p.title)); bd.appendChild(el('div','meta-cat', (p.category||'').toUpperCase())); bd.appendChild(el('div','loc', shortLocation(p)+' • '+(p.year||''))); const stats=el('div','stats-row'); stats.appendChild(el('div','stat','Start: '+(p.start_date||'—'))); stats.appendChild(el('div','stat','Spots: '+(p.spots||'—'))); const countriesCount = (p.eligible_residence_countries||'').split(';').filter(Boolean).length || (p.eligible_residence_countries==='ALL'? 'ALL':0);
  stats.appendChild(el('div','stat','Countries: '+countriesCount)); bd.appendChild(stats);
  bd.appendChild(el('div','about',p.description||''));
  // country selector
  const selWrap = el('div',null); selWrap.appendChild(el('label',null,'Select your country:'));
  const sel = document.createElement('select'); sel.innerHTML = '<option value="">Choose country</option>' + Object.keys(state.formsMap).map(c=>`<option value="${c}">${c}</option>`).join('');
  if(state.filters.myCountry){ sel.value = state.filters.myCountry; sel.disabled = true; }
  selWrap.appendChild(sel); bd.appendChild(selWrap);
  view.appendChild(bd);
  // sticky action bar
  const sticky = document.createElement('div'); sticky.className='sticky-actions'; const infoBtn = el('button','action-btn info-btn','Infopack'); infoBtn.addEventListener('click',()=>window.open(p.infopack_url||'#'));
  const applyBtn = el('button','action-btn apply-btn','Apply Now'); applyBtn.addEventListener('click',()=>{
    const useGlobal = !!state.filters.myCountry;
    const residence = useGlobal ? state.filters.myCountry : sel.value;
    const link = resolveApplyLink(p,residence);
    if(!link){ alert('No application link available for selected country'); return; }
    window.open(link,'_blank');
  });
  if(!state.filters.myCountry && !sel.value) applyBtn.disabled = true;
  sel.addEventListener('change',()=>{ applyBtn.disabled = (!sel.value && !state.filters.myCountry); });
  sticky.appendChild(infoBtn); sticky.appendChild(applyBtn); document.body.appendChild(sticky);
}

function resolveApplyLink(p,residence){
  try{ if(p.application_form_urls_by_residence){ const map = JSON.parse(p.application_form_urls_by_residence); if(residence && map[residence]) return map[residence]; } }catch(e){}
  if(residence && state.formsMap[residence]) return state.formsMap[residence];
  if(state.formsMap['DEFAULT']) return state.formsMap['DEFAULT'];
  return p.application_form_url_default || null;
}

function renderAdd(){ const view=document.getElementById('view'); view.innerHTML=''; const form = el('form',null); form.innerHTML = `
  <h2>Add Project</h2>
  <label>Project Type<select name="type"><option>KA151</option><option>KA152</option><option>KA15</option></select></label>
  <label>Title<input name="title" required></label>
  <label>Description<textarea name="description"></textarea></label>
  <label>Year<input name="year" type="number"></label>
  <label>Destination Country<input name="destination_country" name="destination_country"></label>
  <label>City<input name="city" name="city"></label>
  <label>Start Date<input name="start_date" type="date"></label>
  <label>End Date<input name="end_date" type="date"></label>
  <h3>NGO</h3>
  <label>NGO Name<input name="ngo_name"></label>
  <label>NGO Contact Email<input name="ngo_contact_email" type="email"></label>
  <h3>Participants</h3>
  <label>Eligible Countries (semicolon-separated)<input name="eligible_residence_countries"></label>
  <label>Age range<input name="age_range"></label>
  <label>Spots<input name="spots" type="number"></label>
  <h3>Links</h3>
  <label>Infopack URL<input name="infopack_url" type="url"></label>
  <label>Application form default URL<input name="application_form_url_default" type="url"></label>
  <button type="submit" class="btn">Submit</button>
`;
  form.addEventListener('submit',(e)=>{ e.preventDefault(); const fd = new FormData(form); const payload = Object.fromEntries(fd.entries()); payload.submitted_at = new Date().toISOString(); payload.status='PENDING'; openIssueFromPayload(payload); });
  view.appendChild(form);
}

function openIssueFromPayload(payload){
  const title = `Submission: ${payload.title}`;
  const body = 'New project submission\n\n```json\n'+JSON.stringify(payload,null,2)+'\n```\n\n(From site)';
  const url = `https://github.com/${OWNER}/${REPO}/issues/new?labels=submission&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url,'_blank');
}

function initRouter(){
  function route(){
    const hash = location.hash || '#/explore';
    document.body.querySelectorAll('.sticky-actions').forEach(n=>n.remove());
    if(hash.startsWith('#/project/')){ renderDetail(hash.split('/')[2]); }
    else if(hash==='#/saved') renderSaved();
    else if(hash==='#/add') renderAdd();
    else renderExplore();
    renderChips();
  }
  window.addEventListener('hashchange',route);
  document.getElementById('navExplore').addEventListener('click',()=>navigate('#/explore'));
  document.getElementById('navAdd').addEventListener('click',()=>navigate('#/add'));
  document.getElementById('navSaved').addEventListener('click',()=>navigate('#/saved'));
  document.getElementById('searchInput').addEventListener('input',debounce((e)=>{ state.search = e.target.value; render(); },300));
  route();
}

function render(){ renderChips(); const hash = location.hash || '#/explore'; if(hash.startsWith('#/project/')) renderDetail(hash.split('/')[2]); else if(hash==='#/saved') renderSaved(); else if(hash==='#/add') renderAdd(); else renderExplore(); }

function debounce(fn,ms=200){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}

// Init
fetchJSON().then(([projects,forms])=>{ state.projects = projects; state.formsMap = forms; initRouter(); }).catch(e=>{ console.error(e); document.getElementById('view').innerHTML = '<p style="padding:12px">Failed to load data.</p>'; });
// Minimal config - set your repo owner/name below so submit form targets correct repo issues
const CONFIG = {
  REPO_OWNER: 'IliasPa',
  REPO_NAME: 'ErasmusKA15xPlatform',
  ISSUE_LABEL: 'submission'
};

// Owner contact (used for informational UI and README guidance)
const OWNER_EMAIL = 'iliasparaskevas3@gmail.com';

const CSV_PATH = '/data/projects.csv';
const FORMS_JSON = '/data/forms_by_residence_country.json';

let projects = [];
let formsMap = {};

function normalizeCountry(s){return (s||'').trim()}

function createCard(p){
  const div = document.createElement('div'); div.className='card';
  const h = document.createElement('h3'); h.textContent = p.title; div.appendChild(h);
  const meta = document.createElement('div'); meta.className='meta';
  meta.textContent = `${p.ngo_name} • ${p.year} • ${p.destination_country}`;
  div.appendChild(meta);
  const desc = document.createElement('div'); desc.className='desc'; desc.textContent = p.description || ''; div.appendChild(desc);

  const btns = document.createElement('div'); btns.className='buttons';
  const info = document.createElement('a'); info.className='btn'; info.textContent='InfoPack'; info.href = p.infopack_url || '#'; info.target='_blank';
  btns.appendChild(info);

  const apply = document.createElement('div');
  const applyBtn = document.createElement('a'); applyBtn.className='btn ghost'; applyBtn.textContent='Apply'; applyBtn.href='#'; applyBtn.target='_blank';
  // choose link on click
  applyBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const useMy = document.getElementById('use-my-country').checked;
    const myCountry = document.getElementById('filter-mycountry').value;
    const link = pickApplicationLink(p, useMy ? myCountry : null);
    if(!link){ alert('No application form found for this project.'); return; }
    window.open(link, '_blank');
  });
  btns.appendChild(applyBtn);

  // per-card residence dropdown
  const sel = document.createElement('select'); sel.className='small';
  sel.innerHTML = '<option value="">Choose residence country for form</option>';
  const countries = Object.keys(formsMap).sort();
  countries.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o)});
  sel.addEventListener('change',()=>{
    const link = pickApplicationLink(p, sel.value || null);
    if(link) window.open(link,'_blank');
  });
  btns.appendChild(sel);

  div.appendChild(btns);
  return div;
}

function pickApplicationLink(p, residenceCountry){
  // 1) per-project mapping
  try{
    if(p.application_form_urls_by_residence){
      const map = JSON.parse(p.application_form_urls_by_residence);
      if(residenceCountry && map[residenceCountry]) return map[residenceCountry];
    }
  }catch(e){}
  // 2) global forms map
  if(residenceCountry && formsMap[residenceCountry]) return formsMap[residenceCountry];
  // 3) default in forms map
  if(formsMap['DEFAULT']) return formsMap['DEFAULT'];
  // 4) project default
  if(p.application_form_url_default) return p.application_form_url_default;
  return null;
}

function render(list){
  const container = document.getElementById('results'); container.innerHTML='';
  if(list.length===0){ document.getElementById('empty').hidden=false; return; }
  document.getElementById('empty').hidden=true;
  list.forEach(p=>container.appendChild(createCard(p)));
}

function buildFilters(data){
  const years = Array.from(new Set(data.map(d=>d.year))).sort().reverse();
  const dests = Array.from(new Set(data.map(d=>d.destination_country))).sort();
  const myc = Object.keys(formsMap).sort();
  const fy = document.getElementById('filter-year'); years.forEach(y=>{const o=document.createElement('option'); o.value=y; o.textContent=y; fy.appendChild(o)});
  const fd = document.getElementById('filter-destination'); dests.forEach(c=>{const o=document.createElement('option'); o.value=c; o.textContent=c; fd.appendChild(o)});
  const fm = document.getElementById('filter-mycountry'); myc.forEach(c=>{const o=document.createElement('option'); o.value=c; o.textContent=c; fm.appendChild(o)});
}

function applyFilters(){
  const q = document.getElementById('search').value.trim().toLowerCase();
  const year = document.getElementById('filter-year').value;
  const dest = document.getElementById('filter-destination').value;
  const my = document.getElementById('filter-mycountry').value;
  let res = projects.slice();
  if(year) res = res.filter(r=>r.year===year);
  if(dest) res = res.filter(r=>r.destination_country===dest);
  if(q) res = res.filter(r=>[r.title, r.ngo_name, r.tags].join(' ').toLowerCase().includes(q));
  render(res);
}

function debounce(fn,ms=250){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}

async function load(){
  const [csvResp, jsonResp] = await Promise.all([fetch(CSV_PATH), fetch(FORMS_JSON)]);
  const csvText = await csvResp.text();
  const parsed = Papa.parse(csvText, {header:true,skipEmptyLines:true});
  projects = parsed.data.filter(r=> (r.status||'').toUpperCase()==='APPROVED');
  formsMap = await jsonResp.json();
  buildFilters(projects);
  render(projects);
  document.getElementById('search').addEventListener('input', debounce(applyFilters,300));
  document.getElementById('filter-year').addEventListener('change',applyFilters);
  document.getElementById('filter-destination').addEventListener('change',applyFilters);
}

document.addEventListener('DOMContentLoaded',()=>{
  load().catch(e=>{console.error(e);document.getElementById('empty').textContent='Failed to load data.';document.getElementById('empty').hidden=false});
});
