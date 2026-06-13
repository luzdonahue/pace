/* ===== PHASE 2 — SETTINGS / CATEGORIES SCREEN ===== */
(function(){
'use strict';
var store = window.Pace.store;

// Profile inputs
var nameInput = document.getElementById('prof-name-input');
var intentInput = document.getElementById('prof-intention');
var avatarCircle = document.getElementById('prof-avatar-circle');

function loadProfile(){
  var state = store.get();
  var name = (state.profile && state.profile.name) || '';
  var intention = (state.profile && state.profile.intention) || '';
  if(nameInput) nameInput.value = name;
  if(intentInput) intentInput.value = intention;
  if(avatarCircle) avatarCircle.textContent = name ? name[0].toUpperCase() : '?';
}

if(nameInput){
  nameInput.addEventListener('input', function(){
    var state = store.get();
    if(!state.profile) state.profile={};
    state.profile.name = this.value;
    if(avatarCircle) avatarCircle.textContent = this.value ? this.value[0].toUpperCase() : '?';
    store.save();
  });
}
if(intentInput){
  intentInput.addEventListener('input', function(){
    var state = store.get();
    if(!state.profile) state.profile={};
    state.profile.intention = this.value;
    store.save();
  });
}

// Category drag-to-reorder
var CAT_COLORS = {health:'#EF9F27',selfcare:'#D4537E',creative:'#1D9E75',work:'#378ADD',admin:'#D85A30',home:'#639922',social:'#7F77DD'};
var CAT_LABELS = {health:'Health',selfcare:'Self-care',creative:'Creative',work:'Work',admin:'Admin',home:'Home',social:'Social'};

function renderCatTree(){
  var state = store.get();
  var cats = state.categories || ['health','selfcare','creative','work','admin','home','social'];
  var tree = document.getElementById('cat-tree');
  if(!tree) return;
  tree.innerHTML='';
  cats.forEach(function(cat, i){
    var isChild = (state.categoryParents && state.categoryParents[cat]);
    var row = document.createElement('div');
    row.className='cat-row-item';
    row.dataset.cat = cat;
    row.style.marginLeft = isChild ? '18px' : '';
    var taskCount = state.tasks ? state.tasks.filter(function(t){return t.category===cat && t.status!=='done';}).length : 0;
    var insertLine = document.createElement('div');
    insertLine.className='cat-insert-line';
    row.innerHTML =
      '<div class="grip"><i></i><i></i><i></i></div>' +
      '<div class="swatch" style="background:'+(CAT_COLORS[cat]||'#999')+'"></div>' +
      '<div class="cname">'+(CAT_LABELS[cat]||cat)+'</div>' +
      '<div style="display:flex;align-items:center;gap:4px;">' +
        '<span class="ccount">'+taskCount+'</span>' +
        '<button class="cat-row-btn" data-cat-up="'+cat+'" title="Move up" aria-label="Move '+cat+' up">&#9650;</button>'+
        '<button class="cat-row-btn" data-cat-dn="'+cat+'" title="Move down" aria-label="Move '+cat+' down">&#9660;</button>'+
        '<button class="sett-toggle" data-indent="'+cat+'" style="width:26px;height:16px;font-size:9px;" title="indent as child" aria-label="toggle indent">'+(isChild?'‹':'›')+'</button>'+
      '</div>';
    // Indent toggle
    row.querySelector('[data-indent]').addEventListener('click', function(e){
      e.stopPropagation();
      var state2 = store.get();
      if(!state2.categoryParents) state2.categoryParents={};
      if(state2.categoryParents[cat]){ delete state2.categoryParents[cat]; }
      else if(i>0){ state2.categoryParents[cat]= cats[i-1]; }
      store.save();
      renderCatTree();
    });
    // ▲ up button
    row.querySelector('[data-cat-up]').addEventListener('click', function(e){
      e.stopPropagation();
      if(i===0) return;
      var st=store.get(); var c=st.categories.slice();
      var moved=c.splice(i,1)[0]; c.splice(i-1,0,moved);
      st.categories=c; store.save(); renderCatTree();
    });
    // ▼ down button
    row.querySelector('[data-cat-dn]').addEventListener('click', function(e){
      e.stopPropagation();
      var st=store.get(); var c=st.categories.slice();
      if(i>=c.length-1) return;
      var moved=c.splice(i,1)[0]; c.splice(i+1,0,moved);
      st.categories=c; store.save(); renderCatTree();
    });
    setupCatDrag(row, i);
    tree.appendChild(insertLine);
    tree.appendChild(row);
  });
  // final insert line
  var lastLine = document.createElement('div');
  lastLine.className='cat-insert-line';
  tree.appendChild(lastLine);
}

var _dragCat=null, _dragFromIdx=-1;
function setupCatDrag(row, fromIdx){
  // whole-row draggable; skip interactive children (buttons)
  row.addEventListener('mousedown', function(e){
    if(e.target.closest('button')) return;
    startDrag(e);
  });
  row.addEventListener('touchstart', function(e){
    if(e.target.closest('button')) return;
    startDrag(e);
  }, {passive:true});

  function startDrag(e){
    _dragCat = row.dataset.cat;
    _dragFromIdx = fromIdx;
    row.classList.add('dragging');
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, {passive:false});
    document.addEventListener('touchend', onDragEnd);
  }
  function onDragMove(e){
    if(!_dragCat) return;
    var pt = e.touches ? e.touches[0] : e;
    var tree = document.getElementById('cat-tree');
    var rows = Array.from(tree.querySelectorAll('.cat-row-item'));
    var insertLines = Array.from(tree.querySelectorAll('.cat-insert-line'));
    insertLines.forEach(function(l){ l.classList.remove('show'); });
    var best = -1, bestDist = Infinity;
    rows.forEach(function(r, ri){
      var rect = r.getBoundingClientRect();
      var mid = rect.top + rect.height/2;
      var dist = Math.abs(pt.clientY - mid);
      if(dist < bestDist){ bestDist=dist; best=ri; }
    });
    if(best>=0 && insertLines[best]) insertLines[best].classList.add('show');
  }
  function onDragEnd(e){
    if(!_dragCat){ return; }
    var pt = e.changedTouches ? e.changedTouches[0] : e;
    var tree = document.getElementById('cat-tree');
    var rows = Array.from(tree.querySelectorAll('.cat-row-item'));
    var best=-1, bestDist=Infinity;
    rows.forEach(function(r,ri){
      var rect=r.getBoundingClientRect();
      var mid=rect.top+rect.height/2;
      var d=Math.abs(pt.clientY-mid);
      if(d<bestDist){bestDist=d;best=ri;}
    });
    tree.querySelectorAll('.cat-insert-line').forEach(function(l){l.classList.remove('show');});
    row.classList.remove('dragging');
    if(best>=0 && best!==_dragFromIdx){
      var state=store.get();
      var cats=state.categories.slice();
      var moved=cats.splice(_dragFromIdx,1)[0];
      var toIdx=best>_dragFromIdx?best:best;
      cats.splice(toIdx,0,moved);
      state.categories=cats;
      store.save();
    }
    _dragCat=null; _dragFromIdx=-1;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
    renderCatTree();
  }
}

// Toggles
function syncToggle(id, storeKey){
  var btn = document.getElementById(id);
  if(!btn) return;
  var state = store.get();
  if(!state.prefs) state.prefs={};
  var on = !!state.prefs[storeKey];
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-checked', on);
}
function setupToggle(id, storeKey){
  var btn = document.getElementById(id);
  if(!btn) return;
  syncToggle(id, storeKey);
  btn.addEventListener('click', function(){
    var s2 = store.get();
    if(!s2.prefs) s2.prefs={};
    s2.prefs[storeKey] = !s2.prefs[storeKey];
    store.save();
    btn.classList.toggle('on', !!s2.prefs[storeKey]);
    btn.setAttribute('aria-checked', !!s2.prefs[storeKey]);
    if(storeKey==='flare'){
      var banner = document.getElementById('flare-banner');
      if(banner) banner.classList.toggle('show', !!s2.prefs[storeKey]);
      window.Pace.renderToday();
    }
  });
}
setupToggle('tog-reminders','reminders');
setupToggle('tog-flare','flare');

// Stepper
var stepVal = document.getElementById('step-val');
var stepDown = document.getElementById('step-down');
var stepUp   = document.getElementById('step-up');
function loadStepper(){
  var state=store.get();
  if(!state.prefs) state.prefs={};
  var v = state.prefs.medTasks || 3;
  if(stepVal) stepVal.textContent=v;
}
if(stepDown){
  stepDown.addEventListener('click',function(){
    var state=store.get(); if(!state.prefs)state.prefs={};
    var v=Math.max(2,(state.prefs.medTasks||3)-1);
    state.prefs.medTasks=v; store.save();
    if(stepVal) stepVal.textContent=v;
  });
}
if(stepUp){
  stepUp.addEventListener('click',function(){
    var state=store.get(); if(!state.prefs)state.prefs={};
    var v=Math.min(5,(state.prefs.medTasks||3)+1);
    state.prefs.medTasks=v; store.save();
    if(stepVal) stepVal.textContent=v;
  });
}

// Back / done
var settBack = document.getElementById('sett-back-btn');
var settDone = document.getElementById('sett-done-btn');
if(settBack) settBack.addEventListener('click', function(){ window.Pace.showScreen('today'); });
if(settDone) settDone.addEventListener('click', function(){ window.Pace.showScreen('today'); });

// Wins link → weekly
var winsLink = document.getElementById('sett-wins-link');
if(winsLink) winsLink.addEventListener('click', function(){ window.Pace.showScreen('weekly'); });

// Re-render when entering categories screen
document.addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(tab && tab.dataset.tab==='categories'){
    loadProfile();
    renderCatTree();
    loadStepper();
    syncToggle('tog-reminders','reminders');
    syncToggle('tog-flare','flare');
    var state=store.get();
    var banner=document.getElementById('flare-banner');
    if(banner) banner.classList.toggle('show',!!(state.prefs&&state.prefs.flare));
  }
});
window._renderCatTree = renderCatTree;

/* ===== Data export / import =====
   Export is built from store.get() only — the separate localStorage keys
   pace.apikey / pace.whisper / pace.haptics are never part of it. */
var exportBtn = document.getElementById('export-data-btn');
var importBtn = document.getElementById('import-data-btn');
var importFile = document.getElementById('import-data-file');
var dataMsg = document.getElementById('data-msg');
function setDataMsg(msg){ if(dataMsg) dataMsg.textContent = msg || ''; }

if(exportBtn){
  exportBtn.addEventListener('click', function(){
    var payload = { schema: 1, exportedAt: new Date().toISOString(), state: store.get() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pace-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    setDataMsg('Backup saved to your downloads.');
  });
}

if(importBtn && importFile){
  importBtn.addEventListener('click', function(){ importFile.value=''; importFile.click(); });
  importFile.addEventListener('change', function(){
    var file = importFile.files && importFile.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var data = null;
      try { data = JSON.parse(reader.result); } catch(e){ data = null; }
      var valid = data && data.schema === 1 && data.state && Array.isArray(data.state.tasks);
      if(!valid){
        setDataMsg("That file doesn't look like a Pace backup — nothing was changed.");
        return;
      }
      var ok = window.confirm('This replaces your current data — export a backup first?\n\nOK imports the file. Cancel keeps everything as it is.');
      if(!ok){ setDataMsg('No changes made.'); return; }
      store._state = data.state;
      store.save();   // through the adapter: localStorage + IndexedDB
      store.load();   // re-read + backfill any missing fields
      loadProfile();
      renderCatTree();
      loadStepper();
      syncToggle('tog-reminders','reminders');
      syncToggle('tog-flare','flare');
      window.Pace.renderToday();
      window.Pace.applyCheckinGreeting();
      setDataMsg('Imported — your data is back.');
    };
    reader.onerror = function(){ setDataMsg("Couldn't read that file — nothing was changed."); };
    reader.readAsText(file);
  });
}
})();
