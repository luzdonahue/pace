import { store } from './core-store.js';

/* ===== HELPERS ===== */
var CAT = {
  health:   {color:'#EF9F27', cls:'c-amber', label:'Health'},
  selfcare: {color:'#D4537E', cls:'c-pink',  label:'Self-care'},
  creative: {color:'#1D9E75', cls:'c-teal',  label:'Creative'},
  work:     {color:'#378ADD', cls:'c-blue',  label:'Work'},
  admin:    {color:'#D85A30', cls:'c-coral', label:'Admin'},
  home:     {color:'#639922', cls:'c-green', label:'Home'},
  social:   {color:'#7F77DD', cls:'c-purple',label:'Social'}
};
function catCls(cat){ return (CAT[cat]||CAT.admin).cls; }
function catColor(cat){ return (CAT[cat]||CAT.admin).color; }

/* catRank: returns index of category in store.categories (0=top=strongest).
   Used as a gentle tie-break in renderToday sort. */
function catRank(cat){
  var cats = store.get().categories || ['health','selfcare','creative','work','admin','home','social'];
  var idx = cats.indexOf(cat);
  return idx >= 0 ? idx : cats.length;
}

function calcCapacity(ci){
  var avg = (ci.energy + ci.focus + (10 - ci.pain)) / 3;
  var st = store.get();
  var medN = (st.prefs && st.prefs.medTasks) ? st.prefs.medTasks : 3;
  if(avg >= 7) return {level:'high', tasks:5, pct:Math.round(avg*10)+'%'};
  if(avg >= 4) return {level:'med',  tasks:medN, pct:Math.round(avg*10)+'%'};
  return              {level:'low',  tasks:2, pct:Math.round(avg*10)+'%'};
}

function fmtDate(d){
  d = d || new Date();
  var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var mons=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return days[d.getDay()]+', '+mons[d.getMonth()]+' '+d.getDate();
}

function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== TIME OF DAY HELPER ===== */
function timeOfDay(){
  var h = new Date().getHours();
  if(h >= 5  && h < 11) return 'morning';
  if(h >= 11 && h < 17) return 'afternoon';
  if(h >= 17 && h < 21) return 'evening';
  return 'late';
}

/* 2B: breakdown prompt — exactly 3 concrete verb-first steps, JSON-only reply
   (same contract style as buildDumpPrompt). Category, why and priority are NOT
   asked for: children inherit them from the parent at accept time. */
function buildBreakdownPrompt(task){
  return 'You break one big task into tiny first steps for Pace, a gentle task app for people with limited energy.\n\n' +
  'OUTPUT — reply with ONLY a JSON array, no prose, no markdown fences. Each element exactly:\n' +
  '{"title": string, "energy": "body"|"mind"|"both"}\n\n' +
  'RULES\n' +
  '1. EXACTLY 3 steps — the first three real moves, in the order they would actually happen. Not abstract phases, not themes.\n' +
  '2. Each title starts with a concrete verb and names a physical, specific action a tired person could start in under a minute ("Find the phone number", "Put the form on the table" — never "Research options", "Plan", "Organize", "Figure out").\n' +
  '3. Keep each title under 10 words.\n' +
  '4. energy: "body" if the step is mostly physical, "mind" if mostly mental, "both" if mixed.\n\n' +
  'EXAMPLE\nTask: "Sort out car insurance"\nCorrect output:\n' +
  '[{"title":"Find the current policy email","energy":"mind"},{"title":"Write the renewal date on a sticky note","energy":"both"},{"title":"Open one comparison site","energy":"mind"}]\n\n' +
  'Now break down this task. Reply with ONLY the JSON array.\nTask: "' + task.name + '"' +
  (task.why ? '\nWhy it matters to them: "' + String(task.why).slice(0,140) + '"' : '');
}

/* Order matters: first keyword hit wins. Communication verbs (email/text/reply)
   are checked LAST so "email the bank about the bill" lands in admin, not social;
   a bare "email Sam back" still falls through to social. */
var CAT_KEYWORDS = {
  health:   ['pharmacy','pt','doctor','prescription','medical','pain','refill','therapy','appointment'],
  admin:    ['finance','audit','tax','bill','invoice','budget','money','bank','account'],
  home:     ['garden','water','clean','dishes','laundry','vacuum','tidy','groceries'],
  creative: ['tiktok','video','art','mosaic','write','draw','paint','design','create','photo'],
  work:     ['work','meeting','project','client','deadline','report','proposal'],
  selfcare: ['rest','sleep','bath','meditate','yoga','walk','exercise','nap'],
  social:   ['mum','mom','dad','text','call friend','message','email','reply','respond']
};

function guessCategory(text){
  var t = text.toLowerCase();
  for(var cat in CAT_KEYWORDS){
    var kws = CAT_KEYWORDS[cat];
    for(var i=0;i<kws.length;i++){
      if(t.indexOf(kws[i])>-1) return cat;
    }
  }
  return 'admin';
}

// Local (no-AI) brain dump splitter, tuned for raw speech transcripts
// that arrive with no punctuation. Two passes:
//   1. split on strong delimiters (newlines, sentence punctuation, commas, connectors)
//   2. re-split any chunk before each "task starter" phrase ("I need to…", "gotta…")
// Filler words ("um", "so", "okay") are stripped from the front of each piece.
var DUMP_DELIMS = /\n+|[.!?;]+|,|\band then\b|\band also\b|\bafter that\b|\bplus\b|\band\b/gi;
var DUMP_FILLERS = /^(?:um+|uh+|so|like|okay|ok|yeah|well|anyway|right|also|then|and)\b[,\s]*/i;
var DUMP_STARTERS = "i (?:also |still |really )?(?:need|have|want|got|gotta) to|i should|i must|i'?m going to|i'?ve got to|gotta|don'?t forget(?: to)?|remember(?:ing)? to|make sure (?:i|to)|need to|have to";

function splitOnStarters(s){
  var re = new RegExp('\\b(?:'+DUMP_STARTERS+')\\b','gi');
  var idxs = [], m;
  while((m = re.exec(s)) !== null){
    if(m.index > 0) idxs.push(m.index);
    re.lastIndex = m.index + m[0].length;
  }
  if(!idxs.length) return [s];
  var parts = [], prev = 0;
  for(var i=0;i<idxs.length;i++){ parts.push(s.slice(prev, idxs[i])); prev = idxs[i]; }
  parts.push(s.slice(prev));
  return parts;
}

function cleanDumpPart(s){
  s = s.replace(/^[\s,.;:!?\-]+|[\s,.;:!?\-]+$/g,'');
  var prev;
  do { prev = s; s = s.replace(DUMP_FILLERS,'').trim(); } while(s !== prev && s);
  do { prev = s; s = s.replace(/[\s,]*\b(?:um+|uh+|also|then|and|so|like|okay|ok|yeah)$/i,'').trim(); } while(s !== prev && s);
  return s;
}

function parseDump(text){
  var rough = String(text||'').split(DUMP_DELIMS);
  var parts = [];
  rough.forEach(function(chunk){
    if(!chunk || !chunk.trim()) return;
    splitOnStarters(chunk).forEach(function(p){
      p = cleanDumpPart(p);
      if(p.length > 2 && /[a-z]/i.test(p)) parts.push(p);
    });
  });
  return parts.map(function(name){
    var cat = guessCategory(name);
    return {name:name, category:cat, priority:3};
  });
}

/* ---- AI dump prompt (AI path only — the simple parser above is untouched) ---- */
// One-line meaning per category id; used to build the live category section.
var DUMP_CAT_DEFS = {
  health:   'medical and body care — appointments, meds, symptoms, treatments, refills',
  selfcare: 'rest and recovery — gentle things done for your own wellbeing',
  creative: 'making things — art, writing, music, video, content, hobby projects',
  work:     'job and professional tasks — clients, deadlines, meetings, reports',
  admin:    'life paperwork — money, accounts, passwords, forms, errands, planning',
  home:     'living space — cleaning, cooking, garden, pets, repairs, groceries',
  social:   'people — calls, texts, emails, visits, gifts, relationships'
};
var DUMP_CAT_EXAMPLES = '"refill my prescription" → health · "change my bank password" → admin · "water the plants" → home · "text Sam back" → social · "edit the tiktok video" → creative · "finish the client report" → work · "take a real rest day" → selfcare · "update the budget spreadsheet" → admin · "book the dentist" → health';

function buildDumpPrompt(text){
  // Live category list from state at call time: user's names + user's order.
  // (DUMP_CAT_DEFS keys are only a shape filter; VALID_CATS in the mapper stays the validation fallback.)
  var cats = (store.get().categories || ['health','selfcare','creative','work','admin','home','social']).filter(function(c){ return DUMP_CAT_DEFS[c]; });
  var catLines = cats.map(function(c){ return '- "'+c+'": '+DUMP_CAT_DEFS[c]; }).join('\n');
  var ACCTS = 'Chase Ink, Discover, Ollo 1, Ollo 2, Mission Lane, Destiny, Milestone, Indigo, Avant, Capital One, Venture One, FNBO';
  var goldDump = 'Chase ink / Discover / Ollo 1 / Ollo 2 / Mission lane / Destiny / Milestone / Indigo / Avant / Capital one / Venture one / Fnbo\n\nEach of these needs password change, added to bitwarden, update debt in spreadsheet, update due date in calendar, review recurring payments, adjusting what each of these does';
  var gold = JSON.stringify([
    {title:'Change passwords — '+ACCTS, name:'each of these needs password change', category:'admin', priority:3, energy:'mind', why:null, source_text:'Chase ink / Discover / Ollo 1 / Ollo 2 / Mission lane / Destiny / Milestone / Indigo / Avant / Capital one / Venture one / Fnbo — each of these needs password change', confidence:0.95},
    {title:'Add to Bitwarden — '+ACCTS, name:'added to bitwarden', category:'admin', priority:3, energy:'mind', why:null, source_text:'added to bitwarden', confidence:0.95},
    {title:'Update debt in spreadsheet — '+ACCTS, name:'update debt in spreadsheet', category:'admin', priority:3, energy:'mind', why:null, source_text:'update debt in spreadsheet', confidence:0.95},
    {title:'Update due dates in calendar — '+ACCTS, name:'update due date in calendar', category:'admin', priority:3, energy:'mind', why:null, source_text:'update due date in calendar', confidence:0.95},
    {title:'Review recurring payments — '+ACCTS, name:'review recurring payments', category:'admin', priority:3, energy:'mind', why:'Wants to adjust what each of these accounts does', source_text:'review recurring payments, adjusting what each of these does', confidence:0.9}
  ]);
  return 'You parse brain dumps for Pace, a gentle task app. Convert the dump at the end of this message into a JSON array of task objects.\n\n' +
  'The text may be a raw speech-to-text transcript: little or no punctuation, filler words (um, uh, like, so), misrecognized words. Find task boundaries from phrases like "I need to", "also", "and then", or topic changes. Ignore fillers; if a word is clearly a misrecognition, use the most likely intended word.\n\n' +
  'OUTPUT — reply with ONLY a JSON array, no prose, no markdown fences. Each element exactly:\n' +
  '{"title": string, "name": string, "category": string, "priority": 1-5, "energy": "body"|"mind"|"both", "why": string|null, "source_text": string, "confidence": 0-1}\n' +
  '- title: clean imperative card label ("Call pharmacy — refill"). Keep it short unless it must carry a checklist of items.\n' +
  '- name: the user\'s own wording for this task, minus fillers.\n' +
  '- source_text: the exact fragment(s) of the dump this task came from.\n' +
  '- why: the motivation or context behind this task if the dump gives one, max 140 characters; otherwise null. Reasons, worries, justifications and rambling belong in why — never as their own task.\n' +
  '- priority: 1 urgent to 5 minimal; default 3 unless the dump signals urgency.\n' +
  '- energy: "body" physical, "mind" mental, "both" mixed.\n' +
  '- confidence: 0 to 1, how sure you are of the category.\n\n' +
  'SEMANTIC RULES\n' +
  '1. A task is an ACTION — it must contain or clearly imply a verb. A bare noun (an account name, a brand, a person, a product) is an ENTITY, not a task. Never output an entity alone as a task.\n' +
  '2. Resolve references: "each of these", "all of them", "those" point to the most recent list of entities in the dump.\n' +
  '3. When the dump lists entities and then gives instructions that apply to all of them, group along the SMALLER dimension: fewer actions than entities → one task per action with the entities listed in the title as a checklist suffix ("Change passwords — A, B, C"); fewer entities than actions → one task per entity with the actions listed ("Capital One — password, Bitwarden, spreadsheet"). NEVER output the full cross-product. NEVER output orphaned fragments (a verb with no object, or an entity with no verb).\n' +
  '4. Vague, non-actionable clauses ("adjusting things", "figuring out…", feelings, justifications) are not tasks — fold them into the why of the most related task, or drop them.\n' +
  '5. One task = ONE actionable thing; never merge unrelated activities.\n\n' +
  'CATEGORIES — use only these ids, exactly as written (this is the user\'s own list, in their priority order):\n' + catLines + '\n' +
  'Examples: ' + DUMP_CAT_EXAMPLES + '\n' +
  'If genuinely unsure, pick the closest id and lower the confidence.\n\n' +
  'EXAMPLE\nDump:\n' + goldDump + '\n\nCorrect output:\n' + gold + '\n' +
  '(Why this is correct: 5 action-tasks, because 5 concrete actions < 12 accounts; "adjusting what each of these does" is vague, so it became why-context on the closest task instead of a task; no account name appears alone as a task.)\n\n' +
  'Now parse this dump. Reply with ONLY the JSON array.\nDump: ' + text;
}

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

export { CAT, catCls, catColor, catRank, calcCapacity, fmtDate, escHtml, timeOfDay,
         buildBreakdownPrompt, CAT_KEYWORDS, guessCategory, DUMP_DELIMS, DUMP_FILLERS,
         DUMP_STARTERS, splitOnStarters, cleanDumpPart, parseDump, DUMP_CAT_DEFS,
         DUMP_CAT_EXAMPLES, buildDumpPrompt, getMondayOfWeek, dateStr, calcStreak };
