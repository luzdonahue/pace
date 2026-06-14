import { store } from './core-store.js';
import { catCls, catColor, catRank, calcCapacity, fmtDate, escHtml, timeOfDay, buildBreakdownPrompt } from './core-logic.js';
import { showToast } from './ui-shell.js';

/* ===== TODAY RENDER ===== */
function tileSize(priority){
  if(priority===1) return 's-hero';
  if(priority===2) return 's-lg';
  if(priority===3) return 's-md';
  if(priority===4) return 's-sm';
  return 's-mini';
}

function renderToday(){
  var state = store.get();
  var flareOn = !!(state.prefs && state.prefs.flare);
  var todayTasks = state.tasks.filter(function(t){ return t.status==='today'; });
  if(flareOn){ todayTasks = todayTasks.filter(function(t){ return t.priority <= 2; }); }
  var lastCI2 = state.checkins.length ? state.checkins[state.checkins.length-1] : null;
  var todayFocus = (lastCI2 && lastCI2.focusCategory) ? lastCI2.focusCategory : null;
  todayTasks = todayTasks.slice().sort(function(a,b){
    var ap = a.priority - (todayFocus && a.category===todayFocus ? 0.6 : 0) + (catRank(a.category) * 0.04);
    var bp = b.priority - (todayFocus && b.category===todayFocus ? 0.6 : 0) + (catRank(b.category) * 0.04);
    if(ap !== bp) return ap - bp;
    return (a.rank||0) - (b.rank||0);
  });
  var fb = document.getElementById('today-flare-banner');
  if(fb) fb.classList.toggle('show', flareOn);
  var fBtn = document.getElementById('today-flare-btn');
  if(fBtn) fBtn.classList.toggle('active', flareOn);

  var dEl = document.getElementById('today-date');
  if(dEl) dEl.textContent = fmtDate();
  var dEl2 = document.getElementById('dump-date');
  if(dEl2) dEl2.textContent = fmtDate();

  var cntEl = document.getElementById('today-open-count');
  if(cntEl) cntEl.textContent = todayTasks.length+' open';

  var lastCI = state.checkins.length ? state.checkins[state.checkins.length-1] : null;
  if(lastCI){
    var capInfo = calcCapacity(lastCI);
    var eEl = document.getElementById('strip-energy'); if(eEl) eEl.textContent = lastCI.energy;
    var pEl = document.getElementById('strip-pain');   if(pEl) pEl.textContent = lastCI.pain;
    var fEl = document.getElementById('strip-focus');  if(fEl) fEl.textContent = lastCI.focus;
    var capFill = document.getElementById('strip-cap-fill');
    if(capFill) capFill.style.width = capInfo.pct;
    var capNote = document.getElementById('strip-cap-note');
    if(capNote){
      var lbl = {high:'High',med:'Medium',low:'Low'}[capInfo.level];
      var focChip = '';
      if(todayFocus){
        var focColor = ({health:'#EF9F27',selfcare:'#D4537E',creative:'#1D9E75',work:'#378ADD',admin:'#D85A30',home:'#639922',social:'#7F77DD'})[todayFocus]||'#A89E91';
        var focLabel = ({health:'Health',selfcare:'Self-care',creative:'Creative',work:'Work',admin:'Admin',home:'Home',social:'Social'})[todayFocus]||todayFocus;
        focChip = ' <span style="display:inline-flex;align-items:center;gap:3px;background:'+focColor+'22;color:'+focColor+';border-radius:8px;padding:1px 7px;font-size:10px;font-weight:600;vertical-align:middle;"><span style="width:6px;height:6px;border-radius:50%;background:'+focColor+';display:inline-block;"></span>focus: '+focLabel+'</span>';
      }
      capNote.innerHTML = '<em>'+lbl+' capacity</em> — '+capInfo.tasks+' tasks suggested today.'+focChip;
    }
  }

  // Late-night note
  var lateNoteEl = document.getElementById('strip-late-note');
  if(lateNoteEl){
    if(timeOfDay() === 'late'){
      lateNoteEl.textContent = 'It\'s late. Anything still here can belong to tomorrow.';
      lateNoteEl.style.display = '';
    } else {
      lateNoteEl.style.display = 'none';
    }
  }

  var canvasEl = document.getElementById('today-canvas');
  var listViewEl = document.getElementById('today-list-view');
  var emptyEl = document.getElementById('today-empty');
  var isListView = !!(state.prefs && state.prefs.todayView === 'list');

  // sync toggle button appearance
  var tvt = document.getElementById('today-view-toggle');
  if(tvt) tvt.classList.toggle('active', isListView);

  if(todayTasks.length===0){
    if(canvasEl) canvasEl.style.display='none';
    if(listViewEl) listViewEl.classList.remove('show');
    if(emptyEl){ emptyEl.style.display='flex'; }
    return;
  }
  if(emptyEl) emptyEl.style.display='none';

  if(isListView){
    if(canvasEl) canvasEl.style.display='none';
    if(listViewEl){ listViewEl.classList.add('show'); renderTodayList(todayTasks, listViewEl); }
  } else {
    if(listViewEl) listViewEl.classList.remove('show');
    if(canvasEl) canvasEl.style.display='';

    var capTasks = lastCI ? calcCapacity(lastCI).tasks : 3;
    var visible = todayTasks.slice(0, capTasks);
    var backlog = todayTasks.slice(capTasks);

    var tilesEl = document.getElementById('today-tiles');
    if(!tilesEl) return;
    tilesEl.innerHTML = '';

    visible.forEach(function(task, i){
      var sz = tileSize(i===0 ? Math.min(task.priority,1) : task.priority);
      var div = document.createElement('div');
      div.className = 'tile '+sz+' '+catCls(task.category);
      div.dataset.taskId = task.id;
      var timerPillHtml = '';
      if(i === 0){
        var timerState = window.PaceTimer ? window.PaceTimer.state() : null;
        if(timerState && timerState.taskId === task.id && timerState.running){
          var rem = timerState.remaining;
          var mm = Math.floor(rem/60); var ss = rem%60;
          var lbl = (timerState.paused?'⏸ ':'⏱ ')+mm+':'+(ss<10?'0':'')+ss;
          timerPillHtml = '<button class="tile-timer-pill tile-timer-live" data-timer-task="'+task.id+'" type="button">'+lbl+'</button>';
        } else {
          timerPillHtml = '<button class="tile-timer-pill" data-timer-task="'+task.id+'" type="button">&#9654; 25 min</button>';
        }
      }
      // Tension dot (Feature 2): quiet white dot top-right for high-punt high-priority tasks
      var tensionDotHtml = ((task.puntCount||0) >= 3 && (task.priority||5) <= 3)
        ? '<span style="position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.6);pointer-events:none;"></span>'
        : '';
      div.innerHTML = tensionDotHtml+'<div class="ttl">'+escHtml(task.name)+'</div>'+(task.energy?'<div class="pillrow"><span class="tag">'+escHtml(task.energy)+'</span></div>':'')+timerPillHtml;
      div.addEventListener('click', function(){ openDrawer(task.id); });
      if(i === 0){
        var pill = div.querySelector('.tile-timer-pill');
        if(pill){
          pill.addEventListener('click', function(e){
            e.stopPropagation();
            if(window.PaceTimer){
              var ts = window.PaceTimer.state();
              if(ts && ts.taskId === task.id && ts.running){
                window.PaceTimer.togglePause();
                renderToday();
              } else {
                window.PaceTimer.start(task.id, task.name, 25);
                renderToday();
              }
            }
          });
        }
      }
      tilesEl.appendChild(div);
    });

    var backlogEl = document.getElementById('today-backlog');
    var backlogTilesEl = document.getElementById('today-backlog-tiles');
    var backlogCountEl = document.getElementById('today-backlog-count');
    if(backlog.length > 0 && backlogEl){
      backlogEl.style.display='block';
      backlogTilesEl.innerHTML = '';
      backlog.forEach(function(task){
        var p = Math.max(1, Math.min(5, task.priority||3));
        var col = catColor(task.category);
        var el = document.createElement('div');
        el.className = 'bk2-tile p'+p;
        el.style.background = col+'26';
        el.style.borderLeft = '3px solid '+col;
        el.dataset.taskId = task.id;
        el.title = task.name;
        var t = document.createElement('div');
        t.className='t'; t.textContent = task.name;
        el.appendChild(t);
        el.addEventListener('click', function(){ openDrawer(task.id); });
        backlogTilesEl.appendChild(el);
      });
      backlogCountEl.textContent = backlog.length+' more';
    } else if(backlogEl){
      backlogEl.style.display='none';
    }
  }
  if(typeof window.checkStaleTop === 'function') window.checkStaleTop(todayTasks.slice(0,3)); // SEAM: checkStaleTop lives in ui-checkin.js; window.checkStaleTop is set in ui-dump-sort.js INIT block
}

/* --- List view renderer --- */
var BAND_LABELS = ['urgent','high','medium','low','minimal'];
var BAND_COLORS = ['#C14343','#C17A43','#A89E91','#7A9E7E','#A89E91'];
var BAND_BG     = ['rgba(193,67,67,.07)','rgba(193,122,67,.07)','rgba(168,158,145,.07)','rgba(122,158,126,.07)','rgba(168,158,145,.07)'];

function renderTodayList(tasks, container){
  container.innerHTML='';
  // group by priority 1..5
  for(var p=1;p<=5;p++){
    var band = p-1;
    var bandTasks = tasks.filter(function(t){return t.priority===p;});
    var sec = document.createElement('div');
    sec.className='tl-band';
    sec.style.background=BAND_BG[band];
    sec.style.borderRadius='12px';
    sec.style.padding='4px 4px 4px';
    sec.style.marginBottom='8px';
    var hd = document.createElement('div');
    hd.className='tl-band-hd';
    hd.innerHTML='<span class="tl-dot" style="background:'+BAND_COLORS[band]+'"></span>'+BAND_LABELS[band];
    sec.appendChild(hd);
    bandTasks.forEach(function(task){
      sec.appendChild(makeTLRow(task, tasks));
    });
    container.appendChild(sec);
  }
}

function makeTLRow(task, allTasks){
  var row = document.createElement('div');
  row.className='tl-row';
  row.dataset.taskId=task.id;
  row.innerHTML=
    '<div class="tl-swatch" style="background:'+catColor(task.category)+'"></div>'+
    '<div class="tl-name">'+escHtml(task.name)+'</div>'+
    '<button class="tl-move-btn" data-dir="up" title="Move up" aria-label="Move up">&#9650;</button>'+
    '<button class="tl-move-btn" data-dir="down" title="Move down" aria-label="Move down">&#9660;</button>';

  // tap row name to open drawer (not buttons)
  row.addEventListener('click', function(e){
    if(e.target.closest('.tl-move-btn')) return;
    openDrawer(task.id);
  });

  var upBtn = row.querySelector('[data-dir="up"]');
  var dnBtn = row.querySelector('[data-dir="down"]');

  upBtn.addEventListener('click', function(e){
    e.stopPropagation();
    moveTLTask(task.id, -1, allTasks);
  });
  dnBtn.addEventListener('click', function(e){
    e.stopPropagation();
    moveTLTask(task.id, 1, allTasks);
  });

  // Whole-row drag (mousedown/touchstart pattern)
  setupTLRowDrag(row, task, allTasks);

  return row;
}

function moveTLTask(taskId, dir, allTasks){
  var state = store.get();
  var task = state.tasks.find(function(t){return t.id===taskId;});
  if(!task) return;
  // find all today tasks sorted same way
  var sorted = allTasks.slice();
  var idx = sorted.findIndex(function(t){return t.id===taskId;});
  var newIdx = idx + dir;
  if(newIdx < 0) newIdx = 0;
  if(newIdx >= sorted.length) newIdx = sorted.length - 1;
  if(newIdx === idx) return;

  var neighbor = sorted[newIdx];
  // moving across band boundary?
  var newPriority = task.priority;
  if(dir < 0 && newIdx < idx && neighbor.priority < task.priority){
    newPriority = neighbor.priority;
  } else if(dir > 0 && newIdx > idx && neighbor.priority > task.priority){
    newPriority = neighbor.priority;
  }
  // compute rank: slot between neighbors
  var prevT = sorted[newIdx - 1];
  var nextT = sorted[newIdx + (dir>0?1:0)];
  var prevRank = (prevT && prevT.id !== taskId) ? (prevT.rank||0) : -1;
  var nextRank = (nextT && nextT.id !== taskId) ? (nextT.rank||0) : prevRank + 2;
  var newRank = (prevRank + nextRank) / 2;

  store.updateTask(taskId, {priority: newPriority, rank: newRank});
  renderToday();
}

var _tlDragId = null;
function setupTLRowDrag(row, task, allTasks){
  function onStart(e){
    if(e.target.closest('.tl-move-btn')) return;
    _tlDragId = task.id;
    row.classList.add('tl-dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('touchend', onEnd);
  }
  function onMove(e){
    if(!_tlDragId) return;
    if(e.cancelable) e.preventDefault();
  }
  function onEnd(e){
    if(!_tlDragId) return;
    row.classList.remove('tl-dragging');
    var pt = e.changedTouches ? e.changedTouches[0] : e;
    var container = document.getElementById('today-list-view');
    if(container){
      var rows = Array.from(container.querySelectorAll('.tl-row'));
      var best=-1, bestDist=Infinity;
      rows.forEach(function(r,ri){
        var rect=r.getBoundingClientRect();
        var mid=rect.top+rect.height/2;
        var d=Math.abs(pt.clientY-mid);
        if(d<bestDist){bestDist=d;best=ri;}
      });
      if(best>=0){
        var targetTask = allTasks[best];
        if(targetTask && targetTask.id !== task.id){
          moveTLTaskTo(task.id, targetTask.id, allTasks);
        }
      }
    }
    _tlDragId=null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  }
  row.addEventListener('mousedown', onStart);
  row.addEventListener('touchstart', onStart, {passive:true});
}

function moveTLTaskTo(dragId, targetId, allTasks){
  var dragTask = allTasks.find(function(t){return t.id===dragId;});
  var targetTask = allTasks.find(function(t){return t.id===targetId;});
  if(!dragTask||!targetTask) return;
  store.updateTask(dragId, {priority: targetTask.priority, rank: (targetTask.rank||0) - 0.5});
  renderToday();
}

window.renderToday = renderToday;

/* ===== DRAWER ===== */
var _openTaskId = null;

function openDrawer(taskId){
  var state = store.get();
  var task = state.tasks.find(function(t){ return t.id===taskId; });
  if(!task) return;
  _openTaskId = taskId;

  document.getElementById('dr-swatch').style.background = catColor(task.category);
  var drNameEl = document.getElementById('dr-name');
  drNameEl.textContent = task.name;
  var oldRep = document.getElementById('dr-repeat-note');
  if(oldRep) oldRep.remove();
  if((task.repeatCount||0) > 1){
    var repNote = document.createElement('div');
    repNote.id = 'dr-repeat-note';
    repNote.style.cssText = 'font-size:11px;color:#A89E91;margin-top:3px;font-style:italic;';
    repNote.textContent = 'has come up ×'+task.repeatCount;
    drNameEl.parentNode.insertBefore(repNote, drNameEl.nextSibling);
  }

  document.querySelectorAll('.prio-seg').forEach(function(s){
    s.classList.toggle('active', parseInt(s.dataset.p)===task.priority);
  });
  document.querySelectorAll('[data-energy]').forEach(function(p){
    p.classList.toggle('on', p.dataset.energy===task.energy);
  });
  document.querySelectorAll('[data-cap]').forEach(function(p){
    p.classList.toggle('on', p.dataset.cap===task.capacity);
  });
  document.querySelectorAll('[data-type]').forEach(function(p){
    p.classList.toggle('on', task.types && task.types.indexOf(p.dataset.type)>-1);
  });

  document.getElementById('dr-why').value = task.why||'';

  var notesEl = document.getElementById('dr-notes-list');
  notesEl.innerHTML = '';
  (task.notes||[]).forEach(function(n){
    var d = document.createElement('div'); d.className='note-item'; d.textContent=n;
    notesEl.appendChild(d);
  });

  document.getElementById('emo-grid-wrap').style.display='none';
  document.getElementById('resp-card-wrap').style.display='none';
  document.getElementById('emo-bar-btn').style.display='flex';
  document.getElementById('breakdown').classList.remove('open');
  document.getElementById('bd-title').textContent = task.name;

  // Tension surfacing (Feature 2): idempotent remove-then-add
  var oldTension = document.getElementById('dr-tension-note');
  if(oldTension) oldTension.remove();
  if((task.puntCount||0) >= 3 && (task.priority||5) <= 3){
    var tensionNote = document.createElement('div');
    tensionNote.id = 'dr-tension-note';
    tensionNote.style.cssText = 'background:#EDE8FF;color:#2E245A;font-size:12px;border-radius:10px;padding:10px;margin-bottom:10px;line-height:1.5;';
    var tCount = task.puntCount||0;
    tensionNote.innerHTML = 'This one has waited \xd7'+tCount+' times. That usually means it’s too big, not that you’re failing. Want to make it smaller? <button id="dr-tension-breakdown" style="background:none;border:none;color:#534AB7;font-size:12px;font-family:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0;margin-left:2px;">break it down gently →</button>';
    // insert above the action buttons
    var actBtns = document.getElementById('dr-done');
    if(actBtns && actBtns.parentNode){
      actBtns.parentNode.insertBefore(tensionNote, actBtns);
    }
    // wire the inline button after it's in the DOM
    var tBtn = document.getElementById('dr-tension-breakdown');
    if(tBtn){
      tBtn.addEventListener('click', function(){
        var actBreak = document.getElementById('dr-breakdown-btn');
        if(actBreak) actBreak.click();
      });
    }
  }

  document.getElementById('dr-scrim').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.getElementById('dr-scroll').scrollTop=0;
}

function closeDrawer(){
  _openTaskId = null;
  var scrim = document.getElementById('dr-scrim');
  var drawer = document.getElementById('drawer');
  if(scrim) scrim.classList.remove('open');
  if(drawer) drawer.classList.remove('open');
  var bd = document.getElementById('breakdown');
  if(bd) bd.classList.remove('open');
}

document.getElementById('dr-scrim').addEventListener('click', closeDrawer);
document.getElementById('dr-close').addEventListener('click', closeDrawer);

document.querySelectorAll('.prio-seg').forEach(function(seg){
  seg.addEventListener('click', function(){
    var p = parseInt(seg.dataset.p);
    if(!_openTaskId) return;
    store.updateTask(_openTaskId, {priority:p});
    document.querySelectorAll('.prio-seg').forEach(function(s){
      s.classList.toggle('active', parseInt(s.dataset.p)===p);
    });
    renderToday();
  });
});

document.querySelectorAll('[data-energy]').forEach(function(p){
  p.addEventListener('click', function(){
    if(!_openTaskId) return;
    store.updateTask(_openTaskId, {energy:p.dataset.energy});
    store.logEvent('task_edited', {field:'energy', checkinLevel:store._checkinLevel()}); // item 4
    document.querySelectorAll('[data-energy]').forEach(function(x){ x.classList.toggle('on', x===p); });
  });
});

document.querySelectorAll('[data-cap]').forEach(function(p){
  p.addEventListener('click', function(){
    if(!_openTaskId) return;
    store.updateTask(_openTaskId, {capacity:p.dataset.cap});
    store.logEvent('task_edited', {field:'capacity', checkinLevel:store._checkinLevel()}); // item 4
    document.querySelectorAll('[data-cap]').forEach(function(x){ x.classList.toggle('on', x===p); });
  });
});

document.querySelectorAll('[data-type]').forEach(function(p){
  p.addEventListener('click', function(){
    if(!_openTaskId) return;
    var state = store.get();
    var task = state.tasks.find(function(t){return t.id===_openTaskId;});
    if(!task) return;
    var types = task.types ? task.types.slice() : [];
    var idx = types.indexOf(p.dataset.type);
    if(idx>-1) types.splice(idx,1); else types.push(p.dataset.type);
    store.updateTask(_openTaskId, {types:types});
    store.logEvent('task_edited', {field:'types', checkinLevel:store._checkinLevel()}); // item 4
    p.classList.toggle('on');
  });
});

document.getElementById('dr-why').addEventListener('input', function(){
  if(!_openTaskId) return;
  store.updateTask(_openTaskId, {why:this.value});
});

document.getElementById('dr-note-input').addEventListener('keydown', function(e){
  if(e.key!=='Enter') return;
  e.preventDefault();
  var val = this.value.trim();
  if(!val||!_openTaskId) return;
  var state = store.get();
  var task = state.tasks.find(function(t){return t.id===_openTaskId;});
  if(!task) return;
  var notes = (task.notes||[]).slice(); notes.push(val);
  store.updateTask(_openTaskId, {notes:notes});
  var d = document.createElement('div'); d.className='note-item'; d.textContent=val;
  document.getElementById('dr-notes-list').appendChild(d);
  this.value='';
});

// Done action
document.getElementById('dr-done').addEventListener('click', function(){
  if(!_openTaskId) return;
  var _doneTask = store.get().tasks.find(function(t){return t.id===_openTaskId;});
  store.updateTask(_openTaskId, {status:'done', completedAt:new Date().toISOString()});
  if(_doneTask) store.logEvent('task_completed', {energy:_doneTask.energy||null, capacity:_doneTask.capacity||null, category:_doneTask.category||null, types:_doneTask.types||[], checkinLevel:store._checkinLevel()}); // item 4
  var tile = document.querySelector('[data-task-id="'+_openTaskId+'"]');
  if(tile) tile.classList.add('is-done');
  closeDrawer();
  setTimeout(function(){
    renderToday();
    showToast(timeOfDay()==='late' ? "That's done — and it still counts, even late." : "That's done. It counts.");
  }, 280);
});

// Not today action
document.getElementById('dr-not-today').addEventListener('click', function(){
  if(!_openTaskId) return;
  var state = store.get();
  var tasks = state.tasks;
  var idx = tasks.findIndex(function(t){return t.id===_openTaskId;});
  if(idx>-1){
    var task = tasks[idx]; // ref before splice for logging
    store.logEvent('task_not_today', {energy:task.energy||null, capacity:task.capacity||null, category:task.category||null, types:task.types||[], checkinLevel:store._checkinLevel()}); // item 4
    tasks.splice(idx,1);
    // Punt tracking (Feature 1a)
    task.puntCount = (task.puntCount||0) + 1;
    task.puntLog = (task.puntLog||[]).concat([new Date().toISOString()]);
    tasks.push(task);
    store.save();
  }
  closeDrawer();
  renderToday();
});

/* ===== EMOTION RESPONSES ===== */
var EMO_RESPONSES = {
  Dread:       {head:"Dread makes things very small.",body:"When dread shows up, it's usually protecting you from something hard. You don't have to push through it.",a1:"Acknowledge the feeling before opening the task",a2:"Go very gently — 10 minutes then stop with full permission",a3:"Not today — dread needs its own time"},
  Shame:       {head:"Shame makes everything harder.",body:"Shame whispers that you should have done this already. That voice isn't telling the truth.",a1:"Name it out loud: 'I feel shame about this'",a2:"Do just the smallest possible piece",a3:"Put it away — shame isn't a deadline"},
  Overwhelm:   {head:"Overwhelm means there's too much at once.",body:"You don't have to see the whole staircase. Just the next step.",a1:"Find one single concrete first action",a2:"5 minutes, then permission to stop",a3:"Not today — let it rest"},
  Grief:       {head:"Some tasks carry weight that isn't about the task.",body:"Medical admin and health tasks often touch real grief. The difficulty isn't laziness — it's acknowledging something painful.",a1:"Acknowledge the feeling before opening the task",a2:"Go very gently — 10 minutes then stop with full permission",a3:"Not today — grief needs its own time"},
  Resentment:  {head:"Resentment usually has a message.",body:"If this task makes you angry, that's worth noticing. You might be carrying something that isn't actually yours.",a1:"Ask: whose job is this really?",a2:"Do it for 10 minutes with full permission to stop",a3:"Not today — resentment needs space"},
  Fear:        {head:"Fear is information, not a verdict.",body:"What's the fear underneath this task? Sometimes naming it is enough to soften it.",a1:"Name the fear, even just to yourself",a2:"Tiny step only — no pressure for more",a3:"Not today — fear needs gentleness"},
  Resistance:  {head:"Resistance is your nervous system protecting you.",body:"Resistance isn't laziness. It's your system saying 'I need more before I can move.'",a1:"Ask what you need to feel safe starting",a2:"The tiniest possible start — just open it",a3:"Not today — rest is valid"},
  Complicated: {head:"Some things are just complicated.",body:"Not everything fits into a clear feeling. Complicated is allowed.",a1:"Sit with it for a moment before deciding",a2:"Small step, see how it feels",a3:"Not today — complicated deserves patience"},
  Fine:        {head:"You feel fine about this one.",body:"That's good. Some tasks are just tasks.",a1:"Open it and go",a2:"Set a timer and work until it's done",a3:"Check in again after if you need to"}
};

// Emotion bar toggle
document.getElementById('emo-bar-btn').addEventListener('click', function(){
  this.style.display='none';
  document.getElementById('emo-grid-wrap').style.display='block';
});

// Emotion selection
document.querySelectorAll('.emo-btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    var emo = btn.dataset.emo;
    if(!emo) return;
    if(_openTaskId) store.updateTask(_openTaskId, {emotion:emo});
    var r = EMO_RESPONSES[emo] || EMO_RESPONSES.Fine;
    document.getElementById('resp-head').textContent = r.head;
    document.getElementById('resp-body').textContent = r.body;
    document.getElementById('resp-a1').textContent = r.a1;
    document.getElementById('resp-a2').textContent = r.a2;
    document.getElementById('resp-a3').textContent = r.a3;
    document.getElementById('emo-grid-wrap').style.display='none';
    document.getElementById('resp-card-wrap').style.display='block';
  });
});

// Resp card actions
document.getElementById('resp-not-today').addEventListener('click', function(){
  if(_openTaskId){
    var state = store.get();
    var tasks = state.tasks;
    var idx = tasks.findIndex(function(t){return t.id===_openTaskId;});
    if(idx>-1){
      var task=tasks[idx]; // ref before splice for logging
      store.logEvent('task_not_today', {energy:task.energy||null, capacity:task.capacity||null, category:task.category||null, types:task.types||[], checkinLevel:store._checkinLevel()}); // item 4
      tasks.splice(idx,1);
      // Punt tracking (Feature 1b)
      task.puntCount = (task.puntCount||0) + 1;
      task.puntLog = (task.puntLog||[]).concat([new Date().toISOString()]);
      tasks.push(task);
      store.save();
    }
  }
  closeDrawer();
  renderToday();
});
document.getElementById('resp-open-anyway').addEventListener('click', function(){
  document.getElementById('resp-card-wrap').style.display='none';
  document.getElementById('emo-bar-btn').style.display='flex';
});
// Action pills just close resp card and return to drawer
[document.getElementById('resp-a1'),document.getElementById('resp-a2'),document.getElementById('resp-a3')].forEach(function(btn){
  if(btn) btn.addEventListener('click', function(){
    document.getElementById('resp-card-wrap').style.display='none';
    document.getElementById('emo-bar-btn').style.display='flex';
  });
});

/* ===== BREAKDOWN ===== */
/* 2B (replace, don't stack): accepting a breakdown swaps the parent for its
   steps atomically — see store.replaceTask. Cancel/back never touches state. */
var _bdForTaskId = null; // which task the current bd-input fields were built for

function makeBdRow(n){
  var row = document.createElement('div');
  row.className = 'bd-input-row';
  row.innerHTML = '<input class="bd-input" type="text" placeholder="Step '+n+'…"><button class="bd-rm" type="button">\xd7</button>';
  row.querySelector('.bd-rm').addEventListener('click', function(){ row.remove(); });
  return row;
}

function resetBdInputs(){
  ['bd-ai-status','bd-ai-hint'].forEach(function(id){ var el=document.getElementById(id); if(el) el.remove(); });
  var wrap = document.getElementById('bd-inputs');
  wrap.innerHTML = '';
  for(var i=1;i<=3;i++) wrap.appendChild(makeBdRow(i));
}


document.getElementById('dr-breakdown-btn').addEventListener('click', function(){
  document.getElementById('breakdown').classList.add('open');
  // Fresh 3 empty fields when this is a different task than the fields were
  // built for — stale steps from another task must never be swapped in.
  if(_openTaskId !== _bdForTaskId){
    _bdForTaskId = _openTaskId;
    resetBdInputs();
  } else {
    // Same task re-opened: keep what the user already typed or edited.
    var hasText = false;
    document.getElementById('bd-inputs').querySelectorAll('.bd-input').forEach(function(inp){ if(inp.value.trim()) hasText = true; });
    if(hasText) return; // don't clobber their edits with a fresh AI call
  }
  // AI Breakdown: prefill exactly 3 steps if AI is available (proxy or BYOK key)
  if(!window.PaceAI || !window.PaceAI.available() || !_openTaskId) return;
  var state = store.get();
  var task = state.tasks.find(function(t){ return t.id===_openTaskId; });
  if(!task) return;
  // show status line
  var bdInputsEl = document.getElementById('bd-inputs');
  var oldStatus = document.getElementById('bd-ai-status');
  if(oldStatus) oldStatus.remove();
  var statusEl = document.createElement('div');
  statusEl.id = 'bd-ai-status';
  statusEl.style.cssText = 'font-size:12px;color:#534AB7;font-style:italic;padding:4px 2px 8px;';
  statusEl.textContent = 'thinking of tiny steps…';
  bdInputsEl.parentNode.insertBefore(statusEl, bdInputsEl);
  window.PaceAI.claudeCall([{
    role:'user',
    content: buildBreakdownPrompt(task)
  }], 512)
  .then(function(raw){
    var json = raw.replace(/```[a-z]*\n?/gi,'').replace(/```/g,'').trim();
    var arr = JSON.parse(json);
    if(!Array.isArray(arr)) throw new Error('malformed');
    var VALID_ENERGY = {body:1,mind:1,both:1};
    var steps = [];
    arr.forEach(function(it){
      try {
        if(steps.length >= 3) return; // exactly 3 — extras dropped
        if(!it || typeof it !== 'object' || Array.isArray(it)) return; // malformed item: drop it
        var t = String(it.title||'').trim().slice(0,200);
        if(!t) return;
        steps.push({title:t, energy: VALID_ENERGY[it.energy] ? it.energy : 'both'});
      } catch(itemErr){ /* one bad item never sinks the batch */ }
    });
    if(steps.length !== 3) throw new Error('malformed'); // fewer than 3 usable → manual fields stay
    // remove status, add hint note
    var st2 = document.getElementById('bd-ai-status');
    if(st2) st2.remove();
    var oldHint = document.getElementById('bd-ai-hint');
    if(oldHint) oldHint.remove();
    var hintEl = document.createElement('div');
    hintEl.id = 'bd-ai-hint';
    hintEl.style.cssText = 'font-size:11.5px;color:#534AB7;padding:0 2px 8px;line-height:1.45;';
    hintEl.textContent = 'Suggestions — edit anything. These replace the big task.';
    bdInputsEl.parentNode.insertBefore(hintEl, bdInputsEl);
    // clear existing inputs and repopulate
    bdInputsEl.innerHTML = '';
    steps.forEach(function(step, si){
      var row = makeBdRow(si+1);
      var inp = row.querySelector('.bd-input');
      inp.value = step.title;
      inp.dataset.energy = step.energy;
      // highlight first step (Feature 3: teal border)
      if(si === 0){
        inp.style.border = '1.4px solid #1D9E75';
      }
      bdInputsEl.appendChild(row);
    });
  })
  .catch(function(){
    // AI failure or junk reply → quiet manual fallback: empty fields stay usable
    var st3 = document.getElementById('bd-ai-status');
    if(st3) st3.remove();
  });
});
document.getElementById('bd-back').addEventListener('click', function(){
  document.getElementById('breakdown').classList.remove('open');
});
document.getElementById('bd-add-more').addEventListener('click', function(){
  var row = document.createElement('div'); row.className='bd-input-row';
  var n = document.getElementById('bd-inputs').querySelectorAll('.bd-input').length + 1;
  row.innerHTML = '<input class="bd-input" type="text" placeholder="Step '+n+'…"><button class="bd-rm" type="button">×</button>';
  row.querySelector('.bd-rm').addEventListener('click', function(){ row.remove(); });
  document.getElementById('bd-inputs').appendChild(row);
});
// Remove initial rm buttons
document.querySelectorAll('.bd-rm').forEach(function(btn){
  btn.addEventListener('click', function(){ btn.closest('.bd-input-row').remove(); });
});
document.getElementById('bd-confirm').addEventListener('click', function(){
  if(!_openTaskId) return;
  var state = store.get();
  var parent = state.tasks.find(function(t){return t.id===_openTaskId;});
  if(!parent) return;
  var steps = [];
  document.getElementById('bd-inputs').querySelectorAll('.bd-input').forEach(function(inp){
    var v = inp.value.trim();
    if(!v) return;
    var en = inp.dataset.energy;
    steps.push({ title: v.slice(0,200), energy: (en==='body'||en==='mind'||en==='both') ? en : 'both' });
  });
  if(steps.length < 1) return;
  var today = new Date().toISOString().slice(0,10);
  var prioVal = (parent.priority>=1 && parent.priority<=5) ? parent.priority : 3;
  var whyVal = (parent.why && String(parent.why).trim()) ? String(parent.why).trim().slice(0,140) : '';
  var children = steps.map(function(s){
    return {id:Math.random().toString(36).slice(2,10),name:s.title,category:parent.category,priority:prioVal,energy:s.energy,capacity:'low',types:[],why:whyVal,notes:['step of: '+parent.name+' · '+today],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null};
  });
  // Atomic swap: one in-memory splice, ONE save (write-through). The parent
  // and its steps can never be persisted together.
  if(!store.replaceTask(parent.id, children)) return;
  store.logEvent('breakdown_accepted', {childCount:children.length, checkinLevel:store._checkinLevel()}); // item 4
  _bdForTaskId = null;
  document.getElementById('breakdown').classList.remove('open');
  closeDrawer();
  renderToday();
  showToast('Swapped it for '+children.length+' smaller step'+(children.length!==1?'s':'')+'.');
});


export { renderToday, openDrawer, closeDrawer, _openTaskId };
