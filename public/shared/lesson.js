/* PVA Academy — Understanding Client Work & Instructions
   Lesson page behaviour: progress bar, lesson pills, activities,
   Quick Check, Mark complete / Mark as not done, notes download.
   Requires shared/progress.js (window.PVACW) and shared/quick-checks.js. */
(function () {
  'use strict';
  var P = window.PVACW;
  var body = document.body;
  var LESSON_ID = body.getAttribute('data-lesson-id');
  var ROOT = body.getAttribute('data-root') || '../';
  var lesson = P.LESSONS.filter(function (l) { return l.id === LESSON_ID; })[0];

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- header UI ---------- */
  function renderChrome() {
    P.renderProgressBar(LESSON_ID);
    P.renderLessonNav(LESSON_ID, ROOT);
    var card = $('#lessonCard');
    var done = P.isComplete(LESSON_ID);
    if (card) card.classList.toggle('is-done', done);
    var mark = $('#markBtn'), undo = $('#notDoneBtn'), panel = $('#donePanel');
    if (mark) { mark.disabled = done; mark.textContent = done ? 'Lesson ' + lesson.num + ' complete ✓' : 'Mark Lesson ' + lesson.num + ' complete'; }
    if (undo) undo.disabled = !done;
    if (panel) panel.classList.toggle('hidden', !done);
  }

  /* ---------- graded-style items (activity MCQ + Quick Check) ---------- */
  function lockItem(item, picked) {
    var correct = parseInt(item.getAttribute('data-correct'), 10);
    var ok = picked === correct;
    $all('.choice', item).forEach(function (lab) {
      var inp = $('input', lab);
      var v = parseInt(inp.value, 10);
      inp.checked = v === picked;
      inp.disabled = true;
      lab.classList.add('locked');
      lab.classList.toggle('correct', v === correct);
      lab.classList.toggle('wrong', v === picked && !ok);
    });
    var fb = $('.feedback', item);
    if (fb) {
      var good = item.getAttribute('data-good') || '';
      var tryMsg = item.getAttribute('data-try') || '';
      // Part 5: per-option feedback (data-fb on the picked option) replaces the item-level text
      var pickedLab = $all('.choice', item).filter(function (lab) { return parseInt($('input', lab).value, 10) === picked; })[0];
      var optFb = pickedLab && pickedLab.getAttribute('data-fb');
      if (optFb) { good = optFb; tryMsg = optFb; }
      fb.innerHTML = ok ? '<strong>That matches the lesson.</strong> ' + esc(good)
                        : '<strong>Not quite.</strong> ' + esc(tryMsg || good);
      fb.className = 'feedback show ' + (ok ? 'good' : 'try');
    }
    return ok;
  }
  function unlockItem(item) {
    $all('.choice', item).forEach(function (lab) {
      var inp = $('input', lab);
      inp.checked = false; inp.disabled = false;
      lab.classList.remove('locked', 'correct', 'wrong');
    });
    var fb = $('.feedback', item); if (fb) { fb.className = 'feedback'; fb.innerHTML = ''; }
  }
  function wireGraded(item, onChange) {
    var key = item.getAttribute('data-key');
    var saved = P.getDraft(LESSON_ID, key);
    if (typeof saved === 'number') lockItem(item, saved);
    $all('input', item).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var v = parseInt(inp.value, 10);
        P.setDraft(LESSON_ID, key, v);
        lockItem(item, v);
        if (onChange) onChange();
      });
    });
  }

  /* ---------- seeded shuffle so option order is stable per question ---------- */
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }
  function shuffledOrder(n, seed) {
    var order = []; for (var i = 0; i < n; i++) order.push(i);
    var rnd = seeded(seed);
    for (var j = n - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var t = order[j]; order[j] = order[k]; order[k] = t; }
    return order;
  }

  /* ---------- Quick Check ---------- */
  function renderQuickCheck() {
    var box = $('#quickCheck');
    if (!box) return;
    var data = (window.CW_QUICK_CHECKS || {})[LESSON_ID];
    if (!data || !data.questions || !data.questions.length) { box.classList.add('hidden'); return; }
    var html = '<div class="section-label">Lesson ' + lesson.num + '</div><h2>Quick Check</h2>' +
      '<p class="qc-meta">' + esc(data.purpose) + '</p>' +
      '<p class="qc-meta"><strong>' + data.questions.length + ' questions · Not pass/fail.</strong> You can mark the lesson complete whether or not you answer these. Your answers are saved in this browser.</p>';
    data.questions.forEach(function (q, qi) {
      var order = shuffledOrder(q.options.length, LESSON_ID + '|' + q.id);
      html += '<div class="act-item qc-item" data-key="qc:' + esc(q.id) + '" data-correct="' + q.answer + '" data-good="' + esc(q.explain) + '">' +
        '<p class="act-q"><span class="q-num">Question ' + (qi + 1) + ' of ' + data.questions.length + '</span><br>' + esc(q.q) + '</p>' +
        '<div class="choice-group" role="radiogroup">';
      order.forEach(function (oi) {
        html += '<label class="choice"><input type="radio" name="qc-' + esc(q.id) + '" value="' + oi + '"><span>' + esc(q.options[oi]) + '</span></label>';
      });
      html += '</div><div class="feedback" aria-live="polite"></div></div>';
    });
    html += '<p class="qc-summary" id="qcSummary" aria-live="polite"></p>' +
      '<div class="hero-actions" style="margin:0 0 14px"><button class="btn subtle small-btn" type="button" id="qcReset">Try the Quick Check again</button></div>';
    box.innerHTML = html;
    var items = $all('.qc-item', box);
    function summary() {
      var answered = 0, matched = 0;
      items.forEach(function (it) {
        var v = P.getDraft(LESSON_ID, it.getAttribute('data-key'));
        if (typeof v === 'number') { answered++; if (v === parseInt(it.getAttribute('data-correct'), 10)) matched++; }
      });
      var s = $('#qcSummary');
      s.textContent = answered === 0 ? '' : answered < items.length
        ? 'Answered ' + answered + ' of ' + items.length + '.'
        : 'Done: ' + matched + ' of ' + items.length + ' matched the lesson. If any didn’t, the explanation points you to the part worth re-reading.';
    }
    items.forEach(function (it) { wireGraded(it, summary); });
    summary();
    $('#qcReset').addEventListener('click', function () {
      P.clearDrafts(LESSON_ID, 'qc:');
      items.forEach(unlockItem);
      summary();
    });
  }

  /* ---------- activities ---------- */
  function wireActivities() {
    // graded activity items (scenario Yes/No, follow-the-task MCQ)
    // two-step items: step 2 appears once its step 1 has an answer (saved or just picked)
    function syncSteps() {
      $all('.act-step2').forEach(function (s2) {
        var first = P.getDraft(LESSON_ID, s2.getAttribute('data-after'));
        s2.classList.toggle('hidden', typeof first !== 'number');
      });
    }
    $all('.act-graded').forEach(function (it) { wireGraded(it, syncSteps); });
    syncSteps();
    $all('[data-reset-activity]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.closest('.activity');
        $all('.act-graded', act).forEach(function (it) {
          P.clearDrafts(LESSON_ID, it.getAttribute('data-key'));
          unlockItem(it);
        });
        syncSteps();
      });
    });
    // self-assessment radios (no right answer)
    $all('.self-choice').forEach(function (group) {
      var key = group.getAttribute('data-key');
      var saved = P.getDraft(LESSON_ID, key);
      $all('input', group).forEach(function (inp) {
        if (saved !== undefined && inp.value === saved) inp.checked = true;
        inp.addEventListener('change', function () { if (inp.checked) P.setDraft(LESSON_ID, key, inp.value); });
      });
    });
    // checkboxes with reveal
    $all('.pick').forEach(function (row) {
      var key = row.getAttribute('data-key');
      var inp = $('input', row);
      var reveal = $('.area-reveal', row);
      inp.checked = P.getDraft(LESSON_ID, key) === true;
      if (reveal) reveal.classList.toggle('show', inp.checked);
      inp.addEventListener('change', function () {
        P.setDraft(LESSON_ID, key, inp.checked);
        if (reveal) reveal.classList.toggle('show', inp.checked);
      });
    });
    // free-text responses: debounce 0.5s + blur
    $all('.response').forEach(function (ta) {
      var key = ta.getAttribute('data-key');
      var note = ta.parentNode.querySelector('.saved-note[data-for="' + ta.id + '"]');
      var saved = P.getDraft(LESSON_ID, key);
      if (typeof saved === 'string') ta.value = saved;
      var timer = null;
      function save() {
        clearTimeout(timer);
        P.setDraft(LESSON_ID, key, ta.value);
        if (note) note.textContent = P.storageOK() ? 'Saved in this browser · ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not saved: this browser is blocking storage.';
      }
      ta.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(save, 500); });
      ta.addEventListener('blur', save);
      // flush a pending save if the learner leaves the page within the debounce window
      window.addEventListener('pagehide', function () { if (timer) save(); });
    });
  }


  /* ---------- Put-the-steps-in-order activity (from Computer & Laptop Basics) ----------
     Part 5: with data-rules, any order that meets every rule is accepted ("workable order").
     Rule kinds: needs (true prerequisite), early (starts waiting time), priority (between tasks).
     Feedback lists each unmet rule once, then one workable order (the model order).
     The checked result is restored after a reload. */
  function orderResult(box, picked) {
    var rules = JSON.parse(box.getAttribute('data-rules') || 'null');
    var pos = {};
    var sidOf = {};
    $all('[data-step]', box).forEach(function (el) { sidOf[parseInt(el.getAttribute('data-step'), 10)] = el.getAttribute('data-sid'); });
    picked.forEach(function (n, i) { pos[sidOf[n]] = i; });
    if (!rules) {   // original behaviour: one exact order
      var bad = picked.map(function (n, i) { return n !== i + 1; });
      return { ok: bad.indexOf(true) === -1, bad: bad, unmet: [], rules: null };
    }
    var unmet = [], badSid = {};
    rules.forEach(function (r) {
      var broken = false;
      r.first.forEach(function (a) { r.then.forEach(function (b) {
        if (pos[a] > pos[b]) { broken = true; badSid[a] = true; badSid[b] = true; }
      }); });
      if (broken && unmet.indexOf(r.line) === -1) unmet.push(r.line);
    });
    return { ok: unmet.length === 0, bad: picked.map(function (n) { return !!badSid[sidOf[n]]; }), unmet: unmet, rules: rules };
  }
  function wireOrderActivities() {
    $all('.order-activity').forEach(function (box) {
      var key = box.getAttribute('data-key');
      var steps = $all('[data-step]', box).map(function (el) { return { n: parseInt(el.getAttribute('data-step'), 10), text: el.innerHTML }; });
      var pool = $('.order-pool', box), answer = $('.order-answer', box), out = $('.feedback', box);
      var checkBtn = $('[data-order="check"]', box), resetBtn = $('[data-order="reset"]', box), undoBtn = $('[data-order="undo"]', box);
      var poolLabel = $('.order-label', box);
      var shuffled = shuffledOrder(steps.length, 'order|' + key).map(function (i) { return steps[i]; });
      var picked = [];
      var saved = P.getDraft(LESSON_ID, key);
      if (typeof saved === 'string' && saved) picked = saved.split(',').map(Number).filter(function (n) { return steps.some(function (s) { return s.n === n; }); });
      var checked = false, result = null;
      function stepBy(n) { return steps.filter(function (s) { return s.n === n; })[0]; }
      function render() {
        pool.innerHTML = '';
        shuffled.forEach(function (s) {
          var b = document.createElement('button');
          b.type = 'button'; b.innerHTML = s.text; b.disabled = picked.indexOf(s.n) !== -1 || checked;
          b.addEventListener('click', function () { picked.push(s.n); P.setDraft(LESSON_ID, key, picked.join(',')); render(); });
          var li = document.createElement('li'); li.appendChild(b); pool.appendChild(li);
        });
        answer.innerHTML = picked.map(function (n, i) {
          var cls = checked && result ? (result.bad[i] ? ' class="wrong"' : (result.ok ? ' class="right"' : '')) : '';
          return '<li' + cls + '><span class="n">' + (i + 1) + '.</span><span>' + stepBy(n).text + '</span></li>';
        }).join('');
        checkBtn.disabled = checked || picked.length !== steps.length;
        if (undoBtn) undoBtn.disabled = checked || !picked.length;
        var full = picked.length === steps.length;
        pool.classList.toggle('hidden', full);
        if (poolLabel) poolLabel.classList.toggle('hidden', full);
      }
      function showResult(save) {
        checked = true;
        result = orderResult(box, picked);
        render();
        var model = steps.slice().sort(function (a, b) { return a.n - b.n; }).map(function (s) { return '<li>' + s.text + '</li>'; }).join('');
        if (result.rules) {
          out.innerHTML = result.ok
            ? '<strong>That matches the lesson.</strong> ' + esc(box.getAttribute('data-good') || '')
            : '<strong>Not quite.</strong> Here\'s what to move:<ul class="order-unmet">' +
              result.unmet.map(function (l) { return '<li>' + l + '</li>'; }).join('') +
              '</ul><p class="order-model-label">One workable order:</p><ol style="margin:.3em 0 0">' + model + '</ol>';
        } else {
          var right = result.bad.filter(function (b) { return !b; }).length;
          out.innerHTML = (result.ok ? '<strong>That matches the lesson.</strong> Every step is in a workable order.'
            : '<strong>' + right + ' of ' + steps.length + ' steps are in the lesson’s order.</strong> Here is the order the lesson uses:') +
            (result.ok ? '' : '<ol style="margin:.5em 0 0">' + model + '</ol>');
        }
        out.className = 'feedback show ' + (result.ok ? 'good' : 'try');
        if (save) {
          P.setDraft(LESSON_ID, key + ':checked', true);
          P.setDraft(LESSON_ID, key + ':ok', result.ok);
        }
      }
      checkBtn.addEventListener('click', function () { showResult(true); });
      if (undoBtn) undoBtn.addEventListener('click', function () {
        picked.pop(); P.setDraft(LESSON_ID, key, picked.join(',')); render();
      });
      resetBtn.addEventListener('click', function () {
        picked = []; checked = false; result = null; out.className = 'feedback'; out.innerHTML = '';
        P.clearDrafts(LESSON_ID, key); render();
      });
      // restore a checked result after a reload
      if (picked.length === steps.length && P.getDraft(LESSON_ID, key + ':checked')) showResult(false);
      else render();
    });
  }

  /* ---------- "Select all that apply" (Part 5 Lesson 5; reused by the Final Challenge) ----------
     Items are statements of what's there; data-k="1" = needs fixing / is affected.
     After Check, every item shows its true state and reveal line, ticked or not.
     Lessons: matches only when all keyed items are ticked and nothing else.
     Final Challenge: score = found - extra (minimum 0), out of the number keyed. */
  function multiScore(keys, picked) {
    var n = 0, found = 0, extra = 0;
    keys.forEach(function (k, i) {
      var p = picked.indexOf(i) !== -1;
      if (k) { n++; if (p) found++; } else if (p) extra++;
    });
    return { n: n, found: found, extra: extra, score: Math.max(0, found - extra), match: found === n && extra === 0 };
  }
  window.CWMulti = { score: multiScore };
  function multiSummary(mode, r) {
    if (r.match) return mode === 'touch'
      ? 'You found all ' + r.n + ' parts it touches, and left the rest alone.'
      : 'You found all ' + r.n + ', and left the rest alone.';
    var t = mode === 'touch'
      ? 'You found ' + r.found + ' of ' + r.n + ' parts it touches.'
      : 'You found ' + r.found + ' of ' + r.n + ' things to fix.';
    if (r.extra > 0) t += mode === 'touch'
      ? ' You also picked ' + r.extra + ' that it doesn\u2019t touch.'
      : ' You also picked ' + r.extra + (r.extra === 1 ? ' that was fine as it is.' : ' that were fine as they are.');
    return t;
  }
  function multiResult(box) {
    var key = box.getAttribute('data-key');
    if (!P.getDraft(LESSON_ID, key + ':checked')) return null;
    var saved = P.getDraft(LESSON_ID, key);
    var picked = typeof saved === 'string' && saved ? saved.split(',').map(Number) : [];
    var keys = $all('.multi-item', box).map(function (l) { return l.getAttribute('data-k') === '1'; });
    return multiScore(keys, picked);
  }
  function wireMulti() {
    $all('.multi-activity').forEach(function (box) {
      var key = box.getAttribute('data-key'), mode = box.getAttribute('data-mode');
      var labels = $all('.multi-item', box), out = $('.feedback', box);
      var checkBtn = $('[data-multi="check"]', box), againBtn = $('[data-multi="again"]', box);
      function picked() { return labels.map(function (l, i) { return $('input', l).checked ? i : -1; }).filter(function (i) { return i >= 0; }); }
      function sync() { checkBtn.disabled = !picked().length || P.getDraft(LESSON_ID, key + ':checked') === true; }
      function show() {
        var p = picked();
        var keys = labels.map(function (l) { return l.getAttribute('data-k') === '1'; });
        var r = multiScore(keys, p);
        labels.forEach(function (l, i) {
          var k = keys[i], t = p.indexOf(i) !== -1;
          $('input', l).disabled = true;
          l.classList.add('locked');
          l.classList.toggle('correct', k === t);
          l.classList.toggle('wrong', k !== t);
          l.classList.toggle('is-key', k);
          var st = $('.multi-state', l);
          st.textContent = k ? box.getAttribute('data-yes') : box.getAttribute('data-no');
          var rv = $('.multi-reveal', l);
          rv.textContent = rv.getAttribute('data-reveal');
        });
        out.innerHTML = (r.match ? '<strong>That matches the lesson.</strong> ' : '<strong>Not quite.</strong> ') + esc(multiSummary(mode, r));
        out.className = 'feedback show ' + (r.match ? 'good' : 'try');
        checkBtn.disabled = true; againBtn.classList.remove('hidden');
      }
      function reset() {
        labels.forEach(function (l) {
          var inp = $('input', l); inp.checked = false; inp.disabled = false;
          l.classList.remove('locked', 'correct', 'wrong', 'is-key');
          $('.multi-state', l).textContent = ''; $('.multi-reveal', l).textContent = '';
        });
        out.className = 'feedback'; out.innerHTML = '';
        againBtn.classList.add('hidden'); sync();
      }
      var saved = P.getDraft(LESSON_ID, key);
      if (typeof saved === 'string' && saved) saved.split(',').map(Number).forEach(function (i) { if (labels[i]) $('input', labels[i]).checked = true; });
      labels.forEach(function (l) {
        $('input', l).addEventListener('change', function () { P.setDraft(LESSON_ID, key, picked().join(',')); sync(); });
      });
      checkBtn.addEventListener('click', function () { P.setDraft(LESSON_ID, key + ':checked', true); show(); });
      againBtn.addEventListener('click', function () { P.clearDrafts(LESSON_ID, key); reset(); });
      if (P.getDraft(LESSON_ID, key + ':checked') === true) show(); else sync();
    });
  }

  /* ---------- "What did you catch?" notice (Part 5) ----------
     A .notice section: its feedback line (.notice-fb) appears once any box is ticked. */
  function wireNotices() {
    $all('.notice').forEach(function (box) {
      var fb = $('.notice-fb', box);
      var inputs = $all('.pick input', box);
      function update() { if (fb) fb.classList.toggle('show', inputs.some(function (i) { return i.checked; })); }
      inputs.forEach(function (i) { i.addEventListener('change', update); });
      update();
    });
  }

  /* ---------- Task Card (Part 5) ----------
     Fields are ordinary .response textareas (saved by wireActivities). The model is revealed
     by the reveal button (enabled once any field has text) or "Show me anyway" (always).
     Self-check radios are ordinary .self-choice groups. When every field is marked, a closing
     message appears: critical fields (data-critical) missed > other fields missed > all got. */
  function wireTaskCards() {
    $all('.taskcard').forEach(function (card) {
      var id = card.getAttribute('data-taskcard');
      var revealKey = 'tc:' + id + ':revealed';
      var fields = $all('textarea.response', card);
      var btn = $('[data-tc-reveal]', card), anyway = $('[data-tc-anyway]', card), model = $('[data-tc-model]', card);
      var closing = $('[data-tc-closing]', card);
      var critical = (closing.getAttribute('data-critical') || '').split(',').filter(Boolean);
      function hasText() { return fields.some(function (f) { return f.value.trim().length > 0; }); }
      function reveal(save) {
        model.classList.remove('hidden');
        btn.disabled = true; btn.classList.add('hidden'); anyway.classList.add('hidden');
        if (save) P.setDraft(LESSON_ID, revealKey, true);
      }
      function updateBtn() { if (!model.classList.contains('hidden')) return; btn.disabled = !hasText(); }
      fields.forEach(function (f) { f.addEventListener('input', updateBtn); });
      btn.addEventListener('click', function () { reveal(true); model.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      anyway.addEventListener('click', function () { reveal(true); model.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      var groups = $all('.self-choice', card);
      function updateClosing() {
        var marks = {};
        groups.forEach(function (g) {
          var k = g.getAttribute('data-key'); var v = P.getDraft(LESSON_ID, k);
          marks[k.split(':').pop()] = typeof v === 'string' ? v : null;
        });
        var keys = Object.keys(marks);
        if (keys.some(function (k) { return !marks[k]; })) { closing.className = 'feedback tc-closing'; closing.textContent = ''; return; }
        var missed = keys.filter(function (k) { return marks[k] === 'Missed something'; });
        var critMissed = missed.some(function (k) { return critical.indexOf(k) !== -1; });
        var msg = critMissed ? closing.getAttribute('data-msg-critical')
          : missed.length ? closing.getAttribute('data-msg-other') : closing.getAttribute('data-msg-all');
        closing.textContent = msg;
        closing.className = 'feedback tc-closing show ' + (critMissed ? 'try' : missed.length ? 'info' : 'good');
      }
      groups.forEach(function (g) { $all('input', g).forEach(function (i) { i.addEventListener('change', function () { setTimeout(updateClosing, 0); }); }); });
      if (P.getDraft(LESSON_ID, revealKey) === true) reveal(false);
      updateBtn();
      updateClosing();
    });
  }

  /* ---------- carried-forward panel (Part 5) ----------
     Shows fields the learner saved in an earlier lesson (read-only). If none were saved,
     shows the fallback note and the model values instead. */
  function carryHasData(panel) {
    if (!panel) return false;
    var from = panel.getAttribute('data-carry-from');
    return $all('[data-carry-key]', panel).some(function (td) {
      var v = P.getDraft(from, td.getAttribute('data-carry-key'));
      return typeof v === 'string' && v.trim().length > 0;
    });
  }
  function wireCarry() {
    $all('.carry').forEach(function (panel) {
      var from = panel.getAttribute('data-carry-from');
      var saved = carryHasData(panel);
      $('.carry-fallback', panel).classList.toggle('hidden', saved);
      $all('[data-carry-key]', panel).forEach(function (td) {
        var v = P.getDraft(from, td.getAttribute('data-carry-key'));
        var out = $('.carry-value', td), model = $('.carry-model', td);
        if (saved) { out.textContent = (typeof v === 'string' && v.trim()) ? v : '(left blank)'; model.hidden = true; }
        else { out.textContent = ''; model.hidden = false; }
      });
    });
  }

  /* ---------- notes download ---------- */
  function buildNotes() {
    var lines = ['PVA Academy — Understanding Client Work & Instructions', 'Lesson ' + lesson.num + ': ' + lesson.title, 'My notes · ' + new Date().toLocaleString(), ''];
    var any = false;
    $all('[data-note-label],[data-note-heading]').forEach(function (el) {
      var from = el.getAttribute('data-note-from') || LESSON_ID;
      var optional = el.hasAttribute('data-note-optional');
      if (el.hasAttribute('data-note-heading')) {
        // optional headings (e.g. a carried-forward card) only appear when that lesson saved something
        if (optional && !carryHasData(el.closest('.carry'))) return;
        lines.push('== ' + el.getAttribute('data-note-heading') + ' =='); lines.push(''); return;
      }
      var label = el.getAttribute('data-note-label');
      if (el.hasAttribute('data-order-note')) {
        // a checked order activity: the learner's order as a numbered list
        var okey = el.getAttribute('data-order-note');
        var box = el.closest('.order-activity');
        var seq = P.getDraft(LESSON_ID, okey);
        if (!P.getDraft(LESSON_ID, okey + ':checked') || typeof seq !== 'string' || !seq) return;
        var txt = {};
        $all('[data-step]', box).forEach(function (st) { txt[st.getAttribute('data-step')] = st.textContent; });
        lines.push(label);
        seq.split(',').forEach(function (n, i) { lines.push('  ' + (i + 1) + '. ' + txt[n]); });
        lines.push(''); any = true; return;
      }
      var key = el.getAttribute('data-key') || el.getAttribute('data-carry-key');
      var v = P.getDraft(from, key);
      if (optional && (typeof v !== 'string' || !v.trim())) return;
      var out = '';
      if (el.classList.contains('pick')) { if (v === true) out = 'Selected'; else return; }
      else if (typeof v === 'string') out = v.trim();
      if (!out) out = '(not answered)'; else any = true;
      lines.push(label); lines.push('  ' + out.replace(/\n/g, '\n  ')); lines.push('');
    });
    var multis = $all('.multi-activity');
    if (multis.length) {
      lines.push('== My checks =='); lines.push('');
      multis.forEach(function (box) {
        var r = multiResult(box), touch = box.getAttribute('data-mode') === 'touch';
        lines.push(box.getAttribute('data-note-title'));
        lines.push('  ' + (r ? 'Found ' + r.found + ' of ' + r.n + (touch ? ' affected parts.' : ' things to fix.') + ' Extra picks: ' + r.extra + '.'
                             : 'Not checked yet'));
        lines.push('');
        if (r) any = true;
      });
    }
    var appendix = document.getElementById('notesAppendix');
    if (appendix) { lines.push(appendix.textContent.replace(/^\n+|\s+$/g, '')); lines.push(''); }
    lines.push('Saved in this browser only. Keep this file if you want a copy of your answers.');
    return { text: lines.join('\n'), any: any };
  }
  function wireNotes() {
    var btn = $('#notesBtn');
    if (!btn) return;
    if (!$all('[data-note-label], .multi-activity').length) { btn.classList.add('hidden'); return; }
    btn.addEventListener('click', function () {
      var n = buildNotes();
      var blob = new Blob([n.text], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Client-Work-Lesson-' + lesson.num + '-my-notes.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    });
  }

  /* ---------- completion buttons ---------- */
  function wireCompletion() {
    var mark = $('#markBtn'), undo = $('#notDoneBtn');
    if (mark) mark.addEventListener('click', function () {
      P.markComplete(LESSON_ID); renderChrome();
      var panel = $('#donePanel'); if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (undo) undo.addEventListener('click', function () { P.markNotDone(LESSON_ID); renderChrome(); });
  }

  P.visit(LESSON_ID);
  renderChrome();
  wireActivities();
  wireOrderActivities();
  wireMulti();
  wireNotices();
  wireTaskCards();
  wireCarry();
  renderQuickCheck();
  wireCompletion();
  wireNotes();
})();
