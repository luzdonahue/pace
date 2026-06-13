/* ===== PACE AI HELPER ===== */
(function(){
'use strict';

window.PaceAI = {
  getKey: function(){ return localStorage.getItem('pace.apikey') || ''; },

  claudeCall: async function(messages, maxTokens){
    var key = this.getKey();
    if(!key) throw new Error('No API key set');
    var resp;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens || 1024,
          messages: messages
        })
      });
    } catch(e) {
      throw new Error("Couldn't reach the AI — using simple sorting instead");
    }
    if(resp.status === 401) throw new Error("That key doesn't seem right — check Settings");
    if(!resp.ok) throw new Error("Couldn't reach the AI — using simple sorting instead");
    var data = await resp.json();
    if(data.content && data.content[0] && data.content[0].text) return data.content[0].text;
    throw new Error("Couldn't reach the AI — using simple sorting instead");
  }
};

/* ===== SETTINGS — AI KEY ===== */
var aiKeyInput = document.getElementById('ai-key-input');
var aiKeyStatus = document.getElementById('ai-key-status');

function updateAIStatus(overrideKey){
  var key = (overrideKey !== undefined) ? overrideKey : (localStorage.getItem('pace.apikey') || '');
  if(aiKeyStatus){
    if(key){
      aiKeyStatus.textContent = 'AI on — using Claude';
      aiKeyStatus.style.color = 'var(--creat-hi)';
    } else {
      aiKeyStatus.textContent = 'AI off — using simple sorting';
      aiKeyStatus.style.color = 'var(--ink-faint)';
    }
  }
}

if(aiKeyInput){
  aiKeyInput.value = localStorage.getItem('pace.apikey') || '';
  updateAIStatus();
  // Status follows what's typed; the key itself persists once on blur/change
  // (was: a localStorage write on every keystroke).
  aiKeyInput.addEventListener('input', function(){
    updateAIStatus(aiKeyInput.value.trim());
  });
  aiKeyInput.addEventListener('change', function(){
    var v = aiKeyInput.value.trim();
    if(v){ localStorage.setItem('pace.apikey', v); }
    else { localStorage.removeItem('pace.apikey'); }
    updateAIStatus();
  });
}

document.addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(tab && tab.dataset.tab === 'categories'){
    if(aiKeyInput) aiKeyInput.value = localStorage.getItem('pace.apikey') || '';
    updateAIStatus();
    updateWhisperUI();
  }
});

/* ===== SETTINGS — WHISPER ===== */
function updateWhisperUI(){
  var tog = document.getElementById('whisper-toggle');
  var knob = document.getElementById('whisper-knob');
  var stat = document.getElementById('whisper-status');
  var lbl = document.getElementById('dump-mic-label');
  var on = localStorage.getItem('pace.whisper') === '1';
  if(tog){
    tog.setAttribute('aria-checked', on ? 'true' : 'false');
    tog.style.background = on ? 'var(--social-hi, #7F77DD)' : 'var(--rule)';
  }
  if(knob) knob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
  if(stat){
    if(!on){
      stat.textContent = "Using the browser's basic voice";
      stat.style.color = 'var(--ink-faint)';
    } else if(window.__whisperReady){
      stat.textContent = 'Whisper ready';
      stat.style.color = 'var(--creat-hi)';
    } else {
      stat.textContent = 'Model downloads on first use';
      stat.style.color = 'var(--ink-soft)';
    }
  }
  if(lbl && !(window._isMicListening && window._isMicListening()) && !window._whisperRecording){
    lbl.textContent = on ? 'or speak a brain dump (hq)' : 'or speak a brain dump';
  }
}

function toggleWhisper(){
  var on = localStorage.getItem('pace.whisper') === '1';
  if(on){ localStorage.removeItem('pace.whisper'); }
  else { localStorage.setItem('pace.whisper', '1'); }
  updateWhisperUI();
}
window.toggleWhisper = toggleWhisper;

updateWhisperUI();

/* ===== PHOTO NOTE ===== */
var photoInput = document.getElementById('photo-input');
var cameraBtn  = document.getElementById('dump-camera');
var cameraLbl  = document.getElementById('dump-camera-label');

function resetCameraUI(){
  if(cameraBtn){ cameraBtn.style.opacity=''; cameraBtn.disabled=false; }
  if(cameraLbl) cameraLbl.textContent = 'or photograph a note';
}

if(cameraBtn && photoInput){
  cameraBtn.addEventListener('click', function(){
    var key = localStorage.getItem('pace.apikey');
    if(!key){
      window.Pace.showToast("Photo notes need the AI key — add it in Settings");
      return;
    }
    photoInput.click();
  });

  photoInput.addEventListener('change', function(){
    var file = photoInput.files && photoInput.files[0];
    if(!file){ resetCameraUI(); return; }
    var key = localStorage.getItem('pace.apikey');
    if(!key){ resetCameraUI(); return; }

    cameraBtn.disabled = true;
    cameraBtn.style.opacity = '0.5';
    if(cameraLbl) cameraLbl.textContent = 'reading your note…';

    var img = new Image();
    var reader = new FileReader();
    reader.onload = function(ev){
      img.onload = function(){
        var MAX = 1200;
        var w = img.width, h = img.height;
        if(w > MAX || h > MAX){
          if(w > h){ h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        window.PaceAI.claudeCall([{
          role: 'user',
          content: [
            {type:'image', source:{type:'base64', media_type:'image/jpeg', data: b64}},
            {type:'text', text:'Transcribe all text in this image exactly. Reply with only the transcribed text, nothing else.'}
          ]
        }], 1024)
        .then(function(text){
          var ta = document.getElementById('dump-textarea');
          var existing = ta.value;
          var sep = existing && !existing.endsWith('\n') ? '\n' : '';
          ta.value = existing + sep + text.trim();
          window.Pace.showToast("Note added — read it over, then sort.");
        })
        .catch(function(e){
          var msg = e && e.message ? e.message : "Couldn't read the photo — try again";
          window.Pace.showToast(msg);
        })
        .finally(function(){
          resetCameraUI();
          photoInput.value = '';
        });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

})();

/* ===== FEATURE 2 — AI dump focus category injection ===== */
(function(){
'use strict';
// Patch the AI dump call in openSortSheet to append focusCategory context
var origOpenSortSheet = window._openSortSheet;
// We patch by wrapping the claudeCall content appending
// Since PaceAI.claudeCall is called with message content, we monkey-patch it
var origClaudeCall = window.PaceAI && window.PaceAI.claudeCall;
if(window.PaceAI && origClaudeCall){
  window.PaceAI.claudeCall = function(messages, maxTokens){
    if(window.Pace){
      var state = window.Pace.store.get();
      var lastCI = state.checkins.length ? state.checkins[state.checkins.length-1] : null;
      var focus = lastCI && lastCI.focusCategory;
      if(focus && messages && messages.length>0 && messages[0].role==='user'){
        var focusLabel = ({health:'Health',selfcare:'Self-care',creative:'Creative',work:'Work',admin:'Admin',home:'Home',social:'Social'})[focus]||focus;
        var orig = messages[0].content;
        if(typeof orig === 'string'){
          messages = messages.slice();
          messages[0] = Object.assign({}, messages[0], {content: orig + ' The user wants to prioritize '+focusLabel+' today — weight those tasks one step more urgent.'});
        }
      }
    }
    return origClaudeCall.apply(this, [messages, maxTokens]);
  };
}
})();
