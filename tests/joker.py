# Joker für den Tippkönig: Vergabe nach 5 Tippspielen, Einsetzen im Ergebnisfenster, zweites Handy sieht es mit.
# Start: im Projektordner "python3 -m http.server 8080", dann "python3 tests/joker.py" (W=360 für schmale Handys).
import json, time, sys, os, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + "/fakefb")
from fakeserver import FakeFirestore
from playwright.sync_api import sync_playwright

OUT, FAKE, KEY = tempfile.gettempdir(), HERE + "/fakefb", "fca-bier-roulette:v1"
URL = "http://localhost:8080/"
W = int(os.environ.get("W", "390"))
srv = FakeFirestore()
results, errors = [], []
now = int(time.time() * 1000)

def check(name, ok, info=""):
    results.append(ok)
    print(("ok   " if ok else "FEHLER ") + name + (f"  ({info})" if info else ""), flush=True)
def route_fake(route):
    name = route.request.url.split("/")[-1].split("?")[0]
    route.fulfill(status=200, content_type="application/javascript", body=open(f"{FAKE}/{name}").read())
def phone(b, name):
    ctx = b.new_context(viewport={"width": W, "height": 800 if W < 380 else 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        reduced_motion="reduce", service_workers="block")
    ctx.expose_binding("__fb", srv.handler)
    ctx.route("**/vendor/firebase/*.js", route_fake)
    ctx.route("https://api.openligadb.de/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body="[]"))
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text and "vibrate" not in m.text else None)
    return ctx, pg
def vis(pg, s): return pg.locator(s).is_visible()
def txt(pg, s): return (pg.text_content(s) or "").strip()
def server(code): return srv.comp(code)[0]
def close_reveals(pg, seen=None):
    for _ in range(8):
        if not vis(pg, "#revealSheet"): return
        if seen is not None: seen.append(txt(pg, "#revealTitle"))
        pg.click("#revealActions .sheet-next"); pg.wait_for_timeout(400)
def wait_sheet(pg, t=10000):
    pg.wait_for_selector("#sheet:not([hidden])", timeout=t); pg.wait_for_timeout(200)

P = [{"id": f"p{i+1}", "name": n, "color": c, "active": True, "guest": False}
     for i, (n, c) in enumerate(zip(["Betzmeister", "Cousin", "Demharter M.", "Emilio", "Schaufi", "Schubi"],
                                    ["#c8102e", "#1f6fb2", "#c88a0c", "#7b3fa0", "#0f8a6b", "#d4572a"]))]
tip = lambda name, first, early, half: {"first": first, "early": early, "half": half, "at": 1, "name": name, "color": "#d4572a"}
RES = {"first": {"v": "fca", "at": 1, "src": "live"}, "early": {"v": "yes", "at": 1, "src": "live"}, "half": {"v": "no", "at": 1, "src": "live"}}

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}), args=["--no-sandbox"])
    ctxA, A = phone(b, "A")
    ctxB, B = phone(b, "B")
    A.goto(URL); A.wait_for_timeout(400)
    day = A.evaluate("""(() => { const d = new Date(); if (d.getHours() < 6) d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()""")
    y, m = int(day[:4]), int(day[5:7])
    season = y if m >= 7 else y - 1
    # Fünf frühere Tippspiele dieser Saison: Schubi liegt immer richtig, die anderen nicht
    days = [f"{season}-08-{d:02d}" for d in (2, 9, 16, 23, 30)]
    archive = [{"day": d, "match": None, "results": RES, "liveSays": {}, "locked": 1, "patron": {}, "seen": {},
                "tips": {"p6": tip("Schubi", "fca", "yes", "no"), "p1": tip("Betzmeister", "opp", "no", "no"), "p2": tip("Cousin", "fca", "no", "yes")}} for d in days]
    root = {"version": 2, "activeId": "c1", "settings": {"sound": False, "vibrate": False}, "admin": None,
            "competitions": [{"id": "c1", "name": "FCA-Spieltage", "createdAt": now - 864e5 * 120, "fca": True, "players": P,
                              "round": None, "rounds": [], "pending": [], "debts": [], "tipp": None, "tippArchive": archive,
                              "presence": {"day": day, "ids": [x["id"] for x in P]}}]}
    A.evaluate(f"localStorage.setItem('{KEY}', {json.dumps(json.dumps(root))})"); A.reload(); A.wait_for_timeout(900)
    seen = []
    A.screenshot(path=f"{OUT}/j-1-vergabe.png")
    close_reveals(A, seen)
    check("Joker-Fenster für Schubi nach 5 Spielen", "Joker für Schubi" in seen, str(seen))
    chipA = A.locator("#pot .chip", has_text="Schubi")
    check("Joker-Zeichen am Namen", chipA.locator(".chip-joker").count() == 1)

    A.click('.tab[data-tab="squad"]'); A.wait_for_timeout(200)
    A.locator("#groupActions .btn", has_text="Gemeinsam starten").click()
    A.wait_for_url("**/?g=*", timeout=15000); A.wait_for_timeout(800)
    code = A.url.split("?g=")[1]
    A.click("#groupSheetActions .sheet-undo"); A.wait_for_timeout(300)
    A.click('.tab[data-tab="game"]'); A.wait_for_timeout(300)
    B.goto(f"{URL}?g={code}"); B.wait_for_selector("#loading", state="hidden", timeout=10000); B.wait_for_timeout(900)
    seenB = []; close_reveals(B, seenB)
    check("B bekommt dasselbe Joker-Fenster", "Joker für Schubi" in seenB, str(seenB))
    check("Server kennt den Joker", [j["playerId"] for j in server(code).get("jokers", [])] == ["p6"], str(server(code).get("jokers")))

    # Drehen, bis Schubi gezogen wird (andere Ziehungen mit Rückgängig zurücknehmen)
    got = False
    for i in range(30):
        A.click("#cta"); A.wait_for_timeout(300)
        if vis(A, "#presenceSheet"): A.click("#presenceOk"); A.wait_for_timeout(300)
        wait_sheet(A); B.wait_for_timeout(300)
        if txt(A, "#sheetName").lower() == "schubi": got = True; break
        check_no_joker = not vis(A, "#sheetJoker")
        if not check_no_joker: check("Joker-Knopf nur beim Joker-Besitzer", False, txt(A, "#sheetName"))
        A.click("#sheetUndo"); A.wait_for_timeout(500)
        if vis(B, "#sheet"): B.click("#sheetNext"); B.wait_for_timeout(200)
    check("Schubi gezogen", got)
    wait_sheet(B)
    check("Joker-Knopf auf beiden Handys", vis(A, "#sheetJoker") and vis(B, "#sheetJoker"), txt(A, "#sheetJoker"))
    A.screenshot(path=f"{OUT}/j-2-ergebnis.png")
    picks_before = len(server(code)["round"]["picks"])

    # Joker einsetzen (auf A): Schubi bleibt im Topf, das Rad dreht neu, B schließt sein Fenster und sieht den neuen Dreh
    A.click("#sheetJoker"); A.wait_for_timeout(300)
    toastA = txt(A, "#toast")
    B.wait_for_timeout(600)
    toastB = txt(B, "#toast") if vis(B, "#toast") else ""
    check("Meldung auf A", toastA.startswith("Joker! Schubi bleibt im Topf"), toastA)
    check("B schließt das Schubi-Fenster und meldet den Joker", "Joker! Schubi" in toastB or (vis(B, "#sheet") and txt(B, "#sheetName").lower() != "schubi"), toastB)
    wait_sheet(A, 12000)
    newname = txt(A, "#sheetName")
    A.wait_for_timeout(1500); wait_sheet(B, 12000)
    s = server(code)
    j = s["jokers"][0]
    check("Joker ist verbraucht", bool(j.get("usedAt")), str(j))
    check("Neu gedreht: gleiche Anzahl Ziehungen, letzter ist der neue", len(s["round"]["picks"]) == picks_before and {x["id"]: x["name"] for x in P}[s["round"]["picks"][-1]["id"]] == newname, f"{len(s['round']['picks'])} / {newname}")
    check("B zeigt den neuen Dreh", txt(B, "#sheetName") == newname, f"B: {txt(B, '#sheetName')} A: {newname}")
    check("Kein Joker-Knopf mehr (nur einer)", not vis(A, "#sheetJoker"))
    if vis(A, "#sheet"): A.click("#sheetNext"); A.wait_for_timeout(300)
    if vis(B, "#sheet"): B.click("#sheetNext"); B.wait_for_timeout(300)
    check("Joker-Zeichen am Namen ist weg", A.locator("#pot .chip", has_text="Schubi").locator(".chip-joker").count() == 0)

    # Statistik
    A.click('.tab[data-tab="stats"]'); A.wait_for_timeout(300); A.click("#rangeSeason"); A.wait_for_timeout(300)
    A.evaluate("document.getElementById('jokerBox').scrollIntoView({block: 'center'})"); A.wait_for_timeout(200)
    jb = A.locator("#jokerBox").inner_text().replace("\n", " ")
    A.screenshot(path=f"{OUT}/j-3-statistik.png")
    check("Statistik: Joker eingesetzt, Stand bis zum nächsten", "Eingesetzt: Schubi" in jb and "noch 5 Tippspiele" in jb, jb)
    check("Kein waagrechtes Überlaufen", not A.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
    print("Seitenfehler:", [e for e in errors if "Service Worker" not in e][:10])
    b.close()
print(f"\n{results.count(True)} von {len(results)} Prüfungen bestanden")
