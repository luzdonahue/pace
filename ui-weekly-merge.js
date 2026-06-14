/* ===== PHASE 2 — WEEKLY + PROOF SCREENS ===== */
(function(){
'use strict';
var store = window.Pace.store;
function showToast(msg){
  var t=document.getElementById('global-toast');
  t.innerHTML='<span>✨</span> '+msg; t.classList.add('is-shown');
  setTimeout(function(){t.classList.remove('is-shown');},2600);
}

var CAT_COLOR={health:'#EF9F27',selfcare:'#D4537E',creative:'#1D9E75',work:'#378ADD',admin:'#D85A30',home:'#639922',social:'#7F77DD'};
var CAT_LABEL={health:'Health',selfcare:'Self-care',creative:'Creative',work:'Work',admin:'Admin',home:'Home',social:'Social'};
var DAYS_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var DAYS_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MONS_LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];

var _wkOffset = 0; // 0=current week, -1=prev, etc.

function getMondayOfWeek(offset){
  var now = new Date();
  var day = now.getDay(); // 0=Sun
  var diffToMon = (day===0) ? -6 : 1-day;
  var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate()+diffToMon + offset*7);
  return mon;
}

function dateStr(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function renderWeekly(){
  var state = store.get();
  var mon = getMondayOfWeek(_wkOffset);
  var weekDates = [];
  for(var i=0;i<7;i++){
    var d=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i);
    weekDates.push(d);
  }
  var todayStr = dateStr(new Date());

  // range label
  var rangeEl = document.getElementById('wk-range');
  if(rangeEl) rangeEl.textContent = MONS[mon.getMonth()]+' '+mon.getDate()+' – '+MONS[weekDates[6].getMonth()]+' '+weekDates[6].getDate()+', '+weekDates[6].getFullYear();

  // stats
  var doneTasks = state.tasks.filter(function(t){
    if(t.status!=='done'||!t.completedAt) return false;
    var cd = t.completedAt.slice(0,10);
    return cd >= dateStr(weekDates[0]) && cd <= dateStr(weekDates[6]);
  });
  var statsEl = document.getElementById('wk-stats');
  if(statsEl){
    var cats = {};
    doneTasks.forEach(function(t){ cats[t.category]=(cats[t.category]||0)+1; });
    var topCat = Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];})[0];
    statsEl.innerHTML =
      '<div class="wk-stat"><div class="wn">'+doneTasks.length+'</div><div class="wl">Done</div></div>' +
      '<div class="wk-stat"><div class="wn">'+(topCat?CAT_LABEL[topCat]||topCat:'—')+'</div><div class="wl">Top cat</div></div>' +
      '<div class="wk-stat"><div class="wn">'+state.checkins.filter(function(c){return c.date>=dateStr(weekDates[0])&&c.date<=dateStr(weekDates[6]);}).length+'</div><div class="wl">Check-ins</div></div>';
  }

  // energy bars
  var barsEl = document.getElementById('wk-bars');
  if(barsEl){
    barsEl.innerHTML='';
    weekDates.forEach(function(d){
      var ds = dateStr(d);
      var ci = state.checkins.filter(function(c){return c.date===ds;});
      var energy = ci.length ? ci[ci.length-1].energy : 0;
      var pct = Math.round(energy/10*100);
      var isToday = ds===todayStr;
      var col = document.createElement('div');
      col.className = 'wk-bcol'+(isToday?' today-col':'');
      col.innerHTML =
        '<div class="wb" style="height:'+(pct||8)+'%;background:'+(isToday?'var(--creat-hi)':'var(--health-hi)')+'"></div>' +
        '<div class="wd">'+DAYS_SHORT[(d.getDay())]+'</div>';
      barsEl.appendChild(col);
    });
  }

  // day rows
  var daysEl = document.getElementById('wk-days');
  if(daysEl){
    daysEl.innerHTML='';
    weekDates.forEach(function(d){
      var ds = dateStr(d);
      var isToday = ds===todayStr;
      var dayDone = state.tasks.filter(function(t){ return t.status==='done'&&t.completedAt&&t.completedAt.slice(0,10)===ds; });
      var dayRow = document.createElement('div');
      dayRow.className = 'wk-day'+(isToday?' is-today':'');
      var tilesHtml = dayDone.map(function(t){
        var col = CAT_COLOR[t.category]||'#999';
        return '<div class="wkt" style="background:'+col+'22;color:'+col+';border:.5px solid '+col+'44">'+escHtml(t.name.length>18?t.name.slice(0,17)+'…':t.name)+'</div>';
      }).join('');
      dayRow.innerHTML =
        '<div class="wk-day-head">' +
          '<div class="wk-day-name"><span class="nm">'+DAYS_LONG[d.getDay()]+'</span><span class="dt">'+MONS[d.getMonth()]+' '+d.getDate()+'</span></div>' +
          '<div class="wk-day-meta"><span class="done">'+dayDone.length+' done</span></div>' +
        '</div>' +
        (tilesHtml ? '<div class="wk-tiles-row">'+tilesHtml+'</div>' : '<div style="font-size:11px;color:var(--ink-faint);font-style:italic">'+(ds>todayStr?'future':'rest day')+'</div>');
      daysEl.appendChild(dayRow);
    });
  }

  // reflection
  var reflBody = document.getElementById('wk-reflect-body');
  if(reflBody){
    var cats2={};
    doneTasks.forEach(function(t){ cats2[t.category]=(cats2[t.category]||0)+1; });
    var sortedCats = Object.keys(cats2).sort(function(a,b){return cats2[b]-cats2[a];});
    var heaviestDay = weekDates.reduce(function(best,d){
      var ds2=dateStr(d);
      var cnt=state.tasks.filter(function(t){return t.status==='done'&&t.completedAt&&t.completedAt.slice(0,10)===ds2;}).length;
      return cnt>best.cnt?{d:d,cnt:cnt}:best;
    },{d:weekDates[0],cnt:0});
    var topCat2 = sortedCats[0];
    reflBody.innerHTML = (doneTasks.length>0
      ? 'Most done: <em>'+(topCat2?CAT_LABEL[topCat2]||topCat2:'varied')+'</em>. Heaviest day: <em>'+DAYS_LONG[heaviestDay.d.getDay()]+'</em>.'
      : 'A quieter week. Rest is valid.');
  }
  // month glance renders below
  renderMonthGlance();
}

var escHtml = window.Pace.escHtml; // S3: canonical quote-escaping variant from core-logic

/* ===== MONTH AT A GLANCE ===== */
var _mgOffset = 0; // months relative to current

function renderMonthGlance(){
  var state = store.get();
  var now = new Date();
  var yr = now.getFullYear();
  var mo = now.getMonth() + _mgOffset;
  // normalise year rollover
  yr += Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;

  var firstDay = new Date(yr, mo, 1);
  var lastDay  = new Date(yr, mo+1, 0);
  var todayStr = dateStr(now);
  var firstDayOfMonth = dateStr(firstDay);
  var lastDayOfMonth  = dateStr(lastDay);

  var lblEl = document.getElementById('wk-mg-month-lbl');
  if(lblEl) lblEl.textContent = MONS_LONG[mo] + ' ' + yr;

  var grid = document.getElementById('wk-mg-grid');
  if(!grid) return;
  grid.innerHTML='';

  // Weekday headers: M T W T F S S
  var dayHds = ['M','T','W','T','F','S','S'];
  dayHds.forEach(function(h){
    var dh = document.createElement('div');
    dh.className='wk-mg-dh'; dh.textContent=h;
    grid.appendChild(dh);
  });

  // offset: getDay() returns 0=Sun; we want 0=Mon
  var startDow = firstDay.getDay(); // 0=Sun..6=Sat
  var startOffset = (startDow === 0) ? 6 : startDow - 1;
  for(var b=0; b<startOffset; b++){
    var blank = document.createElement('div'); blank.className='wk-mg-sq'; blank.style.background='transparent'; blank.style.cursor='default';
    grid.appendChild(blank);
  }

  for(var dd=1; dd<=lastDay.getDate(); dd++){
    var dObj = new Date(yr, mo, dd);
    var ds = dateStr(dObj);
    var isFuture = ds > todayStr;
    var isToday  = ds === todayStr;

    var dayDone = state.tasks.filter(function(t){
      return t.status==='done' && t.completedAt && t.completedAt.slice(0,10)===ds;
    });

    var topColor = null;
    var topLabel = null;
    if(dayDone.length){
      var catCounts={};
      var catLastTime={};
      dayDone.forEach(function(t){
        catCounts[t.category]=(catCounts[t.category]||0)+1;
        var ts = t.completedAt||'';
        if(!catLastTime[t.category]||ts>catLastTime[t.category]) catLastTime[t.category]=ts;
      });
      var topCat = Object.keys(catCounts).sort(function(a,b){
        if(catCounts[b]!==catCounts[a]) return catCounts[b]-catCounts[a];
        return (catLastTime[b]||'') > (catLastTime[a]||'') ? 1 : -1;
      })[0];
      topColor = CAT_COLOR[topCat]||'#999';
      topLabel = CAT_LABEL[topCat]||topCat;
    }

    var sq = document.createElement('div');
    sq.className='wk-mg-sq'+(isToday?' today-sq':'')+(isFuture?' future-sq':'')+(topColor?' filled-sq':' empty-sq');
    sq.textContent = dd;
    if(topColor){ sq.style.background = topColor+(isFuture?'33':'99'); sq.style.color = '#fff'; }
    // click → note
    (function(dayDs, dayDoneArr, dayTopLabel){
      sq.addEventListener('click', function(){
        var noteEl = document.getElementById('wk-mg-note');
        if(!noteEl) return;
        var d2 = new Date(dayDs+'T12:00:00');
        var label = MONS[d2.getMonth()]+' '+d2.getDate();
        if(dayDoneArr.length===0){ noteEl.textContent = label+' — rest day'; }
        else { noteEl.textContent = label+' — '+dayDoneArr.length+' done'+(dayTopLabel?', mostly '+dayTopLabel:''); }
      });
    })(ds, dayDone, topLabel);
    grid.appendChild(sq);
  }

  // Legend
  var legendEl = document.getElementById('wk-mg-legend');
  if(legendEl){
    legendEl.innerHTML='';
    Object.keys(CAT_COLOR).forEach(function(k){
      var li = document.createElement('div'); li.className='wk-mg-leg-item';
      li.innerHTML='<div class="wk-mg-leg-dot" style="background:'+CAT_COLOR[k]+'"></div>'+escHtml(CAT_LABEL[k]||k);
      legendEl.appendChild(li);
    });
  }
}

// Nav buttons
var prevBtn = document.getElementById('wk-prev');
var nextBtn = document.getElementById('wk-next');
var backBtn = document.getElementById('wk-back-btn');
if(prevBtn) prevBtn.addEventListener('click', function(){ _wkOffset--; renderWeekly(); });
if(nextBtn) nextBtn.addEventListener('click', function(){ _wkOffset++; renderWeekly(); });
if(backBtn) backBtn.addEventListener('click', function(){ window.Pace.showScreen('today'); });

// Save to wins
var saveWins = document.getElementById('wk-save-wins');
if(saveWins) saveWins.addEventListener('click', function(){
  var state = store.get();
  var mon = getMondayOfWeek(_wkOffset);
  var reflEl = document.getElementById('wk-reflect-body');
  if(!state.wins) state.wins=[];
  state.wins.push({week:dateStr(mon), text:reflEl?reflEl.textContent:'', savedAt:new Date().toISOString()});
  store.save();
  showToast('Saved to wins — it counts');
});

// Month glance nav
var mgPrev = document.getElementById('wk-mg-prev');
var mgNext = document.getElementById('wk-mg-next');
if(mgPrev) mgPrev.addEventListener('click', function(){ _mgOffset--; renderMonthGlance(); });
if(mgNext) mgNext.addEventListener('click', function(){ _mgOffset++; renderMonthGlance(); });

// View proof
var viewProof = document.getElementById('wk-view-proof');
if(viewProof) viewProof.addEventListener('click', function(){ renderProof(); window.Pace.showScreen('proof'); });

// Back to weekly from proof
var proofBack = document.getElementById('proof-back-btn');
if(proofBack) proofBack.addEventListener('click', function(){ window.Pace.showScreen('weekly'); });

// Enter weekly via tab or other nav
document.addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(tab && tab.dataset.tab==='weekly'){ _wkOffset=0; renderWeekly(); }
  // weekly screen has no tab; it's reached via button — handled elsewhere
});
// Also listen for showScreen('weekly') indirectly via wk-back-btn on today
// The weekly screen is reached from categories wins link
var winsLink = document.getElementById('sett-wins-link');
if(winsLink) winsLink.addEventListener('click', function(){
  _wkOffset=0; renderWeekly();
  window.Pace.showScreen('weekly');
});

/* ===== PROOF ===== */
function renderProof(){
  var state = store.get();
  var doneTasks = state.tasks.filter(function(t){return t.status==='done';});
  var now = new Date();
  var todayStr = dateStr(now);

  // week
  var mon = getMondayOfWeek(_wkOffset);
  var weekDates=[];
  for(var i=0;i<7;i++){ weekDates.push(new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i)); }
  var weekDone = doneTasks.filter(function(t){
    var cd=t.completedAt&&t.completedAt.slice(0,10);
    return cd>=dateStr(weekDates[0])&&cd<=dateStr(weekDates[6]);
  });
  // month
  var monthStart = new Date(now.getFullYear(),now.getMonth(),1);
  var monthEnd   = new Date(now.getFullYear(),now.getMonth()+1,0);
  var monthDone = doneTasks.filter(function(t){
    var cd=t.completedAt&&t.completedAt.slice(0,10);
    return cd>=dateStr(monthStart)&&cd<=dateStr(monthEnd);
  });

  var numEl = document.getElementById('proof-num');
  if(numEl) numEl.textContent = doneTasks.length;

  var statsEl = document.getElementById('proof-stats');
  if(statsEl){
    var streak = calcStreak(state);
    statsEl.innerHTML =
      '<div class="proof-stat"><div class="pn">'+weekDone.length+'</div><div class="pl">This week</div></div>' +
      '<div class="proof-stat"><div class="pn">'+monthDone.length+'</div><div class="pl">This month</div></div>' +
      '<div class="proof-stat"><div class="pn">'+streak+'</div><div class="pl">Day streak</div></div>';
  }

  // week strip
  var weekRow = document.getElementById('proof-week-row');
  if(weekRow){
    weekRow.innerHTML='';
    weekDates.forEach(function(d){
      var ds=dateStr(d);
      var dayDone=doneTasks.filter(function(t){return t.completedAt&&t.completedAt.slice(0,10)===ds;});
      var topCatCol=null;
      if(dayDone.length){
        var cats={};
        dayDone.forEach(function(t){cats[t.category]=(cats[t.category]||0)+1;});
        var tc=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];})[0];
        topCatCol=CAT_COLOR[tc]||'#999';
      }
      var sq=document.createElement('div');
      sq.className='proof-day-sq'+(ds===todayStr?' today-sq':'');
      if(topCatCol) sq.style.background=topCatCol+'55';
      sq.textContent=DAYS_SHORT[d.getDay()];
      weekRow.appendChild(sq);
    });
  }
  var weekMeta=document.getElementById('proof-week-meta');
  if(weekMeta) weekMeta.textContent=weekDone.length+' done this week';

  // month grid
  var monthGrid=document.getElementById('proof-month-grid');
  if(monthGrid){
    monthGrid.innerHTML='';
    var daysInMonth=monthEnd.getDate();
    for(var dd=1;dd<=daysInMonth;dd++){
      var dObj=new Date(now.getFullYear(),now.getMonth(),dd);
      var ds2=dateStr(dObj);
      var dayDone2=doneTasks.filter(function(t){return t.completedAt&&t.completedAt.slice(0,10)===ds2;});
      var topCatCol2=null;
      if(dayDone2.length){
        var cats2={};
        dayDone2.forEach(function(t){cats2[t.category]=(cats2[t.category]||0)+1;});
        var tc2=Object.keys(cats2).sort(function(a,b){return cats2[b]-cats2[a];})[0];
        topCatCol2=CAT_COLOR[tc2]||'#999';
      }
      var pm=document.createElement('div');
      pm.className='pm'+(ds2===todayStr?' today-sq':'');
      if(topCatCol2) pm.style.background=topCatCol2+'55';
      monthGrid.appendChild(pm);
    }
  }
}

function calcStreak(state){
  var now = new Date();
  var streak=0;
  var d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  while(true){
    var ds=dateStr(d);
    var hasDone=state.tasks.some(function(t){return t.status==='done'&&t.completedAt&&t.completedAt.slice(0,10)===ds;});
    if(!hasDone) break;
    streak++;
    d.setDate(d.getDate()-1);
  }
  return streak;
}

window._renderWeekly=renderWeekly;
window._renderProof=renderProof;
})();


/* ===== FEATURE 1 — MERGE ON REPEAT ===== */
(function(){
'use strict';

var store = window.Pace.store;
var renderToday = function(){ if(window.Pace) window.Pace.renderToday(); };
var showToast = function(msg){
  var t=document.getElementById('global-toast');
  if(!t) return;
  t.innerHTML='<span>✨</span> '+msg; t.classList.add('is-shown');
  setTimeout(function(){t.classList.remove('is-shown');},2600);
};

/* --- Similarity helper --- */
var STOP = {the:1,a:1,an:1,my:1,to:1,for:1,and:1,in:1,of:1,on:1,it:1,is:1,i:1};
function normalize(str){
  return str.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(function(w){ return w.length>0 && !STOP[w]; }).join(' ');
}
function tokenSet(str){
  var tokens = normalize(str).split(' ');
  var set = {};
  tokens.forEach(function(t){ if(t) set[t]=1; });
  return set;
}
function jaccard(a, b){
  var sa = tokenSet(a), sb = tokenSet(b);
  var inter=0, union=0;
  var all = Object.assign({}, sa, sb);
  Object.keys(all).forEach(function(k){
    if(sa[k] && sb[k]) inter++;
    union++;
  });
  return union===0 ? 0 : inter/union;
}
function similarTask(name, tasks){
  var norm = normalize(name);
  if(norm.length < 4) return null;
  var active = tasks.filter(function(t){ return t.status==='today'||t.status==='someday'; });
  for(var i=0;i<active.length;i++){
    var t = active[i];
    var tn = normalize(t.name);
    if(tn.length < 4) continue;
    if(jaccard(norm, tn) >= 0.5) return t;
    if(norm.length>=4 && tn.indexOf(norm)>-1) return t;
    if(tn.length>=4 && norm.indexOf(tn)>-1) return t;
  }
  return null;
}
window._similarTask = similarTask;

/* --- Merge modal logic --- */
var _mergeQueue = [];
var _mergePending = null;
var _mergeResolve = null;

function showMergeModal(newName, existingTask){
  return new Promise(function(resolve){
    _mergeResolve = resolve;
    var scrim = document.getElementById('merge-scrim');
    var modal = document.getElementById('merge-modal');
    var msg = document.getElementById('merge-msg');
    if(!scrim || !modal || !msg){ resolve('keep'); return; }
    msg.innerHTML = '「'+escHtml(newName)+'」 sounds like 「'+escHtml(existingTask.name)+'」, which is already here.';
    scrim.style.display='flex';
    modal.style.display='block';
  });
}

function hideMergeModal(){
  var scrim=document.getElementById('merge-scrim');
  var modal=document.getElementById('merge-modal');
  if(scrim) scrim.style.display='none';
  if(modal) modal.style.display='none';
}

var escHtml = window.Pace.escHtml; // S3: canonical quote-escaping variant from core-logic

document.getElementById('merge-btn-merge').addEventListener('click', function(){
  hideMergeModal();
  if(_mergeResolve){ _mergeResolve('merge'); _mergeResolve=null; }
});
document.getElementById('merge-btn-keep').addEventListener('click', function(){
  hideMergeModal();
  if(_mergeResolve){ _mergeResolve('keep'); _mergeResolve=null; }
});
document.getElementById('merge-btn-cancel').addEventListener('click', function(){
  hideMergeModal();
  if(_mergeResolve){ _mergeResolve('cancel'); _mergeResolve=null; }
});

/* --- Core add-with-merge --- */
function addTaskWithMerge(taskObj, onDone){
  var state = store.get();
  var existing = similarTask(taskObj.name, state.tasks);
  if(!existing){
    store.addTask(taskObj);
    store.logEvent('task_added', {source:'manual', energy:taskObj.energy||'both', capacity:taskObj.capacity||'med', category:taskObj.category||'admin', types:taskObj.types||[], checkinLevel:store._checkinLevel()}); // item 4
    if(onDone) onDone();
    return;
  }
  showMergeModal(taskObj.name, existing).then(function(choice){
    if(choice === 'merge'){
      var today = new Date().toISOString().slice(0,10);
      var updates = {
        priority: Math.max(1, (existing.priority||3)-1),
        repeatCount: (existing.repeatCount||1)+1
      };
      if(existing.status === 'someday') updates.status = 'today';
      var notes = (existing.notes||[]).slice();
      notes.push('came up again · '+today);
      updates.notes = notes;
      store.updateTask(existing.id, updates);
      showToast('Merged — it’s moved up a little');
    } else if(choice === 'keep'){
      store.addTask(taskObj);
      store.logEvent('task_added', {source:'manual', energy:taskObj.energy||'both', capacity:taskObj.capacity||'med', category:taskObj.category||'admin', types:taskObj.types||[], checkinLevel:store._checkinLevel()}); // item 4
    }
    // cancel: do nothing
    if(onDone) onDone();
  });
}
window._addTaskWithMerge = addTaskWithMerge;

/* --- Intercept: empty-quick-add --- */
var eqa = document.getElementById('empty-quick-add');
if(eqa){
  // remove original listener by cloning
  var eqaNew = eqa.cloneNode(true);
  eqa.parentNode.replaceChild(eqaNew, eqa);
  eqaNew.addEventListener('keydown', function(e){
    if(e.key!=='Enter') return;
    var val = this.value.trim();
    if(!val) return;
    var el = this;
    addTaskWithMerge({id:Math.random().toString(36).slice(2,10),name:val,category:'admin',priority:3,energy:'both',capacity:'med',types:[],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null}, function(){
      el.value='';
      renderToday();
    });
  });
}

/* --- Intercept: dump sort-sheet confirm (ss-confirm-btn, ss-save-btn) --- */
function interceptConfirmSort(){
  var origConfirm = window._confirmSortItems;
  if(!origConfirm) return;
  // We patch via queue approach
}

// Patch the ss-confirm & ss-save buttons to run merge queue
function runMergeQueue(items, idx, added, done){
  if(idx >= items.length){
    done(added);
    return;
  }
  var item = items[idx];
  var state = store.get();
  var existing = similarTask(item.name, state.tasks);
  if(!existing){
    added.push(item);
    runMergeQueue(items, idx+1, added, done);
    return;
  }
  showMergeModal(item.name, existing).then(function(choice){
    if(choice === 'merge'){
      var today = new Date().toISOString().slice(0,10);
      var updates = {
        priority: Math.max(1, (existing.priority||3)-1),
        repeatCount: (existing.repeatCount||1)+1
      };
      if(existing.status==='someday') updates.status='today';
      var notes = (existing.notes||[]).slice();
      notes.push('came up again · '+today);
      updates.notes=notes;
      store.updateTask(existing.id, updates);
      showToast('Merged — it’s moved up a little');
    } else if(choice==='keep'){
      added.push(item);
    }
    runMergeQueue(items, idx+1, added, done);
  });
}

// Override ss-confirm-btn and ss-save-btn
['ss-confirm-btn','ss-save-btn'].forEach(function(btnId){
  var btn = document.getElementById(btnId);
  if(!btn) return;
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', function(){
    var sortItems = window._sortItems || [];
    if(!sortItems.length) return;
    runMergeQueue(sortItems.slice(), 0, [], function(toAdd){
      toAdd.forEach(function(item){
        var whyVal2 = (item.why && String(item.why).trim()) ? String(item.why).trim().slice(0,140) : (item._originalText && item._originalText !== item.name ? item._originalText : '');
        store.addTask({id:Math.random().toString(36).slice(2,10),name:item.name,category:item.category,priority:item.priority,energy:item.energy||'both',capacity:'med',types:[],why:whyVal2,notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null});
        store.logEvent('task_added', {source:'dump', energy:item.energy||'both', capacity:'med', category:item.category||'admin', types:[], checkinLevel:store._checkinLevel()}); // item 4
      });
      var ta = document.getElementById('dump-textarea');
      if(ta) ta.value='';
      var sub = document.getElementById('ss-done-sub');
      if(sub) sub.textContent = 'Added '+toAdd.length+' task'+(toAdd.length!==1?'s':'')+'. The biggest tile is what you said most loudly.';
      ['ss-step-1','ss-step-2'].forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.add('hidden'); });
      var step3=document.getElementById('ss-step-3'); if(step3) step3.classList.remove('hidden');
    });
  });
});

/* --- bd-confirm: NOT intercepted since 2B (replace, don't stack) ---
   Breakdown confirm lives in block 2 with atomic replace semantics
   (store.replaceTask: steps in, parent out, one save). The merge queue is
   deliberately not applied to breakdown steps: its per-item saves would
   break the atomic swap, and steps derived from a task the user already
   has are not "repeats". The clone-replace that used to live here killed
   block 2's listener — do not reintroduce it for this button. */

/* (repeat-count note renders inside the core openDrawer) */

})();
