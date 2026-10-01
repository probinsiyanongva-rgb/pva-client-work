"""Neutral mock screens for Internet, Email & Google Workspace Basics.

Simplified drawings of Gmail / Drive / Docs / sharing screens, in PVA colours.
They are not copies of Google's design: no logos, no exact layout. A mock is
used only where recognizing what you see on the screen is part of the skill.

render_mock(m)                       static mock (m is a dict from course.json)
render_mock(m, pick_name=key)        same mock, but its main list is a set of
                                     radio choices (the learner clicks the row)
"""
import html

esc = lambda s: html.escape(str(s), quote=True)


def avatar(name, big=False):
    initial = (name.strip()[:1] or "?").upper()
    n = sum(ord(c) for c in name) % 6 + 1
    return f'<span class="avatar av-{n}{" big" if big else ""}" aria-hidden="true">{esc(initial)}</span>'


def _rows(items, pick_name):
    """items: list of inner-HTML strings. Static rows or radio-choice rows."""
    if pick_name:
        out = "".join(f'<label class="choice"><input type="radio" name="{esc(pick_name)}" value="{i}"><span>{h}</span></label>'
                      for i, h in enumerate(items))
        return f'<div class="choice-group mock-list" role="radiogroup">{out}</div>'
    return '<div class="mock-list">' + "".join(f'<div class="mock-row">{h}</div>' for h in items) + "</div>"


def _side(items, active):
    on = ' class="on"'
    return '<div class="mock-side">' + "".join(
        f'<span{on if s == active else ""}>{esc(s)}</span>' for s in items) + "</div>"


def _bar(app, search=None, placeholder="Search", who=None):
    s = ""
    if search is not None:
        s = (f'<span class="mock-search filled">{esc(search)}</span>' if search
             else f'<span class="mock-search">{esc(placeholder)}</span>')
    return f'<div class="mock-bar"><span class="mock-app">{esc(app)}</span>{s}{avatar(who) if who else ""}</div>'


def _att(files):
    return "".join(f'<span class="m-att">{esc(f)}</span>' for f in files or [])


FT = {"DOC": "doc", "SHEET": "sheet", "PDF": "pdf", "FOLDER": "folder", "DOCX": "docx", "XLSX": "xlsx", "IMAGE": "img"}


def _doctable(rows):
    """Optional table inside a Doc mock (Part 5 Lesson 5): first row is the header."""
    if not rows:
        return ""
    head = "".join(f"<th>{esc(c)}</th>" for c in rows[0])
    body = "".join("<tr>" + "".join(f"<td>{esc(v)}</td>" for v in r) + "</tr>" for r in rows[1:])
    return f'<div class="m-doctable"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def render_mock(m, pick_name=None):
    kind = m["kind"]
    who = m.get("who", "Ana Cruz")
    if kind == "inbox":
        side = _side(m.get("side", ["Inbox", "Starred", "Sent", "Drafts", "Spam", "Trash", "All Mail"]), m.get("active", "Inbox"))
        items = []
        for r in m["rows"]:
            tag = f'<span class="m-tag">{esc(r["tag"])}</span>' if r.get("tag") else ""
            att = f'<div>{_att(r.get("att"))}</div>' if r.get("att") else ""
            cls = ' unread' if r.get("unread") else ""
            items.append(f'<span class="m-from{cls}">{esc(r["from"])}</span>'
                         f'<span class="m-text{cls}">{tag}<span class="m-subj">{esc(r["subject"])}</span>'
                         f'<span class="m-snip"> — {esc(r.get("snippet", ""))}</span>{att}</span>'
                         f'<span class="m-date">{esc(r.get("date", ""))}</span>')
        inner = (_bar("Mail", m.get("search", ""), "Search mail", who) +
                 f'<div class="mock-body">{side}<div class="mock-main">{_rows(items, pick_name)}</div></div>')
    elif kind == "email":
        cc = f', cc {esc(m["cc"])}' if m.get("cc") else ""
        body = "".join(f"<p>{esc(p)}</p>" for p in m.get("body", []))
        acts = "".join(f"<span>{a}</span>" for a in m.get("actions", ["Reply", "Reply all", "Forward"]))
        inner = (_bar("Mail", None, who=who) +
                 f'<div class="mock-mail"><p class="m-subject">{esc(m["subject"])}</p>'
                 f'<div class="m-head">{avatar(m["from"])}<div class="m-who"><strong>{esc(m["from"])}</strong> '
                 f'&lt;{esc(m["from_email"])}&gt;<br><span class="small">to {esc(m.get("to", "me"))}{cc} · {esc(m.get("date", ""))}</span></div></div>'
                 f'<div class="m-bodytext">{body}</div><div>{_att(m.get("att"))}</div>'
                 + (f'<div class="mock-actions" aria-hidden="true">{acts}</div>' if acts else '') + '</div>')
    elif kind == "chat":
        # A short chat thread: one bubble per message, sender + time shown (IW-CW addition, Part 5 pilot)
        bubbles = []
        for msg in m["messages"]:
            bubbles.append(f'<div class="chat-msg">{avatar(msg["from"])}<div class="chat-bubble">'
                           f'<div class="chat-meta"><strong>{esc(msg["from"])}</strong> <span>{esc(msg.get("time", ""))}</span></div>'
                           f'<div class="chat-text">{esc(msg["text"])}</div></div></div>')
        inner = (f'<div class="mock-bar"><span class="mock-app">{esc(m.get("app", "Chat"))}</span>'
                 f'<span class="chat-with">{esc(m.get("title", ""))}</span></div>'
                 f'<div class="chat-thread">{"".join(bubbles)}</div>')
    elif kind == "compose":
        items = []
        for label, value in m["fields"]:
            v = f'<span class="m-value">{esc(value)}</span>' if value else '<span class="m-value m-empty">(empty)</span>'
            items.append(f'<span class="m-label">{esc(label)}</span>{v}')
        if pick_name:
            fields = _rows(items, pick_name)
        else:
            fields = "".join(f'<div class="mock-field">{h}</div>' for h in items)
        body = f'<div class="mock-field"><span class="m-value">{esc(m["body"])}</span></div>' if m.get("body") else ""
        inner = (f'<div class="mock-bar"><span class="mock-app">{esc(m.get("title", "New message"))}</span></div>'
                 f'<div>{fields}{body}</div>')
    elif kind == "drive":
        side = _side(m.get("side", ["My Drive", "Shared with me", "Recent", "Starred", "Trash"]), m.get("active", "My Drive"))
        items = []
        for r in m["rows"]:
            t = r["type"].upper()
            items.append(f'<span class="ft ft-{FT.get(t, "doc")}">{esc(t)}</span><span class="m-name">{esc(r["name"])}</span>'
                         f'<span class="m-owner">{esc(r.get("owner", ""))}</span><span class="m-date">{esc(r.get("date", ""))}</span>')
        path = f'<div class="mock-path">{esc(m.get("path", m.get("active", "My Drive")))}</div>'
        inner = (_bar("Drive", m.get("search", ""), "Search in Drive", who) +
                 f'<div class="mock-body">{side}<div class="mock-main">{path}{_rows(items, pick_name)}</div></div>')
    elif kind == "share":
        items = []
        for p in m["people"]:
            role = p.get("role", "Viewer")
            items.append(f'<span class="m-person">{avatar(p["name"])}<span class="m-who"><strong>{esc(p["name"])}</strong><br>'
                         f'<span class="small">{esc(p["email"])}</span></span></span>'
                         f'<span class="m-role{" plain" if role == "Owner" else ""}">{esc(role)}</span>')
        g = m.get("general", {"mode": "Restricted"})
        gdesc = ("Only people with access can open with the link" if g["mode"] == "Restricted"
                 else "Anyone on the internet with the link can open it")
        grole = f'<span class="m-role">{esc(g["role"])}</span>' if g["mode"] != "Restricted" else ""
        gitem = (f'<span class="m-person"><span class="avatar av-6" aria-hidden="true">{"🔒" if g["mode"] == "Restricted" else "🔗"}</span>'
                 f'<span class="m-who"><strong>{esc(g["mode"])}</strong><br><span class="small">{esc(gdesc)}</span></span></span>{grole}')
        if pick_name:
            lists = '<div class="mock-sub">People with access · General access</div>' + _rows(items + [gitem], pick_name)
        else:
            lists = ('<div class="mock-sub">People with access</div>' + _rows(items, None) +
                     '<div class="mock-sub">General access</div>' + _rows([gitem], None))
        inner = (f'<div class="mock-dialog"><p class="m-title">Share “{esc(m["file"])}”</p>'
                 f'<div class="mock-input">Add people, groups or email addresses</div>{lists}'
                 '<div class="mock-actions" aria-hidden="true"><span>Copy link</span><span>Done</span></div></div>')
    elif kind == "access":
        inner = (f'<div class="mock-access"><p class="m-big">You need access</p>'
                 f'<p style="margin:0">Request access, or switch to an account with access.</p>'
                 f'<div class="mock-input" style="max-width:320px;margin:12px auto 0;text-align:left">Message (optional)</div>'
                 f'<span class="m-btn">Request access</span>'
                 f'<p class="m-signed">You’re signed in as <strong>{esc(m["signed_in"])}</strong><br>'
                 f'<span style="color:var(--green);font-weight:700">Switch account</span></p></div>')
    elif kind == "account":
        cur = m["current"]
        others = []
        for a in m.get("others", []):
            note = f'<br><span class="small">{esc(a["note"])}</span>' if a.get("note") else ""
            others.append(f'<span class="m-person">{avatar(a["name"])}<span class="m-who"><strong>{esc(a["name"])}</strong><br>'
                          f'<span class="small">{esc(a["email"])}</span>{note}</span></span>')
        inner = (_bar(m.get("app", "Drive"), None, who=cur["name"]) +
                 f'<div class="mock-account"><div class="m-email">{esc(cur["email"])}</div>{avatar(cur["name"], True)}'
                 f'<div class="m-hi">Hi, {esc(cur["name"].split()[0])}!</div>'
                 f'<span class="mock-actions" style="justify-content:center"><span>Manage your Google Account</span></span>'
                 f'{_rows(others, pick_name) if others else ""}'
                 f'<div class="m-more">+ Add another account</div></div>')
    elif kind == "results":
        items = []
        for r in m["results"]:
            tag = '<span class="m-tag">Sponsored</span>' if r.get("ad") else ""
            date = f'{esc(r["date"])} — ' if r.get("date") else ""
            items.append(f'<span class="mock-result">{tag}<span class="m-site">{esc(r["site"])} · {esc(r["url"])}</span>'
                         f'<span class="m-rtitle">{esc(r["title"])}</span><span class="m-rsnip">{date}{esc(r["snippet"])}</span></span>')
        summary = (f'<div class="m-summary"><span class="m-tag">AI summary</span>{esc(m["summary"])}</div>'
                   if m.get("summary") else "")
        inner = (_bar("Search", m["query"], who=None) +
                 f'<div class="mock-results">{summary}{_rows(items, pick_name)}</div>')
    elif kind == "doc":
        badge = f'<span class="m-badge">{esc(m["badge"])}</span>' if m.get("badge") else ""
        menu = "".join(f"<span>{x}</span>" for x in ["File", "Edit", "View", "Insert", "Format", "Tools"])
        inner = (f'<div class="mock-doc"><div class="m-docname"><span class="ft ft-{FT.get(m.get("type", "DOC"), "doc")}">'
                 f'{esc(m.get("type", "DOC"))}</span>{esc(m["name"])}{badge}<span class="m-status">{esc(m.get("status", ""))}</span></div>'
                 f'<div class="m-menu" aria-hidden="true">{menu}</div>'
                 + "".join(f'<p class="m-docline">{esc(x)}</p>' for x in m.get("lines", []))
                 + _doctable(m.get("table")) + '</div>')
    elif kind == "sheet":
        cols = m["cols"]
        head = '<tr><th></th>' + "".join(f"<th>{esc(c)}</th>" for c in cols) + "</tr>"
        body = "".join(f'<tr><th>{i}</th>' + "".join(f"<td>{esc(v)}</td>" for v in row) + "</tr>"
                       for i, row in enumerate(m["rows"], 1))
        inner = (f'<div class="mock-doc"><div class="m-docname"><span class="ft ft-sheet">SHEET</span>{esc(m["name"])}'
                 f'<span class="m-status">{esc(m.get("status", ""))}</span></div></div>'
                 f'<div class="mock-sheet"><table>{head}{body}</table></div>')
    else:
        raise ValueError(kind)
    cap = m.get("caption", "")
    label = esc(m.get("label", cap or "Example screen"))
    capt = f'<figcaption>{esc(cap)}</figcaption>' if cap else ""
    return f'<figure class="mock" role="group" aria-label="{label}"><div class="mock-frame">{inner}</div>{capt}</figure>'


def pick_count(m):
    """How many choices a pickable mock offers (for answer-range checks)."""
    k = m["kind"]
    if k == "inbox" or k == "drive":
        return len(m["rows"])
    if k == "results":
        return len(m["results"])
    if k == "compose":
        return len(m["fields"])
    if k == "share":
        return len(m["people"]) + 1
    if k == "account":
        return len(m.get("others", []))
    raise ValueError(f"mock kind {k} is not pickable")
