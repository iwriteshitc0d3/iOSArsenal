// iOSArsenal Application & UI Engine

let reviewed = {};
let activeCat = null;
let activeSev = 'all';
let searchQ = '';
let currentPlaybooks = [];
let categoriesList = [];

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function catMeta(key){
  return (categoriesList.length ? categoriesList : (typeof CATS !== 'undefined' ? CATS : [])).find(c => c.key === key) || {
    name: key, icon: '📁', cls: 'ic-storage'
  };
}

// Switch between Checklist view and API Docs view
function switchView(viewId){
  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  const target = document.getElementById(viewId);
  if(target){
    target.classList.add('active');
  }
}

// Render deep dive guide cards
function renderModuleCards(elId, arr, icon){
  const el = document.getElementById(elId);
  if(!el) return;
  el.innerHTML = arr.map((item, idx)=>`
    <div class="card open jb-card reveal" style="transition-delay:${idx*60}ms;">
      <div class="card-head" style="cursor:default;">
        <div class="card-title-wrap">
          <div class="card-title">${icon} ${item.name}${item.tag ? ' — '+item.tag : ''}</div>
          ${item.scope ? `<div class="card-meta"><span>${item.scope}</span></div>` : ''}
        </div>
      </div>
      <div class="card-body" style="max-height:none;">
        <div class="card-body-inner">
          <div class="blk"><p>${item.note}</p></div>
          <div class="method-grid">
            ${item.methods.map((m,i)=>`<div class="method">
              <div class="method-head"><span class="method-num">${i+1}</span><span class="method-title">${m.title}</span></div>
              <pre class="code-block">${escapeHtml(m.cmd)}</pre>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `).join('');
  observeReveals();
}

// Render categories grid and filtered playbook cards
async function render(){
  // 1. Render Category grid
  const grid = document.getElementById('catGrid');
  if(grid){
    grid.innerHTML = categoriesList.map((c, idx)=>{
      const count = (typeof DATA !== 'undefined') ? DATA.filter(d=>d.cat===c.key).length : (c.count || 0);
      return `<div class="cat-tile reveal ${activeCat===c.key?'active':''}" data-cat="${c.key}" style="transition-delay:${idx*40}ms;">
        <div class="cat-icon ${c.cls}">${c.icon}</div>
        <div class="cat-name">${c.name}</div>
        <div class="cat-count">${count} checks</div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.cat-tile').forEach(el=>{
      el.addEventListener('click', ()=>{
        const k = el.dataset.cat;
        if(activeCat === k){
          window.router.navigate('/');
        } else {
          window.router.navigate(`/category/${k}`);
        }
      });
    });
  }

  // 2. Fetch filtered playbooks from API Engine / Client
  currentPlaybooks = await window.api.getPlaybooks({
    cat: activeCat,
    sev: activeSev,
    q: searchQ
  });

  const list = document.getElementById('list');
  const empty = document.getElementById('emptyState');
  if(!list) return;

  if(currentPlaybooks.length === 0){
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    list.innerHTML = currentPlaybooks.map((d, idx)=>{
      const cm = catMeta(d.cat);
      const isRev = !!reviewed[d.id];
      return `<div class="card reveal ${isRev?'reviewed':''}" data-id="${d.id}" id="card-${d.id}" style="transition-delay:${Math.min(idx,8)*35}ms;">
        <div class="card-head">
          <div class="chk" data-role="chk" title="Mark check reviewed">✓</div>
          <div class="card-title-wrap">
            <div class="card-title">${d.title}</div>
            <div class="card-meta">
              <span>${cm.icon} ${cm.name}</span>
              <span>${d.masvs}</span>
              <span>${d.mastg}</span>
            </div>
          </div>
          <span class="sev-tag sev-${d.sev}">${d.sev}</span>
          <div class="card-actions">
            <button class="card-action-btn copy-link-btn" data-id="${d.id}" title="Copy direct link to this check">🔗</button>
            <a class="card-action-btn" href="#/api-docs" data-api-target="/api/playbooks/${d.id}" title="Inspect in API Explorer">API</a>
          </div>
          <svg class="caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <div class="card-body">
          <div class="card-body-inner">
            <div class="blk"><div class="blk-label">Summary</div><p>${d.summary}</p></div>
            <div class="blk"><div class="blk-label">Attacker rationale</div><p>${d.attacker}</p></div>
            <div class="blk"><div class="blk-label">Exploitation PoC — ${d.methods.length} ways</div>
              <div class="method-grid">
                ${d.methods.map((m,i)=>`<div class="method">
                  <div class="method-head"><span class="method-num">${i+1}</span><span class="method-title">${m.title}</span></div>
                  <pre class="code-block">${escapeHtml(m.cmd)}</pre>
                </div>`).join('')}
              </div>
            </div>
            <div class="blk"><div class="blk-label">Tools</div><div class="tool-pills">${(d.tools||[]).map(t=>`<span class="tool-pill">${t}</span>`).join('')}</div></div>
            <div class="blk"><div class="blk-label">Mitigation</div><p>${d.mitigation}</p></div>
          </div>
        </div>
      </div>`;
    }).join('');

    // Attach card event listeners
    list.querySelectorAll('.card').forEach(card=>{
      const head = card.querySelector('.card-head');
      const body = card.querySelector('.card-body');
      head.addEventListener('click', (e)=>{
        if(e.target.closest('[data-role="chk"]') || e.target.closest('.card-actions')) return;
        const open = card.classList.toggle('open');
        body.style.maxHeight = open ? body.scrollHeight+40+'px' : '0px';
      });

      card.querySelector('[data-role="chk"]').addEventListener('click', async (e)=>{
        e.stopPropagation();
        const id = card.dataset.id;
        const newState = !reviewed[id];
        reviewed = await window.api.setReviewed(id, newState);
        card.classList.toggle('reviewed', newState);
        updateProgress();
      });

      // Permalink copy button
      const copyBtn = card.querySelector('.copy-link-btn');
      if(copyBtn){
        copyBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const id = copyBtn.dataset.id;
          const permalink = `${window.location.origin}${window.location.pathname}#/playbook/${id}`;
          navigator.clipboard.writeText(permalink).then(()=>{
            showMilestone(`📋 Link copied: #${id}`);
          }).catch(()=>{
            window.location.hash = `#/playbook/${id}`;
          });
        });
      }

      // API inspect button
      const apiBtn = card.querySelector('[data-api-target]');
      if(apiBtn){
        apiBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const targetUrl = apiBtn.dataset.apiTarget;
          window.sessionStorage.setItem('api-explorer-next', targetUrl);
        });
      }
    });
  }

  updateProgress();
  observeReveals();
}

let lastMilestone = 0;
function updateProgress(){
  const total = (typeof DATA !== 'undefined') ? DATA.length : currentPlaybooks.length;
  const done = Object.values(reviewed).filter(Boolean).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  
  const progLabel = document.getElementById('progressLabel');
  const progFill = document.getElementById('progressFill');
  if(progLabel) progLabel.textContent = `${done} / ${total} reviewed · ${pct}%`;
  if(progFill) progFill.style.width = pct+'%';

  const milestones = [25,50,75,100];
  const hit = milestones.filter(m=>pct>=m).pop();
  if(hit && hit>lastMilestone){
    lastMilestone = hit;
    const msg = hit===100 ? '🎉 All checks reviewed — nice work!' : `⚡ ${hit}% through the checklist`;
    showMilestone(msg);
    if(hit===100) burstConfetti();
  }
  if(pct===0) lastMilestone = 0;
}

function showMilestone(text){
  const el = document.getElementById('milestoneToast');
  if(!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showMilestone._t);
  showMilestone._t = setTimeout(()=>el.classList.remove('show'), 2600);
}

function burstConfetti(){
  const colors = ['#FF9F0A','#34C7B8','#FF453A','#FFD60A','#64D2FF'];
  for(let i=0;i<28;i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = (45 + Math.random()*10) + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random()*0.3)+'s';
    p.style.transform = `translateX(${(Math.random()-0.5)*260}px)`;
    document.body.appendChild(p);
    setTimeout(()=>p.remove(), 1500);
  }
}

// Animate numbers
function animateCounter(el, target, duration){
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now-start)/duration);
    const eased = 1 - Math.pow(1-p, 3);
    el.textContent = Math.round(eased*target);
    if(p<1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

// Top scroll indicator and back-to-top button
function initScrollEffects(){
  const bar = document.getElementById('topProgress');
  const btt = document.getElementById('backToTop');
  const onScroll = ()=>{
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    if(bar) bar.style.width = (max>0 ? (scrolled/max)*100 : 0) + '%';
    if(btt) btt.classList.toggle('show', scrolled > 500);
  };
  document.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
  if(btt) btt.addEventListener('click', ()=>window.scrollTo({top:0, behavior:'smooth'}));
}

let revealObserver = null;
function observeReveals(){
  if(!revealObserver){
    revealObserver = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add('visible');
          revealObserver.unobserve(e.target);
        }
      });
    }, {threshold:0.12, rootMargin:'0px 0px -40px 0px'});
  }
  document.querySelectorAll('.reveal:not(.visible)').forEach(el=>revealObserver.observe(el));
}

// Update API Status Badge
async function updateApiStatusUI(){
  const badge = document.getElementById('apiStatusBadge');
  const text = document.getElementById('apiStatusText');
  if(!badge || !text) return;

  const isOnline = await window.api.initializationPromise;
  badge.classList.remove('online', 'offline');
  if(isOnline){
    badge.classList.add('online');
    text.textContent = 'API Engine: Online';
  } else {
    badge.classList.add('offline');
    text.textContent = 'Standalone Mode';
  }
}

// -------------------------------------------------------------
// Interactive API Explorer Runner
// -------------------------------------------------------------
let lastApiResponse = null;
let lastApiEndpoint = '/api/stats';

async function executeApiRequest(endpointPath){
  const codeEl = document.getElementById('apiResponseCode');
  const statusEl = document.getElementById('apiResStatus');
  const timeEl = document.getElementById('apiResTime');
  const runnerBadge = document.getElementById('runnerStatusBadge');

  if(!codeEl) return;
  lastApiEndpoint = endpointPath;
  codeEl.textContent = '// Fetching ' + endpointPath + '...';

  const start = performance.now();
  try {
    let data;
    let status = 200;
    let statusText = 'OK';

    if (window.api.isOnline) {
      const res = await fetch(endpointPath);
      status = res.status;
      statusText = res.statusText || (res.ok ? 'OK' : 'Error');
      data = await res.json();
    } else {
      // Local client evaluation fallback
      if (endpointPath === '/api' || endpointPath === '/api/') {
        data = { name: 'iOSArsenal API (Offline Preview)', version: '1.0.0' };
      } else if (endpointPath === '/api/stats') {
        data = { success: true, data: await window.api.getStats() };
      } else if (endpointPath.startsWith('/api/categories')) {
        const parts = endpointPath.split('/');
        if (parts[3]) {
          data = { success: true, data: await window.api.getCategory(parts[3]) };
        } else {
          data = { success: true, data: await window.api.getCategories() };
        }
      } else if (endpointPath.startsWith('/api/playbooks')) {
        const parts = endpointPath.split('?');
        const path = parts[0];
        const qs = new URLSearchParams(parts[1] || '');
        if (path.replace('/api/playbooks/', '').length > 0 && !path.endsWith('/playbooks')) {
          const id = path.replace('/api/playbooks/', '');
          data = { success: true, data: await window.api.getPlaybook(id) };
        } else {
          data = {
            success: true,
            data: await window.api.getPlaybooks({
              cat: qs.get('cat'),
              sev: qs.get('sev'),
              q: qs.get('q')
            })
          };
        }
      } else if (endpointPath.startsWith('/api/modules')) {
        const parts = endpointPath.split('/');
        data = { success: true, data: await window.api.getModules(parts[3]) };
      } else if (endpointPath.startsWith('/api/reviewed')) {
        data = { success: true, data: await window.api.getReviewed() };
      } else {
        data = { success: true, note: 'Offline fallback response', endpoint: endpointPath };
      }
    }

    const elapsed = Math.round(performance.now() - start);
    lastApiResponse = data;

    statusEl.textContent = `${status} ${statusText}`;
    statusEl.className = `status-tag ${status < 400 ? 'status-200' : 'status-error'}`;
    timeEl.textContent = `${elapsed} ms`;
    codeEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    statusEl.textContent = 'Error';
    statusEl.className = 'status-tag status-error';
    timeEl.textContent = `${elapsed} ms`;
    codeEl.textContent = `// Error executing request:\n${err.message}`;
  }
}

function initApiExplorer(){
  const preset = document.getElementById('apiEndpointPreset');
  const input = document.getElementById('apiCustomEndpoint');
  const sendBtn = document.getElementById('apiSendBtn');
  const copyCurlBtn = document.getElementById('apiCopyCurlBtn');
  const copyJsonBtn = document.getElementById('apiCopyJsonBtn');

  if(preset && input){
    preset.addEventListener('change', ()=>{
      input.value = preset.value;
      executeApiRequest(preset.value);
    });
  }

  if(sendBtn && input){
    sendBtn.addEventListener('click', ()=>{
      const val = input.value.trim() || '/api/stats';
      executeApiRequest(val);
    });
  }

  if(copyCurlBtn){
    copyCurlBtn.addEventListener('click', ()=>{
      const endpoint = (input ? input.value : lastApiEndpoint) || '/api/stats';
      const curl = `curl -X GET "${window.location.origin}${endpoint}" -H "Accept: application/json"`;
      navigator.clipboard.writeText(curl).then(()=>{
        showMilestone('📋 cURL command copied!');
      });
    });
  }

  if(copyJsonBtn){
    copyJsonBtn.addEventListener('click', ()=>{
      if(lastApiResponse){
        navigator.clipboard.writeText(JSON.stringify(lastApiResponse, null, 2)).then(()=>{
          showMilestone('📋 JSON response copied!');
        });
      }
    });
  }

  document.querySelectorAll('.run-endpoint-btn').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const url = btn.dataset.url;
      if(input) input.value = url;
      if(preset) preset.value = url;
      executeApiRequest(url);
      const runner = document.querySelector('.api-test-runner');
      if(runner) runner.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  });
}

// -------------------------------------------------------------
// Setup Router Hooks
// -------------------------------------------------------------
function setupRouter(){
  const router = window.router;

  // Root / Home route
  router.on('/', async (params, query)=>{
    switchView('viewChecklist');
    activeCat = query.cat || null;
    activeSev = query.sev || 'all';
    searchQ = (query.q || '').toLowerCase();

    const searchInput = document.getElementById('searchInput');
    if(searchInput) searchInput.value = query.q || '';

    document.querySelectorAll('#sevRow .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.sev === activeSev);
    });

    await render();
  });

  // Categories route
  router.on('/categories', async (params, query)=>{
    switchView('viewChecklist');
    activeCat = null;
    await render();
    const heading = document.getElementById('headingCategories');
    if(heading) heading.scrollIntoView({ behavior:'smooth' });
  });

  // Category detail route (e.g. #/category/storage)
  router.on('/category/:cat', async (params, query)=>{
    switchView('viewChecklist');
    activeCat = params.cat;
    activeSev = query.sev || 'all';
    searchQ = (query.q || '').toLowerCase();

    document.querySelectorAll('#sevRow .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.sev === activeSev);
    });

    await render();
    const grid = document.getElementById('catGrid');
    if(grid) grid.scrollIntoView({ behavior:'smooth' });
  });

  // Single Playbook Permalink Route (e.g. #/playbook/stor-1)
  router.on('/playbook/:id', async (params, query)=>{
    switchView('viewChecklist');
    activeCat = null;
    activeSev = 'all';
    searchQ = '';
    await render();

    const card = document.getElementById(`card-${params.id}`);
    if(card){
      card.classList.add('open');
      const body = card.querySelector('.card-body');
      if(body) body.style.maxHeight = body.scrollHeight + 40 + 'px';
      card.scrollIntoView({ behavior:'smooth', block:'center' });
      card.style.outline = '2px solid var(--accent)';
      setTimeout(()=>{ card.style.outline = ''; }, 2400);
    }
  });

  // Modules route
  router.on('/modules', async ()=>{
    switchView('viewChecklist');
    const heading = document.getElementById('headingModules');
    if(heading) heading.scrollIntoView({ behavior:'smooth' });
  });

  router.on('/modules/:type', async (params)=>{
    switchView('viewChecklist');
    const type = params.type;
    let target = null;
    if(type === 'jailbreaks') target = document.getElementById('headingModules');
    else if(type === 'jbdetect') target = document.getElementById('headingJbDetect');
    else if(type === 'sslpin') target = document.getElementById('headingSslPin');

    if(target) target.scrollIntoView({ behavior:'smooth' });
  });

  // API Docs view route
  router.on('/api-docs', async ()=>{
    switchView('viewApiDocs');
    const nextTarget = window.sessionStorage.getItem('api-explorer-next');
    if(nextTarget){
      window.sessionStorage.removeItem('api-explorer-next');
      const input = document.getElementById('apiCustomEndpoint');
      if(input) input.value = nextTarget;
      executeApiRequest(nextTarget);
    } else if(!lastApiResponse){
      executeApiRequest('/api/stats');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// -------------------------------------------------------------
// App Initialization
// -------------------------------------------------------------
(async function init(){
  setupRouter();
  initScrollEffects();
  initApiExplorer();

  // Load categories and reviewed state
  categoriesList = await window.api.getCategories();
  reviewed = await window.api.getReviewed();

  // Load modules
  const modules = await window.api.getModules();
  renderModuleCards('jbList', modules.jailbreaks ? modules.jailbreaks.items : JAILBREAKS, '🔓');
  renderModuleCards('jbDetectList', modules.jbdetect ? modules.jbdetect.items : JBDETECT, '🕵️');
  renderModuleCards('sslPinList', modules.sslpin ? modules.sslpin.items : SSLPIN, '🔒');

  // Animated counters
  const totalPlaybooks = (typeof DATA !== 'undefined') ? DATA.length : 61;
  const playbookStat = document.getElementById('stat-playbooks');
  if(playbookStat) playbookStat.dataset.target = totalPlaybooks;
  const inlineStat = document.getElementById('stat-count-inline');
  if(inlineStat) inlineStat.textContent = totalPlaybooks;

  document.querySelectorAll('.stat .n[data-target]').forEach(el=>{
    animateCounter(el, parseInt(el.dataset.target,10), 1100);
  });

  // Search input event
  let searchDebounce = null;
  const searchInput = document.getElementById('searchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(()=>{
        searchQ = e.target.value.trim().toLowerCase();
        render();
      }, 150);
    });
  }

  // Severity row click event
  const sevRow = document.getElementById('sevRow');
  if(sevRow){
    sevRow.addEventListener('click', (e)=>{
      const chip = e.target.closest('.chip');
      if(!chip) return;
      activeSev = chip.dataset.sev;
      document.querySelectorAll('#sevRow .chip').forEach(c => c.classList.toggle('active', c === chip));
      render();
    });
  }

  // Clear button
  const clearBtn = document.getElementById('clearBtn');
  if(clearBtn){
    clearBtn.addEventListener('click', async ()=>{
      reviewed = await window.api.clearReviewed();
      activeCat = null;
      activeSev = 'all';
      searchQ = '';
      if(searchInput) searchInput.value = '';
      document.querySelectorAll('#sevRow .chip').forEach(c => c.classList.toggle('active', c.dataset.sev === 'all'));
      window.router.navigate('/');
      await render();
    });
  }

  // Check API health status and update badge
  await updateApiStatusUI();

  // Trigger route processing
  window.router.handleRoute();
})();
