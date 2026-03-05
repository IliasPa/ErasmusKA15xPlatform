// Erasmus+ KA15x Project Finder - SPA
(function(){
  const OWNER = 'IliasPa';
  const REPO = 'ErasmusKA15xPlatform';
  const DATA_JSON = './data/projects.json';
  const FORMS_JSON = './data/forms_by_residence_country.json';

  const state = {
    projects: [],
    formsMap: {},
    filters: { year:'', destination:'', myCountry:'', type:'' },
    search: '',
    saved: new Set(JSON.parse(localStorage.getItem('saved')||'[]'))
  };

  // Utilities
  const qs = s=>document.querySelector(s);
  const qsa = s=>Array.from(document.querySelectorAll(s));
  const el = (t,cls)=>{const d=document.createElement(t); if(cls) d.className=cls; return d};

  function persistSaved(){ localStorage.setItem('saved', JSON.stringify(Array.from(state.saved))); }

  // Fetch data
  async function loadData(){
    const [pj, fm] = await Promise.all([fetch(DATA_JSON).then(r=>r.json()), fetch(FORMS_JSON).then(r=>r.json())]);
    state.projects = pj.map(normalizeProject);
    state.formsMap = fm;
  }

  function normalizeProject(p){
    // ensure fields exist and normalize types
    p.tags = Array.isArray(p.tags) ? p.tags : (p.tags||'').toString().split(/;|,/).map(s=>s.trim()).filter(Boolean);
    p.eligible_residence_countries = (p.eligible_residence_countries||'').toString();
    p.spots = p.spots ? Number(p.spots) : (p.spots===0?0:'');
    return p;
  }

  // Router
  function route(){
    const hash = location.hash || '#/explore';
    renderHeaderBadge();
    if(hash.startsWith('#/project/')) renderProjectDetail(hash.split('/')[2]);
    else if(hash==='#/saved') renderSaved();
    else if(hash==='#/add') renderAdd();
    else renderExplore();
  }

  // Header and chips
  function renderHeaderBadge(){ const cnt = Object.values(state.filters).filter(Boolean).length; qs('#filtersCount').textContent = cnt; renderChips(); }

  function renderChips(){ const row = qs('#chipsRow'); row.innerHTML=''; const chips = [
    {k:'year', label:'Year'}, {k:'destination', label:'Destination'}, {k:'myCountry', label:'My Country'}, {k:'type', label:'Type'}
  ];
    chips.forEach(ch=>{
      const b = el('button','chip'); b.textContent = ch.label + (state.filters[ch.k]? ': '+state.filters[ch.k] : '');
      if(state.filters[ch.k]) b.classList.add('active');
      b.addEventListener('click', ()=>openPicker(ch.k));
      row.appendChild(b);
    });
  }

  // Country/Value picker modal (supports search)
  function openPicker(key){
    const modal = createModal();
    const header = el('div','picker-header'); header.innerHTML = `<strong>Select ${key}</strong>`;
    const search = document.createElement('input'); search.placeholder='Search...'; search.className='picker-search';
    header.appendChild(search);
    modal.body.appendChild(header);
    const list = el('div','picker-list'); modal.body.appendChild(list);

    let options = [];
    if(key==='year') options = Array.from(new Set(state.projects.map(p=>p.year))).sort().reverse();
    else if(key==='destination') options = Array.from(new Set(state.projects.map(p=>p.destination_country))).sort();
    else if(key==='type') options = Array.from(new Set(state.projects.map(p=>p.type||'KA15'))).sort();
    else if(key==='myCountry') options = Object.keys(state.formsMap).sort();

    function renderOptions(filter){ list.innerHTML=''; (options.filter(o=>o.toLowerCase().includes(filter))).forEach(opt=>{
      const it = el('button','picker-item'); it.textContent = opt; it.addEventListener('click', ()=>{ state.filters[key]=opt; closeModal(modal); route(); }); list.appendChild(it);
    });
    const clearBtn = el('button','picker-clear'); clearBtn.textContent='Clear'; clearBtn.addEventListener('click', ()=>{ state.filters[key]=''; closeModal(modal); route(); }); list.appendChild(clearBtn);
    }
    renderOptions('');
    search.addEventListener('input', e=> renderOptions(e.target.value.toLowerCase()));
  }

  function createModal(){
    const overlay = el('div','modal-overlay');
    const box = el('div','modal-box');
    const close = el('button','modal-close'); close.textContent='✕'; close.addEventListener('click', ()=>closeModal({overlay,box}));
    box.appendChild(close);
    const body = el('div','modal-body'); box.appendChild(body);
    overlay.appendChild(box); document.body.appendChild(overlay);
    return {overlay,box,body};
  }
  function closeModal(modal){ if(!modal) return; if(modal.overlay) modal.overlay.remove(); else modal.remove(); }

  // Explore
  function filterProjects(){
    const q=state.search.trim().toLowerCase();
    return state.projects.filter(p=>{
      if((p.status||'').toUpperCase()!=='APPROVED') return false;
      if(state.filters.year && p.year!=state.filters.year) return false;
      if(state.filters.destination && p.destination_country!=state.filters.destination) return false;
      if(state.filters.type && (p.type||'')!=state.filters.type) return false;
      if(q){ const hay = [p.title,p.ngo_name,(p.tags||[]).join(' '),p.city,p.description].join(' ').toLowerCase(); if(!hay.includes(q)) return false }
      return true;
    });
  }

  function renderExplore(){
    const view = qs('#view'); view.innerHTML=''; const list = filterProjects(); view.appendChild(el('div','countline',`${list.length} project(s) found`));
    const container = el('div','cards');
    list.forEach(p=> container.appendChild(renderCard(p)));
    view.appendChild(container);
    if(list.length===0){ const empty = el('div','empty'); empty.innerHTML = '<p>No projects match your filters.</p><button class="btn" id="clearFilters">Clear filters</button>'; view.appendChild(empty); qs('#clearFilters').addEventListener('click', ()=>{ state.filters={year:'',destination:'',myCountry:'',type:''}; route(); }); }
  }

  function renderCard(p){
    const card = el('article','card');
    const media = el('div','media'); const img = document.createElement('img'); img.src = p.image_url||'./assets/placeholder.svg'; img.alt = p.title; media.appendChild(img);
    const ka = el('div','ka-badge'); ka.textContent = p.type||'KA15'; media.appendChild(ka);
    const bm = el('button','bookmark'); bm.textContent = state.saved.has(p.id)?'★':'☆'; bm.addEventListener('click', e=>{ e.stopPropagation(); toggleSave(p.id,bm); }); media.appendChild(bm);
    card.appendChild(media);
    const body = el('div','body'); body.appendChild(el('div','meta-cat',(p.category||'').toUpperCase())); body.appendChild(el('h3',null)).firstChild.textContent = p.title;
    body.appendChild(el('div','loc', (p.destination_country || '') + (p.city? ', '+p.city:'')));
    const pillRow = el('div','row-pills'); pillRow.appendChild(el('div','pill',p.ngo_name)); pillRow.appendChild(el('div','pill', (p.spots||'') + ' spots')); body.appendChild(pillRow);
    card.appendChild(body);
    card.addEventListener('click', ()=> location.hash = '#/project/'+p.id );
    return card;
  }

  function toggleSave(id,btn){ if(state.saved.has(id)) state.saved.delete(id); else state.saved.add(id); persistSaved(); btn.textContent = state.saved.has(id)?'★':'☆'; }

  // Detail
  function renderProjectDetail(id){
    const p = state.projects.find(x=>x.id==id); if(!p){ route(); return; }
    const view = qs('#view'); view.innerHTML='';
    const back = el('button','btn'); back.textContent='← Back'; back.addEventListener('click', ()=> location.hash='#/explore'); view.appendChild(back);
    const hero = el('div','hero'); const img = document.createElement('img'); img.src = p.image_url||'./assets/placeholder.svg'; hero.appendChild(img); hero.appendChild(el('div','ka-badge', p.type||'KA15')); view.appendChild(hero);
    const body = el('div','detail-body'); body.appendChild(el('h2',null)).firstChild.textContent = p.title; body.appendChild(el('div','meta-cat',(p.category||'').toUpperCase())); body.appendChild(el('div','loc',(p.destination_country||'') + (p.city? ', '+p.city:'') + ' • ' + (p.year||'')));
    const stats = el('div','stats-row'); stats.appendChild(el('div','stat','Start: '+(p.start_date||'—'))); stats.appendChild(el('div','stat','Spots: '+(p.spots||'—'))); const countriesCount = p.eligible_residence_countries==='ALL' ? 'ALL' : (p.eligible_residence_countries||'').split(';').filter(Boolean).length; stats.appendChild(el('div','stat','Countries: '+countriesCount)); body.appendChild(stats);
    body.appendChild(el('div','about',p.description||''));

    // residence selector
    const resWrap = el('div','residence-wrap'); resWrap.appendChild(el('label',null,'Select your country:'));
    const select = document.createElement('select'); select.innerHTML = '<option value="">Choose residence country</option>' + Object.keys(state.formsMap).map(c=>`<option value="${c}">${c}</option>`).join('');
    if(state.filters.myCountry){ select.value = state.filters.myCountry; select.disabled = true; }
    resWrap.appendChild(select); body.appendChild(resWrap);

    view.appendChild(body);

    // sticky CTA
    const existing = qs('.sticky-actions'); if(existing) existing.remove();
    const sticky = el('div','sticky-actions'); const info = el('button','action-btn info-btn'); info.textContent='Infopack'; info.addEventListener('click', ()=> window.open(p.infopack_url || '#','_blank'));
    const apply = el('button','action-btn apply-btn'); apply.textContent='Apply Now'; const updateApplyState = ()=>{
      const residence = state.filters.myCountry || select.value;
      const link = resolveApplyLink(p,residence);
      apply.disabled = !link;
      apply.dataset.href = link||'';
    };
    apply.addEventListener('click', ()=>{ const href = apply.dataset.href; if(!href) return alert('Please choose a residence country'); window.open(href,'_blank'); });
    select.addEventListener('change', updateApplyState); updateApplyState();
    sticky.appendChild(info); sticky.appendChild(apply); document.body.appendChild(sticky);
  }

  function resolveApplyLink(p,residence){
    try{ if(p.application_form_urls_by_residence){ const map = JSON.parse(p.application_form_urls_by_residence); if(residence && map[residence]) return map[residence]; } }catch(e){}
    if(residence && state.formsMap[residence]) return state.formsMap[residence];
    if(p.application_form_url_default) return p.application_form_url_default;
    if(state.formsMap['DEFAULT']) return state.formsMap['DEFAULT'];
    return null;
  }

  // Saved
  function renderSaved(){ const view = qs('#view'); view.innerHTML=''; view.appendChild(el('div','countline',`${state.saved.size} project(s) saved`)); const container = el('div','cards'); state.projects.filter(p=> state.saved.has(p.id) && (p.status||'').toUpperCase()==='APPROVED').forEach(p=> container.appendChild(renderCard(p))); view.appendChild(container); }

  // Add
  function renderAdd(){ const view = qs('#view'); view.innerHTML=''; const form = el('form','add-form'); form.innerHTML = `
    <h2>Add Project</h2>
    <label>Project Type<select name="type"><option>KA151</option><option>KA152</option><option>KA153</option></select></label>
    <label>Title<input name="title" required></label>
    <label>Description<textarea name="description" required></textarea></label>
    <label>Year<input name="year" type="number" min="2023" max="2030" required></label>
    <label>Destination Country<input name="destination_country" placeholder="Country name" required></label>
    <label>City<input name="city"></label>
    <label>Start Date<input name="start_date" type="date"></label>
    <label>End Date<input name="end_date" type="date"></label>
    <h3>NGO</h3>
    <label>NGO Name<input name="ngo_name" required></label>
    <label>NGO Contact Email<input name="ngo_contact_email" type="email" required></label>
    <h3>Participants</h3>
    <label>Eligible Countries (semicolon-separated, or ALL)<input name="eligible_residence_countries" required></label>
    <label>Age range<input name="age_range"></label>
    <label>Spots<input name="spots" type="number"></label>
    <h3>Links</h3>
    <label>Infopack URL<input name="infopack_url" type="url" required></label>
    <label>Application form default URL<input name="application_form_url_default" type="url" required></label>
    <div class="form-actions"><button class="btn" type="submit">Submit</button></div>
  `;
    form.addEventListener('submit', (e)=>{ e.preventDefault(); const data = Object.fromEntries(new FormData(form).entries()); data.submitted_at = new Date().toISOString(); data.status='PENDING'; openIssueForSubmission(data); });
    view.appendChild(form);
  }

  function openIssueForSubmission(payload){ const title = `Submission: ${payload.title}`; const body = 'New project submission\n\n```json\n'+JSON.stringify(payload,null,2)+'\n```\n\n(Submitted from site)'; const url = `https://github.com/${OWNER}/${REPO}/issues/new?labels=submission&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`; window.open(url,'_blank'); qs('#view').innerHTML = '<p>Submission opened in GitHub. The repository owner will review and approve.</p>'; }

  // Bind UI
  function bindUI(){ qs('#searchInput').addEventListener('input', debounce(e=>{ state.search = e.target.value; route(); },250)); qs('#navExplore').addEventListener('click', ()=> location.hash='#/explore'); qs('#navAdd').addEventListener('click', ()=> location.hash='#/add'); qs('#navSaved').addEventListener('click', ()=> location.hash='#/saved'); }

  function debounce(fn,ms=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

  // Init
  document.addEventListener('DOMContentLoaded', async ()=>{ await loadData(); bindUI(); window.addEventListener('hashchange', route); route(); });

})();
