function renderModuleCards(elId, arr, icon){
  const el = document.getElementById(elId);
  if(!el) return;
  el.innerHTML = arr.map((item,idx)=>`
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

let reviewed = {};
let activeCat = null;
let activeSev = 'all';
let searchQ = '';

function catMeta(key){ return CATS.find(c=>c.key===key); }

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function render(){
  const grid = document.getElementById('catGrid');
  grid.innerHTML = CATS.map((c,idx)=>{
    const count = DATA.filter(d=>d.cat===c.key).length;
    return `<div class="cat-tile reveal ${activeCat===c.key?'active':''}" data-cat="${c.key}" style="transition-delay:${idx*40}ms;">
      <div class="cat-icon ${c.cls}">${c.icon}</div>
      <div class="cat-name">${c.name}</div>
      <div class="cat-count">${count} checks</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.cat-tile').forEach(el=>{
    el.addEventListener('click', ()=>{
      const k = el.dataset.cat;
      activeCat = (activeCat===k) ? null : k;
      render();
    });
  });

  let items = DATA.filter(d=>{
    if(activeCat && d.cat!==activeCat) return false;
    if(activeSev!=='all' && d.sev!==activeSev) return false;
    if(searchQ){
      const hay = (d.title+' '+d.summary+' '+d.masvs+' '+d.mastg+' '+(d.tools||[]).join(' ')).toLowerCase();
      if(!hay.includes(searchQ)) return false;
    }
    return true;
  });

  const list = document.getElementById('list');
  const empty = document.getElementById('emptyState');
  if(items.length===0){
    list.innerHTML='';
    empty.style.display='block';
  } else {
    empty.style.display='none';
    list.innerHTML = items.map((d,idx)=>{
      const cm = catMeta(d.cat);
      const isRev = !!reviewed[d.id];
      return `<div class="card reveal ${isRev?'reviewed':''}" data-id="${d.id}" style="transition-delay:${Math.min(idx,8)*35}ms;">
        <div class="card-head">
          <div class="chk" data-role="chk">✓</div>
          <div class="card-title-wrap">
            <div class="card-title">${d.title}</div>
            <div class="card-meta">
              <span>${cm.icon} ${cm.name}</span>
              <span>${d.masvs}</span>
              <span>${d.mastg}</span>
            </div>
          </div>
          <span class="sev-tag sev-${d.sev}">${d.sev}</span>
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
            <div class="blk"><div class="blk-label">Tools</div><div class="tool-pills">${d.tools.map(t=>`<span class="tool-pill">${t}</span>`).join('')}</div></div>
            <div class="blk"><div class="blk-label">Mitigation</div><p>${d.mitigation}</p></div>
          </div>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.card').forEach(card=>{
      const head = card.querySelector('.card-head');
      const body = card.querySelector('.card-body');
      head.addEventListener('click', (e)=>{
        if(e.target.closest('[data-role="chk"]')) return;
        const open = card.classList.toggle('open');
        body.style.maxHeight = open ? body.scrollHeight+40+'px' : '0px';
      });
      card.querySelector('[data-role="chk"]').addEventListener('click', (e)=>{
        e.stopPropagation();
        const id = card.dataset.id;
        reviewed[id] = !reviewed[id];
        saveReviewed();
        render();
      });
    });
  }
  updateProgress();
  observeReveals();
}

let lastMilestone = 0;
function updateProgress(){
  const total = DATA.length;
  const done = Object.values(reviewed).filter(Boolean).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  document.getElementById('progressLabel').textContent = `${done} / ${total} reviewed · ${pct}%`;
  document.getElementById('progressFill').style.width = pct+'%';

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

async function saveReviewed(){
  try{
    await window.storage.set('ios-arsenal-reviewed', JSON.stringify(reviewed), false);
  }catch(err){
    console.error('Storage error saving reviewed state', err);
  }
}

async function loadReviewed(){
  try{
    const res = await window.storage.get('ios-arsenal-reviewed', false);
    if(res && res.value){ reviewed = JSON.parse(res.value); }
  }catch(err){
    reviewed = {};
  }
}

document.getElementById('searchInput').addEventListener('input', (e)=>{
  searchQ = e.target.value.trim().toLowerCase();
  render();
});

document.getElementById('sevRow').addEventListener('click',(e)=>{
  const chip = e.target.closest('.chip');
  if(!chip) return;
  activeSev = chip.dataset.sev;
  document.querySelectorAll('#sevRow .chip').forEach(c=>c.classList.toggle('active', c===chip));
  render();
});

document.getElementById('clearBtn').addEventListener('click', async ()=>{
  reviewed = {};
  activeCat = null;
  activeSev = 'all';
  searchQ = '';
  document.getElementById('searchInput').value='';
  document.querySelectorAll('#sevRow .chip').forEach(c=>c.classList.toggle('active', c.dataset.sev==='all'));
  await saveReviewed();
  render();
});

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

function initScrollEffects(){
  const bar = document.getElementById('topProgress');
  const btt = document.getElementById('backToTop');
  const onScroll = ()=>{
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max>0 ? (scrolled/max)*100 : 0) + '%';
    btt.classList.toggle('show', scrolled > 500);
  };
  document.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
  btt.addEventListener('click', ()=>window.scrollTo({top:0, behavior:'smooth'}));
}

(async function init(){
  const playbookStat = document.getElementById('stat-playbooks');
  playbookStat.dataset.target = DATA.length;
  document.getElementById('stat-count-inline').textContent = DATA.length;
  document.querySelectorAll('.stat .n[data-target]').forEach(el=>{
    animateCounter(el, parseInt(el.dataset.target,10), 1100);
  });
  initScrollEffects();
  renderModuleCards('jbList', JAILBREAKS, '🔓');
  renderModuleCards('jbDetectList', JBDETECT, '🕵️');
  renderModuleCards('sslPinList', SSLPIN, '🔒');
  await loadReviewed();
  render();
})();
