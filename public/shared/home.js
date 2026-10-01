/* PVA Academy — Understanding Client Work & Instructions
   Home page and Progress page: stamps, summary, Continue button,
   Export / Restore / Clear, "Do you need this course?" check,
   completion acknowledgment. Same as Computer & Laptop Basics. */
(function () {
  'use strict';
  var P = window.PVACW;
  var ROOT = document.body.getAttribute('data-root') || './';
  function $(s) { return document.querySelector(s); }

  var ACADEMY = 'https://probinsiyanongva.org/';
  var NEXT_COURSE = document.body.getAttribute('data-next-course') || ACADEMY;

  function render() {
    P.renderProgressBar(null);
    P.renderLessonNav(document.body.getAttribute('data-page') === 'home' ? 'home' : null, ROOT);

    document.querySelectorAll('.lesson-row').forEach(function (row) {
      var id = row.getAttribute('data-lesson');
      var st = P.status(id);
      var stamp = row.querySelector('[data-stamp]');
      stamp.className = 'stamp';
      if (row.hasAttribute('data-soon')) { stamp.textContent = 'Coming soon'; row.classList.remove('is-done'); return; }
      if (st === 'complete') {
        if (id === P.FINAL_ID) { stamp.classList.add('passed'); stamp.textContent = 'Done · ' + P.latestScore() + '/' + P.TOTAL_QUESTIONS; }
        else { stamp.classList.add('complete'); stamp.textContent = 'Complete'; }
      }
      else if (st === 'progress') { stamp.classList.add('progress'); stamp.textContent = 'In progress'; }
      else { stamp.textContent = 'Not started'; }
      row.classList.toggle('is-done', st === 'complete');
    });

    var done = P.lessonsDone(), fin = P.finalDone();
    var pct = Math.round(((done + (fin ? 1 : 0)) / (P.LESSONS.length + 1)) * 100);
    var pctEl = $('#homePct'); if (pctEl) pctEl.textContent = pct + '%';
    var sum = $('#homeSummary');
    if (sum) sum.textContent = done + ' of ' + P.LESSONS.length + ' lessons complete · Final Challenge ' + (fin ? 'done' : 'not done yet');

    var btn = $('#continueBtn');
    if (btn) {
      var next = P.nextLesson();
      // Part 5 pilot: lessons marked data-soon on the course map aren't built yet
      var soonRow = next && document.querySelector('.lesson-row[data-lesson="' + next.id + '"][data-soon]');
      if (soonRow && !P.courseComplete()) { btn.textContent = 'Review the lessons'; btn.href = ROOT + 'lesson-1/'; next = 'soon'; }
      var anyStarted = P.LESSONS.some(function (l) { return P.status(l.id) !== 'none'; });
      if (P.courseComplete()) { btn.textContent = 'Review the lessons'; btn.href = ROOT + 'lesson-1/'; }
      else if (next === 'soon') { /* set above */ }
      else if (next) {
        btn.textContent = (!anyStarted && next.num === 1) ? 'Start Lesson 1' : 'Continue: Lesson ' + next.num;
        btn.href = ROOT + next.id + '/';
      } else if (document.querySelector('.lesson-row[data-lesson="' + P.FINAL_ID + '"][data-soon]')) {
        btn.textContent = 'Review the lessons'; btn.href = ROOT + 'lesson-1/';   // Final Challenge not built yet
      } else { btn.textContent = 'Go to the Final Challenge'; btn.href = ROOT + P.FINAL_ID + '/'; }
    }

    var comp = $('#completion');
    if (comp) {
      if (P.courseComplete()) {
        comp.innerHTML = '<div class="completion-icon">✓</div><h2>Understanding Client Work &amp; Instructions Complete</h2>' +
          '<p><strong>PVA Academy — Understanding Client Work &amp; Instructions</strong></p><p>You finished all ' + P.LESSONS.length + ' lessons and the Final Challenge. That completes Stage 3: Learn to Work.</p>' +
          '<div class="completion-card-note"><strong>This is a completion acknowledgment, not a certification or competency credential.</strong><br><br>' +
          'Next is Stage 4: Find Your Direction, where you look at which kind of VA work fits you.</div>' +
          '<div class="hero-actions"><a class="btn" href="' + ACADEMY + '">Back to PVA Academy</a></div>';
        comp.classList.remove('hidden');
      } else comp.classList.add('hidden');
    }
  }


  /* ---------- "Do you need this course?" ---------- */
  var fitRefresh = function () {};
  function renderFit() {
    var box = $('#fitCheck');
    if (!box) return;
    var rows = Array.prototype.slice.call(box.querySelectorAll('.fit-row'));
    var result = $('#fitResult');
    function update() {
      var answered = 0, notYet = [];
      rows.forEach(function (row) {
        var v = P.getDraft(P.FIT_ID, row.getAttribute('data-key'));
        if (v) answered++;
        if (v === 'Not yet') notYet.push(row);
      });
      if (answered < rows.length) {
        result.className = 'feedback';
        result.innerHTML = '';
        return;
      }
      if (!notYet.length) {
        result.className = 'feedback show good';
        result.innerHTML = '<strong>You may be ready to move ahead.</strong> You can already do what this course teaches. ' +
          'Try this course’s <a href="' + ROOT + P.FINAL_ID + '/">Final Challenge</a> to confirm, or review any lesson you like.';
      } else {
        var seen = {}, links = [];
        notYet.forEach(function (row) {
          var n = row.getAttribute('data-lesson');
          if (seen[n]) return; seen[n] = true;
          var l = P.LESSONS[parseInt(n, 10) - 1];
          links.push('<li><a href="' + ROOT + l.id + '/">Lesson ' + l.num + ': ' + l.title + '</a></li>');
        });
        result.className = 'feedback show info';
        result.innerHTML = '<strong>This course is a good fit for you.</strong> You can take it from Lesson 1, or start with the lessons that match what you can’t do yet:<ul style="margin:.5em 0 0">' + links.join('') + '</ul>';
      }
    }
    rows.forEach(function (row) {
      var key = row.getAttribute('data-key');
      var saved = P.getDraft(P.FIT_ID, key);
      Array.prototype.forEach.call(row.querySelectorAll('input'), function (inp) {
        if (saved !== undefined && inp.value === saved) inp.checked = true;
        inp.addEventListener('change', function () { if (inp.checked) { P.setDraft(P.FIT_ID, key, inp.value); update(); } });
      });
    });
    var reset = $('#fitReset');
    if (reset) reset.addEventListener('click', function () {
      P.clearDrafts(P.FIT_ID);
      rows.forEach(function (row) { Array.prototype.forEach.call(row.querySelectorAll('input'), function (i) { i.checked = false; }); });
      update();
    });
    fitRefresh = function () {
      rows.forEach(function (row) {
        var v = P.getDraft(P.FIT_ID, row.getAttribute('data-key'));
        Array.prototype.forEach.call(row.querySelectorAll('input'), function (i) { i.checked = v !== undefined && i.value === v; });
      });
      update();
    };
    update();
  }

  var exp = $('#exportBtn'), res = $('#restoreBtn'), clr = $('#clearBtn'), file = $('#restoreFile');
  if (exp) exp.addEventListener('click', function () { P.exportProgress(); });
  if (res && file) {
    res.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = '';
      P.restoreFromFile(f, function () { render(); fitRefresh(); var s = document.querySelector('[data-save-state]'); if (s) s.textContent = 'Progress restored in this browser.'; });
    });
  }
  if (clr) clr.addEventListener('click', function () {
    P.clearProgress(function () { render(); fitRefresh(); var s = document.querySelector('[data-save-state]'); if (s) s.textContent = 'Progress cleared.'; });
  });

  render();
  renderFit();
})();
