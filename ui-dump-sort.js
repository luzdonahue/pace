import { store, storageAdapter, loadSampleData, sanitizeState } from './core-store.js';
import { CAT, catCls, escHtml, timeOfDay, guessCategory, parseDump, buildDumpPrompt, rolloverTasks, dateStr } from './core-logic.js';
import { showScreen, showToast, applyCheckinGreeting } from './ui-shell.js';
import { renderToday, openDrawer, closeDrawer, _openTaskId } from './ui-today.js';
import { checkStaleTop } from './ui-checkin.js';

/* ===== DUMP SCREEN ===== */

// Mic — rebuilt
var _micRec = null;
var _micListening = false;
// Read-only view for other script blocks (IIFE scopes don't cross <script> boundaries)
window._isMicListening = function(){ return _micListening; };

function resetMicUI(){
  var btn = document.getElementById('dump-mic');
  var lbl = document.getElementById('dump-mic-label');
  if(btn) btn.classList.remove('listening','recording');
  if(lbl) lbl.textContent = (window.PaceWhisper && window.PaceWhisper.enabled()) ? 'or speak a brain dump (hq)' : 'or speak a brain dump';
  _micListening = false;
  _micRec = null;
  window._whisperRecording = false;
  window._whisperTranscribing = false;
  window._whisperStream = null;
}

document.getElementById('dump-mic').addEventListener('click', function(){
  var btn = document.getElementById('dump-mic');
  var lbl = document.getElementById('dump-mic-label');
  var ta  = document.getElementById('dump-textarea');

  // ---- WHISPER PATH ----
  if(window.PaceWhisper && window.PaceWhisper.enabled() && !window.__whisperImportFailed){
    // Tap while transcribing: cancel — never trap the user
    if(window._whisperTranscribing){
      window.PaceWhisper.cancel();
      window._whisperTranscribing = false;
      resetMicUI();
      showToast('Cancelled — no harm done');
      return;
    }
    // Second tap: stop recording
    if(window._whisperRecording && window._whisperMR){
      try{ window._whisperMR.stop(); } catch(e){}
      return;
    }
    // First tap: start recording
    window._whisperRecording = true;
    if(btn){ btn.classList.add('listening'); }
    if(lbl){ lbl.textContent = 'listening — tap when done'; }
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      window._whisperStream = stream;
      var chunks = [];
      var mr = new MediaRecorder(stream);
      window._whisperMR = mr;
      mr.ondataavailable = function(e){ if(e.data && e.data.size > 0) chunks.push(e.data); };
      mr.onstop = function(){
        stream.getTracks().forEach(function(t){ t.stop(); });
        window._whisperRecording = false;
        window._whisperTranscribing = true;
        if(btn){ btn.classList.remove('listening'); btn.classList.add('recording'); }
        if(lbl){ lbl.textContent = 'working on it… tap to cancel'; }
        var blob = new Blob(chunks, {type: mr.mimeType || 'audio/webm'});
        window.PaceWhisper.transcribe(blob, function(progressMsg){
          if(lbl && window._whisperTranscribing){ lbl.textContent = progressMsg + ' · tap to cancel'; }
        }).then(function(text){
          window._whisperTranscribing = false;
          if(text && text.trim()){
            var existing = ta.value || '';
            var sep = existing && !existing.endsWith(' ') && !existing.endsWith('\n') ? ' ' : '';
            ta.value = existing + sep + text.trim();
          }
          resetMicUI();
        }).catch(function(err){
          window._whisperTranscribing = false;
          var msg = String(err && err.message || '');
          if(msg === 'cancelled'){ resetMicUI(); return; }
          if(msg === 'timeout'){ showToast('That took too long — try again on wifi, or use basic voice'); resetMicUI(); return; }
          showToast("Voice model couldn’t load — using basic voice");
          resetMicUI();
          // fall back to Web Speech for this attempt
          window.__whisperImportFailed = true;
          var SpeechRecFB = window.SpeechRecognition || window.webkitSpeechRecognition;
          if(!SpeechRecFB){ return; }
          var recFB = new SpeechRecFB();
          recFB.lang = navigator.language || 'en-US';
          recFB.continuous = false;
          recFB.interimResults = false;
          recFB.onresult = function(ev){
            var t = ev.results[0][0].transcript;
            var ex2 = ta.value || '';
            var sep2 = ex2 && !ex2.endsWith(' ') && !ex2.endsWith('\n') ? ' ' : '';
            ta.value = ex2 + sep2 + t;
          };
          recFB.onerror = function(){};
          try{ recFB.start(); } catch(e2){}
        });
      };
      mr.start();
    }).catch(function(){
      showToast("Mic permission needed — check the browser’s site settings");
      resetMicUI();
    });
    return;
  }

  // ---- WEB SPEECH PATH ----
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRec){ showToast("Voice isn't supported in this browser"); return; }

  if(_micListening && _micRec){
    try{ _micRec.stop(); } catch(e){}
    return;
  }

  var rec = new SpeechRec();
  _micRec = rec;
  rec.lang = navigator.language || 'en-US';
  rec.continuous = true;
  rec.interimResults = true;

  var committedText = ta.value;

  if(btn){ btn.classList.add('listening'); }
  if(lbl){ lbl.textContent = 'listening — tap to stop'; }
  _micListening = true;

  rec.onresult = function(e){
    var interim = '';
    var final = '';
    for(var i = e.resultIndex; i < e.results.length; i++){
      var t = e.results[i][0].transcript;
      if(e.results[i].isFinal){ final += t; } else { interim += t; }
    }
    if(final){
      var sep = committedText && !committedText.endsWith(' ') && !committedText.endsWith('\n') ? ' ' : '';
      committedText += sep + final;
    }
    ta.value = committedText + (interim ? ' '+interim : '');
  };

  rec.onerror = function(e){
    var code = e.error;
    if(code === 'not-allowed' || code === 'service-not-allowed'){
      showToast("Mic permission needed — check the browser’s site settings");
    } else if(code === 'network'){
      showToast("Voice needs an internet connection");
    } else if(code === 'no-speech'){
      // silent stop
    } else {
      showToast("Voice isn’t supported in this browser");
    }
    resetMicUI();
  };

  rec.onend = function(){
    committedText = ta.value;
    resetMicUI();
  };

  try{ rec.start(); } catch(e){ resetMicUI(); showToast("Couldn't start microphone"); }

  // watchdog — some browsers (iOS) never fire onend; never leave the user stuck
  setTimeout(function(){
    if(_micListening && _micRec === rec){
      try{ rec.stop(); } catch(e){}
      setTimeout(function(){ if(_micListening && _micRec === rec){ resetMicUI(); } }, 1500);
    }
  }, 45000);
});

/* ===== SORT SHEET ===== */
var _sortItems = [];
var prioMap = {urgent:1, high:2, med:3, now:1, soon:3, later:4};

function buildSortList(items){
  var el = document.getElementById('ss-list-1');
  el.innerHTML = '';
  var isAI = window._sortMethod === 'ai';
  items.forEach(function(item, i){
    var catLabel = (CAT[item.category]||CAT.admin).label;
    var row = document.createElement('div'); row.className='ss-row';
    var top = document.createElement('div'); top.className='ss-row-top';
    if(item._needsCategory){
      // Low-confidence category: explicit "you decide" state instead of a silent guess
      top.innerHTML = '<span class="ss-sw ss-sw-unset"></span><span class="ss-name">'+escHtml(item.name)+'</span><button type="button" class="ss-cat-choose" aria-expanded="false" aria-label="Choose a category for this task">you decide</button>';
      row.appendChild(top);
      var pick = document.createElement('div'); pick.className='ss-catpick hidden';
      var cats = (store.get().categories || ['health','selfcare','creative','work','admin','home','social']).filter(function(c){ return CAT[c]; });
      cats.forEach(function(c){
        var b = document.createElement('button'); b.type='button'; b.className='ss-catpick-btn';
        b.innerHTML = '<span class="ss-sw '+catCls(c)+'"></span>'+CAT[c].label;
        b.addEventListener('click', function(){
          item.category = c;
          item._needsCategory = false;
          buildSortList(items);
        });
        pick.appendChild(b);
      });
      row.appendChild(pick);
      var chooseBtn = top.querySelector('.ss-cat-choose');
      chooseBtn.addEventListener('click', function(){
        var open = pick.classList.toggle('hidden');
        chooseBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    } else {
      top.innerHTML = '<span class="ss-sw '+catCls(item.category)+'"></span><span class="ss-name">'+escHtml(item.name)+'</span><span class="ss-meta">'+catLabel+'</span>';
      row.appendChild(top);
    }
    if(isAI){
      if(item._whyFromAI && item.why){
        // AI inferred the motivation — show it so the user can see why it's here
        var whyEl = document.createElement('div'); whyEl.className='ss-why-text';
        whyEl.textContent = item.why;
        row.appendChild(whyEl);
      } else {
        // Optional, never blocking — skip by simply not typing
        var inp = document.createElement('input'); inp.type='text'; inp.className='ss-why-input';
        inp.placeholder = 'why does this matter to you? (optional)';
        inp.maxLength = 140;
        inp.setAttribute('aria-label','Why does this matter to you? Optional.');
        inp.value = item.why || '';
        inp.addEventListener('input', function(){ item.why = inp.value; });
        row.appendChild(inp);
      }
    }
    el.appendChild(row);
  });
  var sub = document.getElementById('ss-sub-1');
  if(sub){
    var methodNote = window._sortMethod === 'ai' ? ' · sorted with AI' : ' · simple sort';
    sub.textContent = items.length+' thing'+(items.length!==1?'s':'')+' · grouped by where they seem to fit'+methodNote;
  }
}

function buildEditList(items){
  var el = document.getElementById('ss-edit-list');
  el.innerHTML = '';
  items.forEach(function(item, i){
    var row = document.createElement('div'); row.className='ss-erow';
    var weights = ['urgent','high','med','low','min'];
    var curLabel = item.priority===1?'urgent':item.priority===2?'high':item.priority===3?'med':item.priority===4?'low':'min';
    var wHtml = weights.map(function(w){ return '<button class="w'+(w===curLabel?' on':'')+'" type="button" data-w="'+w+'">'+w+'</button>'; }).join('');
    row.innerHTML = '<div class="ss-erow-top"><span class="ss-sw '+catCls(item.category)+'"></span><span class="ss-name">'+escHtml(item.name)+'</span></div><div class="ss-weights">'+wHtml+'</div>';
    var wRow = row.querySelector('.ss-weights');
    wRow.addEventListener('click', function(e){
      var btn = e.target.closest('.w'); if(!btn) return;
      wRow.querySelectorAll('.w').forEach(function(b){ b.classList.remove('on'); }); btn.classList.add('on');
      var wVal = btn.dataset.w;
      items[i].priority = wVal==='urgent'?1:wVal==='high'?2:wVal==='med'?3:wVal==='low'?4:5;
    });
    el.appendChild(row);
  });
}

function showSortSheet(items, method){
  window._sortMethod = method || 'simple';
  _sortItems = items;
  window._sortItems = _sortItems;
  buildSortList(_sortItems);
  document.getElementById('ss-step-1').classList.remove('hidden');
  document.getElementById('ss-step-2').classList.add('hidden');
  document.getElementById('ss-step-3').classList.add('hidden');
  document.getElementById('sort-scrim').classList.add('open');
  document.getElementById('sort-sheet').classList.add('open');
}

function openSortSheet(){
  var text = document.getElementById('dump-textarea').value.trim();
  if(!text){ showToast('Add something to sort first'); return; }
  if(!window.PaceAI || !window.PaceAI.available()){
    showSortSheet(parseDump(text), 'simple');
    return;
  }
  var btn = document.getElementById('dump-sort-btn');
  btn.textContent = 'sorting gently…';
  btn.disabled = true;
  // 4096 max_tokens: per-task objects now echo source_text and carry why/confidence,
  // so worst-case output is ~3× the dump length; 4096 covers a ~1000-token dump.
  window.PaceAI.claudeCall([{
    role:'user',
    content: buildDumpPrompt(text)
  }], 4096)
  .then(function(raw){
    var json = raw.replace(/```[a-z]*\n?/gi,'').replace(/```/g,'').trim();
    var arr = JSON.parse(json);
    if(!Array.isArray(arr) || !arr.length) throw new Error('empty');
    var VALID_CATS = {health:1,selfcare:1,creative:1,work:1,admin:1,home:1,social:1};
    var VALID_ENERGY = {body:1,mind:1,both:1};
    var out = [];
    arr.forEach(function(it){
      try {
        if(!it || typeof it !== 'object' || Array.isArray(it)) return; // malformed item: drop it, keep the batch
        var displayName = String(it.title||it.name||'').trim().slice(0,200);
        var originalText = String(it.source_text||it.name||it.title||'').trim().slice(0,300);
        if(!displayName) displayName = originalText.slice(0,200);
        if(!displayName) return;
        var prio = Math.round(Number(it.priority));
        if(!(prio>=1 && prio<=5)) prio = 3;
        var conf = Number(it.confidence);
        if(!(conf>=0 && conf<=1)) conf = 1; // missing/invalid confidence → treat as confident (old behavior)
        var whyVal = (typeof it.why==='string') ? it.why.trim().slice(0,140) : '';
        out.push({
          name: displayName,
          _originalText: originalText,
          category: VALID_CATS[it.category] ? it.category : guessCategory(displayName),
          priority: prio,
          energy: VALID_ENERGY[it.energy] ? it.energy : 'both',
          why: whyVal,
          _whyFromAI: !!whyVal,
          _needsCategory: conf < 0.6
        });
      } catch(itemErr){ /* one bad item never sinks the batch */ }
    });
    if(!out.length) throw new Error('empty'); // nothing usable → catch() → simple parser
    showSortSheet(out, 'ai');
  })
  .catch(function(e){
    var msg = e && e.message;
    if(msg && (msg.indexOf('key')+msg.indexOf('401'))>-2){
      showToast(msg);
    } else {
      showToast("Couldn't reach the AI — using simple sorting instead");
    }
    showSortSheet(parseDump(text), 'simple');
  })
  .finally(function(){
    btn.innerHTML = 'Sort into canvas <span style="font-size:17px">→</span>';
    btn.disabled = false;
  });
}

function closeSortSheet(){
  document.getElementById('sort-scrim').classList.remove('open');
  document.getElementById('sort-sheet').classList.remove('open');
}

document.getElementById('dump-sort-btn').addEventListener('click', openSortSheet);
document.getElementById('sort-scrim').addEventListener('click', closeSortSheet);
document.getElementById('ss-cancel-btn').addEventListener('click', closeSortSheet);

document.getElementById('ss-edit-btn').addEventListener('click', function(){
  buildEditList(_sortItems);
  document.getElementById('ss-step-1').classList.add('hidden');
  document.getElementById('ss-step-2').classList.remove('hidden');
});
document.getElementById('ss-back-btn').addEventListener('click', function(){
  document.getElementById('ss-step-2').classList.add('hidden');
  document.getElementById('ss-step-1').classList.remove('hidden');
});

function confirmSortItems(){
  _sortItems.forEach(function(item){
    var whyVal = (item.why && String(item.why).trim()) ? String(item.why).trim().slice(0,140) : (item._originalText && item._originalText !== item.name ? item._originalText : '');
    store.addTask({id:Math.random().toString(36).slice(2,10),name:item.name,category:item.category,priority:item.priority,energy:item.energy||'both',capacity:'med',types:[],why:whyVal,notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null});
    store.logEvent('task_added', {source:'dump', energy:item.energy||'both', capacity:'med', category:item.category, types:[], checkinLevel:store._checkinLevel()}); // item 4
  });
  document.getElementById('dump-textarea').value = '';
  var sub = document.getElementById('ss-done-sub');
  if(sub) sub.textContent = 'Added '+_sortItems.length+' task'+(_sortItems.length!==1?'s':'')+'. The biggest tile is what you said most loudly.';
  document.getElementById('ss-step-1').classList.add('hidden');
  document.getElementById('ss-step-2').classList.add('hidden');
  document.getElementById('ss-step-3').classList.remove('hidden');
}

document.getElementById('ss-confirm-btn').addEventListener('click', confirmSortItems);
document.getElementById('ss-save-btn').addEventListener('click', confirmSortItems);
document.getElementById('ss-go-today').addEventListener('click', function(){
  closeSortSheet();
  renderToday();
  showScreen('today');
});

/* ===== INIT ===== */
var _persistToastShown = false;
storageAdapter.onPersistError(function(){
  if(_persistToastShown) return;
  _persistToastShown = true;
  var showIt = function(){ showToast("Couldn't save just now — your changes are held in memory. Consider exporting a backup."); };
  // The toast element lives later in the document; if a failure fires this
  // early in the parse, wait for the DOM instead of losing the message.
  if(document.getElementById('global-toast')) showIt();
  else document.addEventListener('DOMContentLoaded', showIt);
});

/* Ask the browser for persistent storage once, after the first real user
   interaction (browsers ignore the request on page load). No UI about it. */
function requestPersistentStorage(){
  document.removeEventListener('pointerdown', requestPersistentStorage);
  document.removeEventListener('keydown', requestPersistentStorage);
  if(!(navigator.storage && navigator.storage.persist)) return;
  navigator.storage.persist().then(function(granted){
    var s = store.get();
    if(s && s.prefs && s.prefs.persistentStorage !== granted){
      s.prefs.persistentStorage = granted;
      store.save();
    }
  }, function(){ /* request denied/unavailable — not a data-save failure */ });
}

var _booted = false;
function bootApp(){
  store.load(); // authoritative load — picks up anything init() restored from IndexedDB
  var state = store.get();
  var today = new Date().toISOString().slice(0,10);

  // 3.1 Day rollover — runs ONCE per calendar day, guarded by lastActiveDate.
  // Pure rolloverTasks() re-parks untouched status:'today' tasks without shame flags.
  if(state.onboarded && state.lastActiveDate && state.lastActiveDate !== today){
    state.tasks = rolloverTasks(state, today);
  }
  // Always update lastActiveDate so subsequent same-day boots skip rollover.
  state.lastActiveDate = today;
  store.save();
  store.logEvent('day_opened', {}); // item 4

  renderToday();
  applyCheckinGreeting();

  // 3.2 Check-in gating: new day → check-in; same-day reopen → skip to today.
  if(!state.onboarded){
    showScreen('onboarding-welcome');
  } else if(state.lastCheckinDate !== today){
    applyCheckinGreeting();
    showScreen('checkin');
  } else {
    showScreen('today');
  }
  document.addEventListener('pointerdown', requestPersistentStorage);
  document.addEventListener('keydown', requestPersistentStorage);
}
function bootOnce(){ if(_booted) return; _booted = true; bootApp(); }

storageAdapter.init().then(function(){
  if(!_booted){ bootOnce(); return; }
  // The safety timeout below booted first (IDB was slow). If init since
  // restored newer state into localStorage, show it.
  var disk = storageAdapter.read();
  if(disk && disk !== JSON.stringify(store.get())) bootApp();
}, bootOnce);
/* Safety net: if IndexedDB hangs, boot on localStorage alone. The app must
   never fail to boot because of the durability layer. */
setTimeout(bootOnce, 2500);

window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;   // SEAM (added in split): consumed by ui-shell.js showScreen
window.checkStaleTop = checkStaleTop; // SEAM (added in split): consumed by ui-today.js renderToday
window.timeOfDay = timeOfDay;
window._getOpenTaskId = function(){ return _openTaskId; };
window.Pace = { store: store, showScreen: showScreen, renderToday: renderToday, openDrawer: openDrawer, showToast: showToast, timeOfDay: timeOfDay, applyCheckinGreeting: applyCheckinGreeting, _loadSampleData: loadSampleData, escHtml: escHtml, sanitizeState: sanitizeState };
