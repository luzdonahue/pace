/* ===== FEATURE 3 — GENTLE POMODORO ===== */
(function(){
'use strict';

var _state = null; // {taskId, name, endTime, pausedAt, paused, mins, running}
var _interval = null;

function tick(){
  if(!_state || !_state.running) return;
  if(_state.paused) return;
  var now = Date.now();
  var rem = Math.max(0, Math.round((_state.endTime - now)/1000));
  _state.remaining = rem;
  // repaint if renderToday available
  if(window.Pace && window.Pace.renderToday) window.Pace.renderToday();
  // update drawer status
  updateDrawerStatus();
  if(rem <= 0){
    finish();
  }
}

function finish(){
  clearInterval(_interval);
  _interval = null;
  var taskId = _state ? _state.taskId : null;
  var mins = _state ? _state.mins : 0;
  if(taskId && window.Pace){
    var prevMins = (window.Pace.store.get().tasks.find(function(t){return t.id===taskId;})||{}).minutesGiven || 0;
    window.Pace.store.updateTask(taskId, {minutesGiven: prevMins + mins});
  }
  _state = null;
  if(window.PaceHaptics) window.PaceHaptics.play('timerEnd');
  if(window.Pace && window.Pace.showToast) window.Pace.showToast('Time. Stopping is allowed — it counts.');
  if(window.Pace && window.Pace.renderToday) window.Pace.renderToday();
  updateDrawerStatus();
}

function updateDrawerStatus(){
  var el = document.getElementById('dr-timer-status');
  if(!el) return;
  if(!_state || !_state.running){
    el.textContent='';
    return;
  }
  var rem = _state.remaining||0;
  var mm=Math.floor(rem/60); var ss=rem%60;
  var openId = null;
  var drName = document.getElementById('dr-name');
  if(drName){
    var state = window.Pace ? window.Pace.store.get() : null;
    if(state){
      var t2 = state.tasks.find(function(t){ return t.name===drName.textContent; });
      if(t2) openId = t2.id;
    }
  }
  if(openId === _state.taskId){
    el.textContent = (_state.paused?'Paused: ':'Running: ')+mm+':'+(ss<10?'0':'')+ss;
  } else if(_state.running){
    el.textContent = 'Timer running for another task';
  } else {
    el.textContent='';
  }
}

var PaceTimer = {
  start: function(taskId, name, mins){
    if(_state && _state.running && _state.taskId !== taskId){
      if(window.Pace && window.Pace.showToast) window.Pace.showToast('Switched the timer to 「'+name+'」');
    }
    clearInterval(_interval);
    var now = Date.now();
    _state = {taskId:taskId, name:name, mins:mins, running:true, paused:false, endTime:now+mins*60*1000, remaining:mins*60};
    _interval = setInterval(tick, 1000);
    if(window.Pace && window.Pace.renderToday) window.Pace.renderToday();
    updateDrawerStatus();
  },
  stop: function(){
    clearInterval(_interval); _interval=null; _state=null;
    if(window.Pace && window.Pace.renderToday) window.Pace.renderToday();
    updateDrawerStatus();
  },
  togglePause: function(){
    if(!_state) return;
    if(_state.paused){
      _state.endTime = Date.now() + _state.remaining * 1000;
      _state.paused = false;
    } else {
      _state.paused = true;
    }
    if(window.Pace && window.Pace.renderToday) window.Pace.renderToday();
    updateDrawerStatus();
  },
  state: function(){ return _state ? Object.assign({}, _state) : null; }
};

window.PaceTimer = PaceTimer;

/* --- Drawer timer buttons --- */
var btn10 = document.getElementById('dr-timer-10');
var btn25 = document.getElementById('dr-timer-25');
function getOpenTaskId(){
  var drName = document.getElementById('dr-name');
  if(!drName) return null;
  var state = window.Pace ? window.Pace.store.get() : null;
  if(!state) return null;
  var t = state.tasks.find(function(x){ return x.name===drName.textContent; });
  return t ? t.id : null;
}
function getOpenTaskName(){
  var drName = document.getElementById('dr-name');
  return drName ? drName.textContent : '';
}
if(btn10){
  btn10.addEventListener('click', function(){
    var tid = getOpenTaskId();
    if(!tid) return;
    PaceTimer.start(tid, getOpenTaskName(), 10);
    updateDrawerStatus();
  });
}
if(btn25){
  btn25.addEventListener('click', function(){
    var tid = getOpenTaskId();
    if(!tid) return;
    PaceTimer.start(tid, getOpenTaskName(), 25);
    updateDrawerStatus();
  });
}

// Update drawer status when drawer opens
document.addEventListener('click', function(e){
  if(e.target.closest('#drawer')) {
    setTimeout(updateDrawerStatus, 50);
  }
});

})();


/* ===== GENTLE HAPTICS =====
   Neurodivergent-friendly principles:
   - short and soft (6-26ms pulses), predictable, semantic
   - celebration > alert: completions get the richest pattern
   - NEVER vibrates for errors or warnings — calm is the baseline
   - throttled so feedback can't stack into noise */
(function(){
  var PATTERNS = {
    tick:       [6],               // small selection (pills, priority steps)
    select:     [10],              // committing a choice (merge, do-now)
    done:       [12, 70, 22],      // task complete — soft double heartbeat
    release:    [10, 50, 10],      // letting go / sending to someday
    timerStart: [12],
    timerEnd:   [14, 80, 14, 80, 26], // gentle landing, slightly rising
    breakdown:  [8, 40, 8]         // making something smaller
  };
  var lastAt = 0;
  function supported(){ return typeof navigator !== 'undefined' && 'vibrate' in navigator; }
  function enabled(){ return supported() && localStorage.getItem('pace.haptics') !== '0'; }
  function play(name){
    if(!enabled()) return;
    var now = Date.now();
    if(now - lastAt < 250) return; // never stack buzzes
    lastAt = now;
    try { navigator.vibrate(PATTERNS[name] || PATTERNS.tick); } catch(e){}
  }
  window.PaceHaptics = { play: play, enabled: enabled, supported: supported };

  function updateHapticsUI(){
    var tog = document.getElementById('haptics-toggle');
    var knob = document.getElementById('haptics-knob');
    var stat = document.getElementById('haptics-status');
    var on = localStorage.getItem('pace.haptics') !== '0';
    if(tog){
      tog.setAttribute('aria-checked', on ? 'true' : 'false');
      tog.style.background = on ? 'var(--selfc-hi, #D4537E)' : 'var(--rule)';
    }
    if(knob) knob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
    if(stat){
      stat.textContent = !supported() ? 'Not available on this device — visuals carry the feeling instead'
                       : on ? 'On — soft taps for done, sort, and release' : 'Off';
      stat.style.color = on && supported() ? 'var(--creat-hi)' : 'var(--ink-faint)';
    }
  }
  window.toggleHaptics = function(){
    var on = localStorage.getItem('pace.haptics') !== '0';
    localStorage.setItem('pace.haptics', on ? '0' : '1');
    updateHapticsUI();
    if(!on) play('select'); // a little hello when turning on
  };
  updateHapticsUI();

  /* --- wiring via delegation (no edits inside other modules) --- */
  function hap(name){ return function(){ play(name); }; }
  document.addEventListener('click', function(e){
    var t = e.target;
    if(t.closest('#act-done, #dr-done, .dr-btn') && /done/i.test((t.closest('.dr-btn')||{}).textContent||'')) play('done');
    else if(t.closest('#sort-do-now')) play('select');
    else if(t.closest('#sort-letgo') || (t.closest('button') && /let go/i.test((t.closest('button')||{}).textContent||''))) play('release');
    else if(t.closest('.prio-seg, .dr-pill, .ci-fpill, .ob-cat-pill')) play('tick');
    else if(t.closest('#merge-btn-merge')) play('select');
    else if(t.closest('#stale-nudge-break') || t.closest('#bd-confirm')) play('breakdown');
    else if(t.closest('.pop-label')) play('select'); // bring cloud back
    else if(t.closest('.tile-timer-pill')) play('timerStart');
  }, true);

  /* timer end haptic fires from the timer module's own finish() */
})();


/* ===== WHISPER MODULE — runs in a Web Worker so the UI never freezes ===== */
(function(){
  var WORKER_SRC = [
    "import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.1';",
    "let pipePromise = null;",
    "function getPipe(){",
    "  if(!pipePromise){",
    "    pipePromise = (async () => {",
    "      const opts = { dtype:'q8', progress_callback: (p) => {",
    "        if(p && p.status==='progress' && p.total){ postMessage({type:'progress', pct: Math.round(p.loaded/p.total*100)}); }",
    "      }};",
    "      try { return await pipeline('automatic-speech-recognition','onnx-community/whisper-base.en', {...opts, device:'webgpu'}); }",
    "      catch(e){ return await pipeline('automatic-speech-recognition','onnx-community/whisper-base.en', {...opts, device:'wasm'}); }",
    "    })();",
    "  }",
    "  return pipePromise;",
    "}",
    "onmessage = async (e) => {",
    "  if(e.data.type !== 'transcribe') return;",
    "  try {",
    "    const pipe = await getPipe();",
    "    postMessage({type:'status', msg:'transcribing'});",
    "    const result = await pipe(e.data.audio);",
    "    postMessage({type:'result', text: (result && result.text) ? result.text.trim() : ''});",
    "  } catch(err){ postMessage({type:'error', msg: String(err && err.message || err)}); }",
    "};"
  ].join('\n');

  var worker = null;
  function getWorker(){
    if(worker) return worker;
    var blob = new Blob([WORKER_SRC], {type:'text/javascript'});
    worker = new Worker(URL.createObjectURL(blob), {type:'module'});
    return worker;
  }

  async function decodeTo16kMono(blob){
    var arrayBuf = await blob.arrayBuffer();
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var audioCtx = new Ctx({ sampleRate: 16000 });
    var decoded = await audioCtx.decodeAudioData(arrayBuf);
    try { audioCtx.close(); } catch(e){}
    var nCh = decoded.numberOfChannels, len = decoded.length;
    var mono = new Float32Array(len);
    for(var ch=0; ch<nCh; ch++){
      var d = decoded.getChannelData(ch);
      for(var i=0;i<len;i++){ mono[i]+=d[i]; }
    }
    if(nCh>1){ for(var j=0;j<len;j++){ mono[j]/=nCh; } }
    return mono;
  }

  var _activeReject = null;
  window.PaceWhisper = {
    enabled: function(){ return localStorage.getItem('pace.whisper') === '1'; },
    cancel: function(){
      if(worker){ try{ worker.terminate(); }catch(e){} worker = null; }
      if(_activeReject){ _activeReject(new Error('cancelled')); _activeReject = null; }
    },
    transcribe: function(blob, onProgress){
      return new Promise(function(resolve, reject){
        var settled = false;
        _activeReject = function(err){ if(!settled){ settled = true; reject(err); } };
        // hard watchdog: never leave the user stuck
        var watchdog = setTimeout(function(){
          window.PaceWhisper.cancel();
          if(!settled){ settled = true; reject(new Error('timeout')); }
        }, 120000);
        decodeTo16kMono(blob).then(function(mono){
          var w = getWorker();
          w.onmessage = function(e){
            var m = e.data || {};
            if(m.type === 'progress' && onProgress){ onProgress('downloading voice model… '+m.pct+'%'); }
            else if(m.type === 'status' && onProgress){ onProgress('transcribing…'); }
            else if(m.type === 'result'){
              clearTimeout(watchdog); window.__whisperReady = true;
              if(typeof updateWhisperUI === 'function'){ try{ updateWhisperUI(); }catch(err){} }
              if(!settled){ settled = true; _activeReject = null; resolve(m.text); }
            }
            else if(m.type === 'error'){
              clearTimeout(watchdog);
              if(!settled){ settled = true; _activeReject = null; reject(new Error(m.msg)); }
            }
          };
          w.onerror = function(err){
            clearTimeout(watchdog);
            if(!settled){ settled = true; _activeReject = null; reject(new Error('worker failed')); }
          };
          w.postMessage({type:'transcribe', audio: mono}, [mono.buffer]);
        }).catch(function(err){
          clearTimeout(watchdog);
          if(!settled){ settled = true; _activeReject = null; reject(err); }
        });
      });
    }
  };
})();
