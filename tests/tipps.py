# Tipps kommen sicher an: Funkloch, Zusammenstoß, fremder Tipp während einer Animation, fehlende Stammspieler,
# App vom Home-Bildschirm ohne Gruppe. Mit nachgebauter Firebase (tests/fakefb).
# Start: im Projektordner "python3 -m http.server 8080", dann "python3 tests/tipps.py".
import json, time, sys, os, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + "/fakefb")
from fakeserver import FakeFirestore
from playwright.sync_api import sync_playwright

OUT, FAKE, KEY = tempfile.gettempdir(), HERE + "/fakefb", "fca-bier-roulette:v1"
URL = "http://localhost:8080/"
srv = FakeFirestore()
results, errors = [], []
now = int(time.time() * 1000)

def check(name, ok, info=""):
    results.append(ok)
    print(("ok   " if ok else "FEHLER ") + name + (f"  ({info})" if info else ""), flush=True)

def route_fake(route):
    name = route.request.url.split("/")[-1].split("?")[0]
    route.fulfill(status=200, content_type="application/javascript", body=open(f"{FAKE}/{name}").read())

def phone(b, name, motion="reduce", standalone=False):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        reduced_motion=motion, service_workers="block")
    ctx.expose_binding("__fb", srv.handler)
    ctx.route("**/vendor/firebase/*.js", route_fake)
    ctx.route("https://api.openligadb.de/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body="[]"))
    if standalone:
        ctx.add_init_script("Object.defineProperty(navigator, 'standalone', { get: () => true });")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
    return ctx, pg

def vis(pg, s): return pg.locator(s).is_visible()
def txt(pg, s): return (pg.text_content(s) or "").strip()
def server_state(code):
    s, d = srv.comp(code)
    return s
def server_tips(code):
    s = server_state(code)
    return sorted((s.get("tipp") or {}).get("tips", {}).keys()) if s else []
PUMP = []   # eine Seite, über die gewartet wird (die Test-Datenbank antwortet nur, während Playwright arbeitet)
def wait_until(fn, ms=10000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        if fn(): return True
        PUMP[0].wait_for_timeout(150)
    return fn()
def wait_sheet(pg, t=10000):
    pg.wait_for_selector("#sheet:not([hidden])", timeout=t); pg.wait_for_timeout(150)
def close_sheet(pg):
    if vis(pg, "#sheet"): pg.click("#sheetNext"); pg.wait_for_timeout(250)
def person_row(pg, name):
    return pg.locator(".tipp-person", has_text=name)
def do_tip(pg, name, answers=("FCA", "Ja", "Nein")):
    if not vis(pg, "#tippSheet"): pg.click("#tippBar"); pg.wait_for_timeout(250)
    person_row(pg, name).click(); pg.wait_for_timeout(150)
    qs = pg.locator("#tippBody .tq")
    for i, a in enumerate(answers):
        qs.nth(i).locator(".tq-opt", has_text=a).first.click(); pg.wait_for_timeout(60)
    pg.click("#tippActions .sheet-next"); pg.wait_for_timeout(300)
def close_tipp(pg):
    if vis(pg, "#tippSheet"): pg.click("#tippActions .sheet-next"); pg.wait_for_timeout(250)

P = [{"id": f"p{i+1}", "name": n, "color": c, "active": True, "guest": False}
     for i, (n, c) in enumerate(zip(["Betzmeister", "Cousin", "Demharter M.", "Emilio", "Schaufi", "Schubi", "Flo"],
                                    ["#c8102e", "#1f6fb2", "#c88a0c", "#7b3fa0", "#0f8a6b", "#d4572a", "#3d5a80"]))]

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}), args=["--no-sandbox"])
    ctxA, A = phone(b, "A", motion="no-preference")   # A dreht mit echter Animation (rund 5 Sekunden)
    ctxB, B = phone(b, "B")
    PUMP.append(A)

    # Daniels Handy: FCA-Meisterschaft, heute alle da außer Flo
    A.goto(URL); A.wait_for_timeout(400)
    day = A.evaluate("""(() => { const d = new Date(); if (d.getHours() < 6) d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()""")
    root = {"version": 2, "activeId": "c1", "settings": {"sound": False, "vibrate": False}, "admin": None,
            "competitions": [{"id": "c1", "name": "FCA-Spieltage", "createdAt": now - 864e5 * 30, "fca": True, "players": P,
                              "round": None, "rounds": [], "pending": [], "debts": [],
                              "presence": {"day": day, "ids": [x["id"] for x in P if x["name"] != "Flo"]}}]}
    A.evaluate(f"localStorage.setItem('{KEY}', {json.dumps(json.dumps(root))})"); A.reload(); A.wait_for_timeout(700)
    A.click('.tab[data-tab="squad"]'); A.wait_for_timeout(200)
    A.locator("#groupActions .btn", has_text="Gemeinsam starten").click()
    A.wait_for_url("**/?g=*", timeout=15000); A.wait_for_timeout(800)
    code = A.url.split("?g=")[1]
    A.click("#groupSheetActions .sheet-undo"); A.wait_for_timeout(200)
    A.click('.tab[data-tab="game"]'); A.wait_for_timeout(300)
    B.goto(f"{URL}?g={code}"); B.wait_for_selector("#loading", state="hidden", timeout=10000); B.wait_for_timeout(500)

    # 1) Fehlende Stammspieler können tippen
    A.click("#tippBar"); A.wait_for_timeout(300)
    flo = person_row(A, "Flo")
    check("Flo (heute nicht da) steht in der Tippliste", flo.count() == 1 and "nicht da" in flo.inner_text(), flo.inner_text().replace("\n", " ") if flo.count() else "fehlt")
    A.screenshot(path=f"{OUT}/t-1-liste.png")
    do_tip(A, "Schubi")
    check("Tipp online: sofort angekommen", wait_until(lambda: "p6" in server_tips(code)) and "angekommen" in txt(A, ".tipp-ok"), txt(A, ".tipp-ok"))
    close_tipp(A)

    # 2) Funkloch: B tippt für Emilio ohne Netz
    srv.offline.add(ctxB); ctxB.set_offline(True); B.wait_for_timeout(300)
    do_tip(B, "Emilio")
    B.wait_for_timeout(800)
    msg = txt(B, ".tipp-ok")
    row = person_row(B, "Emilio").inner_text().replace("\n", " ")
    check("Ohne Netz: Hinweis 'noch nicht gesendet'", "noch nicht gesendet" in msg and "nicht gesendet" in row, f"{msg} | {row}")
    B.screenshot(path=f"{OUT}/t-2-offline.png")
    close_tipp(B)
    check("Ohne Netz: Tipp-Leiste zeigt es auch", "noch nicht gesendet" in txt(B, "#tippSub"), txt(B, "#tippSub"))
    check("Ohne Netz: Server hat den Tipp noch nicht", "p4" not in server_tips(code))
    srv.offline.discard(ctxB); ctxB.set_offline(False)
    check("Wieder Netz: Tipp kommt an", wait_until(lambda: "p4" in server_tips(code), 8000), str(server_tips(code)))
    B.wait_for_timeout(600)
    check("Wieder Netz: Hinweis verschwindet", "nicht gesendet" not in txt(B, "#tippSub"), txt(B, "#tippSub"))
    check("A sieht Emilios Tipp", wait_until(lambda: A.evaluate(f"JSON.parse(localStorage.getItem('fca-bier-roulette:g:{code}')).competitions[0].tipp.tips.p4 != null"), 5000))

    # 3) Zusammenstoß: B dreht und tippt ohne Netz, A dreht online. B übernimmt A, Bs Tipp bleibt trotzdem.
    srv.offline.add(ctxB); ctxB.set_offline(True); B.wait_for_timeout(300)
    do_tip(B, "Cousin"); close_tipp(B)
    B.click("#cta"); B.wait_for_timeout(300)
    if vis(B, "#presenceSheet"): B.click("#presenceOk"); B.wait_for_timeout(300)
    wait_sheet(B); b_off = txt(B, "#sheetName"); close_sheet(B)
    A.click("#cta"); A.wait_for_timeout(300)
    if vis(A, "#presenceSheet"): A.click("#presenceOk"); A.wait_for_timeout(300)
    wait_sheet(A, 15000); a_on = txt(A, "#sheetName"); close_sheet(A)
    picks_before = len(server_state(code)["round"]["picks"])
    srv.offline.discard(ctxB); ctxB.set_offline(False)
    ok = wait_until(lambda: "p2" in server_tips(code), 10000)
    s = server_state(code)
    check("Zusammenstoß: As Dreh gilt, Cousins Tipp von B kommt trotzdem an", ok and len(s["round"]["picks"]) == picks_before,
          f"B offline '{b_off}', A online '{a_on}', Ziehungen {len(s['round']['picks'])}, Tipps {server_tips(code)}")
    B.wait_for_timeout(1200); close_sheet(B)

    # 4) Fremder Tipp, während A noch das Rad dreht: darf nicht überschrieben werden
    close_sheet(B); B.click("#tippBar"); B.wait_for_timeout(300)   # B hat das Tippspiel offen
    A.click("#cta"); A.wait_for_timeout(1200)          # A dreht, Animation läuft noch
    do_tip(B, "Betzmeister"); close_tipp(B)
    wait_until(lambda: "p1" in server_tips(code), 4000)
    A.evaluate("window.dispatchEvent(new Event('online'))")   # A will in der Animation hochladen (z. B. Live-Daten)
    A.wait_for_timeout(600)
    still = "p1" in server_tips(code)
    wait_sheet(A, 15000); close_sheet(A); A.wait_for_timeout(1500)
    check("Tipp von B während As Animation bleibt erhalten", still and "p1" in server_tips(code), str(server_tips(code)))

    # 5) Gleicher Stand überall
    A.wait_for_timeout(800)
    ta = A.evaluate(f"Object.keys(JSON.parse(localStorage.getItem('fca-bier-roulette:g:{code}')).competitions[0].tipp.tips).sort()")
    tb = B.evaluate(f"Object.keys(JSON.parse(localStorage.getItem('fca-bier-roulette:g:{code}')).competitions[0].tipp.tips).sort()")
    check("A, B und Server haben dieselben Tipps", ta == tb == server_tips(code), f"A {ta} B {tb} Server {server_tips(code)}")

    # 6) Adresse behält den Link (für 'Zum Home-Bildschirm')
    A.goto(URL); A.wait_for_timeout(1200)
    check("Ohne ?g geöffnet: Adresse bekommt den Einladungslink", A.url.endswith(f"?g={code}"), A.url)

    # 7) App vom Home-Bildschirm mit eigenem Speicher: fragt nach dem Link und verbindet
    ctxC, C = phone(b, "C", standalone=True)
    C.goto(URL); C.wait_for_timeout(900)
    check("Home-Bildschirm ohne Gruppe: Verbinden-Fenster", vis(C, "#groupSheet") and vis(C, "#connectForm"), txt(C, "#groupTitle"))
    C.screenshot(path=f"{OUT}/t-3-verbinden.png")
    C.click("#groupSheetActions .sheet-undo"); C.wait_for_timeout(300)
    C.click("#tippBar"); C.wait_for_timeout(300)
    check("Ohne Gruppe: Warnung im Tippspiel", vis(C, ".tipp-warn"), txt(C, ".tipp-warn"))
    C.screenshot(path=f"{OUT}/t-4-warnung.png")
    C.locator(".tipp-warn .link-btn").click(); C.wait_for_timeout(300)
    C.fill("#connectInput", f"Hier unser Link: {URL}?g={code}")
    C.click("#groupSheetActions .sheet-next")
    C.wait_for_url("**/?g=*", timeout=10000); C.wait_for_selector("#loading", state="hidden", timeout=10000); C.wait_for_timeout(600)
    C.click("#tippBar"); C.wait_for_timeout(300)
    check("Nach dem Verbinden: Tipps der Gruppe sichtbar", person_row(C, "Emilio").count() == 1 and "getippt" in person_row(C, "Emilio").inner_text(), person_row(C, "Emilio").inner_text().replace("\n", " "))
    C.reload(); C.wait_for_timeout(800)
    check("Zweiter Start: kein Verbinden-Fenster mehr", not vis(C, "#groupSheet"))

    print("Seitenfehler:", [e for e in errors if "Service Worker" not in e][:10])
    print("Bilder:", OUT + "/t-*.png")
    b.close()
print(f"\n{results.count(True)} von {len(results)} Prüfungen bestanden")
