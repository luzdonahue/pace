/* ===== NOTIFICATION ADAPTER (3.3) =====
   Mirrors adapter-platform.js adapter pattern.
   IMPORTANT — UNVERIFIED: All push/notification paths require a real installed PWA
   on a device with notification permission. None of this can be tested in the Node
   sandbox. The in-app nudge fallback (pure DOM) is the only testable path here.

   Architecture:
   - Permission is ALWAYS user-initiated from Settings. Never auto-prompted on load.
   - If permission granted: schedules a local SW-based Notification via showTrigger
     (Chrome/Android) or falls back to a setTimeout-based same-session nudge.
   - If permission denied/unavailable: stores the reminder time and shows a gentle
     in-app banner at next open after that time (the "nudge fallback").
   - SW push/notificationclick handlers live in sw.js (see there).
   - All copy is warm and pressure-free — no streak guilt, no overdue framing. */

(function(){
'use strict';

var REMINDER_KEY = 'pace.reminder.time'; // "HH:MM" or null
var NUDGE_KEY    = 'pace.nudge.shown';   // date string of last nudge shown

/* ---- helpers ---- */
function reminderTime(){
  try { return localStorage.getItem(REMINDER_KEY) || null; } catch(e){ return null; }
}
function setReminderTime(hhmm){
  try {
    if(hhmm){ localStorage.setItem(REMINDER_KEY, hhmm); }
    else { localStorage.removeItem(REMINDER_KEY); }
  } catch(e){}
}
function todayStr(){
  return new Date().toISOString().slice(0,10);
}
function notifSupported(){
  return typeof Notification !== 'undefined';
}
function notifGranted(){
  return notifSupported() && Notification.permission === 'granted';
}

/* ---- in-app nudge fallback ----
   Shown at next open after the reminder time if notifications aren't granted.
   Gentle, dismissable — never nags. */
function maybeShowNudge(){
  var rt = reminderTime();
  if(!rt) return;
  var lastShown = null;
  try { lastShown = localStorage.getItem(NUDGE_KEY); } catch(e){}
  var today = todayStr();
  if(lastShown === today) return; // already shown today
  var now = new Date();
  var parts = rt.split(':');
  var hh = parseInt(parts[0], 10);
  var mm = parseInt(parts[1], 10) || 0;
  if(isNaN(hh)) return;
  if(now.getHours() < hh || (now.getHours() === hh && now.getMinutes() < mm)) return;
  // Past the reminder time and not shown today — show the nudge
  try { localStorage.setItem(NUDGE_KEY, today); } catch(e){}
  showNudgeBanner();
}

function showNudgeBanner(){
  var el = document.getElementById('pace-reminder-nudge');
  if(!el) return;
  el.style.display = 'block';
  el.setAttribute('aria-hidden', 'false');
}

function hideNudgeBanner(){
  var el = document.getElementById('pace-reminder-nudge');
  if(el){ el.style.display = 'none'; el.setAttribute('aria-hidden', 'true'); }
}

/* ---- permission request (user-initiated, from Settings) ----
   UNVERIFIED: Notification API behaviour on iOS Safari (installed PWA only,
   iOS 16.4+) and Android Chrome differs. We request once; the browser may
   show its own permission prompt. We never call this on page load. */
function requestPermission(onResult){
  if(!notifSupported()){ if(onResult) onResult('unsupported'); return; }
  if(Notification.permission === 'granted'){ if(onResult) onResult('granted'); return; }
  if(Notification.permission === 'denied'){ if(onResult) onResult('denied'); return; }
  Notification.requestPermission().then(function(result){
    if(onResult) onResult(result);
  }).catch(function(){
    if(onResult) onResult('denied');
  });
}

/* ---- schedule a local notification via SW ----
   UNVERIFIED: showTrigger (TimestampTrigger) is Chrome/Android only.
   On iOS (installed PWA) web push requires a server push — this SW-local
   schedule will silently no-op there. The in-app nudge fallback covers iOS.
   Do NOT stand up server infrastructure for v1 (per spec). */
function scheduleLocalNotification(hhmm){
  /* UNVERIFIED — requires SW registration + notification permission on a real device */
  if(!notifGranted()) return;
  if(!('serviceWorker' in navigator)) return;
  var parts = (hhmm||'').split(':');
  var hh = parseInt(parts[0], 10);
  var mm = parseInt(parts[1], 10) || 0;
  if(isNaN(hh)) return;

  navigator.serviceWorker.ready.then(function(reg){
    var now = new Date();
    var fire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    if(fire <= now) fire.setDate(fire.getDate() + 1); // if time already past, schedule tomorrow
    var title = 'Pace — gentle check-in';
    var opts = {
      body: "Your day is waiting. No rush — just open when you're ready.",
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'pace-daily-reminder',
      renotify: false
    };
    /* showTrigger (Chrome only — UNVERIFIED on Safari/iOS) */
    if(typeof TimestampTrigger !== 'undefined'){
      opts.showTrigger = new TimestampTrigger(fire.getTime());
      reg.showNotification(title, opts).catch(function(){
        /* silent — SW scheduling not available */ });
    } else {
      /* fallback: same-session setTimeout — fires only if tab is open */
      var delay = fire.getTime() - Date.now();
      if(delay > 0 && delay < 24*60*60*1000){
        setTimeout(function(){
          reg.showNotification(title, opts).catch(function(){});
        }, delay);
      }
    }
  }).catch(function(){ /* SW not ready — silent */ });
}

/* ---- public API ---- */
window.PaceNotifications = {
  /* Call from Settings permission button (user-initiated) */
  requestPermission: requestPermission,
  /* Save reminder time ("HH:MM") and schedule/reschedule the notification */
  setReminder: function(hhmm){
    setReminderTime(hhmm);
    if(hhmm && notifGranted()){
      scheduleLocalNotification(hhmm);
    }
  },
  /* Get the current stored reminder time */
  getReminder: reminderTime,
  /* Called at boot (after DOM ready) to show the in-app nudge if needed */
  checkNudge: maybeShowNudge,
  hideNudge: hideNudgeBanner,
  notifGranted: notifGranted,
  notifSupported: notifSupported
};

/* ---- boot: check nudge on load ---- */
/* We call maybeShowNudge once the DOM is ready. ui-dump-sort bootApp fires
   after storageAdapter.init() resolves, so by the time bootApp runs the DOM
   is guaranteed ready. We hook into DOMContentLoaded as a safety net. */
document.addEventListener('DOMContentLoaded', function(){
  maybeShowNudge();
  // wire dismiss button if present
  var dismissBtn = document.getElementById('pace-reminder-nudge-dismiss');
  if(dismissBtn) dismissBtn.addEventListener('click', hideNudgeBanner);
});

})();
