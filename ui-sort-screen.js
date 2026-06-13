/* ===== PHASE 2 — SORT SCREEN ===== */
(function(){
'use strict';

var store = window.Pace.store;
var showScreen = window.Pace.showScreen;
var renderToday = window.Pace.renderToday;
var showToast = function(msg){
  var t = document.getElementById('global-toast');
  t.innerHTML = '<span>✨</span> '+msg;
  t.classList.add('is-shown');
  setTimeout(function(){ t.classList.remove('is-shown'); }, 2600);
};

var CAT_COLOR = {
  health:'#EF9F27',selfcare:'#D4537E',creative:'#1D9E75',
  work:'#378ADD',admin:'#D85A30',home:'#639922',social:'#7F77DD'
};
var CAT_CLS = {
  health:'c-amber',selfcare:'c-pink',creative:'c-teal',
  work:'c-blue',admin:'c-coral',home:'c-green',social:'c-purple'
};
var CAT_LABEL = {
  health:'Health',selfcare:'Self-care',creative:'Creative',
  work:'Work',admin:'Admin',home:'Home',social:'Social'
};
function catColor(c){ return CAT_COLOR[c]||CAT_COLOR.admin; }
function catCls(c){ return CAT_CLS[c]||CAT_CLS.admin; }
function catLabel(c){ return CAT_LABEL[c]||CAT_LABEL.admin; }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ----- SORT state ----- */
var _sortQueue = [];
var _sortIdx   = 0;

function buildSortQueue(){
  var state = store.get();
  _sortQueue = state.tasks.filter(function(t){ return t.status==='today'; }).slice();
  _sortIdx = 0;
  _signals = {}; // reset per sort session
  renderSignal();
}

/* ----- Sort signals (Feature 5) ----- */
var _signals = {}; // {category: {now:0, later:0}}

function recordSignal(cat, dir){
  if(!cat) return;
  if(!_signals[cat]) _signals[cat] = {now:0, later:0};
  if(dir === 'now') _signals[cat].now++;
  else _signals[cat].later++;
  renderSignal();
}

function renderSignal(){
  var el = document.getElementById('sort-signal');
  if(!el) return;
  // find most lopsided category with 3+ in one direction
  var best = null, bestCount = 0, bestDir = '';
  var CAT_LABEL_SIG = {health:'Health',selfcare:'Self-care',creative:'Creative',work:'Work',admin:'Admin',home:'Home',social:'Social'};
  Object.keys(_signals).forEach(function(cat){
    var s = _signals[cat];
    if(s.now >= 3 && s.now > s.later && s.now > bestCount){ best=cat; bestCount=s.now; bestDir='now'; }
    if(s.later >= 3 && s.later > s.now && s.later > bestCount){ best=cat; bestCount=s.later; bestDir='later'; }
  });
  if(!best){ el.textContent=''; return; }
  var label = CAT_LABEL_SIG[best]||best;
  if(bestDir==='now'){
    el.textContent = label+' keeps moving to do-now ('+bestCount+') — it matters a lot right now.';
  } else {
    el.textContent = label+' keeps sliding to later ('+bestCount+') — heavy, or just not yet?';
  }
}

function renderSortCard(){
  var stage = document.getElementById('sort-stage');
  var cta   = document.getElementById('sort-cta');
  var empty = document.getElementById('sort-empty');
  var ctr   = document.getElementById('sort-counter-txt');
  var pill  = document.getElementById('sort-counter-pill');

  // clear old cards
  stage.querySelectorAll('.sort-card').forEach(function(c){ c.remove(); });
  [document.getElementById('se-left'),document.getElementById('se-right'),
   document.getElementById('se-top'),document.getElementById('se-bottom')].forEach(function(h){
    if(h){ h.style.opacity='0'; }
  });

  var remaining = _sortQueue.length - _sortIdx;
  if(remaining <= 0){
    stage.style.display='none';
    cta.style.display='none';
    empty.style.display='flex';
    ctr.textContent='';
    if(pill) pill.textContent='done';
    return;
  }

  stage.style.display='';
  cta.style.display='';
  empty.style.display='none';
  if(pill) pill.textContent = remaining+' task'+(remaining!==1?'s':'');

  // render up to 3 depth cards back→front
  var depth = Math.min(3, remaining);
  for(var di = depth-1; di >= 0; di--){
    var qi = _sortIdx + di;
    if(qi >= _sortQueue.length) continue;
    var task = _sortQueue[qi];
    var card = document.createElement('div');
    card.className = 'sort-card'+(di===0?' front':di===1?' back1':' back2');
    var col = catColor(task.category);
    card.style.background = col;
    card.style.color = '#fff';
    card.innerHTML =
      '<div class="sc-body">' +
        '<div class="sc-cat">'+escHtml(catLabel(task.category))+'</div>' +
        '<div class="sc-name">'+escHtml(task.name)+'</div>' +
        '<span class="sc-pill">'+escHtml(catLabel(task.category))+(task.energy?' · '+escHtml(task.energy):'')+'</span>' +
        (task.why ? '<div class="sc-why">'+escHtml(task.why)+'</div>' : '') +
      '</div>' +
      '<div class="sc-spark" style="background:rgba(255,255,255,.35);width:'+(task.priority?((6-task.priority)/5*100)+'%':'60%')+'"></div>';
    stage.appendChild(card);
    if(di===0) attachSwipe(card, task);
  }

  ctr.textContent = 'card '+(_sortIdx+1)+' of '+_sortQueue.length;
}

function advanceSort(){
  _sortIdx++;
  renderToday();
  renderSortCard();
}

function attachSwipe(card, task){
  var startX=0, startY=0, dx=0, dy=0, dragging=false;
  var THRESHOLD = 80;
  var hintL = document.getElementById('se-left');
  var hintR = document.getElementById('se-right');
  var hintT = document.getElementById('se-top');
  var hintB = document.getElementById('se-bottom');

  function onStart(e){
    dragging=true;
    var pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX; startY = pt.clientY;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('touchend', onEnd);
  }
  function onMove(e){
    if(!dragging) return;
    e.preventDefault();
    var pt = e.touches ? e.touches[0] : e;
    dx = pt.clientX - startX;
    dy = pt.clientY - startY;
    var rot = dx * 0.08;
    card.style.transform = 'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg)';
    var adx = Math.abs(dx), ady = Math.abs(dy);
    var dominant = adx > ady ? 'x' : 'y';
    var opx = Math.min(1, adx/THRESHOLD);
    var opy = Math.min(1, ady/THRESHOLD);
    hintL.style.opacity = (dominant==='x' && dx<0) ? opx : 0;
    hintR.style.opacity = (dominant==='x' && dx>0) ? opx : 0;
    hintT.style.opacity = (dominant==='y' && dy<0) ? opy : 0;
    hintB.style.opacity = (dominant==='y' && dy>0) ? opy : 0;
  }
  function onEnd(){
    dragging=false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    hintL.style.opacity=hintR.style.opacity=hintT.style.opacity=hintB.style.opacity=0;

    var adx=Math.abs(dx), ady=Math.abs(dy);
    if(adx > THRESHOLD && adx > ady){
      if(dx > 0){
        // right → raise priority → signal "now"
        var np = Math.max(1, task.priority-1);
        store.updateTask(task.id, {priority:np});
        recordSignal(task.category, 'now');
        animateCardOff(card, 1, 0, advanceSort);
      } else {
        // left → lower priority → signal "later"
        // Punt tracking (Feature 1d): swipe-left on priority 1-2 = punt
        var np2 = Math.min(5, task.priority+1);
        var patchLeft = {priority:np2};
        if(task.priority <= 2){
          patchLeft.puntCount = (task.puntCount||0) + 1;
          patchLeft.puntLog = (task.puntLog||[]).concat([new Date().toISOString()]);
        }
        store.updateTask(task.id, patchLeft);
        recordSignal(task.category, 'later');
        animateCardOff(card, -1, 0, advanceSort);
      }
    } else if(ady > THRESHOLD && ady > adx){
      if(dy < 0){
        // up → open drawer
        card.style.transform='';
        window.openDrawer && window.openDrawer(task.id);
      } else {
        // down → someday
        store.updateTask(task.id, {status:'someday'});
        animateCardOff(card, 0, 1, function(){
          showToast('Sent to Someday — safe in the clouds');
          advanceSort();
        });
      }
    } else {
      card.style.transform='';
    }
  }
  card.addEventListener('mousedown', onStart);
  card.addEventListener('touchstart', onStart, {passive:true});
}

function animateCardOff(card, sx, sy, cb){
  card.style.transition='transform .35s ease,opacity .3s ease';
  card.style.transform='translate('+(sx*400)+'px,'+(sy*-300)+'px) rotate('+(sx*25)+'deg)';
  card.style.opacity='0';
  setTimeout(cb, 340);
}

// CTA buttons
document.getElementById('sort-do-now').addEventListener('click', function(){
  if(_sortIdx >= _sortQueue.length) return;
  var task = _sortQueue[_sortIdx];
  store.updateTask(task.id, {priority:1});
  recordSignal(task.category, 'now'); // Feature 5
  // move to front of queue
  _sortQueue.splice(_sortIdx,1);
  _sortQueue.unshift(task);
  _sortIdx=0;
  renderSortCard();
  renderToday();
  showToast('Set as priority one — front and center');
});
document.getElementById('sort-skip').addEventListener('click', function(){
  if(_sortIdx < _sortQueue.length){
    var task = _sortQueue[_sortIdx];
    // Punt tracking (Feature 1c)
    store.updateTask(task.id, {
      puntCount: (task.puntCount||0) + 1,
      puntLog: (task.puntLog||[]).concat([new Date().toISOString()])
    });
    recordSignal(task.category, 'later'); // Feature 5
  }
  advanceSort();
});
document.getElementById('sort-letgo').addEventListener('click', function(){
  if(_sortIdx >= _sortQueue.length) return;
  var task = _sortQueue[_sortIdx];
  store.updateTask(task.id, {status:'done', letGo:true, completedAt:new Date().toISOString()});
  showToast('Released. That’s allowed.');
  advanceSort();
});

// Re-enter sort screen — rebuild queue
document.addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(tab && tab.dataset.tab==='sort'){
    buildSortQueue();
    renderSortCard();
  }
});

})();
