/* boot.js — module manifest. Imports execute in the order listed (each file's
   dependencies point strictly backward, so listed order = execution order =
   the original <script> block order, with two long-standing exceptions noted
   in the split report: the AI focus-injection IIFE now runs right after the
   PaceAI block, and the service-worker registration below runs after the
   modules (import hoisting) — its load-event listener is unaffected. */
import './ui-shell.js';      // block 2: seam, router, tab bar, toast, greeting, showScreen wrapper
import './ui-today.js';      // block 2: today render, drawer, breakdown
import './ui-checkin.js';    // block 2: check-in, onboarding, today extras (view/flare/stale)
import './ui-dump-sort.js';  // block 2: dump screen, sort sheet, INIT/boot + window exports
import './adapter-ai.js';    // blocks 3 + 11: PaceAI, AI key settings, focus injection
import './ui-sort-screen.js';     // block 4
import './ui-someday-goals.js';   // blocks 5 + 6
import './ui-settings.js';        // block 7
import './ui-weekly-merge.js';    // blocks 8 + 9
import './adapter-platform.js';   // blocks 10 + 12 + 13: timer, haptics, whisper

if('serviceWorker' in navigator && location.protocol==='https:'){
  window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
}
