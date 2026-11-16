(function () {
  'use strict';

  /* ---------- small helpers ---------- */
  function h(tag, props) {
    var el = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    var kids = Array.prototype.slice.call(arguments, 2);
    (function add(list) {
      list.forEach(function (kid) {
        if (kid == null || kid === false) return;
        if (Array.isArray(kid)) add(kid);
        else el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      });
    })(kids);
    return el;
  }
  var $ = function (s) { return document.querySelector(s); };
  function todayISO() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function fmtDay(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function pct(x) { return x == null ? '–' : (x * 100).toFixed(1) + '%'; }
  function pts(x) { return x == null ? '–' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' pts'; }
  function rate(n, d) { return d > 0 ? n / d : null; }

  /* ---------- form definitions ---------- */
  var OPT = {
    schoolType: ['Primary', 'Secondary', 'Combined'],
    gender: ['Female', 'Male', 'Other'],
    yesno: ['Yes', 'No'],
    grade: Array.from({ length: 12 }, function (_, i) { return 'Grade ' + (i + 1); }),
    sessionType: ['Coaching session', 'Workshop', 'Assessment day', 'Catch-up session'],
    module: ['Module 1', 'Module 2', 'Module 3', 'Module 4'],
    asmType: ['Pre', 'Post'],
    attendance: ['Present', 'Absent', 'Excused']
  };

  var BUILTIN = [
    {
      id: 'school', col: 'school', group: 'once', title: 'School profile', hint: 'Once per school', sort: 'title',
      fields: [
        { key: 'school_name', label: 'School name', type: 'text', required: true },
        { key: 'region', label: 'Region or district', type: 'text' },
        { key: 'school_type', label: 'School type', type: 'select', options: OPT.schoolType },
        { key: 'contact_person', label: 'Contact person', type: 'text' },
        { key: 'contact_phone', label: 'Contact phone', type: 'tel' },
        { key: 'total_learners', label: 'Total learners', type: 'number', min: 0 },
        { key: 'notes', label: 'Notes', type: 'textarea' }
      ],
      recTitle: function (r) { return r.d.school_name || 'Unnamed school'; },
      recSub: function (r) { return [r.d.region, r.d.school_type].filter(Boolean).join(' · '); }
    },
    {
      id: 'student', col: 'student', group: 'once', title: 'Student profile', hint: 'Once per student', sort: 'title',
      needs: ['school'], repeat: true,
      fields: [
        { key: 'school', label: 'School', type: 'lookup', of: 'school', required: true },
        { key: 'first_name', label: 'First name', type: 'text', required: true },
        { key: 'last_name', label: 'Last name', type: 'text', required: true },
        { key: 'gender', label: 'Gender', type: 'select', options: OPT.gender },
        { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
        { key: 'grade', label: 'Grade', type: 'select', options: OPT.grade },
        { key: 'guardian_name', label: 'Guardian name', type: 'text' },
        { key: 'guardian_phone', label: 'Guardian phone', type: 'tel' },
        { key: 'consent_given', label: 'Guardian consent given', type: 'select', options: OPT.yesno, required: true }
      ],
      recTitle: function (r) { return [r.d.first_name, r.d.last_name].filter(Boolean).join(' ') || 'Unnamed student'; },
      recSub: function (r) { return [titleOf('school', r.d.school), r.d.grade].filter(Boolean).join(' · '); }
    },
    {
      id: 'session', col: 'session', group: 'every', title: 'Session report', hint: 'After each session, with attendance', sort: 'date',
      needs: ['school', 'student'],
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, today: true },
        { key: 'school', label: 'School', type: 'lookup', of: 'school', required: true },
        { key: 'session_type', label: 'Session type', type: 'select', options: OPT.sessionType, required: true },
        { key: 'module', label: 'Module', type: 'select', options: OPT.module },
        { key: 'topic', label: 'Topic', type: 'text', required: true },
        { key: 'duration_minutes', label: 'Duration in minutes', type: 'number', min: 1, required: true },
        { key: 'attendance', label: 'Attendance', type: 'roster', of: 'student', by: 'school', mode: 'select', options: OPT.attendance, def: 'Present', column: 'attendance_status' },
        { key: 'summary', label: 'What happened', type: 'textarea' },
        { key: 'challenges', label: 'Challenges', type: 'textarea' },
        { key: 'next_steps', label: 'Next steps', type: 'textarea' }
      ],
      recTitle: function (r) { return r.d.topic || 'Session'; },
      recSub: function (r) { return [r.d.date, titleOf('school', r.d.school)].filter(Boolean).join(' · '); }
    },
    {
      id: 'assessment', col: 'assessment', group: 'every', title: 'Assessment scores', hint: 'Pre and post scores for a class', sort: 'date',
      needs: ['school', 'student'],
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, today: true },
        { key: 'school', label: 'School', type: 'lookup', of: 'school', required: true },
        { key: 'assessment_type', label: 'Assessment type', type: 'select', options: OPT.asmType, required: true },
        { key: 'module', label: 'Module', type: 'select', options: OPT.module },
        { key: 'max_score', label: 'Maximum score', type: 'number', min: 1, required: true },
        { key: 'scores', label: 'Scores', type: 'roster', of: 'student', by: 'school', mode: 'number', maxKey: 'max_score', column: 'score' }
      ],
      recTitle: function (r) { return (r.d.assessment_type || 'Assessment') + ' assessment' + (r.d.module ? ' · ' + r.d.module : ''); },
      recSub: function (r) { return [r.d.date, titleOf('school', r.d.school)].filter(Boolean).join(' · '); }
    }
  ];

  function customForm(def) {
    var fields = (def.fields || []).map(function (f) {
      return {
        key: f.key, label: f.label, required: !!f.required,
        type: f.type === 'yesno' ? 'select' : f.type,
        options: f.type === 'yesno' ? OPT.yesno : f.options
      };
    });
    return {
      id: 'cf_' + def.id, col: 'cf_' + def.id, group: 'custom', title: def.title || 'Untitled form', hint: 'Custom form',
      sort: 'recent', custom: true, defId: def.id, fields: fields,
      recTitle: function (r) { var f = fields[0]; return (f && fmtVal(f, r.d[f.key])) || 'Record'; },
      recSub: function (r) { var f = fields[1]; return f ? fmtVal(f, r.d[f.key]) : ''; }
    };
  }

  /* ---------- state ---------- */
  var Backend = window.Backend || { configured: false };
  var S = {
    db: null, auth: 'loading', authMode: 'in', authMsg: '', loadingFor: null, profile: null,
    myId: null, meName: '', admin: false, canWrite: null,
    tab: 'forms', screen: null, values: {}, built: false, saving: false,
    data: {}, idx: {}, loaded: {}, subs: {}, subErr: {}, names: {}, custom: [], formsCache: null,
    filter: '', slow: false, slowTimer: 0, people: null, peopleLoading: false
  };
  var B = { title: '', fields: [{ label: '', type: 'text', options: '', required: false }], err: '', delDef: null };

  function allForms() { return S.formsCache || (S.formsCache = BUILTIN.concat(S.custom.map(customForm))); }
  function formById(id) { return allForms().filter(function (f) { return f.id === id; })[0]; }
  function formByCol(col) { return allForms().filter(function (f) { return f.col === col; })[0]; }
  function list(col) { return S.data[col] || []; }
  function getRec(col, id) { return S.idx[col] ? S.idx[col].get(id) : undefined; }
  function titleOf(col, id) {
    if (!id) return '';
    var f = formByCol(col), r = getRec(col, id);
    return r && f ? f.recTitle(r) : 'Deleted record';
  }
  function fmtVal(f, v) {
    if (v == null || v === '') return '';
    if (f.type === 'lookup') return titleOf(f.of, v);
    return String(v);
  }
  function nameOf(id) {
    if (!id) return 'Unknown';
    if (id === S.myId) return 'You';
    return S.names[id] || 'A coach';
  }
  function plainName(id) {
    if (!id) return '';
    return S.names[id] || (id === S.myId ? S.meName : '') || 'Unknown coach';
  }
  function canWrite() { return S.canWrite !== false; }
  function canModify(rec) { return canWrite() && (S.admin || (!!rec.by && rec.by === S.myId)); }

  function loadNames(ids) {
    if (!S.db) return;
    var need = Array.from(new Set(ids.filter(Boolean))).filter(function (i) { return !(i in S.names); });
    if (!need.length) return;
    need.forEach(function (i) { S.names[i] = ''; });
    Promise.resolve(Backend.profiles(need)).then(function (ps) {
      need.forEach(function (i) { S.names[i] = (ps && ps[i] && ps[i].name) || ''; });
      scheduleRender();
    }, function () { scheduleRender(); });
  }

  /* ---------- data subscriptions ---------- */
  function sub(col) {
    if (!S.db || S.subs[col]) return;
    S.subs[col] = S.db.collection(col).onSnapshot(function (snap) {
      S.data[col] = snap.docs.map(function (d) {
        var x = d.data() || {};
        return Object.assign({}, x, { id: d.id, d: x.d || {} });
      });
      S.idx[col] = new Map(S.data[col].map(function (r) { return [r.id, r]; }));
      S.loaded[col] = true;
      delete S.subErr[col];
      if (col === 'formdefs') {
        S.custom = S.data.formdefs.slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
        S.formsCache = null;
        S.custom.forEach(function (c) { sub('cf_' + c.id); });
      }
      checkSlow();
      scheduleRender();
    }, function (err) {
      S.loaded[col] = true;
      S.subErr[col] = (err && err.code) || 'error';
      scheduleRender();
    });
  }
  function checkSlow() {
    var cols = ['school', 'student', 'session', 'assessment', 'formdefs'];
    if (cols.every(function (c) { return S.loaded[c]; })) S.slow = false;
  }

  /* ---------- navigation and rendering ---------- */
  var timer = 0;
  function scheduleRender() {
    if (timer) return;
    timer = setTimeout(function () { timer = 0; render(); }, 30);
  }
  function go(tab, screen) {
    S.tab = tab; S.screen = screen || null; S.built = false;
    S.resetFor = null; S.resetDone = null; S.schoolsFor = null;
    if (tab === 'people' && S.admin) { S.peopleLoading = false; loadPeople(); } // pick up new sign-ups and assignments
    if (!screen || screen.kind !== 'fill') S.values = {};
    S.filter = '';
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }
  var toastTimer = 0;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function chrome() {
    var who = $('#who');
    who.replaceChildren();
    if (S.auth === 'in' || S.auth === 'pending') {
      [
        S.meName ? h('span', { text: S.meName + (S.admin ? ' · admin' : '') }) : null,
        S.auth === 'in' ? h('button', { type: 'button', class: 'linkbtn', onclick: function () { go('account', null); }, text: 'Password' }) : null,
        h('button', { type: 'button', class: 'linkbtn', onclick: signOut, text: 'Sign out' })
      ].forEach(function (el) { if (el) who.append(el); });
    }
    var nav = $('#tabs');
    nav.replaceChildren();
    if (S.auth === 'in') {
      var tabs = [['forms', 'Forms'], ['overview', S.admin ? 'Overview' : 'My schools']];
      if (S.admin) {
        tabs.push(['build', 'Build a form']);
        var waiting = (S.people || []).filter(function (p) { return !p.approved; }).length;
        tabs.push(['people', 'People' + (waiting ? ' (' + waiting + ')' : '')]);
      }
      tabs.forEach(function (t) {
        nav.append(h('button', { type: 'button', class: 'tab', 'aria-current': S.tab === t[0] ? 'page' : null, onclick: function () { go(t[0], null); }, text: t[1] }));
      });
    }
    var n = $('#notice');
    n.replaceChildren();
    if (S.slow) n.append(h('div', { class: 'banner', text: 'Still connecting to the shared data. What you see may be out of date until this message goes away.' }));
    Object.keys(S.subErr).forEach(function (c) {
      n.append(h('div', { class: 'banner bad', text: 'Could not load ' + c.replace(/^cf_/, 'a custom form') + ' (' + S.subErr[c] + ').' }));
    });
  }

  function render() {
    chrome();
    var main = $('#main');
    if (!Backend.configured) { main.replaceChildren(screenSetup()); return; }
    if (S.auth === 'loading') { main.replaceChildren(h('p', { class: 'hint', text: 'Connecting…' })); return; }
    if (S.auth === 'out') { main.replaceChildren(screenLogin()); return; }
    if (S.auth === 'pending') { main.replaceChildren(screenPending()); return; }
    if (S.screen && S.screen.kind === 'fill' && S.built) return;
    if ((S.tab === 'account' || S.tab === 'people') && S.built) return;
    var view;
    try {
      if (S.tab === 'overview') view = screenOverview();
      else if (S.tab === 'account') view = screenAccount();
      else if (S.tab === 'people' && S.admin) view = screenPeople();
      else if (S.tab === 'build' && S.admin) view = screenBuild();
      else if (S.screen && S.screen.kind === 'list') view = screenList();
      else if (S.screen && S.screen.kind === 'view') view = screenView();
      else if (S.screen && S.screen.kind === 'fill') view = screenFill();
      else view = screenHome();
    } catch (e) {
      if (window.console) console.error(e);
      view = h('div', { class: 'banner bad', text: 'Something went wrong showing this screen. Go back to Forms and try again.' });
    }
    main.replaceChildren(view);
  }

  /* ---------- sign in, approval and people ---------- */
  function screenSetup() {
    return h('div', { class: 'card stack-s' },
      h('h2', { text: 'Connect a database' }),
      h('p', { text: 'This copy of the app is not connected to a database yet. Open config.js in the repository, paste your Supabase project URL and key, commit the change and reload this page.' }),
      h('p', { class: 'hint', text: 'The README walks through it, starting with creating the Supabase project.' }));
  }

  /* A password box with a Show / Hide button, so people can check what they typed. */
  function pwField(id, auto) {
    var input = h('input', { class: 'inp', id: id, type: 'password', autocomplete: auto, autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' });
    var btn = h('button', { type: 'button', class: 'btn pwshow', 'aria-pressed': 'false', 'aria-label': 'Show password', text: 'Show' });
    btn.addEventListener('click', function () {
      var shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      btn.textContent = shown ? 'Show' : 'Hide';
      btn.setAttribute('aria-pressed', shown ? 'false' : 'true');
      btn.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    });
    return { input: input, box: h('div', { class: 'pwrow' }, input, btn) };
  }

  /* Supabase's messages are short and technical; say what to do about them. */
  function friendlyAuthError(msg) {
    var m = String(msg || '');
    if (/invalid login credentials/i.test(m)) return 'That email and password do not match an account. Check the email, tap Show to check the password (capital letters count) and try again. If it keeps failing, ask your admin to reset your password.';
    if (/email not confirmed/i.test(m)) return 'This account’s email has not been confirmed, so it cannot sign in yet. Ask your admin for help (README, step 2).';
    if (/already registered|already been registered/i.test(m)) return 'That email already has an account. Tap “I already have an account” to sign in, or ask your admin to reset the password.';
    if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a few minutes and try again.';
    if (/not authorized|error sending|sending .*email/i.test(m)) return 'The confirmation email could not be sent. Ask your admin to turn off “Confirm email” in Supabase (README, step 2).';
    return m || 'Something went wrong. Try again.';
  }

  function screenLogin() {
    var signup = S.authMode === 'up';
    var form = h('form', { class: 'stack-s', novalidate: true });
    var msg = h('p', { class: 'err', id: 'auth-err', role: 'alert', text: S.authMsg });
    var name = null;
    if (signup) {
      name = h('input', { class: 'inp', id: 'a-name', type: 'text', autocomplete: 'name' });
      form.append(h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'a-name', text: 'Your name' }), name));
    }
    var email = h('input', { class: 'inp', id: 'a-email', type: 'email', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' });
    var pf = pwField('a-pass', signup ? 'new-password' : 'current-password');
    var pass = pf.input;
    var pf2 = signup ? pwField('a-pass2', 'new-password') : null;
    var go1 = h('button', { type: 'submit', class: 'btn primary', id: 'a-go', text: signup ? 'Create account' : 'Sign in' });
    form.append(
      h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'a-email', text: 'Email' }), email),
      h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'a-pass', text: signup ? 'Password (at least 8 characters)' : 'Password' }), pf.box));
    if (pf2) form.append(h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'a-pass2', text: 'Type the password again' }), pf2.box));
    form.append(msg, go1);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = email.value.trim().toLowerCase(), pw = pass.value, nm = name ? name.value.trim() : '';
      if (!em || !pw) { msg.textContent = 'Enter your email and password.'; return; }
      if (signup && !nm) { msg.textContent = 'Enter your name so the admin knows who you are.'; return; }
      if (signup && !/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(em)) { msg.textContent = 'Enter a full email address, such as name@company.com.'; return; }
      if (signup && pw.length < 8) { msg.textContent = 'Use a password of at least 8 characters.'; return; }
      if (signup && pf2.input.value !== pw) { msg.textContent = 'The two passwords do not match. Tap Show to check them.'; return; }
      go1.disabled = true; msg.textContent = '';
      var call = signup ? Backend.signUp(em, pw, nm) : Backend.signIn(em, pw);
      Promise.resolve(call).then(function (res) {
        go1.disabled = false;
        if (res && res.error) {
          if (window.console) console.warn('Sign-in problem reported by the server:', res.error);
          S.authMsg = friendlyAuthError(res.error); msg.textContent = S.authMsg; return;
        }
        if (res && res.needsConfirm) {
          S.authMode = 'in';
          S.authMsg = 'Account created. Check your email for a confirmation link, then sign in.';
          render();
        }
      }, function () { go1.disabled = false; msg.textContent = 'Could not reach the server. Check your connection and try again.'; });
    });
    var toggle = h('button', { type: 'button', class: 'btn', onclick: function () { S.authMode = signup ? 'in' : 'up'; S.authMsg = ''; render(); }, text: signup ? 'I already have an account' : 'Create an account' });
    var forgot = signup ? null : h('details', { class: 'forgot' },
      h('summary', { text: 'Forgot your password?' }),
      h('p', { class: 'hint', text: 'Ask your admin to reset it. They open the People tab, press Reset password next to your name and give you a temporary password. After you sign in, tap Password at the top to choose your own.' }));
    return h('div', { class: 'stack' },
      h('div', { class: 'card stack-s' },
        h('h2', { text: signup ? 'Create your account' : 'Sign in' }),
        h('p', { class: 'hint', text: signup ? 'An admin has to approve new accounts before you can see or add records.' : 'Use the email and password you registered with.' }),
        form, forgot),
      toggle);
  }

  /* Signed-in people choose a new password here (also used after an admin set a temporary one). */
  function screenAccount() {
    S.built = true; // keep what is typed when live data refreshes the page
    var msg = h('p', { class: 'err', id: 'c-err', role: 'alert' });
    var done = h('p', { class: 'hint', id: 'c-done', role: 'status' });
    var p1 = pwField('c-pass', 'new-password'), p2 = pwField('c-pass2', 'new-password');
    var go1 = h('button', { type: 'submit', class: 'btn primary', id: 'c-go', text: 'Change password' });
    var form = h('form', { class: 'stack-s', novalidate: true },
      h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'c-pass', text: 'New password (at least 8 characters)' }), p1.box),
      h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'c-pass2', text: 'Type it again' }), p2.box),
      msg, done, go1);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = ''; done.textContent = '';
      var a = p1.input.value, b = p2.input.value;
      if (a.length < 8) { msg.textContent = 'Use a password of at least 8 characters.'; return; }
      if (a !== b) { msg.textContent = 'The two passwords do not match. Tap Show to check them.'; return; }
      go1.disabled = true;
      Promise.resolve(Backend.changePassword(a)).then(function (res) {
        go1.disabled = false;
        if (res && res.error) { msg.textContent = friendlyAuthError(res.error); return; }
        p1.input.value = ''; p2.input.value = '';
        done.textContent = 'Your password has been changed. Use the new one next time you sign in.';
        toast('Password changed');
      }, function () { go1.disabled = false; msg.textContent = 'Could not reach the server. Try again.'; });
    });
    return h('div', { class: 'stack' },
      head('Password', function () { go('forms', null); }, 'Forms'),
      h('div', { class: 'card stack-s' },
        h('p', { class: 'hint', text: 'Signed in as ' + ((S.profile && S.profile.email) || 'you') + '.' }),
        form));
  }

  function screenPending() {
    return h('div', { class: 'card stack-s' },
      h('h2', { text: 'Waiting for approval' }),
      h('p', { text: 'Your account is created. An admin needs to approve it before you can see or add records. Ask them to open the People tab and approve ' + ((S.profile && S.profile.email) || 'your email') + '.' }),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', onclick: function () { Backend.getSession().then(function (s) { if (s) loadProfile(s); }); }, text: 'Check again' })));
  }

  function loadPeople() {
    if (S.peopleLoading) return;
    S.peopleLoading = true;
    Promise.resolve(Backend.listProfiles()).then(function (rows) {
      S.people = rows || []; S.peopleLoading = false; scheduleRender();
    }, function () { S.people = S.people || []; S.peopleLoading = false; scheduleRender(); });
    if (Backend.listAccess) {
      Promise.resolve(Backend.listAccess()).then(function (rows) {
        S.access = {};
        (rows || []).forEach(function (r) { (S.access[r.user_id] = S.access[r.user_id] || {})[r.school_id] = true; });
        S.accessErr = null; scheduleRender();
      }, function (e) { S.access = S.access || {}; S.accessErr = (e && e.code) || 'error'; scheduleRender(); });
    }
  }
  function setProfile(p, patch) {
    Promise.resolve(Backend.updateProfile(p.id, patch)).then(function () {
      toast('Updated'); S.peopleLoading = false; S.built = false; loadPeople();
    }, function (e) { toast('Could not update (' + ((e && e.code) || 'error') + ')'); });
  }
  /* Admin sets a temporary password for someone who is locked out. */
  function tempPassword() {
    var abc = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', out = '', i;
    var buf = new Uint8Array(32);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    else for (i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    for (i = 0; i < buf.length && out.length < 10; i++) if (buf[i] < 216) out += abc.charAt(buf[i] % 54);
    while (out.length < 10) out += abc.charAt(Math.floor(Math.random() * 54));
    return out;
  }
  function resetError(e) {
    var code = e && e.code, m = (e && e.message) || '';
    if (code === 'PGRST202' || /could not find the function/i.test(m)) return 'The database does not have the password-reset function yet. Run the latest schema.sql in the Supabase SQL Editor (README), then try again.';
    if (code === '42501') return 'Only admins can reset passwords.';
    if (code === '22023') return m;
    if (code === 'P0002') return 'That account no longer exists.';
    return 'Could not reset the password (' + (code || 'error') + ').';
  }
  function openReset(p) { S.resetFor = p.id; S.resetPw = tempPassword(); S.resetDone = null; S.built = false; render(); }
  function closeReset() { S.resetFor = null; S.resetPw = ''; S.resetDone = null; S.built = false; render(); }
  function resetPanel(p) {
    var who = p.name || p.email || 'this person';
    if (S.resetDone && S.resetDone.id === p.id) {
      return h('div', { class: 'banner', role: 'status' },
        h('p', { text: 'Password set for ' + who + '. Give them this temporary password:' }),
        h('p', { class: 'temp-pw', id: 'r-shown', text: S.resetDone.pw }),
        h('p', { class: 'hint', text: 'Ask them to sign in and tap Password at the top to choose their own. It is not shown again.' }),
        h('button', { type: 'button', class: 'btn', onclick: closeReset, text: 'Done' }));
    }
    if (S.resetFor !== p.id) return null;
    var input = h('input', { class: 'inp', id: 'r-pw', type: 'text', value: S.resetPw, autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' });
    input.addEventListener('input', function () { S.resetPw = input.value; });
    var err = h('p', { class: 'err', id: 'r-err', role: 'alert' });
    var go1 = h('button', { type: 'button', class: 'btn primary', id: 'r-go', text: 'Set password' });
    go1.addEventListener('click', function () {
      var pw = input.value;
      err.textContent = '';
      if (pw.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      if (pw !== pw.trim()) { err.textContent = 'Remove the spaces at the start or end.'; return; }
      go1.disabled = true;
      Promise.resolve(Backend.setPassword(p.id, pw)).then(function () {
        S.resetDone = { id: p.id, pw: pw }; S.resetFor = null; S.resetPw = ''; S.built = false; render();
      }, function (e) { go1.disabled = false; err.textContent = resetError(e); });
    });
    return h('div', { class: 'stack-s' },
      h('label', { class: 'lbl', for: 'r-pw', text: 'Temporary password for ' + who + ' (at least 8 characters)' }),
      input, err,
      h('div', { class: 'row' }, go1, h('button', { type: 'button', class: 'btn', onclick: closeReset, text: 'Cancel' })));
  }

  /* Admin: which schools does each coach work at? */
  function schoolName(id) { var r = getRec('school', id); return r ? (r.d.school_name || 'Unnamed school') : null; }
  function assignedIds(userId) { return Object.keys((S.access && S.access[userId]) || {}).filter(function (id) { return !!getRec('school', id); }); }
  function schoolsText(p) {
    if (p.role === 'admin') return 'Sees every school.';
    if (S.accessErr) return 'Schools could not be loaded (' + S.accessErr + '). Run the latest schema.sql in Supabase (README).';
    if (!S.access) return 'Loading schools…';
    var ids = assignedIds(p.id);
    if (!ids.length) return 'No schools assigned. They cannot see any school data yet.';
    var names = ids.map(schoolName).sort();
    return (ids.length === 1 ? '1 school: ' : ids.length + ' schools: ') + (ids.length <= 3 ? names.join(', ') : names.slice(0, 3).join(', ') + ' and ' + (ids.length - 3) + ' more') + '.';
  }
  function openSchools(p) { S.schoolsFor = p.id; S.resetFor = null; S.resetDone = null; S.built = false; render(); }
  function closeSchools() { S.schoolsFor = null; S.built = false; render(); }
  function accessError(e) {
    var code = e && e.code;
    if (code === '42P01' || code === 'PGRST205') return 'The database does not have school assignments yet. Run the latest schema.sql in the Supabase SQL Editor (README).';
    if (code === '42501') return 'Only admins can change this.';
    return 'Could not change this (' + (code || 'error') + ').';
  }
  function schoolsPanel(p, summary) {
    if (S.schoolsFor !== p.id) return null;
    var schools = list('school').map(function (sc) { return { id: sc.id, name: sc.d.school_name || 'Unnamed school' }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    var box = h('div', { class: 'stack-s' }, h('div', { class: 'lbl', text: 'Schools ' + (p.name || p.email || 'this person') + ' works at' }));
    var err = h('p', { class: 'err', role: 'alert' });
    if (!schools.length) box.append(h('p', { class: 'hint', text: 'No schools yet. Schools appear here once someone adds a school profile.' }));
    schools.forEach(function (sc) {
      var cb = h('input', { type: 'checkbox', id: 'sch-' + p.id + '-' + sc.id });
      cb.checked = !!(S.access && S.access[p.id] && S.access[p.id][sc.id]);
      cb.addEventListener('change', function () {
        var on = cb.checked;
        cb.disabled = true; err.textContent = '';
        Promise.resolve(Backend.setAccess(sc.id, p.id, on)).then(function () {
          S.access = S.access || {};
          var mine = S.access[p.id] = S.access[p.id] || {};
          if (on) mine[sc.id] = true; else delete mine[sc.id];
          cb.disabled = false;
          summary.textContent = schoolsText(p);
          toast(on ? 'Assigned to ' + sc.name : 'Removed from ' + sc.name);
        }, function (e) { cb.checked = !on; cb.disabled = false; err.textContent = accessError(e); });
      });
      box.append(h('label', { class: 'check', for: cb.id }, cb, h('span', { text: sc.name })));
    });
    box.append(err, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: closeSchools, text: 'Done' })));
    return box;
  }

  function screenPeople() {
    var box = h('div', { class: 'stack' });
    S.built = !!(S.resetFor || S.resetDone || S.schoolsFor); // keep a half-typed temporary password or open school list when live data refreshes
    box.append(h('div', { class: 'card stack-s' },
      h('h2', { text: 'People' }),
      h('p', { class: 'hint', text: 'New accounts wait here until you approve them. An approved coach sees only the schools you assign with Schools (plus any school they add themselves), and adds and edits their own records there. Admins see everything, edit anyone’s records and build forms.' })));
    if (!S.people) { loadPeople(); box.append(h('p', { class: 'hint', text: 'Loading…' })); return box; }
    var rows = S.people.slice().sort(function (a, b) {
      return (a.approved === b.approved ? 0 : a.approved ? 1 : -1) || String(a.name || a.email).localeCompare(String(b.name || b.email));
    });
    rows.forEach(function (p) {
      var me = p.id === S.myId;
      var status = p.approved ? (p.role === 'admin' ? 'Admin' : 'Coach') : 'Waiting for approval';
      var actions = h('div', { class: 'row' });
      if (!me && !p.approved) {
        actions.append(h('button', { type: 'button', class: 'btn primary', onclick: function () { setProfile(p, { approved: true }); }, text: 'Approve' }));
      } else if (!me) {
        actions.append(
          h('button', { type: 'button', class: 'btn', onclick: function () { setProfile(p, { role: p.role === 'admin' ? 'coach' : 'admin' }); }, text: p.role === 'admin' ? 'Make coach' : 'Make admin' }),
          h('button', { type: 'button', class: 'btn danger', onclick: function () { setProfile(p, { approved: false }); }, text: 'Remove access' }));
      }
      if (!me && p.approved && p.role !== 'admin') actions.append(h('button', { type: 'button', class: 'btn', onclick: function () { openSchools(p); }, text: 'Schools' }));
      if (!me) actions.append(h('button', { type: 'button', class: 'btn', onclick: function () { openReset(p); }, text: 'Reset password' }));
      var summary = p.approved && !me ? h('div', { class: 'rec-s', id: 'sch-sum-' + p.id, text: schoolsText(p) }) : null;
      box.append(h('div', { class: 'card stack-s' },
        h('div', {}, h('div', { class: 'rec-t', text: p.name || p.email || 'Unnamed' }), h('div', { class: 'rec-s', text: p.email || '' })),
        h('div', { class: 'fc-count', text: status + (me ? ' (you)' : '') }),
        summary,
        actions.childNodes.length ? actions : null,
        summary ? schoolsPanel(p, summary) : null,
        resetPanel(p)));
    });
    return box;
  }

  function signOut() { Promise.resolve(Backend.signOut()); }

  function head(title, onBack, backLabel) {
    return h('div', { class: 'screen-head' },
      h('button', { type: 'button', class: 'btn back', onclick: onBack, text: '← ' + backLabel }),
      h('h2', { text: title }));
  }

  /* ---------- home ---------- */
  function screenHome() {
    var box = h('div', { class: 'stack' });
    if (S.loaded.school && !list('school').length) {
      box.append(h('div', { class: 'banner', text: S.admin
        ? 'Start here. Add a school profile, then the students at that school. After that, coaches can file session reports and scores.'
        : 'You are not linked to a school yet. Add a school profile below and you will be linked to it automatically, or ask your admin to assign you to your school.' }));
    }
    [['once', 'Set up once'], ['every', 'Every session'], ['custom', 'Custom forms']].forEach(function (g) {
      var fs = allForms().filter(function (f) { return f.group === g[0]; });
      if (!fs.length) return;
      box.append(h('section', { class: 'stack-s' }, h('h2', { class: 'sec', text: g[1] }), fs.map(formCard)));
    });
    return box;
  }
  function formCard(f) {
    var n = list(f.col).length;
    var count = S.loaded[f.col] ? plural(n, 'record') : 'Loading';
    return h('div', { class: 'formcard' },
      h('button', { type: 'button', class: 'fc-main', onclick: function () { go('forms', { kind: 'list', formId: f.id }); } },
        h('span', { class: 'fc-title', text: f.title }),
        h('span', { class: 'fc-hint', text: f.hint }),
        h('span', { class: 'fc-count', text: count })),
      canWrite() ? h('button', { type: 'button', class: 'fc-add', 'aria-label': 'New ' + f.title.toLowerCase(), onclick: function () { openFill(f.id, null); }, text: '+' }) : null);
  }

  /* ---------- records list ---------- */
  function sortedRecs(form) {
    var arr = list(form.col).slice();
    if (form.sort === 'title') arr.sort(function (a, b) { return form.recTitle(a).localeCompare(form.recTitle(b)); });
    else if (form.sort === 'date') arr.sort(function (a, b) { return String(b.d.date || '').localeCompare(String(a.d.date || '')) || (b.at || 0) - (a.at || 0); });
    else arr.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return arr;
  }
  function screenList() {
    var form = formById(S.screen.formId);
    var box = h('div', { class: 'stack' });
    if (!form) { box.append(head('Form not found', function () { go('forms', null); }, 'All forms')); return box; }
    var recs = sortedRecs(form);
    loadNames(recs.map(function (r) { return r.by; }));
    box.append(head(form.title, function () { go('forms', null); }, 'All forms'));
    var actions = h('div', { class: 'row' });
    if (canWrite()) actions.append(h('button', { type: 'button', class: 'btn primary', onclick: function () { openFill(form.id, null); }, text: 'New record' }));
    if (recs.length) actions.append(h('button', { type: 'button', class: 'btn', onclick: function () { exportCsv(form); }, text: 'Download CSV' }));
    box.append(actions);
    var q = h('input', { class: 'inp', type: 'search', id: 'rec-filter', placeholder: 'Filter records', 'aria-label': 'Filter records', autocomplete: 'off' });
    q.value = S.filter;
    var items = h('div', { class: 'stack-s' });
    var count = h('p', { class: 'hint' });
    function fill() {
      var needle = S.filter.trim().toLowerCase();
      var shown = recs.filter(function (r) {
        if (!needle) return true;
        return (form.recTitle(r) + ' ' + form.recSub(r)).toLowerCase().indexOf(needle) !== -1;
      });
      count.textContent = !S.loaded[form.col] ? 'Loading records…' : (needle ? shown.length + ' of ' + plural(recs.length, 'record') : plural(recs.length, 'record'));
      items.replaceChildren();
      shown.forEach(function (r) {
        items.append(h('button', { type: 'button', class: 'rec', onclick: function () { go('forms', { kind: 'view', formId: form.id, recId: r.id }); } },
          h('span', { class: 'rec-t', text: form.recTitle(r) }),
          h('span', { class: 'rec-s', text: form.recSub(r) }),
          h('span', { class: 'rec-m', text: 'Added by ' + nameOf(r.by) + (r.at ? ' on ' + fmtDay(r.at) : '') })));
      });
      if (S.loaded[form.col] && !recs.length) items.append(h('p', { class: 'hint', text: 'Nothing here yet.' }));
    }
    q.addEventListener('input', function () { S.filter = q.value; fill(); });
    fill();
    box.append(q, count, items);
    return box;
  }

  /* ---------- one record ---------- */
  function screenView() {
    var form = formById(S.screen.formId);
    var box = h('div', { class: 'stack' });
    var back = function () { go('forms', { kind: 'list', formId: S.screen.formId }); };
    if (!form) { box.append(head('Form not found', function () { go('forms', null); }, 'All forms')); return box; }
    var rec = getRec(form.col, S.screen.recId);
    if (!rec) {
      box.append(head('Record', back, form.title));
      box.append(h('p', { class: 'hint', text: S.loaded[form.col] ? 'This record no longer exists.' : 'Loading…' }));
      return box;
    }
    loadNames([rec.by, rec.updBy]);
    box.append(head(form.recTitle(rec), back, form.title));
    var dl = h('dl', { class: 'card dl' });
    form.fields.forEach(function (f) {
      var v = rec.d[f.key];
      dl.append(h('dt', { text: f.label }));
      if (f.type === 'roster') {
        var entries = Object.keys(v || {});
        if (!entries.length) { dl.append(h('dd', { text: 'Not recorded' })); return; }
        var rows = entries.map(function (sid) { return [titleOf(f.of, sid), v[sid]]; })
          .sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });
        var tbl = h('table', { class: 'tbl' }, h('tbody', {}, rows.map(function (r) {
          return h('tr', {}, h('td', { text: r[0] }), h('td', { text: String(r[1]) }));
        })));
        dl.append(h('dd', {}, h('div', { class: 'tbl-wrap' }, tbl)));
      } else {
        dl.append(h('dd', { text: v == null || v === '' ? 'Not recorded' : fmtVal(f, v) }));
      }
    });
    box.append(dl);
    box.append(h('p', { class: 'hint', text: 'Added by ' + nameOf(rec.by) + (rec.at ? ' on ' + fmtDay(rec.at) : '') + (rec.upd ? '. Last edited by ' + nameOf(rec.updBy) + ' on ' + fmtDay(rec.upd) : '') + '.' }));
    if (canModify(rec)) {
      if (S.screen.confirm) {
        var warn = form.id === 'school' || form.id === 'student'
          ? 'Sessions and scores that refer to this record will show “Deleted record”. '
          : '';
        box.append(h('div', { class: 'card stack-s' },
          h('p', { text: warn + 'Delete this record? This cannot be undone.' }),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn danger', onclick: function () { removeRec(form, rec); }, text: 'Delete record' }),
            h('button', { type: 'button', class: 'btn', onclick: function () { S.screen.confirm = false; render(); }, text: 'Keep it' }))));
      } else {
        box.append(h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', onclick: function () { openFill(form.id, rec); }, text: 'Edit' }),
          h('button', { type: 'button', class: 'btn danger', onclick: function () { S.screen.confirm = true; render(); }, text: 'Delete' })));
      }
    }
    return box;
  }
  function removeRec(form, rec) {
    Promise.resolve(S.db.doc(form.col + '/' + rec.id).delete()).then(function () {
      toast('Record deleted');
      go('forms', { kind: 'list', formId: form.id });
    }, function (e) {
      toast('Could not delete (' + ((e && e.code) || 'error') + ')');
    });
  }

  /* ---------- fill a form ---------- */
  function defaults(form) {
    var v = {};
    form.fields.forEach(function (f) {
      if (f.type === 'roster') v[f.key] = {};
      else if (f.type === 'date' && f.today) v[f.key] = todayISO();
      else v[f.key] = '';
    });
    return v;
  }
  function openFill(formId, rec) {
    var f = formById(formId);
    if (!f) return;
    S.values = rec ? JSON.parse(JSON.stringify(rec.d || {})) : defaults(f);
    go('forms', { kind: 'fill', formId: formId, recId: rec ? rec.id : null });
  }

  function screenFill() {
    var form = formById(S.screen.formId);
    var box = h('div', { class: 'stack' });
    var cancel = function () {
      go('forms', S.screen.recId ? { kind: 'view', formId: S.screen.formId, recId: S.screen.recId } : { kind: 'list', formId: S.screen.formId });
    };
    if (!form) { box.append(head('Form not found', function () { go('forms', null); }, 'All forms')); return box; }
    var waiting = (form.needs || []).concat([form.col]).some(function (c) { return !S.loaded[c]; });
    if (waiting) { box.append(head(form.title, cancel, 'Cancel'), h('p', { class: 'hint', text: 'Loading shared data…' })); return box; }
    if (S.screen.recId && !getRec(form.col, S.screen.recId)) {
      box.append(head(form.title, cancel, 'Back'), h('p', { class: 'hint', text: 'This record no longer exists.' }));
      return box;
    }
    box.append(head((S.screen.recId ? 'Edit ' : 'New ') + form.title.toLowerCase(), cancel, 'Cancel'));
    var fm = h('form', { class: 'card', novalidate: true });
    fm.addEventListener('submit', function (e) { e.preventDefault(); save(form, false); });
    form.fields.forEach(function (f) { fm.append(buildField(form, f)); });
    fm.append(h('p', { class: 'err', id: 'form-err', role: 'alert' }));
    var actions = h('div', { class: 'row' },
      h('button', { type: 'submit', class: 'btn primary', id: 'save-btn', text: S.screen.recId ? 'Save changes' : 'Save record' }));
    if (form.repeat && !S.screen.recId) {
      actions.append(h('button', { type: 'button', class: 'btn', id: 'save-more', onclick: function () { save(form, true); }, text: 'Save and add another' }));
    }
    fm.append(actions);
    box.append(fm);
    S.built = true;
    return box;
  }

  function clearErr(key) {
    var w = document.querySelector('[data-key="' + key + '"]');
    if (w) { w.classList.remove('bad'); var e = w.querySelector('.err'); if (e) e.textContent = ''; }
  }

  function buildField(form, f) {
    var id = 'f-' + f.key;
    var wrap = h('div', { class: 'field', 'data-key': f.key });
    wrap.append(h('label', { for: id, class: 'lbl' }, f.label, f.required ? h('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : null));
    var v = S.values[f.key];
    var ctl;
    if (f.type === 'textarea') {
      ctl = h('textarea', { id: id, rows: '3' });
      ctl.value = v == null ? '' : v;
      ctl.addEventListener('input', function () { S.values[f.key] = ctl.value; clearErr(f.key); });
    } else if (f.type === 'select') {
      ctl = h('select', { id: id }, h('option', { value: '', text: 'Choose…' }),
        (f.options || []).map(function (o) { return h('option', { value: o, text: o }); }));
      if (v && (f.options || []).indexOf(v) === -1) ctl.append(h('option', { value: v, text: v }));
      ctl.value = v == null ? '' : v;
      ctl.addEventListener('change', function () { S.values[f.key] = ctl.value; clearErr(f.key); });
    } else if (f.type === 'lookup') {
      var opts = list(f.of).map(function (r) { return [r.id, titleOf(f.of, r.id)]; })
        .sort(function (a, b) { return a[1].localeCompare(b[1]); });
      ctl = h('select', { id: id }, h('option', { value: '', text: opts.length ? 'Choose…' : 'None registered yet' }),
        opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      ctl.value = v == null ? '' : v;
      S.values[f.key] = ctl.value;
      ctl.addEventListener('change', function () {
        S.values[f.key] = ctl.value; clearErr(f.key);
        form.fields.forEach(function (r) {
          if (r.type === 'roster' && r.by === f.key) {
            S.values[r.key] = {};
            renderRoster(r, document.getElementById('roster-' + r.key));
          }
        });
      });
      if (!opts.length) wrap.append(h('p', { class: 'hint', text: 'Add a ' + f.of + ' profile first' + (f.of === 'school' && !S.admin ? ', or ask your admin to assign you to your school.' : '.') }));
    } else if (f.type === 'roster') {
      ctl = h('div', { id: 'roster-' + f.key });
      wrap.append(ctl);
      renderRoster(f, ctl);
      wrap.append(h('p', { class: 'err', role: 'alert' }));
      return wrap;
    } else {
      var t = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text';
      var props = { id: id, type: t, class: 'inp', autocomplete: 'off' };
      if (t === 'number') { props.inputmode = 'decimal'; props.step = 'any'; if (f.min != null) props.min = String(f.min); }
      ctl = h('input', props);
      ctl.value = v == null ? '' : v;
      ctl.addEventListener('input', function () {
        S.values[f.key] = t === 'number' ? (ctl.value === '' ? '' : Number(ctl.value)) : ctl.value;
        clearErr(f.key);
      });
    }
    wrap.append(ctl, h('p', { class: 'err', role: 'alert' }));
    return wrap;
  }

  function renderRoster(f, box) {
    box.replaceChildren();
    var school = S.values[f.by];
    if (!school) { box.append(h('p', { class: 'hint', text: 'Choose a school to list its students.' })); return; }
    var studs = list(f.of).filter(function (s) { return s.d.school === school; })
      .sort(function (a, b) { return BUILTIN[1].recTitle(a).localeCompare(BUILTIN[1].recTitle(b)); });
    if (!studs.length) {
      box.append(h('p', { class: 'hint', text: 'No students are registered for this school yet. Add their student profiles first, or save this record without them.' }));
      return;
    }
    var cur = S.values[f.key] = S.values[f.key] || {};
    var isNew = !S.screen.recId;
    var sum = h('p', { class: 'roster-sum' });
    function update() {
      if (f.mode === 'select') {
        var counts = {}, unmarked = 0;
        f.options.forEach(function (o) { counts[o] = 0; });
        studs.forEach(function (s) { var x = cur[s.id]; if (x in counts) counts[x]++; else unmarked++; });
        var parts = f.options.map(function (o) { return o + ' ' + counts[o]; });
        if (unmarked) parts.push('Not marked ' + unmarked);
        sum.textContent = parts.join(' · ');
      } else {
        var n = studs.filter(function (s) { return cur[s.id] != null && cur[s.id] !== ''; }).length;
        sum.textContent = n + ' of ' + studs.length + ' scores entered';
      }
    }
    studs.forEach(function (s) {
      var nm = BUILTIN[1].recTitle(s);
      if (f.mode === 'select') {
        if (cur[s.id] === undefined) cur[s.id] = isNew ? (f.def || '') : '';
        var seg = h('div', { class: 'seg-row', role: 'group', 'aria-label': f.label + ' for ' + nm });
        f.options.forEach(function (o) {
          seg.append(h('button', {
            type: 'button', class: 'seg', 'data-v': o, 'aria-pressed': String(cur[s.id] === o), text: o,
            onclick: function () {
              cur[s.id] = o;
              seg.querySelectorAll('.seg').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === o)); });
              update(); clearErr(f.key);
            }
          }));
        });
        box.append(h('div', { class: 'rrow' }, h('span', { class: 'rname', text: nm }), seg));
      } else {
        var inp = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', class: 'inp score', placeholder: '–', 'aria-label': 'Score for ' + nm });
        if (cur[s.id] != null && cur[s.id] !== '') inp.value = cur[s.id];
        inp.addEventListener('input', function () { cur[s.id] = inp.value === '' ? null : Number(inp.value); update(); clearErr(f.key); });
        box.append(h('div', { class: 'rrow' }, h('span', { class: 'rname', text: nm }), inp));
      }
    });
    if (f.mode === 'number') box.append(h('p', { class: 'hint', text: 'Leave a score blank for a student who was absent.' }));
    box.append(sum);
    update();
  }

  function validate(form) {
    var errs = {};
    form.fields.forEach(function (f) {
      var v = S.values[f.key];
      if (f.type === 'roster') {
        var school = S.values[f.by];
        var studs = list(f.of).filter(function (s) { return s.d.school === school; });
        var cur = v || {};
        if (f.mode === 'number') {
          var max = Number(S.values[f.maxKey]);
          Object.keys(cur).forEach(function (sid) {
            var x = cur[sid];
            if (errs[f.key] || x == null || x === '') return;
            if (!Number.isFinite(Number(x)) || Number(x) < 0) errs[f.key] = 'Scores must be zero or higher.';
            else if (max > 0 && Number(x) > max) errs[f.key] = 'A score is higher than the maximum score of ' + max + '.';
          });
        } else if (studs.some(function (s) { return f.options.indexOf(cur[s.id]) === -1; })) {
          errs[f.key] = 'Mark every student before saving.';
        }
        return;
      }
      var empty = v === '' || v == null || (typeof v === 'string' && !v.trim());
      if (f.required && empty) { errs[f.key] = 'This is required.'; return; }
      if (f.type === 'number' && !empty) {
        if (!Number.isFinite(Number(v))) errs[f.key] = 'Enter a number.';
        else if (f.min != null && Number(v) < f.min) errs[f.key] = 'Must be ' + f.min + ' or more.';
      }
    });
    return errs;
  }
  function collect(form) {
    var d = {};
    form.fields.forEach(function (f) {
      var v = S.values[f.key];
      if (f.type === 'roster') {
        var out = {};
        Object.keys(v || {}).forEach(function (k) { var x = v[k]; if (x === '' || x == null) return; out[k] = x; });
        if (Object.keys(out).length) d[f.key] = out;
        return;
      }
      if (typeof v === 'string') v = v.trim();
      if (v === '' || v == null) return;
      d[f.key] = f.type === 'number' ? Number(v) : v;
    });
    return d;
  }
  function showErrors(errs) {
    var first = null;
    Object.keys(errs).forEach(function (k) {
      var w = document.querySelector('[data-key="' + k + '"]');
      if (!w) return;
      w.classList.add('bad');
      var e = w.querySelector('.err'); if (e) e.textContent = errs[k];
      if (!first) first = w;
    });
    var g = $('#form-err');
    if (g) g.textContent = 'Fix the highlighted fields and save again.';
    if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center' });
  }
  function setBusy(on) {
    ['save-btn', 'save-more'].forEach(function (i) {
      var b = document.getElementById(i);
      if (b) b.disabled = on;
    });
    var s = document.getElementById('save-btn');
    if (s) s.textContent = on ? 'Saving…' : (S.screen && S.screen.recId ? 'Save changes' : 'Save record');
  }
  function save(form, another) {
    if (S.saving) return;
    var g = $('#form-err'); if (g) g.textContent = '';
    var errs = validate(form);
    if (Object.keys(errs).length) { showErrors(errs); return; }
    var recId = S.screen.recId;
    var existing = recId ? getRec(form.col, recId) : null;
    var d = collect(form);
    var doc = existing
      ? { d: d, by: existing.by == null ? null : existing.by, at: existing.at || Date.now(), upd: Date.now(), updBy: S.myId }
      : { d: d, by: S.myId, at: Date.now() };
    S.saving = true; setBusy(true);
    var col = S.db.collection(form.col);
    var ref = recId ? col.doc(recId) : col.doc();
    var slow = setTimeout(function () { var x = $('#form-err'); if (x) x.textContent = 'Still saving. Keep this page open until it finishes.'; }, 15000);
    Promise.resolve(ref.set(doc)).then(function () {
      clearTimeout(slow); S.saving = false;
      toast('Saved');
      if (another) {
        var keep = S.values.school;
        S.values = defaults(form);
        if (keep) S.values.school = keep;
        go('forms', { kind: 'fill', formId: form.id, recId: null });
      } else if (recId) {
        go('forms', { kind: 'view', formId: form.id, recId: recId });
      } else {
        go('forms', { kind: 'list', formId: form.id });
      }
    }, function (e) {
      clearTimeout(slow); S.saving = false; setBusy(false);
      var x = $('#form-err');
      if (x) x.textContent = 'Could not save (' + ((e && e.code) || 'error') + '). Your entries are still here. Check your connection and try again.';
    });
  }

  /* ---------- CSV export ---------- */
  function csvCell(v) {
    if (v == null) return '';
    var s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^\+[\d\s()-]+$/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function buildCsv(form) {
    var plain = form.fields.filter(function (f) { return f.type !== 'roster'; });
    var ros = form.fields.filter(function (f) { return f.type === 'roster'; })[0];
    var head = ['record_id', 'recorded_by', 'recorded_by_id', 'recorded_at'];
    plain.forEach(function (f) {
      var name = form.custom ? f.label : f.key;
      head.push(name);
      if (f.type === 'lookup') head.push(name + '_id');
    });
    if (ros) head.push('student_id', 'student_name', ros.column);
    var rows = [head];
    sortedRecs(form).forEach(function (r) {
      var base = [r.id, plainName(r.by), r.by || '', r.at ? new Date(r.at).toISOString() : ''];
      plain.forEach(function (f) {
        var v = r.d[f.key];
        if (f.type === 'lookup') base.push(v ? titleOf(f.of, v) : '', v || '');
        else base.push(v == null ? '' : v);
      });
      if (ros) {
        var entries = Object.keys(r.d[ros.key] || {});
        if (!entries.length) rows.push(base.concat(['', '', '']));
        entries.forEach(function (sid) {
          rows.push(base.concat([sid, titleOf(ros.of, sid), r.d[ros.key][sid]]));
        });
      } else rows.push(base);
    });
    return '﻿' + rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
  }
  function downloadText(filename, text) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportCsv(form) {
    var recs = list(form.col);
    var ids = recs.map(function (r) { return r.by; }).filter(Boolean);
    var need = Array.from(new Set(ids)).filter(function (i) { return !(i in S.names) || S.names[i] === ''; });
    var ready = !need.length ? Promise.resolve() : Promise.resolve(Backend.profiles(need)).then(function (ps) {
      need.forEach(function (i) { S.names[i] = (ps && ps[i] && ps[i].name) || ''; });
    }, function () {});
    ready.then(function () {
      downloadText(form.id + '-' + todayISO() + '.csv', buildCsv(form));
      toast('CSV downloaded');
    }, function () { toast('Could not create the file'); });
  }

  /* ---------- overview ---------- */
  function analyse(only) {
    var rows = new Map();
    var scoped = function (rec) { return !only || rec.d.school === only; };
    var students = list('student').filter(scoped), sessions = list('session').filter(scoped), assessments = list('assessment').filter(scoped);
    list('school').filter(function (s) { return !only || s.id === only; }).forEach(function (s) {
      rows.set(s.id, { id: s.id, name: s.d.school_name || 'Unnamed school', students: 0, sessions: 0, hours: 0, att: 0, present: 0, pre: 0, preMax: 0, post: 0, postMax: 0 });
    });
    var t = { students: students.length, sessions: sessions.length, hours: 0, att: 0, present: 0, pre: 0, preMax: 0, post: 0, postMax: 0 };
    var coaches = new Map();
    students.forEach(function (s) { var r = rows.get(s.d.school); if (r) r.students++; });
    sessions.forEach(function (se) {
      var r = rows.get(se.d.school);
      var hrs = (Number(se.d.duration_minutes) || 0) / 60;
      t.hours += hrs;
      var key = se.by || '';
      var c = coaches.get(key) || { id: key, sessions: 0, hours: 0, last: '' };
      c.sessions++; c.hours += hrs;
      if ((se.d.date || '') > c.last) c.last = se.d.date || '';
      coaches.set(key, c);
      if (r) { r.sessions++; r.hours += hrs; }
      Object.keys(se.d.attendance || {}).forEach(function (sid) {
        var present = se.d.attendance[sid] === 'Present';
        t.att++; if (present) t.present++;
        if (r) { r.att++; if (present) r.present++; }
      });
    });
    assessments.forEach(function (a) {
      var k = a.d.assessment_type === 'Pre' ? 'pre' : a.d.assessment_type === 'Post' ? 'post' : null;
      if (!k) return;
      var r = rows.get(a.d.school);
      var max = Number(a.d.max_score) || 0;
      Object.keys(a.d.scores || {}).forEach(function (sid) {
        var v = a.d.scores[sid];
        if (v == null || v === '') return;
        var n = Number(v);
        if (!Number.isFinite(n)) return;
        t[k] += n; t[k + 'Max'] += max;
        if (r) { r[k] += n; r[k + 'Max'] += max; }
      });
    });
    return {
      rows: Array.from(rows.values()).sort(function (a, b) { return a.name.localeCompare(b.name); }),
      total: t,
      coaches: Array.from(coaches.values()).sort(function (a, b) { return b.sessions - a.sessions; })
    };
  }
  function change(r) {
    var a = rate(r.pre, r.preMax), b = rate(r.post, r.postMax);
    return a == null || b == null ? null : b - a;
  }
  function tile(label, value) {
    return h('div', { class: 'tile' }, h('div', { class: 'tile-l', text: label }), h('div', { class: 'tile-v', text: value }));
  }
  function table(headers, rows) {
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, headers.map(function (x) { return h('th', { text: x }); }))),
      h('tbody', {}, rows.map(function (r) { return h('tr', {}, r.map(function (c) { return h('td', { text: c }); })); }))));
  }
  function screenOverview() {
    if (S.ovSchool && !getRec('school', S.ovSchool)) S.ovSchool = '';
    var a = analyse(S.ovSchool || null), t = a.total;
    loadNames(a.coaches.map(function (c) { return c.id; }));
    var box = h('div', { class: 'stack' });
    var mine = list('school').map(function (sc) { return [sc.id, sc.d.school_name || 'Unnamed school']; })
      .sort(function (x, y) { return x[1].localeCompare(y[1]); });
    if (S.admin) {
      box.append(h('p', { class: 'hint', text: 'Every school, across all coaches.' }));
    } else if (!mine.length) {
      box.append(h('div', { class: 'banner', text: 'You are not linked to a school yet. Add a school profile under Forms and you will be linked to it, or ask your admin to assign you to your school.' }));
    } else {
      box.append(h('p', { class: 'hint', text: 'Only the ' + (mine.length === 1 ? 'school you work at' : 'schools you work at') + ' are shown: ' + mine.map(function (m) { return m[1]; }).join(', ') + '.' }));
    }
    if (mine.length > 1) {
      var pick = h('select', { id: 'ov-school', 'aria-label': 'School' },
        h('option', { value: '', text: S.admin ? 'All schools' : 'All my schools' }),
        mine.map(function (m) { return h('option', { value: m[0], text: m[1] }); }));
      pick.value = S.ovSchool || '';
      pick.addEventListener('change', function () { S.ovSchool = pick.value; render(); });
      box.append(h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'ov-school', text: 'Show' }), pick));
    }
    box.append(h('div', { class: 'tiles' },
      tile('Schools', String(a.rows.length)),
      tile('Students', String(t.students)),
      tile('Sessions', String(t.sessions)),
      tile('Hours delivered', t.hours.toFixed(1)),
      tile('Attendance rate', pct(rate(t.present, t.att))),
      tile('Average pre score', pct(rate(t.pre, t.preMax))),
      tile('Average post score', pct(rate(t.post, t.postMax))),
      tile('Improvement', pts(change(t)))));
    box.append(h('section', { class: 'card stack-s' }, h('h2', { text: 'By school' }),
      a.rows.length
        ? table(['School', 'Students', 'Sessions', 'Attend.', 'Pre', 'Post', 'Change'],
          a.rows.map(function (r) { return [r.name, String(r.students), String(r.sessions), pct(rate(r.present, r.att)), pct(rate(r.pre, r.preMax)), pct(rate(r.post, r.postMax)), pts(change(r))]; }))
        : h('p', { class: 'hint', text: 'No schools yet.' })));
    box.append(h('section', { class: 'card stack-s' }, h('h2', { text: 'By coach' }),
      a.coaches.length
        ? table(['Coach', 'Sessions', 'Hours', 'Last session'],
          a.coaches.map(function (c) { return [nameOf(c.id), String(c.sessions), c.hours.toFixed(1), c.last || '–']; }))
        : h('p', { class: 'hint', text: 'No sessions yet.' })));
    box.append(h('p', { class: 'hint', text: 'Scores are marks scored divided by marks available, so classes with a higher maximum count for more. Attendance counts every student marked in a session report.' }));
    return box;
  }

  /* ---------- form builder (editors) ---------- */
  var TYPES = [['text', 'Short text'], ['textarea', 'Long text'], ['number', 'Number'], ['date', 'Date'], ['select', 'Choice list'], ['yesno', 'Yes or no']];
  function screenBuild() {
    var box = h('div', { class: 'stack' });
    box.append(h('div', { class: 'card' },
      h('h2', { text: 'Build a form' }),
      h('p', { class: 'hint', text: 'Add a form for anything the built-in ones do not cover. It appears on the Forms screen for every coach.' }),
      h('div', { class: 'field', style: 'margin-top:14px' },
        h('label', { class: 'lbl', for: 'b-title', text: 'Form name' }),
        (function () {
          var i = h('input', { class: 'inp', id: 'b-title', type: 'text', autocomplete: 'off', placeholder: 'For example, Parent meeting' });
          i.value = B.title;
          i.addEventListener('input', function () { B.title = i.value; });
          return i;
        })()),
      (function () {
        var wrap = h('div', {});
        B.fields.forEach(function (f, idx) {
          var label = h('input', { class: 'inp', type: 'text', id: 'b-label-' + idx, autocomplete: 'off', placeholder: 'Question or field name' });
          label.value = f.label;
          label.addEventListener('input', function () { f.label = label.value; });
          var type = h('select', { id: 'b-type-' + idx }, TYPES.map(function (t) { return h('option', { value: t[0], text: t[1] }); }));
          type.value = f.type;
          type.addEventListener('change', function () { f.type = type.value; render(); });
          var q = h('div', { class: 'qcard' },
            h('label', { class: 'lbl', for: 'b-label-' + idx, text: 'Question ' + (idx + 1) }), label, type);
          if (f.type === 'select') {
            var o = h('input', { class: 'inp', type: 'text', id: 'b-opts-' + idx, autocomplete: 'off', placeholder: 'Choices, separated by commas' });
            o.value = f.options;
            o.addEventListener('input', function () { f.options = o.value; });
            q.append(o);
          }
          var req = h('input', { type: 'checkbox', id: 'b-req-' + idx });
          req.checked = !!f.required;
          req.addEventListener('change', function () { f.required = req.checked; });
          q.append(h('label', { class: 'checkrow', for: 'b-req-' + idx }, req, 'Required'));
          if (B.fields.length > 1) q.append(h('button', { type: 'button', class: 'btn danger', onclick: function () { B.fields.splice(idx, 1); render(); }, text: 'Remove question' }));
          wrap.append(q);
        });
        return wrap;
      })(),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: function () { if (B.fields.length < 40) { B.fields.push({ label: '', type: 'text', options: '', required: false }); render(); } }, text: 'Add a question' }),
        h('button', { type: 'button', class: 'btn primary', onclick: saveBuilder, text: 'Create form' })),
      h('p', { class: 'err', id: 'b-err', role: 'alert', text: B.err })));
    if (S.custom.length) {
      box.append(h('section', { class: 'card stack-s' }, h('h2', { text: 'Your forms' }),
        S.custom.map(function (c) {
          var row = h('div', { class: 'stack-s' },
            h('div', { class: 'row' },
              h('span', { class: 'rname', text: c.title + ' (' + plural((c.fields || []).length, 'question') + ')' }),
              B.delDef === c.id ? null : h('button', { type: 'button', class: 'btn danger', onclick: function () { B.delDef = c.id; render(); }, text: 'Delete' })));
          if (B.delDef === c.id) {
            row.append(h('p', { class: 'hint', text: 'This removes the form from the list. Records already collected stay in the database but can no longer be opened here.' }),
              h('div', { class: 'row' },
                h('button', { type: 'button', class: 'btn danger', onclick: function () { deleteDef(c); }, text: 'Delete form' }),
                h('button', { type: 'button', class: 'btn', onclick: function () { B.delDef = null; render(); }, text: 'Keep it' })));
          }
          return row;
        })));
    }
    return box;
  }
  function saveBuilder() {
    var title = B.title.trim(), errs = [], fields = [];
    if (!title) errs.push('Give the form a name.');
    B.fields.forEach(function (f, i) {
      var label = f.label.trim();
      if (!label) { errs.push('Question ' + (i + 1) + ' needs a label.'); return; }
      var o = { key: 'q' + (i + 1), label: label, type: f.type, required: !!f.required };
      if (f.type === 'select') {
        var opts = f.options.split(/[\n,]/).map(function (x) { return x.trim(); }).filter(Boolean);
        if (opts.length < 2) { errs.push('Question ' + (i + 1) + ' needs at least two choices, separated by commas.'); return; }
        o.options = opts;
      }
      fields.push(o);
    });
    if (errs.length) { B.err = errs.join(' '); var e = $('#b-err'); if (e) e.textContent = B.err; return; }
    Promise.resolve(S.db.collection('formdefs').add({ title: title, fields: fields, by: S.myId, at: Date.now() })).then(function () {
      B.title = ''; B.fields = [{ label: '', type: 'text', options: '', required: false }]; B.err = '';
      toast('Form created');
      go('forms', null);
    }, function (err) {
      B.err = 'Could not create the form (' + ((err && err.code) || 'error') + '). Only editors can create forms.';
      var e2 = $('#b-err'); if (e2) e2.textContent = B.err;
    });
  }
  function deleteDef(c) {
    Promise.resolve(S.db.doc('formdefs/' + c.id).delete()).then(function () {
      B.delDef = null; toast('Form deleted'); render();
    }, function (e) { toast('Could not delete (' + ((e && e.code) || 'error') + ')'); });
  }

  /* ---------- start ---------- */
  var DATA_COLS = ['school', 'student', 'session', 'assessment', 'formdefs'];
  function startData() {
    DATA_COLS.forEach(sub);
    clearTimeout(S.slowTimer);
    S.slowTimer = setTimeout(function () {
      checkSlow();
      if (!DATA_COLS.every(function (c) { return S.loaded[c]; })) { S.slow = true; scheduleRender(); }
    }, 10000);
  }
  function resetState() {
    Object.keys(S.subs).forEach(function (k) { try { S.subs[k](); } catch (e) { /* ignore */ } });
    clearTimeout(S.slowTimer);
    S.db = null; S.profile = null; S.myId = null; S.meName = ''; S.admin = false; S.canWrite = null; S.loadingFor = null;
    S.tab = 'forms'; S.screen = null; S.values = {}; S.built = false; S.saving = false;
    S.data = {}; S.idx = {}; S.loaded = {}; S.subs = {}; S.subErr = {}; S.names = {}; S.custom = []; S.formsCache = null;
    S.filter = ''; S.slow = false; S.people = null; S.peopleLoading = false;
    S.resetFor = null; S.resetPw = ''; S.resetDone = null; S.schoolsFor = null; S.access = null; S.accessErr = null; S.ovSchool = '';
  }
  function loadProfile(session) {
    S.auth = 'loading'; S.loadingFor = session.user.id; render();
    Promise.resolve(Backend.me(session)).then(function (p) {
      if (S.loadingFor !== session.user.id) return;
      if (!p) { resetState(); S.authMsg = 'Your profile was not found. Run schema.sql in Supabase, then sign in again.'; S.auth = 'out'; render(); return; }
      S.profile = p; S.myId = p.id; S.meName = p.name || '';
      S.admin = p.role === 'admin' && !!p.approved;
      S.canWrite = !!p.approved;
      if (!p.approved) { S.auth = 'pending'; render(); return; }
      S.auth = 'in'; S.db = Backend;
      startData();
      if (S.admin) loadPeople();
      render();
    }, function (e) {
      resetState();
      S.authMsg = 'Could not load your profile (' + ((e && e.code) || 'error') + '). Check your connection and sign in again.';
      S.auth = 'out'; render();
    });
  }
  function handleSession(session) {
    if (!session || !session.user) { resetState(); S.auth = 'out'; render(); return; }
    if ((S.auth === 'in' || S.auth === 'pending') && S.myId === session.user.id) return;
    if (S.auth === 'loading' && S.loadingFor === session.user.id) return;
    S.authMsg = '';
    loadProfile(session);
  }
  render();
  if (Backend.configured) Backend.onAuth(handleSession);
})();
