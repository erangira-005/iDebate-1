/*
  Backend adapter. Everything the app needs from Supabase lives in this file:
  sign-in, the shared record store, live updates and the list of people.
  app.js only talks to window.Backend, so another database could be swapped in by
  replacing this file with one that offers the same functions.
*/
(function () {
  'use strict';
  if (window.Backend) return; // lets a test, or a different backend, provide its own

  var cfg = window.APP_CONFIG || {};
  var url = String(cfg.supabaseUrl || '');
  var key = String(cfg.supabaseAnonKey || '');
  var lib = window.supabase;
  var configured = /^https:\/\/[^ ]+$/.test(url) && key.length > 20 && !/YOUR_/.test(url + key) && !!(lib && lib.createClient);
  var sb = configured
    ? lib.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null;

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }
  function err(e) {
    return { code: String((e && (e.code || e.status)) || 'error'), message: (e && e.message) || '' };
  }

  /* A record in the app looks like { d: {...}, by, at, upd, updBy }.
     In the database, by/at/upd/updBy are columns and everything else is the data column. */
  var META = ['by', 'at', 'upd', 'updBy'];
  function rowToDoc(row) {
    var doc = Object.assign({}, row.data);
    doc.by = row.created_by;
    doc.at = Date.parse(row.created_at);
    if (row.updated_at) { doc.upd = Date.parse(row.updated_at); doc.updBy = row.updated_by; }
    return doc;
  }
  function docToData(doc) {
    var data = {};
    Object.keys(doc).forEach(function (k) { if (META.indexOf(k) === -1) data[k] = doc[k]; });
    return data;
  }

  /* ---------- records ---------- */
  var listeners = [];
  var channel = null;

  function refresh(name) {
    listeners.forEach(function (l) { if (l.name === name) l.load(); });
  }

  function docRef(name, id) {
    return {
      id: id,
      set: function (doc) {
        return sb.from('records').upsert({ id: id, collection: name, data: docToData(doc) }, { onConflict: 'id' })
          .then(function (r) { if (r.error) throw err(r.error); refresh(name); });
      },
      delete: function () {
        return sb.from('records').delete().eq('id', id).eq('collection', name).select('id')
          .then(function (r) {
            if (r.error) throw err(r.error);
            if (!r.data || !r.data.length) throw { code: 'not_allowed', message: 'Nothing was deleted. You can only delete your own records.' };
            refresh(name);
          });
      }
    };
  }

  function ensureChannel() {
    if (channel || !sb) return;
    channel = sb.channel('records-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, function (payload) {
        var row = (payload.new && payload.new.collection) ? payload.new : payload.old;
        var name = row && row.collection;
        listeners.forEach(function (l) { if (!name || l.name === name) l.load(); });
      })
      .subscribe();
  }

  function listen(name, next, error) {
    var stopped = false, busy = false, again = false;
    var entry = { name: name, load: load };
    function load() {
      if (stopped) return;
      if (busy) { again = true; return; }
      busy = true;
      var all = [];
      (function page(from) {
        sb.from('records').select('*').eq('collection', name)
          .order('created_at', { ascending: true }).range(from, from + 999)
          .then(function (r) {
            if (stopped) { busy = false; return; }
            if (r.error) throw err(r.error);
            all = all.concat(r.data || []);
            if ((r.data || []).length === 1000) return page(from + 1000);
            busy = false;
            next({ docs: all.map(function (row) { return { id: row.id, data: function () { return rowToDoc(row); } }; }) });
            if (again) { again = false; load(); }
          })
          .catch(function (e) {
            busy = false;
            if (!stopped && error) error(err(e));
          });
      })(0);
    }
    listeners.push(entry);
    ensureChannel();
    load();
    var poll = setInterval(load, 30000);
    function onVisible() { if (document.visibilityState === 'visible') load(); }
    document.addEventListener('visibilitychange', onVisible);
    return function () {
      stopped = true;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      listeners = listeners.filter(function (l) { return l !== entry; });
    };
  }

  function collection(name) {
    return {
      doc: function (id) { return docRef(name, id || uuid()); },
      add: function (doc) { var ref = docRef(name, uuid()); return ref.set(doc).then(function () { return ref; }); },
      onSnapshot: function (next, error) { return listen(name, next, error); }
    };
  }
  function doc(path) {
    var i = path.indexOf('/');
    return docRef(path.slice(0, i), path.slice(i + 1));
  }

  /* ---------- people and sign-in ---------- */
  function me(session) {
    return sb.from('profiles').select('id,email,name,role,approved').eq('id', session.user.id).maybeSingle()
      .then(function (r) { if (r.error) throw err(r.error); return r.data; });
  }
  function profiles(ids) {
    return sb.from('profiles').select('id,name').in('id', ids).then(function (r) {
      if (r.error) throw err(r.error);
      var out = {};
      (r.data || []).forEach(function (p) { out[p.id] = { id: p.id, name: p.name }; });
      return out;
    });
  }
  function listProfiles() {
    return sb.from('profiles').select('id,email,name,role,approved,created_at').order('created_at', { ascending: true })
      .then(function (r) { if (r.error) throw err(r.error); return r.data || []; });
  }
  function updateProfile(id, patch) {
    return sb.from('profiles').update(patch).eq('id', id).select('id').then(function (r) {
      if (r.error) throw err(r.error);
      if (!r.data || !r.data.length) throw { code: 'not_allowed', message: 'Only admins can change this.' };
    });
  }
  function onAuth(cb) {
    // supabase-js asks that its own methods are not called inside this callback, so hand off first.
    sb.auth.onAuthStateChange(function (event, session) { setTimeout(function () { cb(session); }, 0); });
  }
  function getSession() { return sb.auth.getSession().then(function (r) { return r.data && r.data.session; }); }
  function signIn(email, password) {
    return sb.auth.signInWithPassword({ email: email, password: password })
      .then(function (r) { return { error: r.error ? r.error.message : null }; });
  }
  function signUp(email, password, name) {
    return sb.auth.signUp({ email: email, password: password, options: { data: { name: name } } })
      .then(function (r) {
        if (r.error) return { error: r.error.message };
        return { error: null, needsConfirm: !(r.data && r.data.session) };
      });
  }
  function signOut() { return sb.auth.signOut(); }

  window.Backend = configured ? {
    configured: true,
    onAuth: onAuth, getSession: getSession, signIn: signIn, signUp: signUp, signOut: signOut,
    me: me, profiles: profiles, listProfiles: listProfiles, updateProfile: updateProfile,
    collection: collection, doc: doc
  } : { configured: false };
})();
