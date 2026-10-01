#!/usr/bin/env python3
"""Build the Understanding Client Work & Instructions standalone module (PVA Part 5).

Page chrome, progress architecture and components are reused from the rebuilt
Stage 2 modules (pva-computer-basics, pva-internet-workspace), including the
neutral mock screens (tools/mocks.py). Part 5 pilot additions, all driven by
content/course.json:
  - per-option feedback on graded items ("feedback": [...])
  - row layout for two-option sorting items (activity "layout": "row")
  - several static mocks above one question ("mocks": [...])
  - chat-thread mock (mocks.py kind "chat")
  - Task Card component ({{taskcard:ID}}): fields, model reveal, per-field
    self-check, weighted closing feedback
  - notes download headings/appendix (data-note-heading, #notesAppendix)

Content sources (this repo):
  content/lesson-N.html   lesson body, written with the shared course.css components
  content/course.json     lesson metadata, activities, mock screens, Quick Checks, next-lesson previews

A lesson with no content file yet gets a short "coming soon" page, so every
link in the course map and lesson pills always resolves.

Output: public/  (the only folder Cloudflare serves; see wrangler.jsonc)
Run:    python3 tools/build.py
"""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mocks import render_mock, pick_count  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = ROOT / "public"
VERSION = "0.1 pilot"

COURSE = "Understanding Client Work & Instructions"
ACADEMY_URL = "https://probinsiyanongva.org/"
PREV_COURSE = ("Communication & Professionalism", "https://probinsiyanongva.org/communication-professionalism/")
NEXT_COURSE = ("PVA Academy", "https://probinsiyanongva.org/")  # Stage 4 has no course yet
STAGE_TAG = "STAGE 3 · LEARN TO WORK"
OPTIONAL = [
    ("Document Basics", "https://pva-document-basics.probinsiyanongva.workers.dev/",
     "Practice creating, formatting and saving simple documents."),
    ("Spreadsheet Basics", "https://pva-spreadsheet-basics.probinsiyanongva.workers.dev/",
     "Practice rows, columns, cells and simple spreadsheet tasks."),
]
FINAL_LABEL = "Final Challenge"
FINAL_SUB = "Diagnostic, no pass mark"  # add the question count once the Final Challenge blueprint is locked

esc = lambda s: html.escape(s, quote=True)
DATA = json.loads((CONTENT / "course.json").read_text(encoding="utf-8"))
LESSONS = DATA["lessons"]  # list of {num, title, next_preview}
TOTAL = len(LESSONS)


# ---------------------------------------------------------------- page chrome (from VA Foundations)
def head(title, root, description=""):
    desc = f'\n<meta name="description" content="{esc(description)}">' if description else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1B4332">{desc}
<title>{esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}shared/course.css">
</head>"""


def chrome_top(root):
    return f"""<a class="skip-link" href="#main-content">Skip to course content</a>
<header class="route-bar"><div class="route-inner"><a class="home-btn" href="{ACADEMY_URL}" aria-label="Back to PVA Academy home page">← PVA Academy</a><div class="route-title"><a href="{root}">{esc(COURSE)}</a></div><div class="route-tag">{STAGE_TAG}</div></div></header>
<div class="progress-wrap"><div class="progress-inner"><div class="progress-label"><span id="progressText">Getting started</span><span id="progressPct">0%</span></div><div class="progress-track" id="progressTrack"></div></div></div>"""


STORAGE_BANNER = """<div class="storage-banner hidden" id="storageBanner" role="status" aria-live="polite"><strong>Progress can't be saved in this browser.</strong><br><span id="storageBannerText">You can continue learning, but your progress may not remain after you close or refresh this page. If you are using private browsing or have blocked site data, try a normal browser window.</span></div>"""

FOOTER = f'<footer><span class="footer-mark">PVA Academy</span> · Practical. Valuable. Authentic. · {esc(COURSE)} v{VERSION}</footer>'

WARNINGS = """<ul>
<li>Your saved progress may not be available if you switch to another device or browser.</li>
<li>Clearing your browser's site data may remove your saved progress.</li>
<li>Private or incognito browsing may prevent your saved progress from being available later.</li>
<li>You are responsible for keeping a backup. Use <strong>Export Progress</strong> to save a backup file.</li>
</ul>"""

PROGRESS_TOOLS = """<div class="progress-tools"><button class="btn subtle" type="button" id="exportBtn">Export Progress</button><button class="btn subtle" type="button" id="restoreBtn">Restore Progress</button><button class="btn subtle" type="button" id="clearBtn">Clear Progress</button><span class="save-state" data-save-state>Progress is saved in this browser.</span><input id="restoreFile" type="file" accept="application/json,.json" hidden></div>"""

JOURNEY = [
    ("1. EXPLORE", "Understand the VA world", "What VA work is, what it can look like, and where to start.", False),
    ("2. BUILD YOUR FOUNDATION", "Become ready to learn and work", "Computer, internet, email and Google Workspace basics.", False),
    ("3. LEARN TO WORK", "Learn how work is actually done", "", True),
    ("4. FIND YOUR DIRECTION", "Choose work worth learning", "Explore skills and possible VA directions.", False),
    ("5. PRACTICE & PROVE", "Build functional skill and evidence", "Practice realistic tasks and create proof of what you can do.", False),
    ("6. ENTER THE MARKET", "Present yourself and begin working", "Prepare your profile, apply for work, and start entering the market.", False),
]


def render_journey():
    items = []
    for name, sub, detail, here in JOURNEY:
        cls = ' class="here"' if here else ""
        tag = '<span class="here-tag">You are here</span>' if here else ""
        det = f'<div class="flow-detail">{esc(detail)}</div>' if detail else ""
        items.append(f'<li{cls}><div class="flow-name">{esc(name)}{tag}</div><div class="flow-sub">{esc(sub)}</div>{det}</li>')
    return '<ol class="flow">' + "".join(items) + "</ol>"


def is_built(num):
    return (CONTENT / f"lesson-{num}.html").exists()


def lesson_rows(prefix):
    rows = "".join(
        f'<li><a class="lesson-row" data-lesson="lesson-{l["num"]}"{"" if is_built(l["num"]) else " data-soon"} href="{prefix}lesson-{l["num"]}/"><span class="lesson-num">{l["num"]}</span>'
        f'<span class="row-text"><span class="row-title">{esc(l["title"])}</span><span class="row-sub">Lesson {l["num"]} of {TOTAL}</span></span>'
        f'<span class="stamp" data-stamp>{"Not started" if is_built(l["num"]) else "Coming soon"}</span></a></li>' for l in LESSONS)
    final_ready = FINAL_SRC.exists() or (OUT / "shared" / "challenge-data.js").exists()
    rows += (f'<li><a class="lesson-row final" data-lesson="final-challenge"{"" if final_ready else " data-soon"} href="{prefix}final-challenge/"><span class="lesson-num">✓</span>'
             f'<span class="row-text"><span class="row-title">{FINAL_LABEL}</span><span class="row-sub">{FINAL_SUB}</span></span>'
             f'<span class="stamp" data-stamp>{"Not started" if final_ready else "Coming soon"}</span></a></li>')
    return rows


def journey_pager():
    """Previous / next course in the Beginner VA Journey (links out of this course)."""
    return (f'<nav class="pager" aria-label="Beginner VA Journey">'
            f'<a class="prev" href="{PREV_COURSE[1]}"><span class="pager-dir">← Previous course</span><span class="pager-title">{esc(PREV_COURSE[0])}</span></a>'
            f'<a class="next" href="{NEXT_COURSE[1]}"><span class="pager-dir">Return to →</span><span class="pager-title">{esc(NEXT_COURSE[0])}</span></a></nav>')


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


# ---------------------------------------------------------------- activities from course.json
def render_activity(act_id, act):
    """{{activity:ID}} in a lesson body -> a graded activity (same markup as VA Foundations).

    Optional (Part 5): act["label"] (default "Activity"), act["layout"] == "row"
    (options side by side, e.g. Do / Background), act["qlabel"] (default "Question"),
    item["mocks"] (several static mocks above the question) and item["feedback"]
    (one feedback text per option, shown for the option the learner picked)."""
    items = []
    row = act.get("layout") == "row"
    qlabel = act.get("qlabel", "Question")
    numbered = act.get("numbered", True)
    for i, it in enumerate(act["items"], 1):
        key = f"act:{act_id}-{i}"
        mock = it.get("mock")
        fb = it.get("feedback")
        if mock and mock.get("pick"):
            # the learner clicks a row in the mock screen; the rows are the choices
            n = pick_count(mock)
            assert 0 <= it["answer"] < n, (act_id, i)
            assert not fb, (act_id, i, "per-option feedback is not supported on pickable mocks")
            above, opts_html = "", render_mock(mock, pick_name=key)
        else:
            above = render_mock(mock) if mock else ""
            above += "".join(render_mock(mm) for mm in it.get("mocks", []))
            if fb:
                assert len(fb) == len(it["options"]), (act_id, i, "one feedback per option")
            opts = "".join(
                f'<label class="choice"{(" data-fb=" + chr(34) + esc(fb[j]) + chr(34)) if fb else ""}>'
                f'<input type="radio" name="{esc(key)}" value="{j}"><span>{o}</span></label>'
                for j, o in enumerate(it["options"]))
            assert 0 <= it["answer"] < len(it["options"]), (act_id, i)
            opts_html = f'<div class="{"choice-row" if row else "choice-group"}" role="radiogroup">{opts}</div>'
        then = it.get("then")
        num = f'{esc(qlabel)} {i}' if numbered else esc(qlabel)
        if then:
            num += ' · Step 1'
        q = f'<div class="act-q"><span class="q-num">{num}</span><br><p>{it["q"]}</p></div>'
        # pickable mock or several comparison mocks: the question comes first (it says what to look for);
        # a single scene-setting mock, or "evidence_first", puts the mocks before the question
        q_first = ((mock and mock.get("pick")) or it.get("mocks")) and not it.get("evidence_first")
        above += f'<p class="act-context">{it["context"]}</p>' if it.get("context") else ""
        body = q + above + opts_html if q_first else above + q + opts_html
        if it.get("divider_before"):
            items.append('<hr class="pair-divider">')
        if it.get("before_html"):                                # e.g. a note shared by a pair of items
            items.append(it["before_html"])
        good = it.get("good", "")
        items.append(
            f'<div class="act-item act-graded{" act-row" if row else ""}{" act-step1" if then else ""}" data-key="{esc(key)}" data-correct="{it["answer"]}" '
            f'data-good="{esc(good)}" data-try="{esc(it.get("try", good))}">'
            f'{body}<div class="feedback" aria-live="polite"></div></div>')
        if then:
            # Two-step item (Part 5): step 2 ("What decided it?") stays hidden until step 1 is
            # answered, so its options can't hint at the step-1 answer. Both steps are scored and
            # saved. Reusable for Final Challenge two-step decision items.
            tfb = then.get("feedback")
            if tfb:
                assert len(tfb) == len(then["options"]), (act_id, i, "step 2: one feedback per option")
            assert 0 <= then["answer"] < len(then["options"]), (act_id, i, "step 2")
            k2 = key + "-why"
            topts = "".join(
                f'<label class="choice"{(" data-fb=" + chr(34) + esc(tfb[j]) + chr(34)) if tfb else ""}>'
                f'<input type="radio" name="{esc(k2)}" value="{j}"><span>{o}</span></label>'
                for j, o in enumerate(then["options"]))
            items.append(
                f'<div class="act-item act-graded act-step2 hidden" data-key="{esc(k2)}" data-after="{esc(key)}" '
                f'data-correct="{then["answer"]}" data-good="" data-try="">'
                f'<div class="act-q"><span class="q-num">{num.replace("Step 1", "Step 2")}</span><br><p>{then["q"]}</p></div>'
                f'<div class="choice-group" role="radiogroup">{topts}</div>'
                f'<div class="feedback" aria-live="polite"></div></div>')
    intro = f'<p>{act["intro"]}</p>' if act.get("intro") else ""
    intro += act.get("intro_html", "")                          # may contain {{mock:ID}} / {{carry:ID}}
    intro += "".join(render_mock(mm) for mm in act.get("mocks", []))
    title = f'<h2>{esc(act["title"])}</h2>' if act.get("title") else ""
    return (f'<section class="activity"><div class="activity-title">{esc(act.get("label", "Activity"))}</div>{title}{intro}'
            + "".join(items) +
            '<div class="hero-actions" style="margin:4px 0 12px"><button type="button" class="btn subtle small-btn" '
            'data-reset-activity>Reset this activity</button></div></section>')


def render_taskcard(tc_id, tc):
    """{{taskcard:ID}} -> Task Card: fields (saved), model reveal, per-field self-check,
    weighted closing feedback. Reusable across Part 5 lessons (course.json "taskcards")."""
    k = f"tc:{tc_id}"
    fields = tc["fields"]
    note_title = tc.get("note_heading", "My Task Card")
    out = [f'<section class="taskcard" data-taskcard="{esc(tc_id)}">',
           (f'<div class="activity-title">{esc(tc.get("label", "Practice"))}</div>' if tc.get("label", "Practice") else ""),
           (f'<h2>{esc(tc["title"])}</h2>' if tc.get("title") else ""),   # empty: the card continues the activity above it
           tc.get("intro_html", ""),
           f'<div hidden data-note-heading="{esc(note_title)}"></div>']
    for f in fields:
        fid = f'{tc_id}-{f["key"]}'
        out.append(f'<div class="tc-field"><label class="field-label" for="{fid}">{esc(f["label"])}</label>'
                   f'<textarea class="response" id="{fid}" data-key="{k}:{f["key"]}" data-note-label="{esc(f["label"])}" '
                   f'placeholder="{esc(f["placeholder"])}"></textarea>'
                   f'<p class="saved-note" data-for="{fid}" aria-live="polite"></p></div>')
    out.append(f'<div class="tc-reveal-row"><button type="button" class="btn secondary" data-tc-reveal disabled>{esc(tc.get("reveal_label", "Show the model Task Card"))}</button>'
               f'<button type="button" class="tc-anyway" data-tc-anyway>{esc(tc.get("anyway_label", "Show me anyway"))}</button></div>')
    rows = "".join(f'<tr><td>{esc(f["label"])}</td><td>{f["model"]}</td></tr>' for f in fields)
    checks = "".join(
        f'<div class="tc-check-row"><p class="act-q">{esc(f["label"])}: {f["check"]}</p>'
        f'<div class="choice-row self-choice" role="radiogroup" data-key="{k}:check:{f["key"]}" '
        f'data-note-label="Self-check: {esc(f["label"])}" aria-label="{esc(f["label"])} self-check">'
        f'<label class="choice"><input type="radio" name="{k}:check:{f["key"]}" value="Got it"><span>Got it</span></label>'
        f'<label class="choice"><input type="radio" name="{k}:check:{f["key"]}" value="Missed something"><span>Missed something</span></label>'
        f'</div></div>' for f in fields)
    closing = tc["closing"]
    critical = [f["key"] for f in fields if f.get("critical")]
    out.append(f'<div class="tc-model hidden" data-tc-model>'
               f'<div class="section-label">{esc(tc.get("model_heading", "Model"))}</div>'
               f'<div class="table-wrap"><table><thead><tr><th>{esc(tc.get("model_col", "Part"))}</th><th>Model</th></tr></thead><tbody>{rows}</tbody></table></div>'
               f'<div class="tc-check"><h3 style="margin-top:6px">Self-check</h3><p>{tc["check_intro"]}</p>{checks}</div>'
               f'<div class="feedback tc-closing" aria-live="polite" data-tc-closing '
               f'data-critical="{esc(",".join(critical))}" '
               f'data-msg-critical="{esc(closing["critical_missed"])}" '
               f'data-msg-other="{esc(closing["other_missed"])}" '
               f'data-msg-all="{esc(closing["all_got"])}"></div>'
               f'</div>')
    if tc.get("after_html"):
        out.append(tc["after_html"])
    out.append('</section>')
    return "".join(out)


def render_carry(cid, cfg):
    """{{carry:ID}} -> read-only panel showing a Task Card (or list) the learner saved in an
    earlier lesson. Filled in the browser from that lesson's saved drafts; if nothing was
    saved, shows the fallback note and the model. Reusable (Lesson 2 shows Lesson 1's card,
    Lesson 3 will show Lesson 2's list). Included in the notes download when saved."""
    rows = "".join(
        f'<tr><td>{esc(f["label"])}</td><td data-carry-key="{esc(cfg["key_prefix"] + f["key"])}" '
        f'data-note-label="{esc(f["label"])}" data-note-from="{esc(cfg["from_lesson"])}" data-note-optional>'
        f'<span class="carry-model" hidden>{f["model"]}</span><span class="carry-value"></span></td></tr>' for f in cfg["fields"])
    return (f'<div class="carry" data-carry-from="{esc(cfg["from_lesson"])}">'
            f'<div class="section-label">{esc(cfg["title"])}</div>'
            f'<p class="carry-fallback small hidden">{esc(cfg["fallback_note"])}</p>'
            f'<div hidden data-note-heading="{esc(cfg["note_heading"])}" data-note-from="{esc(cfg["from_lesson"])}" data-note-optional></div>'
            f'<div class="table-wrap"><table><thead><tr><th>{esc(cfg.get("col", "Part"))}</th><th>{esc(cfg.get("value_col", "Yours"))}</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div></div>')


def render_order(oid, cfg):
    """{{order:ID}} -> put-the-steps-in-order activity (component from Computer & Laptop Basics).

    Part 5 extension: cfg["rules"] makes it a *workable-order* activity. Each rule is
    {"first": [ids], "then": [ids], "kind": "needs" | "early" | "priority", "line": html}:
    every step in "first" must be placed before every step in "then". Any order that meets
    all rules is accepted; feedback lists each unmet rule's line once, then one workable order
    (the model order, i.e. the order of cfg["steps"]). Without rules it scores one exact order.
    Reusable for the Final Challenge's ordering items."""
    key = f"act:order-{oid}"
    steps = cfg["steps"]
    ids = [st["id"] for st in steps]
    assert len(set(ids)) == len(ids), oid
    rules = cfg.get("rules", [])
    for r in rules:
        assert r["kind"] in ("needs", "early", "priority"), (oid, r)
        assert all(x in ids for x in r["first"] + r["then"]), (oid, r)
        assert not set(r["first"]) & set(r["then"]), (oid, r)
    # the model order itself must meet every rule
    pos = {sid: i for i, sid in enumerate(ids)}
    assert all(pos[a] < pos[b] for r in rules for a in r["first"] for b in r["then"]), (oid, "model order breaks a rule")
    rules_js = json.dumps([{"first": r["first"], "then": r["then"], "kind": r["kind"], "line": r["line"]} for r in rules],
                          ensure_ascii=False)
    hidden = "".join(f'<span data-step="{i}" data-sid="{esc(st["id"])}">{st["text"]}</span>' for i, st in enumerate(steps, 1))
    title = f'<h2>{esc(cfg["title"])}</h2>' if cfg.get("title") else ""
    note = (f'<div hidden data-order-note="{esc(key)}" data-note-label="{esc(cfg["note_label"])}"></div>'
            if cfg.get("note_label") else "")
    return (f'<section class="activity order-activity" data-key="{esc(key)}"'
            + (f" data-rules='{esc(rules_js)}'" if rules else "")
            + f' data-good="{esc(cfg.get("good", ""))}">'
            f'<div class="activity-title">{esc(cfg.get("label", "Activity"))}</div>{title}{cfg.get("intro_html", "")}'
            f'<div hidden>{hidden}</div>{note}'
            '<div class="order-label">Steps</div><ul class="order-pool"></ul>'
            '<div class="order-label">Your order</div><ol class="order-answer"></ol>'
            '<div class="hero-actions" style="margin:4px 0 8px"><button type="button" class="btn small-btn" data-order="check" disabled>Check my order</button>'
            '<button type="button" class="btn subtle small-btn" data-order="undo" disabled>Undo last</button>'
            '<button type="button" class="btn subtle small-btn" data-order="reset">Start again</button></div>'
            '<div class="feedback" aria-live="polite"></div></section>')


def fill_activities(content, l):
    # Order matters: activities and Task Cards may contain {{carry:ID}} / {{mock:ID}} tokens
    # in their intro HTML, so those are resolved after them.
    for act_id, act in (l.get("activities") or {}).items():
        token = "{{activity:" + act_id + "}}"
        assert token in content, (l["num"], token)
        content = content.replace(token, render_activity(act_id, act))
    assert "{{activity:" not in content, l["num"]
    for oid, cfg in (l.get("orders") or {}).items():
        token = "{{order:" + oid + "}}"
        assert token in content, (l["num"], token)
        content = content.replace(token, render_order(oid, cfg))
    assert "{{order:" not in content, l["num"]
    for tc_id, tc in (l.get("taskcards") or {}).items():
        token = "{{taskcard:" + tc_id + "}}"
        assert token in content, (l["num"], token)
        content = content.replace(token, render_taskcard(tc_id, tc))
    assert "{{taskcard:" not in content, l["num"]
    for cid, cfg in (l.get("carry") or {}).items():
        token = "{{carry:" + cid + "}}"
        assert token in content, (l["num"], token)
        content = content.replace(token, render_carry(cid, cfg))
    assert "{{carry:" not in content, l["num"]
    for mock_id, mock in (l.get("mocks") or {}).items():
        token = "{{mock:" + mock_id + "}}"
        assert token in content, (l["num"], token)
        content = content.replace(token, render_mock(mock))
    assert "{{mock:" not in content, l["num"]
    # keep a key combination (Ctrl + C) on one line
    # (two keys only: longer combinations may wrap on narrow phones)
    return re.sub(r"(<kbd>[^<]*</kbd>\s*\+\s*<kbd>[^<]*</kbd>)(?!\s*\+)", r'<span class="keys">\1</span>', content)


# ---------------------------------------------------------------- lessons
def build_lesson(l):
    num, title = l["num"], l["title"]
    root = "../"
    src = CONTENT / f"lesson-{num}.html"
    built = src.exists()
    if built:
        content = fill_activities(src.read_text(encoding="utf-8").strip(), l)
    else:
        content = (f'<div class="callout"><strong>Lesson {num} is coming soon.</strong> '
                   'Lessons that are ready are listed on the '
                   f'<a href="{root}">course home page</a>.</div>')

    prev_link = (f'<a class="prev" href="../lesson-{num - 1}/"><span class="pager-dir">← Previous</span><span class="pager-title">Lesson {num - 1}: {esc(LESSONS[num - 2]["title"])}</span></a>'
                 if num > 1 else f'<a class="prev" href="../"><span class="pager-dir">← Back</span><span class="pager-title">{esc(COURSE)} home</span></a>')
    next_link = (f'<a class="next" href="../lesson-{num + 1}/"><span class="pager-dir">Next →</span><span class="pager-title">Lesson {num + 1}: {esc(LESSONS[num]["title"])}</span></a>'
                 if num < TOTAL else f'<a class="next" href="../final-challenge/"><span class="pager-dir">Next →</span><span class="pager-title">{FINAL_LABEL}</span></a>')

    next_block = ""
    if built and l.get("next_preview"):
        if num < TOTAL:
            heading, href, label = LESSONS[num]["title"], f"../lesson-{num + 1}/", f"Go to Lesson {num + 1} →"
        else:
            heading, href, label = FINAL_LABEL, "../final-challenge/", "Go to the Final Challenge →"
        section = "Next Lesson" if num < TOTAL else "Next Step"
        paras = "".join(f"<p>{p}</p>" for p in l["next_preview"])
        next_ready = is_built(num + 1) if num < TOTAL else FINAL_SRC.exists() or (OUT / "shared" / "challenge-data.js").exists()
        next_block = (f'<section class="card"><div class="connection-title">{section}</div>'
                      f'<h2>{esc(heading)}</h2>{paras}'
                      + (f'<div class="hero-actions"><a class="btn" href="{href}">{label}</a></div></section>' if next_ready
                         else '<div class="hero-actions"><span class="btn subtle" aria-disabled="true">Coming soon</span></div></section>'))

    footer = ""
    if built:
        footer = f"""<section class="quick-check" id="quickCheck" aria-label="Quick Check"></section>
<div class="lesson-footer"><span class="next-hint">Finished this lesson? Marking it complete is saved in this browser.</span><div class="footer-actions"><button class="btn" type="button" id="markBtn">Mark Lesson {num} complete</button><button class="btn subtle" type="button" id="notDoneBtn" disabled>Mark as not done</button></div></div>
<div class="tip hidden" id="donePanel" role="status"><strong>Lesson {num} is marked complete.</strong> <span class="small">It's saved in this browser.</span><div class="hero-actions" style="margin-top:10px"><button class="btn secondary small-btn" type="button" id="notesBtn">Download my Lesson {num} notes (.txt)</button></div></div>"""

    scripts = (f'<script src="{root}shared/progress.js"></script>\n<script src="{root}shared/quick-checks.js"></script>\n'
               f'<script src="{root}shared/lesson.js"></script>') if built else \
              (f'<script src="{root}shared/progress.js"></script>\n'
               f'<script>PVACW.renderProgressBar("lesson-{num}");PVACW.renderLessonNav("lesson-{num}","{root}");</script>')

    page = f"""{head(f"Lesson {num}: {title} — {COURSE} | PVA Academy", root)}
<body data-lesson-id="lesson-{num}" data-root="{root}">
{chrome_top(root)}
<main id="main-content">
{STORAGE_BANNER}
<nav class="lesson-nav" id="lessonNav" aria-label="Course lessons"></nav>
<article class="card lesson" id="lessonCard">
<div class="lesson-head"><div class="lesson-num">{num}</div><div class="lesson-title-wrap"><div class="section-label">Lesson {num} of {TOTAL}</div><h1>{esc(title)}</h1><span class="done-stamp">✓ Completed</span></div></div>
<div class="lesson-body">
{content}
</div>
{footer}
</article>
{next_block}
<nav class="pager" aria-label="Lesson navigation">{prev_link}{next_link}</nav>
{FOOTER}
</main>
{scripts}
</body>
</html>
"""
    write(OUT / f"lesson-{num}" / "index.html", page)
    return built


def build_quick_checks():
    qc = {f'lesson-{l["num"]}': l["quick_check"] for l in LESSONS if l.get("quick_check")}
    for k, v in qc.items():
        for q in v["questions"]:
            assert 0 <= q["answer"] < len(q["options"]) and len(q["options"]) >= 3, (k, q["id"])
    write(OUT / "shared" / "quick-checks.js",
          "/* Quick Checks — Understanding Client Work & Instructions. Not pass/fail. Built from content/course.json. */\n"
          "window.CW_QUICK_CHECKS = " + json.dumps(qc, ensure_ascii=False, indent=1) + ";\n")
    return sum(len(v["questions"]) for v in qc.values())


# ---------------------------------------------------------------- final challenge
FINAL_SRC = ROOT / "tools" / "source" / "final-challenge.json"  # private: holds the answer key
SALT = "pva-cw-2026"


def fnv(s: str) -> str:
    h = 2166136261
    for ch in s.encode("utf-8"):
        h ^= ch
        h = (h * 16777619) & 0xFFFFFFFF
    return format(h, "08x")


def build_final():
    """Final Challenge page + hashed question data.

    The source (with answers) is private and kept out of the public repo, like
    VA Foundations. Without it, the already-built public files are left as they are."""
    data_js = OUT / "shared" / "challenge-data.js"
    if not FINAL_SRC.exists():
        if data_js.exists():
            return "kept existing (private source not present)"
        # Part 5 pilot: the Final Challenge isn't written yet -> a "coming soon" page, no challenge data
        root = "../"
        write(OUT / "final-challenge" / "index.html", f"""{head(f"{FINAL_LABEL} — {COURSE} | PVA Academy", root)}
<body data-root="{root}">
{chrome_top(root)}
<main id="main-content">
{STORAGE_BANNER}
<nav class="lesson-nav" id="lessonNav" aria-label="Course lessons"></nav>
<section class="card"><div class="section-label">{FINAL_LABEL}</div>
<h1 style="font:700 clamp(1.7rem,4vw,2.3rem)/1.15 Fraunces,Georgia,serif;color:var(--green);margin:0 0 10px">{FINAL_LABEL}</h1>
<div class="callout"><strong>The Final Challenge is coming soon.</strong> Lessons that are ready are listed on the <a href="{root}">course home page</a>.</div></section>
{FOOTER}
</main>
<script src="{root}shared/progress.js"></script>
<script>PVACW.renderProgressBar("final-challenge");PVACW.renderLessonNav("final-challenge","{root}");</script>
</body>
</html>
""")
        return "placeholder (not written yet)"
    src = json.loads(FINAL_SRC.read_text(encoding="utf-8"))
    qs = []
    for n, q in enumerate(src["questions"], 1):
        assert 0 <= q["answer"] < len(q["options"]) == 4, n
        qs.append({"n": n, "html": q["q"], "options": [esc(o) for o in q["options"]],
                   "k": fnv(f"{SALT}|{n}|{q['answer']}"), "review": q["review"]})
    assert qs, "Final Challenge has no questions"  # count is set by the locked blueprint
    write(data_js, "/* Final Challenge questions. Answers are hashed, not stored as letters. */\n"
          "window.CW_CHALLENGE = " + json.dumps(qs, ensure_ascii=False, indent=1) + ";\nwindow.CW_SALT = " + json.dumps(SALT) + ";\n")

    root = "../"
    page = f"""{head(f"{FINAL_LABEL} — {COURSE} | PVA Academy", root)}
<body data-root="{root}" data-next-course="{NEXT_COURSE[1]}">
{chrome_top(root)}
<main id="main-content">
{STORAGE_BANNER}
<nav class="lesson-nav" id="lessonNav" aria-label="Course lessons"></nav>
<section class="card" id="assessIntro">
<div class="section-label">{FINAL_LABEL}</div><div class="folder-tab">{len(qs)} questions</div>
<h1 style="font:700 clamp(1.7rem,4vw,2.3rem)/1.15 Fraunces,Georgia,serif;color:var(--green);margin:0 0 10px">{esc(COURSE)} — {FINAL_LABEL}</h1>
{src["intro_html"]}
<div class="key-idea"><strong>How it works</strong><ul style="margin:.4em 0 0">
<li>One question at a time. Your answers are saved in this browser as you go.</li>
<li><strong>There is no pass mark.</strong> This challenge is diagnostic: your score shows what's solid and which lessons are worth another look.</li>
<li>After you submit, you'll see your score and a link to the lesson behind any answer that didn't match. You can take it again as many times as you like.</li>
<li>{esc(COURSE)} is complete when all {TOTAL} lessons are marked complete and you've submitted this challenge once.</li>
</ul></div>
<div id="gate" class="callout hidden"></div>
<div class="hero-actions"><button class="btn" type="button" id="startBtn">Start the challenge</button></div>
</section>
<section class="card hidden" id="assessRunner" aria-live="polite"></section>
<section class="card hidden" id="assessResult"></section>
<section class="completion hidden" id="completion"></section>
{FOOTER}
</main>
<script src="{root}shared/progress.js"></script>
<script src="{root}shared/challenge-data.js"></script>
<script src="{root}shared/challenge.js"></script>
</body>
</html>
"""
    write(OUT / "final-challenge" / "index.html", page)
    return "built"


# ---------------------------------------------------------------- home
# NOTE (pilot): the course home copy below is DRAFT. It was not part of the locked
# Lesson 1 production copy and needs review before release.
def build_home():
    root = "./"
    fit_rows = "".join(
        f'<div class="act-item fit-row" data-key="fit-{i}" data-lesson="{f["lesson"]}"><p class="act-q">{esc(f["text"])}</p>'
        f'<div class="choice-row" role="radiogroup" aria-label="{esc(f["text"])}">'
        f'<label class="choice"><input type="radio" name="fit-{i}" value="Yes"><span>Yes, I can</span></label>'
        f'<label class="choice"><input type="radio" name="fit-{i}" value="Not yet"><span>Not yet</span></label></div></div>'
        for i, f in enumerate(DATA["fit_check"], 1))
    outcomes = "".join(f"<li>{esc(o)}</li>" for o in DATA["outcomes"])
    built = sum(1 for l in LESSONS if is_built(l["num"]))
    pilot_note = ("" if built == TOTAL else
                  f'<div class="callout"><strong>This course is being released lesson by lesson.</strong> '
                  f'{"Lesson 1 is" if built == 1 else f"{built} lessons are"} ready now. The other lessons and the Final Challenge are coming soon.</div>')

    page = f"""{head(f"{COURSE} — PVA Academy", root, "A free, self-paced PVA Academy course for aspiring VAs: read a client request carefully, decide whether you can start, plan the work, and check it before you say it's done.")}
<body data-root="{root}" data-page="home" data-next-course="{NEXT_COURSE[1]}">
{chrome_top(root)}
<main id="main-content">
<section class="course-header" id="top"><div class="eyebrow">PVA Academy · Beginner VA Journey · Stage 3: Learn to Work</div><h1>{esc(COURSE)}</h1><p>Turn a client's request into correctly finished work: read what's actually being asked, decide whether you can start, plan the work, and check it before you say it's done.</p><div class="meta-row"><span class="meta-chip">Free</span><span class="meta-chip">Self-Paced</span><span class="meta-chip">No Login</span><span class="meta-chip">{TOTAL} Lessons + Final Challenge</span></div></section>
{STORAGE_BANNER}
{pilot_note}
<div class="before-start" aria-labelledby="before-start-title"><h2 id="before-start-title">Before You Start</h2><p><strong>No login is required.</strong> You can start learning right away.</p><p>Your course progress is saved on the device and browser you are using right now. Nothing is sent to an account or a server.</p><p>For the best experience, keep using the <strong>same device and browser</strong> while you take this course.</p><p><strong>Important:</strong></p>{WARNINGS}</div>

<section class="card" aria-labelledby="progress-h">
<div class="section-label">Your progress</div>
<h2 id="progress-h" style="margin-bottom:6px">Where you are</h2>
<div class="progress-summary"><span class="big-pct" id="homePct">0%</span><span id="homeSummary">0 of {TOTAL} lessons complete · Final Challenge not done yet</span></div>
<div class="hero-actions"><a class="btn" id="continueBtn" href="lesson-1/">Start Lesson 1</a><a class="btn secondary" href="progress/">Progress &amp; backup</a></div>
{PROGRESS_TOOLS}
</section>

<section class="completion hidden" id="completion"></section>

<section class="card" aria-labelledby="about-h">
<div class="section-label">About this course</div>
<h2 id="about-h">Understanding the work</h2>
<p>A client sends a request. Before you start, you need to know exactly what's being asked, what "done" looks like, and whether anything is missing. When you're finished, you need to know it's actually right before you say so.</p>
<p>By the end of this course, you should be able to say: <strong>"I understand what needs to be done, I know what I need to check, and I know what to do when something is unclear."</strong></p>
<p>In practice, that means you can:</p>
<ul>{outcomes}</ul>
<p>This course builds on <a href="{PREV_COURSE[1]}">{esc(PREV_COURSE[0])}</a>, which covers how to write to clients. Here you work out <em>what</em> needs to happen; when a message is needed, the lessons point you back to that course. The tasks use simple lists, files and sheets, so no specialist VA skills are needed.</p>
<p class="small">Names, email addresses and companies in the examples are made up. The example screens are simplified drawings.</p>
</section>

<section class="card" aria-labelledby="fit-h" id="fitCheck">
<div class="section-label">Check your starting point</div>
<h2 id="fit-h">Do you need this course?</h2>
<p>Answer honestly. There is no score, and nobody else sees your answers. They are saved in this browser.</p>
{fit_rows}
<div class="feedback" id="fitResult" aria-live="polite"></div>
<div class="hero-actions" style="margin-top:12px"><button class="btn subtle small-btn" type="button" id="fitReset">Clear my answers</button></div>
</section>

<section class="card" aria-labelledby="journey-h">
<div class="section-label">The PVA Beginner VA Journey</div>
<h2 id="journey-h">You are in Stage 3: Learn to Work</h2>
<p>Stage 3 has two courses:</p>
<ol><li><a href="{PREV_COURSE[1]}">{esc(PREV_COURSE[0])}</a>: working with people, and what to say.</li><li><strong>{esc(COURSE)}</strong> (this course): understanding the work and doing it correctly.</li></ol>
{render_journey()}
</section>

<section class="card" aria-labelledby="map-h">
<div class="section-label">Course map</div><div class="folder-tab">{TOTAL} lessons + Final Challenge</div>
<h2 id="map-h">Lessons</h2>
<ul class="lesson-list" id="lessonList">{lesson_rows("")}</ul>
</section>
{journey_pager()}
{FOOTER}
</main>
<script src="{root}shared/progress.js"></script>
<script src="{root}shared/home.js"></script>
</body>
</html>
"""
    write(OUT / "index.html", page)


def build_progress_page():
    root = "../"
    page = f"""{head(f"Progress & Backup — {COURSE} | PVA Academy", root)}
<body data-root="{root}" data-page="progress" data-next-course="{NEXT_COURSE[1]}">
{chrome_top(root)}
<main id="main-content">
{STORAGE_BANNER}
<nav class="lesson-nav" id="lessonNav" aria-label="Course lessons"></nav>
<section class="card">
<div class="section-label">Progress &amp; backup</div>
<h1 style="font:700 clamp(1.7rem,4vw,2.3rem)/1.15 Fraunces,Georgia,serif;color:var(--green);margin:0 0 10px">Your {esc(COURSE)} progress</h1>
<div class="progress-summary"><span class="big-pct" id="homePct">0%</span><span id="homeSummary">0 of {TOTAL} lessons complete</span></div>
<p>Your progress is saved only in this browser, on this device. Nothing is sent to an account or a server.</p>
{WARNINGS}
{PROGRESS_TOOLS}
<p class="small"><strong>Export Progress</strong> downloads a backup file. <strong>Restore Progress</strong> loads a {esc(COURSE)} backup and <em>replaces</em> what is saved in this browser. Backups from other PVA courses can't be restored here. <strong>Clear Progress</strong> removes only {esc(COURSE)} progress.</p>
</section>
<section class="card"><div class="section-label">Course map</div><h2>Lessons</h2><ul class="lesson-list" id="lessonList">{lesson_rows("../")}</ul></section>
{FOOTER}
</main>
<script src="{root}shared/progress.js"></script>
<script src="{root}shared/home.js"></script>
</body>
</html>
"""
    write(OUT / "progress" / "index.html", page)


def main():
    assert TOTAL == 6
    built = [build_lesson(l) for l in LESSONS]
    n_qc = build_quick_checks()
    final = build_final()
    build_home()
    build_progress_page()
    print(f"lessons built: {sum(built)} of {TOTAL} | quick check questions: {n_qc} | final challenge: {final}")


if __name__ == "__main__":
    main()
