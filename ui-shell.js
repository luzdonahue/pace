import { store } from './core-store.js';
import { timeOfDay } from './core-logic.js';

/* Provisional synchronous load so every script block can parse safely.
   The authoritative load + first render happen in INIT below, after
   storageAdapter.init() has had the chance to restore an evicted
   localStorage from IndexedDB. */
store.load();

/* ===== ROUTER ===== */
function showScreen(name){
  document.querySelectorAll('[data-screen]').forEach(function(s){ s.classList.remove('active'); });
  var target = document.querySelector('[data-screen="'+name+'"]');
  if(target){ target.classList.add('active'); }
  window.closeDrawer(); // SEAM: closeDrawer lives in ui-today.js; window.closeDrawer is set in ui-dump-sort.js INIT block
}
window.showScreen = showScreen;

/* ===== TAB BAR ===== */
document.addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(!tab) return;
  var name = tab.dataset.tab;
  if(name) showScreen(name);
});


function showToast(msg){
  var t = document.getElementById('global-toast');
  t.innerHTML = '<span>✨</span> '+msg;
  t.classList.add('is-shown');
  setTimeout(function(){ t.classList.remove('is-shown'); }, 2200);
}


function applyCheckinGreeting(){
  var tod = timeOfDay();
  var greet = {morning:'Good morning.', afternoon:'Good afternoon.', evening:'Good evening.', late:'Still up?'}[tod];
  var hq    = {morning:'How are you<br/>arriving today?', afternoon:'How are you<br/>arriving right now?', evening:'How are you<br/>arriving right now?', late:'How are you, honestly?'}[tod];
  var greetEl = document.getElementById('ci-greet-text');
  var hqEl    = document.getElementById('ci-hq-text');
  if(greetEl) greetEl.textContent = greet;
  if(hqEl)    hqEl.innerHTML = hq;
}


/* RELOCATED from the dump section (originally between mic vars and the sort sheet):
   this IIFE reassigns the showScreen binding, which ES modules only permit in the
   declaring module. All showScreen calls happen post-boot, so timing is unchanged. */
// Checkin banner flag
(function(){
  var origShow = showScreen;
  showScreen = function(s){
    origShow(s);
    if(s === 'dump'){
      var banner = document.getElementById('dump-checkin-banner');
      if(banner){
        if(window._dumpFromCheckin){
          banner.style.display = 'block';
          window._dumpFromCheckin = false;
        } else {
          banner.style.display = 'none';
        }
      }
    }
  };
  if(window.Pace) window.Pace.showScreen = showScreen;
})();

export { showScreen, showToast, applyCheckinGreeting };
