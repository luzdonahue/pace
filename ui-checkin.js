import { store } from './core-store.js';
import { calcCapacity } from './core-logic.js';
import { showScreen, showToast, applyCheckinGreeting } from './ui-shell.js';
import { renderToday, openDrawer } from './ui-today.js';

/* ===== MORNING CHECK-IN SLIDERS ===== */
var ciValues = {energy:6, pain:3, focus:5, mood:5};

function setupSlider(card){
  var key = card.dataset.slider;
  var knob = card.querySelector('.ci-knob');
  var numEl = card.querySelector('.ci-num');
  var track = card.querySelector('.ci-slider');

  function setVal(pct){
    pct = Math.max(0, Math.min(1, pct));
    var val = Math.round(pct * 10);
    ciValues[key] = val;
    card.dataset.val = val;
    numEl.textContent = val;
    knob.style.left = (pct*100)+'%';
    updateCICapacity();
  }

  function getPos(e){
    var rect = track.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) / rect.width;
  }

  function onMove(e){ e.preventDefault(); setVal(getPos(e)); }
  function onUp(){ document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp); }

  track.addEventListener('mousedown', function(e){ setVal(getPos(e)); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); });
  track.addEventListener('touchstart', function(e){ setVal(getPos(e)); document.addEventListener('touchmove', onMove, {passive:false}); document.addEventListener('touchend', onUp); });
}

document.querySelectorAll('[data-slider]').forEach(setupSlider);

function updateCICapacity(){
  var avg = (ciValues.energy + ciValues.focus + (10 - ciValues.pain)) / 3;
  var pct = Math.round(avg*10);
  var level = avg>=7?'High':avg>=4?'Medium':'Low';
  var stCap = store.get();
  var medN = (stCap.prefs && stCap.prefs.medTasks) ? stCap.prefs.medTasks : 3;
  var tasks = avg>=7?5:avg>=4?medN:2;
  var bar = document.getElementById('ci-cap-bar');
  if(bar) bar.style.width = pct+'%';
  var note = document.getElementById('ci-cap-note');
  if(note) note.innerHTML = '<b>'+level+' capacity.</b> Pace will surface '+tasks+' tasks.';
}

/* ===== CI FOCUS PILLS ===== */
var _ciFocusCategory = '';
document.querySelectorAll('.ci-fpill').forEach(function(pill){
  pill.addEventListener('click', function(){
    document.querySelectorAll('.ci-fpill').forEach(function(p){ p.classList.remove('ci-fpill-active'); });
    pill.classList.add('ci-fpill-active');
    _ciFocusCategory = pill.dataset.fc || '';
  });
});

document.getElementById('ci-continue').addEventListener('click', function(){
  // capacity stored via the same formula the check-in screen displays (calcCapacity: energy+focus+inverted pain)
  var ci = {date:new Date().toISOString().slice(0,10), energy:ciValues.energy, pain:ciValues.pain, focus:ciValues.focus, mood:ciValues.mood, capacity:calcCapacity({energy:ciValues.energy, pain:ciValues.pain, focus:ciValues.focus}).level, focusCategory:_ciFocusCategory||null};
  store.saveCheckin(ci);
  renderToday();
  window._dumpFromCheckin = true;
  showScreen('dump');
});
document.getElementById('ci-skip').addEventListener('click', function(){
  renderToday();
  showScreen('today');
});

/* ===== ONBOARDING ===== */
document.getElementById('ob-begin').addEventListener('click', function(){
  showScreen('onboarding-q1');
});
document.getElementById('ob-back').addEventListener('click', function(){
  showScreen('onboarding-welcome');
});
document.getElementById('ob-next').addEventListener('click', function(){
  var selected = document.querySelector('.opt.sel');
  if(selected){
    var state = store.get();
    if(!state.profile) state.profile = {};
    state.profile.limitFactor = selected.dataset.val;
    store.save();
  }
  showScreen('onboarding-q2');
});
document.getElementById('ob-skip').addEventListener('click', function(){
  showScreen('onboarding-q2');
});

/* ===== ONBOARDING Q2 — Name ===== */
document.getElementById('ob2-back').addEventListener('click', function(){
  showScreen('onboarding-q1');
});
document.getElementById('ob2-next').addEventListener('click', function(){
  var val = (document.getElementById('ob-name-input').value || '').trim();
  var state = store.get();
  if(!state.profile) state.profile = {};
  state.profile.name = val || 'friend';
  store.save();
  // update avatar initials
  var av = document.getElementById('prof-avatar-circle');
  if(av) av.textContent = (state.profile.name)[0].toUpperCase();
  var chip = document.getElementById('today-profile-chip');
  if(chip) chip.textContent = (state.profile.name)[0].toUpperCase();
  showScreen('onboarding-q3');
});
document.getElementById('ob2-skip').addEventListener('click', function(){
  showScreen('onboarding-q3');
});

/* ===== ONBOARDING Q3 — Categories ===== */
document.querySelectorAll('#ob-cat-grid .ob-cat-pill').forEach(function(pill){
  pill.addEventListener('click', function(){
    pill.classList.toggle('on');
    var pc = pill.style.getPropertyValue('--pc') || '#EF9F27';
    if(pill.classList.contains('on')){
      pill.style.background = pc + '22';
      pill.style.borderColor = pc;
      pill.style.color = 'var(--ink)';
    } else {
      pill.style.background = '';
      pill.style.borderColor = '';
      pill.style.color = '';
    }
  });
});
document.getElementById('ob3-back').addEventListener('click', function(){
  showScreen('onboarding-q2');
});
document.getElementById('ob3-next').addEventListener('click', function(){
  var ALL_CATS = ['health','selfcare','creative','work','admin','home','social'];
  var selected = [];
  document.querySelectorAll('#ob-cat-grid .ob-cat-pill.on').forEach(function(p){ selected.push(p.dataset.cat); });
  if(selected.length > 0){
    var rest = ALL_CATS.filter(function(c){ return selected.indexOf(c) === -1; });
    var state = store.get();
    state.categories = selected.concat(rest);
    store.save();
  }
  showScreen('onboarding-q4');
});
document.getElementById('ob3-skip').addEventListener('click', function(){
  showScreen('onboarding-q4');
});

/* ===== ONBOARDING Q4 — Task count ===== */
document.querySelectorAll('#ob-task-opts .ob-task-card').forEach(function(card){
  card.addEventListener('click', function(){
    document.querySelectorAll('#ob-task-opts .ob-task-card').forEach(function(c){ c.classList.remove('sel'); });
    card.classList.add('sel');
  });
});
document.getElementById('ob4-back').addEventListener('click', function(){
  showScreen('onboarding-q3');
});
function finishOnboarding(){
  var selCard = document.querySelector('#ob-task-opts .ob-task-card.sel');
  if(selCard){
    var state = store.get();
    if(!state.prefs) state.prefs = {};
    state.prefs.medTasks = parseInt(selCard.dataset.tasks) || 3;
    store.save();
  }
  var state2 = store.get();
  state2.onboarded = true;
  store.save();
  applyCheckinGreeting();
  showScreen('checkin');
}
document.getElementById('ob4-finish').addEventListener('click', finishOnboarding);
document.getElementById('ob4-skip').addEventListener('click', finishOnboarding);

document.querySelectorAll('#ob-options .opt').forEach(function(opt){
  opt.addEventListener('click', function(){
    document.querySelectorAll('#ob-options .opt').forEach(function(o){ o.classList.remove('sel'); });
    opt.classList.add('sel');
    document.getElementById('ob-next').disabled = false;
  });
});

/* ===== EMPTY STATE ACTIONS ===== */
document.getElementById('empty-open-dump').addEventListener('click', function(){
  showScreen('dump');
});
document.getElementById('empty-quick-add').addEventListener('keydown', function(e){
  if(e.key!=='Enter') return;
  var val = this.value.trim();
  if(!val) return;
  store.addTask({id:Math.random().toString(36).slice(2,10),name:val,category:'admin',priority:3,energy:'both',capacity:'med',types:[],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null});
  this.value='';
  renderToday();
});

// Today view toggle (mosaic ↔ list)
var _tvtBtn = document.getElementById('today-view-toggle');
if(_tvtBtn){
  _tvtBtn.addEventListener('mousedown', function(e){ e.preventDefault(); });
  _tvtBtn.addEventListener('click', function(){
    var s = store.get();
    if(!s.prefs) s.prefs={};
    s.prefs.todayView = (s.prefs.todayView === 'list') ? 'mosaic' : 'list';
    store.save();
    renderToday();
  });
}

// Today dump button
document.getElementById('today-dump-btn').addEventListener('click', function(){ showScreen('dump'); });
document.getElementById('today-weekly-btn').addEventListener('click', function(){
  if(window._renderWeekly) window._renderWeekly();
  showScreen('weekly');
});
document.getElementById('today-profile-chip').addEventListener('click', function(){
  showScreen('categories');
  if(window._renderCatTree) window._renderCatTree();
});

// Flare mode quick toggle on Today
var flareBtn = document.getElementById('today-flare-btn');
if(flareBtn){
  flareBtn.addEventListener('click', function(){
    var s = store.get();
    s.prefs = s.prefs || {};
    s.prefs.flare = !s.prefs.flare;
    store.save();
    renderToday();
    showToast(s.prefs.flare ? 'Flare mode on — just the essentials.' : 'Flare mode off — full canvas back.');
    var st = document.getElementById('tog-flare');
    if(st){ st.classList.toggle('on', !!s.prefs.flare); st.setAttribute('aria-checked', !!s.prefs.flare); }
  });
}

/* ===== STALE TOP-TASK NUDGE (3+ days at the top without progress) ===== */
function checkStaleTop(visibleTasks){
  var nudgeEl = document.getElementById('today-stale-nudge');
  if(!nudgeEl) return;
  nudgeEl.style.display='none';
  var state = store.get();
  var today = new Date().toISOString().slice(0,10);
  var now = Date.now();
  var top3 = visibleTasks.slice(0,3);
  var topIds = {};
  top3.forEach(function(t){ topIds[t.id]=1; });
  var dirty=false, candidate=null;
  state.tasks.forEach(function(t){
    if(t.status!=='today') { if(t.topSince){ delete t.topSince; dirty=true; } return; }
    if(topIds[t.id]){
      if(!t.topSince){ t.topSince = now; t.minutesAtTop = t.minutesGiven||0; dirty=true; }
      var days = (now - t.topSince) / 86400000;
      var progressed = (t.minutesGiven||0) > (t.minutesAtTop||0);
      if(days >= 3 && !progressed && t.staleSnooze !== today){
        if(!candidate || t.topSince < candidate.topSince) candidate = t;
      }
    } else if(t.topSince){ delete t.topSince; delete t.minutesAtTop; dirty=true; }
  });
  if(dirty) store.save();
  if(!candidate) return;
  var days = Math.floor((now - candidate.topSince) / 86400000);
  document.getElementById('stale-nudge-msg').innerHTML =
    '「'+escHtml2(candidate.name)+'」 has sat at the top for '+days+' days. Too big is more likely than too lazy — want to make it smaller, or let it rest lower for now?';
  nudgeEl.style.display='block';
  nudgeEl.dataset.taskId = candidate.id;
}
function escHtml2(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

(function(){
  var br=document.getElementById('stale-nudge-break');
  var lo=document.getElementById('stale-nudge-lower');
  var sn=document.getElementById('stale-nudge-snooze');
  function nudgeTask(){
    var id=document.getElementById('today-stale-nudge').dataset.taskId;
    return store.get().tasks.find(function(t){return t.id===id;});
  }
  if(br) br.addEventListener('click', function(){
    var t=nudgeTask(); if(!t) return;
    openDrawer(t.id);
    var bb=document.getElementById('dr-breakdown-btn');
    if(bb) bb.click();
  });
  if(lo) lo.addEventListener('click', function(){
    var t=nudgeTask(); if(!t) return;
    store.updateTask(t.id, {priority: Math.min(5, t.priority+1)});
    var t2=nudgeTask(); if(t2){ delete t2.topSince; store.save(); }
    renderToday();
    showToast('Moved down — no judgment. It\'ll be there when you\'re ready.');
  });
  if(sn) sn.addEventListener('click', function(){
    var t=nudgeTask(); if(!t) return;
    store.updateTask(t.id, {staleSnooze: new Date().toISOString().slice(0,10)});
    renderToday();
  });
})();


export { checkStaleTop };
