/* PVA Academy — Understanding Client Work & Instructions
   Final Challenge: one work packet, a Task Card, then 12 questions (3 per stage:
   READ, DECIDE, DO, CHECK), one at a time, saved in this browser.
   DIAGNOSTIC: there is no pass mark and it is never gated. No feedback is shown
   before submitting (no right/wrong state on any question type, including when
   going back). The result shows the score, a stage breakdown with lessons to
   review, and the learner's Task Card next to a model with a self-check.
   Question types: single, two (two parts; one point only if both right),
   multi (tick all that apply; one point only for a perfect match),
   order (any workable order). The answer key is stored as hashes only; the model
   Task Card is kept out of plain view. (A static site cannot make this
   tamper-proof; it keeps answers out of plain view.) */
(function () {
  'use strict';
  var P = window.PVACW;
  var QS = window.CW_CHALLENGE || [];
  var SALT = window.CW_SALT || '';
  var MODEL = window.CW_TC_MODEL || {};
  var ROOT = document.body.getAttribute('data-root') || '../';
  var ID = P.FINAL_ID;
  var ACADEMY = 'https://probinsiyanongva.org/';
  var STAGES = ['READ', 'DECIDE', 'DO', 'CHECK'];
  var STAGE_Q = { READ: 'What exactly is being asked?', DECIDE: 'Can I go ahead?', DO: 'In what order, following which process?', CHECK: 'Does my result match the request?' };
  function $(s) { return document.querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function fnv(str) {
    var bytes = new TextEncoder().encode(str);
    var h = 2166136261;
    for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function reveal(b64) {   // undo build.py obscure(): base64 -> XOR SALT -> UTF-8
    var raw = atob(b64), k = new TextEncoder().encode(SALT), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) ^ k[i % k.length];
    return new TextDecoder().decode(out);
  }

  /* ---------- saved answers (drafts hold simple values only) ---------- */
  function get(k) { return P.getDraft(ID, k); }
  function set(k, v) { P.setDraft(ID, k, v); }
  function single(q) { var v = get('a:' + q.n); return typeof v === 'number' ? v : null; }
  function part(q, i) { var v = get('a:' + q.n + ':' + i); return typeof v === 'number' ? v : null; }
  function list(q) { var v = get('a:' + q.n); return typeof v === 'string' && v ? v.split(',') : []; }
  function answered(q) {
    if (q.type === 'single') return single(q) !== null;
    if (q.type === 'two') return part(q, 0) !== null && part(q, 1) !== null;
    if (q.type === 'multi') return list(q).length > 0;
    if (q.type === 'order') return list(q).length === q.steps.length;
    return false;
  }
  function answeredCount() { return QS.filter(answered).length; }
  function correct(q) {
    if (!answered(q)) return false;
    if (q.type === 'single') return fnv(SALT + '|' + q.n + '|' + single(q)) === q.k;
    if (q.type === 'two') return fnv(SALT + '|' + q.n + '|' + part(q, 0) + ',' + part(q, 1)) === q.k;
    if (q.type === 'multi') {      // perfect match only: every keyed item ticked, nothing else
      var picked = list(q).map(Number);
      return q.ks.every(function (h, i) {
        var keyed = fnv(SALT + '|' + q.n + '|' + i + '|1') === h;
        return keyed === (picked.indexOf(i) !== -1);
      });
    }
    if (q.type === 'order') return q.ks.indexOf(fnv(SALT + '|' + q.n + '|' + list(q).join(','))) !== -1;
    return false;
  }

  var pos = 0;
  var SECTIONS = ['#assessIntro', '#taskCardStep', '#assessRunner', '#assessResult'];
  function show(el) {
    SECTIONS.forEach(function (s) { $(s).classList.toggle('hidden', s !== el); });
    $('#packet').classList.toggle('hidden', !(el === '#taskCardStep' || el === '#assessRunner'));
  }
  function renderChrome() { P.renderProgressBar(ID); P.renderLessonNav(ID, ROOT); }
  function setPacketOpen(open) { $all('#packet details').forEach(function (d) { d.open = open; }); }

  /* ---------- intro ---------- */
  function renderIntro() {
    renderChrome();
    var gate = $('#gate'), start = $('#startBtn');
    // Never gated: learners can take it first to see which lessons to focus on.
    var missing = P.LESSONS.filter(function (l) { return !P.isComplete(l.id); });
    if (missing.length === P.LESSONS.length) {
      gate.innerHTML = '<strong>You can take this at any time.</strong> Trying it before the lessons shows you which ones to focus on.';
      gate.classList.remove('hidden');
    } else gate.classList.add('hidden');
    var a = P.assessment();
    start.textContent = answeredCount() > 0 && !a.submitted ? 'Continue the challenge (' + answeredCount() + ' of ' + QS.length + ' answered)' : 'Start the challenge';
    if (a.submitted && a.attempts.length) { renderResult(a.attempts[a.attempts.length - 1].score); return; }
    show('#assessIntro');
    renderCompletion();
  }

  /* ---------- Task Card (unscored) ---------- */
  function wireTaskCard() {
    $all('[data-fc-tc]').forEach(function (ta) {
      var k = 'tc:' + ta.getAttribute('data-fc-tc');
      ta.value = typeof get(k) === 'string' ? get(k) : '';
      ta.addEventListener('input', function () { set(k, ta.value); });
    });
    $('#startQsBtn').addEventListener('click', function () { set('tcStep', true); go(0); });
  }
  function renderTaskCard() {
    $all('[data-fc-tc]').forEach(function (ta) { var v = get('tc:' + ta.getAttribute('data-fc-tc')); ta.value = typeof v === 'string' ? v : ''; });
    show('#taskCardStep'); setPacketOpen(true);
    $('#taskCardStep').scrollIntoView({ block: 'start' });
  }

  /* ---------- runner ---------- */
  function inputsFor(q) {
    if (q.type === 'single' || q.type === 'two') {
      var groups = q.type === 'single' ? [{ label: null, options: q.options, key: 'a:' + q.n, val: single(q) }]
        : q.parts.map(function (p, i) { return { label: p.label, options: p.options, key: 'a:' + q.n + ':' + i, val: part(q, i) }; });
      return groups.map(function (g, gi) {
        return (g.label ? '<p class="act-q fc-part">' + esc(g.label) + '</p>' : '') +
          '<div class="choice-group" role="radiogroup"' + (g.label ? ' aria-label="' + esc(g.label) + '"' : ' aria-labelledby="qText"') + '>' +
          g.options.map(function (o, i) {
            return '<label class="choice"><input type="radio" name="q' + q.n + '-' + gi + '" data-key="' + g.key + '" value="' + i + '"' +
              (g.val === i ? ' checked' : '') + '><span><strong>' + 'ABCDE'[i] + '.</strong> ' + o + '</span></label>';
          }).join('') + '</div>';
      }).join('');
    }
    if (q.type === 'multi') {
      var picked = list(q).map(Number);
      return '<div class="choice-group multi-items">' + q.items.map(function (t, i) {
        return '<label class="choice multi-item"><input type="checkbox" value="' + i + '"' + (picked.indexOf(i) !== -1 ? ' checked' : '') +
          '><span class="multi-text">' + t + '</span></label>';
      }).join('') + '</div>';
    }
    // order
    return '<div class="order-activity fc-order"><div class="order-label">Steps</div><ul class="order-pool"></ul>' +
      '<div class="order-label">Your order</div><ol class="order-answer"></ol>' +
      '<div class="hero-actions" style="margin:4px 0 8px"><button type="button" class="btn subtle small-btn" data-order="undo">Undo last</button>' +
      '<button type="button" class="btn subtle small-btn" data-order="reset">Start again</button></div></div>';
  }
  function savedNote() { $('#qSaved').textContent = 'Answer saved in this browser.'; refreshProgress(); }
  function refreshProgress() {
    var q = QS[pos];
    var el = document.querySelector('.assess-progress');
    if (el) el.textContent = 'Question ' + q.n + ' of ' + QS.length + ' · ' + answeredCount() + ' answered';
    var dot = document.querySelector('.q-dot[data-go="' + pos + '"]'); if (dot) dot.classList.toggle('answered', answered(q));
  }
  function wireInputs(q) {
    if (q.type === 'single' || q.type === 'two') {
      $all('#assessRunner input[type=radio]').forEach(function (inp) {
        inp.addEventListener('change', function () { set(inp.getAttribute('data-key'), parseInt(inp.value, 10)); set('pos', pos); savedNote(); });
      });
    } else if (q.type === 'multi') {
      $all('#assessRunner .multi-item input').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var p = $all('#assessRunner .multi-item input').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
          set('a:' + q.n, p.join(',')); set('pos', pos);
          $('#qSaved').textContent = p.length ? 'Answer saved in this browser.' : '';
          refreshProgress();
        });
      });
    } else {
      var box = $('#assessRunner .fc-order'), pool = $('.order-pool', box), ans = $('.order-answer', box);
      var byId = {}; q.steps.forEach(function (s) { byId[s.id] = s; });
      var render = function () {
        var picked = list(q);
        pool.innerHTML = '';
        q.steps.forEach(function (s) {
          var b = document.createElement('button'); b.type = 'button'; b.innerHTML = s.text; b.disabled = picked.indexOf(s.id) !== -1;
          b.addEventListener('click', function () { var p = list(q); p.push(s.id); set('a:' + q.n, p.join(',')); set('pos', pos); render(); });
          var li = document.createElement('li'); li.appendChild(b); pool.appendChild(li);
        });
        ans.innerHTML = picked.map(function (id, i) { return '<li><span class="n">' + (i + 1) + '.</span><span>' + byId[id].text + '</span></li>'; }).join('');
        var full = picked.length === q.steps.length;
        pool.classList.toggle('hidden', full); $all('.order-label', box)[0].classList.toggle('hidden', full);
        $('[data-order="undo"]', box).disabled = !picked.length;
        $('#qSaved').textContent = full ? 'Answer saved in this browser.' : (picked.length ? 'Place all ' + q.steps.length + ' steps to finish this question.' : '');
        refreshProgress();
      };
      $('[data-order="undo"]', box).addEventListener('click', function () { var p = list(q); p.pop(); set('a:' + q.n, p.join(',')); render(); });
      $('[data-order="reset"]', box).addEventListener('click', function () { set('a:' + q.n, ''); render(); });
      render();
    }
  }
  function renderQuestion() {
    var q = QS[pos];
    var dots = QS.map(function (qq, i) {
      var cls = 'q-dot' + (answered(qq) ? ' answered' : '') + (i === pos ? ' current' : '');
      return '<button type="button" class="' + cls + '" data-go="' + i + '" aria-label="Question ' + qq.n + (answered(qq) ? ', answered' : ', not answered') + '">' + qq.n + '</button>';
    }).join('');
    var last = pos === QS.length - 1;
    $('#assessRunner').innerHTML =
      '<div class="stage-marker" style="margin-top:0;border-top:0;padding-top:0"><span class="stage-label">' + q.stage + '</span><span class="stage-q">' + STAGE_Q[q.stage] + '</span></div>' +
      '<div class="assess-progress">Question ' + q.n + ' of ' + QS.length + ' · ' + answeredCount() + ' answered</div>' +
      '<div class="q-dots" aria-label="Jump to a question">' + dots + '</div>' +
      '<div class="assess-q" id="qText">' + q.html + '</div>' + inputsFor(q) +
      '<p class="saved-note" id="qSaved">' + (answered(q) ? 'Answer saved in this browser.' : '') + '</p>' +
      '<div class="assess-nav"><button type="button" class="btn secondary" id="prevQ">' + (pos === 0 ? '← Task Card' : '← Previous') + '</button>' +
      (last ? '<button type="button" class="btn gold" id="reviewBtn">Review and submit</button>' : '<button type="button" class="btn" id="nextQ">Next →</button>') + '</div>';
    wireInputs(q);
    $all('.q-dot').forEach(function (b) { b.addEventListener('click', function () { go(parseInt(b.getAttribute('data-go'), 10)); }); });
    $('#prevQ').addEventListener('click', function () { if (pos === 0) renderTaskCard(); else go(pos - 1); });
    if (last) $('#reviewBtn').addEventListener('click', renderReview);
    else $('#nextQ').addEventListener('click', function () { go(pos + 1); });
    show('#assessRunner');
  }
  function go(i) {
    pos = Math.max(0, Math.min(QS.length - 1, i)); set('pos', pos);
    setPacketOpen(false); renderQuestion(); $('#packet').scrollIntoView({ block: 'start' });
  }

  function renderReview() {
    var missing = QS.filter(function (q) { return !answered(q); });
    var html = '<div class="section-label">Review</div><h2>Ready to submit?</h2>' +
      '<p>You have answered <strong>' + answeredCount() + ' of ' + QS.length + '</strong> questions.</p>';
    if (missing.length) {
      html += '<div class="callout"><strong>Not answered yet:</strong> ' + missing.map(function (q) {
        return '<button type="button" class="btn subtle small-btn" data-go="' + (q.n - 1) + '">Question ' + q.n + '</button>';
      }).join(' ') + '<br><span class="small">Unanswered questions count as incorrect.</span></div>';
    }
    html += '<p class="small">Your result appears after you submit. There is no pass mark.</p>' +
      '<div class="assess-nav"><button type="button" class="btn secondary" id="backToQs">← Back to the questions</button>' +
      '<button type="button" class="btn gold" id="submitBtn">Submit my answers</button></div>';
    $('#assessRunner').innerHTML = html;
    $all('#assessRunner [data-go]').forEach(function (b) { b.addEventListener('click', function () { go(parseInt(b.getAttribute('data-go'), 10)); }); });
    $('#backToQs').addEventListener('click', function () { renderQuestion(); });
    $('#submitBtn').addEventListener('click', submit);
    show('#assessRunner');
  }

  function score() { return QS.filter(correct).length; }
  function submit() {
    var missing = QS.length - answeredCount();
    if (missing && !confirm(missing + ' question(s) are not answered and will count as incorrect. Submit anyway?')) return;
    var s = score();
    P.recordAttempt(s);
    renderChrome();
    renderResult(s);
  }

  /* ---------- result ---------- */
  function lessonLink(name) {
    var n = (name.match(/\d+/) || [null])[0];
    return n ? '<a href="' + ROOT + 'lesson-' + n + '/">' + esc(name) + '</a>' : esc(name);
  }
  function renderResult(s) {
    var ready = s >= P.READY_MARK;
    var html = '<div class="section-label">Final Challenge result</div>' +
      '<div class="result-box ' + (ready ? 'pass' : 'retake') + '">' +
      '<div class="stamp ' + (ready ? 'passed' : 'progress') + '">' + (ready ? 'Ready to move on' : 'Practice a little more') + '</div>' +
      '<div class="result-score">' + s + ' / ' + QS.length + '</div>' +
      '<p style="margin:0">' + (ready
        ? 'You used the whole process on a new request: you read it, made the calls, planned the work and checked it.'
        : 'A few parts of the process are worth another look. That’s normal. The table below shows which, and you can try again whenever you like.') + '</p></div>' +
      '<p class="small">This score shows you where you are in the process. There’s no pass mark, nothing is locked either way, and it isn’t a certificate.</p>';

    // stage breakdown
    html += '<h3>Where you are in the process</h3><p class="small">Each part of the work had three questions.</p>' +
      '<div class="table-wrap"><table class="stage-table"><thead><tr><th>Stage</th><th>Result</th></tr></thead><tbody>' +
      STAGES.map(function (st) {
        var qs = QS.filter(function (q) { return q.stage === st; });
        var got = qs.filter(correct).length;
        var lessons = [];
        qs.forEach(function (q) { if (!correct(q) && lessons.indexOf(q.review) === -1) lessons.push(q.review); });
        lessons.sort();
        return '<tr data-stage="' + st + '"><td><strong>' + st + '</strong></td><td>' + got + '/' + qs.length + ' · ' +
          (lessons.length ? 'Worth reviewing: ' + lessons.map(lessonLink).join(', ') : 'Solid') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    // missed questions, grouped by stage (no answers revealed)
    var missed = QS.filter(function (q) { return !correct(q); });
    if (missed.length) {
      html += '<h3>Worth reviewing</h3><p class="small">These answers didn’t match the course. The lesson shown covers each one.</p>';
      STAGES.forEach(function (st) {
        var m = missed.filter(function (q) { return q.stage === st; });
        if (!m.length) return;
        html += '<p class="review-stage"><strong>' + st + '</strong></p><ul class="review-list">' + m.map(function (q) {
          return '<li><strong>Question ' + q.n + ':</strong> ' + esc(q.short.replace(/<[^>]+>/g, '')) + '<br><span class="small">Review:</span> ' + lessonLink(q.review) + '</li>';
        }).join('') + '</ul>';
      });
    } else {
      html += '<p>Every answer matched the course.</p>';
    }

    // Task Card: learner's card next to the model, with an unscored self-check
    var parts = $all('[data-fc-tc]').map(function (ta) { return { key: ta.getAttribute('data-fc-tc'), label: ta.getAttribute('data-label') }; });
    html += '<h3>Your Task Card</h3><p>Here’s the Task Card you wrote before the questions, next to a model. Compare them and mark each part. It’s for you only and doesn’t change your score.</p>' +
      '<div class="table-wrap"><table class="fc-tc-table"><thead><tr><th>Part</th><th>Yours</th><th>Model</th></tr></thead><tbody>' +
      parts.map(function (p) {
        var mine = get('tc:' + p.key);
        return '<tr><td><strong>' + esc(p.label) + '</strong></td><td class="fc-mine" data-h="Yours">' + (typeof mine === 'string' && mine.trim() ? esc(mine) : '<span class="small">(left blank)</span>') +
          '</td><td data-h="Model">' + esc(MODEL[p.key] ? reveal(MODEL[p.key]) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="tc-check">' + parts.map(function (p) {
        var v = get('tcs:' + p.key);
        return '<div class="tc-check-row"><p class="act-q">' + esc(p.label) + '</p><div class="choice-row self-choice" role="radiogroup" aria-label="' + esc(p.label) + ' self-check">' +
          ['Got it', 'Missed something'].map(function (o) {
            return '<label class="choice"><input type="radio" name="tcs-' + p.key + '" data-tcs="' + p.key + '" value="' + o + '"' + (v === o ? ' checked' : '') + '><span>' + o + '</span></label>';
          }).join('') + '</div></div>';
      }).join('') + '</div>';

    var attempts = P.assessment().attempts.length;
    html += '<p class="small">Attempts so far: ' + attempts + '.</p><div class="hero-actions">' +
      (ready ? '<a class="btn" href="' + ROOT + '">Back to the course home</a><button type="button" class="btn subtle" id="retakeBtn">Take it again</button>'
             : '<button type="button" class="btn" id="retakeBtn">Take it again</button><a class="btn secondary" href="' + ROOT + '">Back to the course home</a>') + '</div>';
    $('#assessResult').innerHTML = html;
    $all('#assessResult [data-tcs]').forEach(function (inp) {
      inp.addEventListener('change', function () { set('tcs:' + inp.getAttribute('data-tcs'), inp.value); });
    });
    $('#retakeBtn').addEventListener('click', function () {
      if (!confirm('Start a new attempt? Your current answers and Task Card will be cleared. Your earlier scores stay recorded.')) return;
      P.resetAttempt(); pos = 0; renderChrome(); renderTaskCard();
    });
    show('#assessResult');
    renderCompletion();
    $('#assessResult').scrollIntoView({ block: 'start' });
  }

  function renderCompletion() {
    var comp = $('#completion');
    if (P.courseComplete()) {
      comp.innerHTML = '<div class="completion-icon">✓</div><h2>Understanding Client Work &amp; Instructions Complete</h2>' +
        '<p><strong>PVA Academy — Understanding Client Work &amp; Instructions</strong></p><p>You finished all ' + P.LESSONS.length + ' lessons and the Final Challenge. That completes Stage 3: Learn to Work.</p>' +
        '<div class="completion-card-note"><strong>This is a completion acknowledgment, not a certification or competency credential.</strong> It is saved in this browser only.<br><br>' +
        'Next is Stage 4: Find Your Direction, where you look at which kind of VA work fits you.</div>' +
        '<div class="hero-actions"><a class="btn" href="' + ACADEMY + '">Back to PVA Academy</a>' +
        '<button type="button" class="btn subtle" onclick="window.print()">Print this screen</button></div>';
      comp.classList.remove('hidden');
    } else if (P.finalDone()) {
      var left = P.LESSONS.filter(function (l) { return !P.isComplete(l.id); });
      comp.innerHTML = '<p><strong>You’ve done the Final Challenge.</strong> The course is complete once all ' + P.LESSONS.length + ' lessons are also marked complete. Still to mark complete:</p>' +
        '<ul class="gate-list">' + left.map(function (l) { return '<li><a href="' + ROOT + l.id + '/">Lesson ' + l.num + ': ' + esc(l.title) + '</a></li>'; }).join('') + '</ul>';
      comp.classList.remove('hidden');
    } else comp.classList.add('hidden');
  }

  $('#startBtn').addEventListener('click', function () {
    if (get('tcStep') === true) {
      var saved = get('pos');
      go(typeof saved === 'number' ? saved : 0);
    } else renderTaskCard();
  });
  wireTaskCard();
  renderIntro();
})();
