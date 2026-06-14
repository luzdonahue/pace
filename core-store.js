/* ===== STORE ===== */
var STORE_KEY = 'pace.state.v1';

function uid(){ return Math.random().toString(36).slice(2,10); }

var DEFAULT_TASKS = [
  {id:uid(),name:'Call pharmacy — refill',category:'health',priority:1,energy:'body',capacity:'low',types:['physical','admin'],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null},
  {id:uid(),name:'Rest window — protect it',category:'selfcare',priority:2,energy:'body',capacity:'low',types:['physical'],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null},
  {id:uid(),name:'TikTok videos overdue',category:'creative',priority:3,energy:'mind',capacity:'high',types:['creative','cognitive'],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null},
  {id:uid(),name:'Commission artwork',category:'creative',priority:3,energy:'mind',capacity:'med',types:['creative'],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null},
  {id:uid(),name:'Audit finances',category:'admin',priority:3,energy:'mind',capacity:'med',types:['cognitive','admin'],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null},
  {id:uid(),name:'Text mum back',category:'social',priority:4,energy:'both',capacity:'low',types:['social','emotional'],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null},
  {id:uid(),name:'Water the garden',category:'home',priority:5,energy:'body',capacity:'low',types:['physical'],why:'',notes:[],emotion:null,status:'today',createdAt:new Date().toISOString(),completedAt:null}
];

var DEFAULT_STATE = {
  tasks: [],   // 3.4: first-run starts EMPTY; demo tasks are opt-in via "Load sample data" in Settings
  profile: {name:'', intention:''},
  categories: ['health','selfcare','creative','work','admin','home','social'],
  categoryParents: {},
  checkins: [],
  goals: [],
  wins: [],
  events: [],  // item 4: append-only interaction log (no task text)
  prefs: {reminders:false, flare:false, medTasks:3},
  onboarded: false,
  lastCheckinDate: null
};

/* ===== STORAGE ADAPTER =====
   localStorage stays the fast, synchronous mirror the app reads at boot.
   IndexedDB (database "pace", object store "kv", key "state") is the durable
   replica — it survives iOS evicting localStorage. Every save writes to both.
   State is kept in IDB as the same JSON string written to localStorage, so a
   plain string comparison is a deep compare. */
var storageAdapter = {
  _db: null,
  _idbOk: false,
  _errFns: [],
  onPersistError: function(fn){ this._errFns.push(fn); },
  _fail: function(err){
    this._errFns.forEach(function(fn){ try{ fn(err); }catch(e){} });
  },
  _openDb: function(){
    return new Promise(function(resolve, reject){
      if(!window.indexedDB){ reject(new Error('IndexedDB unavailable')); return; }
      var req;
      try { req = indexedDB.open('pace', 1); }
      catch(e){ reject(e); return; }
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error || new Error('IndexedDB open failed')); };
      req.onblocked = function(){ reject(new Error('IndexedDB open blocked')); };
    });
  },
  _idbGet: function(){
    var db = this._db;
    return new Promise(function(resolve, reject){
      var tx = db.transaction('kv', 'readonly');
      var req = tx.objectStore('kv').get('state');
      req.onsuccess = function(){ resolve(typeof req.result === 'string' ? req.result : null); };
      req.onerror = function(){ reject(req.error || new Error('IndexedDB read failed')); };
    });
  },
  _idbPut: function(json){
    var db = this._db;
    return new Promise(function(resolve, reject){
      var tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(json, 'state');
      tx.oncomplete = function(){ resolve(); };
      tx.onerror = function(){ reject(tx.error || new Error('IndexedDB write failed')); };
      tx.onabort = function(){ reject(tx.error || new Error('IndexedDB write aborted')); };
    });
  },
  /* Boot/recovery. Always resolves — the app must never fail to boot
     because of this layer. On any failure the app simply runs on
     localStorage alone and the error hook fires. */
  init: function(){
    var self = this;
    return self._openDb().then(function(db){
      self._db = db;
      self._idbOk = true;
      return self._idbGet();
    }).then(function(idbJson){
      var lsJson = null;
      try { lsJson = localStorage.getItem(STORE_KEY); } catch(e){}
      if(lsJson && !idbJson){
        // Existing user, first run with this feature: copy to IDB, read it
        // back, deep-compare; only if identical mark migration done.
        // The localStorage copy is never deleted or modified.
        return self._idbPut(lsJson).then(function(){ return self._idbGet(); }).then(function(echo){
          if(echo === lsJson){
            try { localStorage.setItem('pace.migrated.v1', '1'); } catch(e){}
          }
        });
      }
      if(!lsJson && idbJson){
        // localStorage was evicted — restore it from the durable copy
        // before the app loads. This is the entire point of the feature.
        try { localStorage.setItem(STORE_KEY, idbJson); }
        catch(e){ self._fail(e); }
      }
      // Both present → localStorage wins (it's the live mirror); IDB
      // catches up on the next write. Both empty → brand-new user.
    }).catch(function(err){
      self._idbOk = false;
      self._db = null;
      self._fail(err);
    });
  },
  read: function(){
    try { return localStorage.getItem(STORE_KEY); } catch(e){ return null; }
  },
  write: function(state){
    var json;
    try { json = JSON.stringify(state); }
    catch(e){ this._fail(e); return; }
    try { localStorage.setItem(STORE_KEY, json); }
    catch(e){ this._fail(e); }
    if(this._idbOk && this._db){
      var self = this;
      this._idbPut(json).catch(function(err){ self._fail(err); });
    }
  }
};

var store = {
  _state: null,
  load: function(){
    try {
      var raw = storageAdapter.read();
      if(raw){ this._state = JSON.parse(raw); }
      else { this._state = JSON.parse(JSON.stringify(DEFAULT_STATE)); }
    } catch(e){ this._state = JSON.parse(JSON.stringify(DEFAULT_STATE)); }
    // migrate old states
    var s = this._state;
    if(!s.goals) s.goals=[];
    if(!s.wins) s.wins=[];
    if(!s.prefs) s.prefs={reminders:false,flare:false,medTasks:3};
    if(!s.categoryParents) s.categoryParents={};
    if(!('lastActiveDate' in s)) s.lastActiveDate = null; // 3.1: day rollover guard
    // heal sparse states (e.g. hand-edited imports) so nothing crashes later
    if(!Array.isArray(s.tasks)) s.tasks=[];
    if(!Array.isArray(s.checkins)) s.checkins=[];
    if(!s.profile) s.profile={name:'',intention:''};
    if(!Array.isArray(s.categories) || !s.categories.length) s.categories=['health','selfcare','creative','work','admin','home','social'];
    // S3: clamp goal.color on every boot — guards against bad values from old imports
    if(Array.isArray(s.goals)) s.goals.forEach(function(g){
      if(g && g.color && !/^#[0-9A-Fa-f]{3,8}$/.test(g.color)) g.color='#999999';
    });
    // item 4: event log — migrate existing installs
    if(!Array.isArray(s.events)) s.events=[];
    return this._state;
  },
  save: function(){
    storageAdapter.write(this._state); // write-through: localStorage + IndexedDB; failures fire onPersistError
  },
  get: function(){ return this._state; },
  updateTask: function(id, patch){
    var t = this._state.tasks.find(function(x){return x.id===id;});
    if(t){ Object.assign(t, patch); this.save(); }
  },
  addTask: function(task){
    this._state.tasks.push(task);
    this.save();
  },
  /* 2B: atomic swap — newTasks in (at the parent's position), parent out,
     ONE save. Never addTask-per-child followed by a delete: a crash
     mid-sequence must never persist parent and children together. */
  replaceTask: function(id, newTasks){
    var i = this._state.tasks.findIndex(function(x){return x.id===id;});
    if(i < 0) return false;
    Array.prototype.splice.apply(this._state.tasks, [i,1].concat(newTasks));
    this.save();
    return true;
  },
  saveCheckin: function(ci){
    this._state.checkins.push(ci);
    this._state.lastCheckinDate = new Date().toISOString().slice(0,10);
    this.save();
  },
  /* item 4: returns today's check-in capacity level (string e.g. 'low'|'med'|'high') or null */
  _checkinLevel: function(){
    var s = this._state;
    var today = new Date().toISOString().slice(0,10);
    if(!Array.isArray(s.checkins)) return null;
    for(var i=s.checkins.length-1;i>=0;i--){
      if(s.checkins[i] && s.checkins[i].date===today) return s.checkins[i].capacity||null;
    }
    return null;
  },
  /* item 4: append one event; cap at 5000 (drop oldest 500 on overflow).
     Events MUST NOT carry task names/text — stays safe to export and share. */
  logEvent: function(type, payload){
    var s = this._state;
    if(!Array.isArray(s.events)) s.events=[];
    var ev = Object.assign({t: new Date().toISOString(), type: type}, payload);
    s.events.push(ev);
    if(s.events.length > 5000) s.events.splice(0, 500); // drop oldest 500
    this.save();
  }
};

/* 3.4: Inject demo tasks on demand (Settings → "Load sample data").
   Safe to call multiple times — uses a name-based duplicate check so
   existing real tasks are never wiped or duplicated. */
function loadSampleData(){
  var s = store.get();
  var existingNames = {};
  s.tasks.forEach(function(t){ existingNames[t.name] = 1; });
  var added = 0;
  DEFAULT_TASKS.forEach(function(tmpl){
    if(existingNames[tmpl.name]) return; // already present (idempotent)
    s.tasks.push(Object.assign({}, tmpl, {id: uid(), createdAt: new Date().toISOString()}));
    added++;
  });
  if(added > 0) store.save();
  return added;
}

/* S4: sanitizeState — run on import only (never on live state).
   Deep-clones the incoming object, type-checks each field, and drops/clamps
   unknown values so nothing untrusted reaches the render layer.
   Pure function — no side-effects, no global reads. */
function sanitizeState(state){
  if(!state || typeof state !== 'object') return state;
  var s = JSON.parse(JSON.stringify(state)); // deep clone — never mutate caller's object
  var validCats = ['health','selfcare','creative','work','admin','home','social'];
  var validStatus = ['today','backlog','done','not-today'];
  // tasks
  if(!Array.isArray(s.tasks)) s.tasks=[];
  s.tasks = s.tasks.filter(function(t){ return t && typeof t === 'object'; });
  s.tasks.forEach(function(t){
    if(typeof t.id !== 'string') t.id='';
    if(typeof t.name !== 'string') t.name=String(t.name||'');
    if(validCats.indexOf(t.category)===-1) t.category='admin';
    if(typeof t.priority !== 'number') t.priority=3;
    if(t.energy !== null && typeof t.energy !== 'string') t.energy='';
    if(typeof t.capacity !== 'string') t.capacity='';
    if(!Array.isArray(t.types)) t.types=[];
    if(typeof t.why !== 'string') t.why='';
    if(!Array.isArray(t.notes)) t.notes=[];
    if(validStatus.indexOf(t.status)===-1) t.status='backlog';
  });
  // goals — S3: validate color (attr-injection via imported backups)
  if(!Array.isArray(s.goals)) s.goals=[];
  s.goals = s.goals.filter(function(g){ return g && typeof g === 'object'; });
  s.goals.forEach(function(g){
    if(typeof g.id !== 'string') g.id='';
    if(typeof g.name !== 'string') g.name=String(g.name||'');
    if(!/^#[0-9A-Fa-f]{3,8}$/.test(g.color)) g.color='#999999';
    if(typeof g.why !== 'string') g.why='';
    var pct=g.pct; g.pct=(typeof pct==='number'&&pct>=0&&pct<=100)?pct:0;
  });
  // checkins
  if(!Array.isArray(s.checkins)) s.checkins=[];
  s.checkins = s.checkins.filter(function(c){ return c && typeof c === 'object'; });
  s.checkins.forEach(function(c){
    ['energy','focus','pain','mood','capacity'].forEach(function(k){
      var v=c[k]; c[k]=(typeof v==='number')?Math.max(0,Math.min(10,v)):0;
    });
    if(typeof c.date !== 'string') c.date='';
  });
  return s;
}

export { STORE_KEY, uid, DEFAULT_TASKS, DEFAULT_STATE, storageAdapter, store, loadSampleData, sanitizeState };
