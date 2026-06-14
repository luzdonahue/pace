/* ===== PHASE 2 — SOMEDAY SCREEN ===== */
(function(){
'use strict';
var store = window.Pace.store;
var showScreen = window.Pace.showScreen;
var renderToday = window.Pace.renderToday;
function showToast(msg){
  var t=document.getElementById('global-toast');
  t.innerHTML='<span>✨</span> '+msg;
  t.classList.add('is-shown');
  setTimeout(function(){t.classList.remove('is-shown');},2600);
}

var CAT_COLOR={health:'#EF9F27',selfcare:'#D4537E',creative:'#1D9E75',work:'#378ADD',admin:'#D85A30',home:'#639922',social:'#7F77DD'};
var CAT_LABEL={health:'Health',selfcare:'Self-care',creative:'Creative',work:'Work',admin:'Admin',home:'Home',social:'Social'};
var escHtml = window.Pace.escHtml; // S3: canonical quote-escaping variant from core-logic

var DRIFT_ANIMS = ['drift1 4.2s ease-in-out infinite','drift2 5.1s ease-in-out infinite','drift3 3.8s ease-in-out infinite'];
var _openPopTaskId = null;

function renderSomeday(){
  var state = store.get();
  var tasks = state.tasks.filter(function(t){return t.status==='someday';});
  var doneSd = state.tasks.filter(function(t){return t.status==='done' && t.letGo;}).length;

  // stats
  var sdCount = document.getElementById('sd-count');
  var sdOldest = document.getElementById('sd-oldest');
  var sdDone = document.getElementById('sd-done');
  if(sdCount) sdCount.textContent = tasks.length;
  if(sdDone) sdDone.textContent = doneSd;
  if(sdOldest){
    if(tasks.length){
      var oldest = tasks.reduce(function(a,b){return a.createdAt<b.createdAt?a:b;});
      var d = new Date(oldest.createdAt);
      var now = new Date();
      var days = Math.round((now-d)/(1000*60*60*24));
      sdOldest.textContent = days===0?'today':days+'d';
    } else { sdOldest.textContent='—'; }
  }

  var canvas = document.getElementById('sky-canvas');
  var emptyEl = document.getElementById('someday-empty');
  if(!canvas) return;

  // remove old clouds (keep sun-orb)
  Array.from(canvas.children).forEach(function(c){
    if(!c.classList.contains('sun-orb')) c.remove();
  });

  if(tasks.length===0){
    if(emptyEl) emptyEl.style.display='flex';
    return;
  }
  if(emptyEl) emptyEl.style.display='none';

  // layout: 2 staggered columns, clouds sized to hold their full text
  var pendingClouds = [];
  tasks.forEach(function(task, i){
    var cloud = document.createElement('div');
    cloud.className = 'cloud';
    var len = task.name.length;
    // generous width; height comes from real measurement after render
    var w = Math.max(200, Math.min(130 + len * 5, 310));
    cloud.style.cssText = 'width:'+w+'px;animation:'+DRIFT_ANIMS[i%3];
    pendingClouds.push({cloud: cloud, w: w, i: i});
    cloud.dataset.taskId = task.id;
    var catCol = CAT_COLOR[task.category]||CAT_COLOR.admin;
    var catLbl = CAT_LABEL[task.category]||'Task';
    cloud.innerHTML =
      '<div class="cshape"><svg viewBox="0 0 200 80" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M30 62 Q10 62 10 46 Q10 30 26 29 Q24 8 50 8 Q62 2 76 12 Q88 2 108 8 Q126 0 144 14 Q166 8 178 26 Q196 26 196 44 Q196 62 174 62 Z" fill="rgba(255,255,255,0.88)"/>' +
      '</svg></div>' +
      '<div class="ccontent">' +
        '<div class="cl-ttl">'+escHtml(task.name)+'</div>' +
        '<div class="cl-meta"><div class="cl-dot" style="background:'+catCol+'"></div>'+escHtml(catLbl)+'</div>' +
      '</div>';
    cloud.addEventListener('click', function(e){
      e.stopPropagation();
      if(_openPopTaskId===task.id){
        closeAllPops();
        return;
      }
      closeAllPops();
      _openPopTaskId = task.id;
      showCloudPop(cloud, task);
    });
    canvas.appendChild(cloud);
  });
  // second pass: measure real heights, single staggered stack — never overlaps
  var skyW = canvas.clientWidth || 340;
  var runTop = 24;
  pendingClouds.forEach(function(pc){
    var h = Math.max(76, pc.cloud.offsetHeight);
    var offsets = [10, 0.45, 0.18]; // px, then fractions of free space
    var free = Math.max(0, skyW - pc.w - 16);
    var left = pc.i % 3 === 0 ? Math.min(10, free) : Math.round(free * offsets[pc.i % 3]) + 8;
    pc.cloud.style.left = left + 'px';
    pc.cloud.style.top = runTop + 'px';
    runTop += h + 26;
  });
}

function closeAllPops(){
  _openPopTaskId = null;
  document.querySelectorAll('.cloud-pop').forEach(function(p){ p.remove(); });
}

function showCloudPop(cloud, task){
  var pop = document.createElement('div');
  pop.className = 'cloud-pop';
  pop.innerHTML =
    '<span class="pop-label" style="cursor:pointer">bring back to today ↓</span>' +
    '<span class="pop-div"></span>' +
    '<button class="pop-ghost" type="button">let go</button>';
  pop.querySelector('.pop-label').addEventListener('click', function(){
    store.updateTask(task.id, {status:'today'});
    renderToday();
    renderSomeday();
    closeAllPops();
    showToast('Back on today — welcome back');
  });
  pop.querySelector('.pop-ghost').addEventListener('click', function(){
    cloud.classList.add('cloud-float-away');
    store.updateTask(task.id, {status:'done', letGo:true, completedAt:new Date().toISOString()});
    setTimeout(function(){
      renderSomeday();
      closeAllPops();
    }, 510);
  });
  cloud.appendChild(pop);
}

document.addEventListener('click', function(e){
  if(!e.target.closest('.cloud')) closeAllPops();
});

document.getElementById('someday-back-btn').addEventListener('click', function(){
  showScreen('today');
});

// Re-render when entering someday
document.addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(tab && tab.dataset.tab==='someday') renderSomeday();
});
window._renderSomeday = renderSomeday;

})();


/* ===== PHASE 2 — GOALS SCREEN ===== */
(function(){
'use strict';
var store = window.Pace.store;
var showToast = function(msg){
  var t=document.getElementById('global-toast');
  t.innerHTML='<span>✨</span> '+msg; t.classList.add('is-shown');
  setTimeout(function(){t.classList.remove('is-shown');},2600);
};
var escHtml = window.Pace.escHtml; // S3: canonical quote-escaping variant from core-logic

// Seed default goals if missing
var GOAL_DEFAULTS = [
  {id:'g1',name:'Build Pace app',why:'I want to make something that helps people like me feel less alone.',pct:35,color:'#1D9E75',expanded:true,
   tasks:['Finish phase 2 JS','Write onboarding copy','Test with 3 users'],
   nextTask:{name:'Fix sort screen bugs',category:'creative',priority:2}},
  {id:'g2',name:'Stabilise my health routine',why:'Consistency is the only thing that actually moves the needle.',pct:55,color:'#EF9F27',expanded:false,
   tasks:['Track symptoms daily','Schedule PT 2x/week'],
   nextTask:{name:'Log symptoms today',category:'health',priority:2}},
  {id:'g3',name:'Finish the mosaic project',why:'Creative output is proof I\'m still here, still making.',pct:20,color:'#D4537E',expanded:false,
   tasks:['Grout the bottom panel','Source more glass tiles'],
   nextTask:{name:'Grout bottom panel — 1 hour',category:'creative',priority:3}},
  {id:'g4',name:'Get finances in order',why:'Money stress makes everything else harder.',pct:10,color:'#D85A30',expanded:false,
   tasks:['Complete audit spreadsheet','Set up auto-savings'],
   nextTask:{name:'Open the audit spreadsheet',category:'admin',priority:3}}
];

function ensureGoals(){
  var state = store.get();
  if(!state.goals || state.goals.length===0){
    state.goals = JSON.parse(JSON.stringify(GOAL_DEFAULTS));
    store.save();
  }
}

function renderGoals(){
  ensureGoals();
  var state = store.get();
  var list = document.getElementById('goals-list');
  if(!list) return;
  list.innerHTML='';
  state.goals.forEach(function(goal, gi){
    var card = document.createElement('div');
    card.className='goal-card';
    card.style.background = goal.color+'18';
    card.style.setProperty('--gc',goal.color);
    card.innerHTML =
      '<style>.goal-card::before{background:var(--gc,#1D9E75)}</style>' +
      '<div class="goal-row" data-gi="'+gi+'">' +
        '<div class="goal-dot" style="background:'+escHtml(goal.color)+'"></div>' +
        '<div class="goal-name">'+escHtml(goal.name)+'</div>' +
        '<div class="goal-pct" style="color:'+escHtml(goal.color)+'">'+goal.pct+'%</div>' +
        '<span style="font-size:13px;color:#A89E91;margin-left:4px;">'+(goal.expanded?'▾':'▸')+'</span>' +
      '</div>' +
      '<div class="goal-bar"><span style="width:'+goal.pct+'%;background:'+escHtml(goal.color)+'"></span></div>' +
      '<div class="goal-expand'+(goal.expanded?' open':'')+'">'+
        '<div class="goal-why">'+escHtml(goal.why)+'</div>'+
        '<div class="goal-eyebrow">Linked tasks</div>'+
        '<div class="goal-linked">'+
          goal.tasks.map(function(tn){
            return '<div class="goal-link"><div class="ll-dot" style="background:'+escHtml(goal.color)+'"></div><div class="ll-name">'+escHtml(tn)+'</div></div>';
          }).join('')+
        '</div>'+
        '<button class="goal-break-btn" data-gi="'+gi+'">break a task into today →</button>'+
      '</div>';
    card.querySelector('.goal-row').addEventListener('click', function(){
      goal.expanded = !goal.expanded;
      store.save();
      renderGoals();
    });
    card.querySelector('.goal-break-btn').addEventListener('click', function(e){
      e.stopPropagation();
      var nt = goal.nextTask;
      if(!nt) return;
      var newTask = {id:Math.random().toString(36).slice(2,10),name:nt.name,category:nt.category||'creative',priority:nt.priority||2,energy:'mind',capacity:'med',types:[],why:goal.why,notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null};
      if(window._addTaskWithMerge){
        window._addTaskWithMerge(newTask, function(){
          window.Pace.renderToday();
          showToast('Added to today — p'+newTask.priority);
        });
      } else {
        store.addTask(newTask);
        window.Pace.store.logEvent('task_added', {source:'manual', energy:newTask.energy||'both', capacity:newTask.capacity||'med', category:newTask.category||'admin', types:newTask.types||[], checkinLevel:window.Pace.store._checkinLevel()}); // item 4
        window.Pace.renderToday();
        showToast('Added to today — p'+newTask.priority);
      }
    });
    list.appendChild(card);
  });
}

// Add goal form
document.getElementById('goals-add-open').addEventListener('click', function(){
  var form = document.getElementById('goals-add-form');
  form.style.display = form.style.display==='flex' ? 'none' : 'flex';
  this.textContent = form.style.display==='flex' ? '— cancel' : '+ add a goal';
});
document.getElementById('goals-new-save').addEventListener('click', function(){
  var nameEl = document.getElementById('goals-new-name');
  var whyEl  = document.getElementById('goals-new-why');
  var name = nameEl.value.trim();
  if(!name) return;
  ensureGoals();
  var state = store.get();
  var colors=['#1D9E75','#EF9F27','#D4537E','#378ADD','#D85A30','#7F77DD'];
  var col = colors[state.goals.length % colors.length];
  state.goals.push({id:Math.random().toString(36).slice(2,10),name:name,why:whyEl.value.trim()||'',pct:0,color:col,expanded:false,tasks:[],nextTask:{name:'First step for: '+name,category:'admin',priority:3}});
  store.save();
  nameEl.value=''; whyEl.value='';
  document.getElementById('goals-add-form').style.display='none';
  document.getElementById('goals-add-open').textContent='+ add a goal';
  renderGoals();
  window.Pace.showToast && window.Pace.showToast('Goal added.');
});

document.addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(tab && tab.dataset.tab==='goals') renderGoals();
});

// set goals-date header
var gd = document.getElementById('goals-date');
if(gd){
  var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var mons=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var nd=new Date(); gd.textContent=days[nd.getDay()]+', '+mons[nd.getMonth()]+' '+nd.getDate();
}

window._renderGoals = renderGoals;
})();
