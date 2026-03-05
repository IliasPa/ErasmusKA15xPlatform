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
