# Paten für Ausgeschiedene und Tippkönig: zwei Handys, nachgebaute Firebase und nachgestellte Live-Daten.
# Start: im Projektordner "python3 -m http.server 8080", dann "python3 tests/paten.py".
import json, time, sys, os, tempfile
from datetime import datetime, timezone
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + "/fakefb")
from fakeserver import FakeFirestore
from playwright.sync_api import sync_playwright

OUT, FAKE, KEY = tempfile.gettempdir(), HERE + "/fakefb", "fca-bier-roulette:v1"
URL, MIN = "http://localhost:8080/", 60000
srv = FakeFirestore()
results, errors = [], []
now = int(time.time() * 1000)

def check(name, ok, info=""):
    results.append(ok)
    print(("ok   " if ok else "FEHLER ") + name + (f"  ({info})" if info else ""), flush=True)

# Live-Daten: Anpfiff vor 4 Minuten, noch kein Tor
def iso(ms): return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
FEED = {"kickoff": now - 4 * MIN, "goals": [], "end": [0, 0]}
def match_json():
    fca = {"teamId": 95, "teamName": "FC Augsburg", "shortName": "Augsburg"}
    opp = {"teamId": 134, "teamName": "SV Werder Bremen", "shortName": "Bremen"}
    res = [{"resultID": 1, "resultName": "Endergebnis", "pointsTeam1": FEED["end"][0], "pointsTeam2": FEED["end"][1], "resultOrderID": 2, "resultTypeID": 2}]
    return {"matchID": 77001, "matchDateTimeUTC": iso(FEED["kickoff"]), "matchDateTime": "", "leagueShortcut": "bl1",
            "team1": fca, "team2": opp, "matchIsFinished": False, "matchResults": res,
            "goals": [{"goalID": i, "scoreTeam1": a, "scoreTeam2": b, "matchMinute": m, "goalGetterName": "X"} for i, (a, b, m) in enumerate(FEED["goals"])]}
def live(route):
    url = route.request.url
    body = [match_json()] if url.endswith("/getmatchdata/bl1") else match_json() if url.endswith("/77001") else []
    route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(body))
def route_fake(route):
    name = route.request.url.split("/")[-1].split("?")[0]
    route.fulfill(status=200, content_type="application/javascript", body=open(f"{FAKE}/{name}").read())

def phone(b, name):
    ctx = b.new_context(viewport={"width": int(os.environ.get("W", "390")), "height": 800 if os.environ.get("W") == "360" else 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        reduced_motion="reduce", service_workers="block")
    ctx.expose_binding("__fb", srv.handler)
    ctx.route("**/vendor/firebase/*.js", route_fake)
    ctx.route("https://api.openligadb.de/**", live)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text and "vibrate" not in m.text else None)
    return ctx, pg

def vis(pg, s): return pg.locator(s).is_visible()
def txt(pg, s): return (pg.text_content(s) or "").strip()
def cache(pg, code):
    r = json.loads(pg.evaluate(f"localStorage.getItem('fca-bier-roulette:g:{code}')") or "null")
    return r["competitions"][0] if r else None
def seg_angles(pg):
    return dict(pg.evaluate("""() => [...document.querySelectorAll('#wheel .wheel-seg')].map(p => {
        const n = p.getAttribute('d').match(/-?[\\d.]+/g).map(Number);
        if (n.length < 10) return [p.dataset.id, 360];
        const ang = (x, y) => (Math.atan2(x - 200, -(y - 200)) * 180 / Math.PI + 360) % 360;
        let s = (ang(n[9], n[10]) - ang(n[2], n[3]) + 360) % 360; return [p.dataset.id, Math.round(s * 10) / 10]; })"""))
def close_reveals(pg, seen):
    for _ in range(8):
        if not vis(pg, "#revealSheet"): return
        seen.append(txt(pg, "#revealTitle"))
        pg.click("#revealActions .sheet-next"); pg.wait_for_timeout(450)

P = [{"id": f"p{i+1}", "name": n, "color": c, "active": True, "guest": False}
     for i, (n, c) in enumerate(zip(["Betzmeister", "Cousin", "Demharter M.", "Emilio", "Schaufi", "Schubi", "Flo"],
                                    ["#c8102e", "#1f6fb2", "#c88a0c", "#7b3fa0", "#0f8a6b", "#d4572a", "#3d5a80"]))]

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}), args=["--no-sandbox"])
    ctxA, A = phone(b, "A")
    ctxB, B = phone(b, "B")
    A.goto(URL); A.wait_for_timeout(400)
    day = A.evaluate("""(() => { const d = new Date(); if (d.getHours() < 6) d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()""")
    tip = lambda name, color, first, at: {"first": first, "early": "yes", "half": "no", "at": at, "name": name, "color": color}
    # Laufende Runde: Emilio und Flo sind vor dem Anpfiff schon gezogen worden. Alle haben getippt, Flo nicht.
    round_ = {"id": "rlauf", "startedAt": now - 400 * MIN, "pot": P, "final": None,
              "picks": [{"id": "p4", "at": now - 300 * MIN, "absent": False, "beers": 6, "debtId": None},
                        {"id": "p7", "at": now - 200 * MIN, "absent": True, "beers": None, "debtId": None}]}
    game = {"day": day, "match": {"id": 77001, "kickoff": FEED["kickoff"], "team1": "FC Augsburg", "team2": "SV Werder Bremen", "opp": "Bremen", "fcaFirst": True, "searched": now},
            "tips": {"p1": tip("Betzmeister", "#c8102e", "opp", now - 60 * MIN), "p4": tip("Emilio", "#7b3fa0", "fca", now - 50 * MIN),
                     "p6": tip("Schubi", "#d4572a", "fca", now - 40 * MIN)},
            "results": {}, "liveSays": {}, "locked": None, "patron": {}, "seen": {}}
    old = {"day": "2026-11-22", "match": None, "results": {"first": {"v": "fca", "at": now - 864e5 * 2, "src": "live"}, "early": {"v": "yes", "at": now - 864e5 * 2, "src": "live"}, "half": {"v": "yes", "at": now - 864e5 * 2, "src": "live"}},
           "tips": {"p6": tip("Schubi", "#d4572a", "fca", 1), "p1": {**tip("Betzmeister", "#c8102e", "fca", 1), "half": "yes"}, "p2": tip("Cousin", "#1f6fb2", "opp", 1)},
           "liveSays": {}, "locked": now - 864e5 * 2, "patron": {}, "seen": {}}
    root = {"version": 2, "activeId": "c1", "settings": {"sound": False, "vibrate": False}, "admin": None,
            "competitions": [{"id": "c1", "name": "FCA-Spieltage", "createdAt": now - 864e5 * 30, "fca": True, "players": P,
                              "round": round_, "rounds": [], "pending": [], "debts": [], "tipp": game, "tippArchive": [old],
                              "presence": {"day": day, "ids": [x["id"] for x in P if x["name"] != "Flo"]}}]}
    A.evaluate(f"localStorage.setItem('{KEY}', {json.dumps(json.dumps(root))})"); A.reload(); A.wait_for_timeout(900)
    seenA = []; close_reveals(A, seenA)
    A.click('.tab[data-tab="squad"]'); A.wait_for_timeout(200)
    A.locator("#groupActions .btn", has_text="Gemeinsam starten").click()
    A.wait_for_url("**/?g=*", timeout=15000); A.wait_for_timeout(800)
    code = A.url.split("?g=")[1]
    A.click("#groupSheetActions .sheet-undo"); A.wait_for_timeout(300)
    B.goto(f"{URL}?g={code}"); B.wait_for_selector("#loading", state="hidden", timeout=10000); B.wait_for_timeout(900)

    # 1) Paten werden beim Anpfiff zugelost und auf beiden Handys gleich angezeigt
    pa, pb = cache(A, code)["tipp"]["patron"], cache(B, code)["tipp"]["patron"]
    srvp = srv.comp(code)[0]["tipp"]["patron"]
    check("Nur Emilio (raus, getippt) bekommt einen Paten, Flo (raus, ohne Tipp) nicht", list(pa.keys()) == ["p4"], str(pa))
    check("Pate ist noch im Rad", pa.get("p4") in ("p1", "p2", "p3", "p5", "p6"), pa.get("p4"))
    check("A, B und Server haben denselben Paten", pa == pb == srvp, f"{pa} / {pb} / {srvp}")
    pate = {x["id"]: x["name"] for x in P}[pa["p4"]]
    check("A hat das Paten-Fenster gesehen", "Pate zugelost" in seenA, str(seenA))
    title_b = txt(B, "#revealTitle") if vis(B, "#revealSheet") else ""
    B.screenshot(path=f"{OUT}/p-1-pate.png")
    check("B zeigt das Paten-Fenster", title_b == "Pate zugelost" and "EMILIO" in B.locator("#revealBody").inner_text().upper() and pate.upper() in B.locator("#revealBody").inner_text().upper(), B.locator("#revealBody").inner_text().replace("\n", " ") if title_b else "kein Fenster")
    seenB = []; close_reveals(B, seenB)

    # 2) FCA trifft: Emilio lag richtig, also wird das Feld seines Paten kleiner
    before = seg_angles(A)
    FEED.update(goals=[(1, 0, 3)], end=[1, 0])
    A.reload(); A.wait_for_selector("#revealSheet:not([hidden])", timeout=10000); A.wait_for_timeout(400)
    body = A.locator("#revealBody").inner_text().replace("\n", " ")
    A.screenshot(path=f"{OUT}/p-2-aufloesung.png")
    check("Auflösung nennt den Paten bei Emilio", f"PATE {pate.upper()}" in body.upper(), body)
    seenA = []; close_reveals(A, seenA); A.wait_for_timeout(1200)
    after = seg_angles(A)
    g = cache(A, code)["tipp"]
    tot_b, tot_a = sum(before.values()), sum(after.values())
    check("Feld des Paten ist geschrumpft", after[pa["p4"]] / tot_a < before[pa["p4"]] / tot_b, f"{pate}: {before[pa['p4']]}° -> {after[pa['p4']]}°")

    # 3) Tabelle im Tippspiel
    A.click("#tippBar"); A.wait_for_timeout(400)
    A.evaluate("document.getElementById('tippSheet').scrollTop = 9999"); A.wait_for_timeout(200)
    tab = A.locator(".tipp-table").inner_text().replace("\n", " ")
    A.screenshot(path=f"{OUT}/p-3-tabelle.png")
    check("Tabelle zeigt Pate und Patenkind", f"Pate: {pate}" in tab and "Pate von Emilio" in tab, tab)
    A.click("#tippActions .sheet-next"); A.wait_for_timeout(300)

    # 4) Tippkönig in der Statistik (Gesamt: 22.11. + heute), auch auf B
    A.click('.tab[data-tab="stats"]'); A.wait_for_timeout(300); A.click("#rangeAll"); A.wait_for_timeout(300)
    A.evaluate("document.getElementById('tippKingBox').scrollIntoView({block: 'start'})"); A.wait_for_timeout(200)
    king = A.locator("#tippKing").inner_text().replace("\n", " ")
    A.screenshot(path=f"{OUT}/p-4-tippkoenig.png")
    check("Tippkönig Gesamt: Betzmeister und Schubi gleichauf mit je 4 richtigen", "2 gleichauf mit je 4" in king and "Betzmeister 4 2 80" in king, king)
    close_reveals(B, seenB)
    B.click('.tab[data-tab="stats"]'); B.wait_for_timeout(300); B.click("#rangeAll"); B.wait_for_timeout(1500)
    kb = B.locator("#tippKing").inner_text().replace("\n", " ")
    check("B sieht dieselbe Tabelle (Archiv vom Server)", kb == king, kb)
    A.click("#rangeToday"); A.wait_for_timeout(200)
    check("Heute: nur das heutige Spiel", "1 Spiel" in A.locator("#tippKing").inner_text(), A.locator("#tippKing").inner_text().replace("\n", " "))
    overflow = A.evaluate("document.documentElement.scrollWidth > window.innerWidth")
    check("Kein waagrechtes Überlaufen", not overflow)

    print("Seitenfehler:", [e for e in errors if "Service Worker" not in e][:10])
    b.close()
print(f"\n{results.count(True)} von {len(results)} Prüfungen bestanden")
