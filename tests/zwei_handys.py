# Zwei-Handy-Test für den gemeinsamen Stand, mit nachgebauter Firebase (tests/fakefb).
# Start: im Projektordner "python3 -m http.server 8080", dann "python3 tests/zwei_handys.py".
import json, time, sys, os, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + "/fakefb")
from fakeserver import FakeFirestore
from playwright.sync_api import sync_playwright

OUT, FAKE, KEY = tempfile.gettempdir(), HERE + "/fakefb", "fca-bier-roulette:v1"
srv = FakeFirestore()
class L(list):
    def append(self, x):
        print(x, flush=True); super().append(x)
log, errors = L(), []
now = int(time.time() * 1000)

def route_fake(route):
    name = route.request.url.split("/")[-1].split("?")[0]
    route.fulfill(status=200, content_type="application/javascript", body=open(f"{FAKE}/{name}").read())

def phone(b, name):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        reduced_motion="reduce", service_workers="block")
    ctx.expose_binding("__fb", srv.handler)
    ctx.route("**/vendor/firebase/*.js", route_fake)
    ctx.route("https://api.openligadb.de/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body="[]"))
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type in ("error", "warning") and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
    return ctx, pg

def vis(pg, s): return pg.locator(s).is_visible()
def txt(pg, s): return (pg.text_content(s) or "").strip()
def under_pointer(pg):
    return pg.evaluate("""() => {
        const rot = Number((document.querySelector('#wheel .wheel-rotor').getAttribute('transform').match(/rotate\\(([-\\d.]+)/) || [0, 0])[1]);
        const phi = ((-rot % 360) + 360) % 360;
        for (const p of document.querySelectorAll('#wheel .wheel-seg')) {
          const n = p.getAttribute('d').match(/-?[\\d.]+/g).map(Number);
          if (n.length < 10) return p.dataset.id;
          const ang = (x, y) => (Math.atan2(x - 200, -(y - 200)) * 180 / Math.PI + 360) % 360;
          const a0 = ang(n[2], n[3]), a1 = ang(n[9], n[10]);
          if (a0 <= a1 ? (phi >= a0 && phi < a1) : (phi >= a0 || phi < a1)) return p.dataset.id;
        } return null; }""")
def names(pg):
    return pg.evaluate("Object.fromEntries([...document.querySelectorAll('#wheel .wheel-seg')].map(p => [p.dataset.id, p.dataset.id]))")
def wait_sheet(pg, t=8000):
    try:
        pg.wait_for_selector("#sheet:not([hidden])", timeout=t); pg.wait_for_timeout(150)
    except Exception:
        print("!! kein Ergebnisfenster. Fehler bisher:", errors[-6:], "Toast:", pg.text_content("#toast"), "Ticker:", pg.text_content("#tickerText"), flush=True)
        raise
def close_sheet(pg):
    if vis(pg, "#sheet"): pg.click("#sheetNext"); pg.wait_for_timeout(250)
def server_round(code):
    s, d = srv.comp(code)
    return s["round"], d["rev"]

P = [{"id": f"p{i+1}", "name": n, "color": c, "active": True, "guest": False}
     for i, (n, c) in enumerate(zip(["Betzmeister", "Cousin", "Demharter M.", "Emilio", "Schaufi", "Schubi", "Gast Hans", "Maxi"],
                                    ["#c8102e", "#1f6fb2", "#c88a0c", "#7b3fa0", "#0f8a6b", "#d4572a", "#b5179e", "#3d5a80"]))]

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}), args=["--no-sandbox"])
    ctxA, A = phone(b, "A")
    ctxB, B = phone(b, "B")

    # Daniels Handy: bisheriger Stand mit einer fertigen Runde und Champion
    A.goto("http://localhost:8080/"); A.wait_for_timeout(500)
    day = A.evaluate("""(() => { const d = new Date(); if (d.getHours() < 6) d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()""")
    done = {"id": "rold", "startedAt": now - 864e5 * 7, "pot": P, "picks": [{"id": f"p{i}", "at": now - 864e5 * 7 + i * 60000, "absent": False, "beers": 6} for i in (1, 2, 3, 4)],
            "final": {"a": "p5", "b": "p6", "first": "p5", "shots": [], "winner": "p6", "loser": "p5", "endedAt": now - 864e5 * 7 + 600000, "forfeit": False, "postponed": False, "beers": 6}}
    root = {"version": 2, "activeId": "c1", "settings": {"sound": False, "vibrate": False}, "admin": None,
            "competitions": [{"id": "c1", "name": "FCA-Spieltage", "createdAt": now - 864e5 * 30, "fca": True, "players": P,
                              "round": None, "rounds": [done], "pending": [], "debts": [], "presence": {"day": day, "ids": [x["id"] for x in P]}}]}
    A.evaluate(f"localStorage.setItem('{KEY}', {json.dumps(json.dumps(root))})"); A.reload(); A.wait_for_timeout(800)
    log.append(f"A vorher: Champion '{txt(A, '#champPillName')}', Punkt sichtbar={vis(A, '#syncDot')}")

    # 1) Gemeinsam starten
    A.click('.tab[data-tab="squad"]'); A.wait_for_timeout(300)
    A.evaluate("document.getElementById('groupActions').scrollIntoView({block: 'center'})")
    A.screenshot(path=f"{OUT}/g-1-einstellungen.png")
    A.locator("#groupActions .btn", has_text="Gemeinsam starten").click()
    A.wait_for_url("**/?g=*", timeout=15000); A.wait_for_timeout(900)
    code = A.url.split("?g=")[1]
    log.append(f"Gruppe angelegt: Code {len(code)} Zeichen · Einladungsfenster: {vis(A, '#groupSheet')} '{txt(A, '#groupTitle')}' · Dokumente auf dem Server: {len(srv.docs)}")
    A.screenshot(path=f"{OUT}/g-2-einladung.png")
    A.click("#groupSheetActions .sheet-undo"); A.wait_for_timeout(300)

    # 2) Zweites Handy tritt per Link bei
    B.goto(f"http://localhost:8080/?g={code}")
    B.wait_for_selector("#loading", state="hidden", timeout=10000); B.wait_for_timeout(600)
    log.append(f"B beigetreten: Meisterschaft '{txt(B, '#compName')}', Champion '{txt(B, '#champPillName')}', Punkt-Klasse '{B.get_attribute('#syncDot', 'class')}'")
    log.append(f"Gleicher Stand A/B: {txt(A, '#roundNo') == txt(B, '#roundNo')} ('{txt(A, '#roundNo')}'), Namen gleich: {A.locator('#pot').inner_text() == B.locator('#pot').inner_text()}")

    # 3) A dreht, B dreht mit
    A.click("#cta"); wait_sheet(A)
    wait_sheet(B)
    a_name, b_name = txt(A, "#sheetName"), txt(B, "#sheetName")
    b_ptr = under_pointer(B); pmap = {x["id"]: x["name"] for x in P}
    log.append(f"A dreht: A zeigt '{a_name}', B zeigt '{b_name}', B-Zeiger auf '{pmap.get(b_ptr)}' · Server-Ziehungen {len(server_round(code)[0]['picks'])}")
    B.screenshot(path=f"{OUT}/g-3-b-sieht-mit.png")
    close_sheet(A); close_sheet(B)

    # 4) B dreht, A sieht mit
    B.click("#cta"); wait_sheet(B); wait_sheet(A)
    log.append(f"B dreht: B '{txt(B, '#sheetName')}', A '{txt(A, '#sheetName')}', A-Zeiger auf '{pmap.get(under_pointer(A))}'")
    close_sheet(A); close_sheet(B)

    # 5) Beide drehen gleichzeitig
    before = len(server_round(code)[0]["picks"])
    A.evaluate("document.getElementById('cta').click()"); B.evaluate("document.getElementById('cta').click()")
    A.wait_for_timeout(1200)
    toasts = [txt(x, "#toast") if vis(x, "#toast") else "" for x in (A, B)]
    A.wait_for_timeout(2300)
    after = len(server_round(code)[0]["picks"])
    log.append(f"Gleichzeitig: Ziehungen {before} -> {after} · Meldungen A='{toasts[0]}' B='{toasts[1]}' · beide zeigen '{txt(A, '#sheetName') if vis(A, '#sheet') else '-'}' / '{txt(B, '#sheetName') if vis(B, '#sheet') else '-'}'")
    close_sheet(A); close_sheet(B); A.wait_for_timeout(400)

    # 6) Funkloch: A dreht offline, B sieht es nach dem Wiederverbinden
    srv.offline.add(ctxA); ctxA.set_offline(True); A.wait_for_timeout(300)
    log.append(f"A offline: Punkt-Klasse '{A.get_attribute('#syncDot', 'class')}'")
    A.click("#cta"); wait_sheet(A)
    off_name = txt(A, "#sheetName")
    B.wait_for_timeout(1500)
    log.append(f"A dreht offline: '{off_name}' · B sieht noch nichts: {not vis(B, '#sheet')}")
    close_sheet(A)
    srv.offline.discard(ctxA); ctxA.set_offline(False)
    wait_sheet(B, 10000)
    log.append(f"A wieder online: B zeigt '{txt(B, '#sheetName')}' · Server-Ziehungen {len(server_round(code)[0]['picks'])}")
    close_sheet(B)

    # 7) Funkloch mit Zusammenstoß: A dreht offline, B dreht online -> A übernimmt B
    rr, _ = server_round(code)
    if rr and not rr.get("final"):
        srv.offline.add(ctxA); ctxA.set_offline(True); A.wait_for_timeout(300)
        A.click("#cta"); wait_sheet(A); a_off = txt(A, "#sheetName"); close_sheet(A)
        B.click("#cta"); wait_sheet(B); b_on = txt(B, "#sheetName"); close_sheet(B)
        srv.offline.discard(ctxA); ctxA.set_offline(False)
        msg = ""
        for _ in range(30):
            A.wait_for_timeout(100)
            if vis(A, "#toast"): msg = txt(A, "#toast")
            if msg: break
        A.wait_for_timeout(1500)
        last = server_round(code)[0]["picks"][-1]["id"]
        log.append(f"Zusammenstoß: A offline '{a_off}', B online '{b_on}' -> Server letzter '{pmap[last]}' · A-Meldung '{msg}' · A zeigt '{txt(A, '#sheetName') if vis(A, '#sheet') else '-'}'")
        close_sheet(A)
    A.wait_for_timeout(500)
    log.append(f"Stand gleich: A '{txt(A, '#roundNo')} {txt(A, '#roundState')}' / B '{txt(B, '#roundNo')} {txt(B, '#roundState')}' · Namen gleich: {A.locator('#pot').inner_text() == B.locator('#pot').inner_text()}")

    # 8) Admin-PIN gilt für alle
    A.click('.tab[data-tab="squad"]'); A.wait_for_timeout(200)
    A.click("#adminSet"); A.fill("#pinInput", "1234"); A.fill("#pinInput2", "1234"); A.click("#pinOk"); A.wait_for_timeout(800)
    A.click('.tab[data-tab="game"]'); A.wait_for_timeout(200)
    B.wait_for_timeout(500)
    if vis(B, "#undoBtn"):
        B.click("#undoBtn"); B.wait_for_timeout(300)
        log.append(f"PIN auf A festgelegt -> B fragt bei Rückgängig nach PIN: {vis(B, '#pinSheet')}")
        B.click("#pinCancel"); B.wait_for_timeout(200)
    else:
        log.append("Rückgängig-Knopf auf B nicht sichtbar (Runde im Finale?)")

    # 9) Bis zum Finale drehen, dann schießt A und B schaut zu
    for i in range(8):
        if vis(A, "#stageFinal") or not vis(A, "#stageWheel"): break
        A.click("#cta"); wait_sheet(A); close_sheet(A); A.wait_for_timeout(500)
        close_sheet(B)
    A.wait_for_timeout(800); close_sheet(B); B.wait_for_timeout(600)
    log.append(f"Finale: A {vis(A, '#stageFinal')}, B {vis(B, '#stageFinal')}")
    shots = 0
    while vis(A, "#stageFinal") and shots < 14:
        if not A.locator("#goal.is-ready").count(): A.wait_for_timeout(300); continue
        A.locator('.goal-zone[data-aim="L"]').click(force=True); shots += 1
        A.wait_for_timeout(2400)
        sa = A.locator("#score").inner_text() if vis(A, "#stageFinal") else "fertig"
        sb = B.locator("#score").inner_text() if vis(B, "#stageFinal") else "fertig"
        if shots == 2: B.screenshot(path=f"{OUT}/g-4-b-elfmeter.png")
        if sa != sb: log.append(f"  Schuss {shots}: Spielstand A/B weicht ab: {sa!r} / {sb!r}")
    B.wait_for_timeout(2500)
    log.append(f"Nach {shots} Schüssen: A Champion '{txt(A, '#champName')}' sichtbar={vis(A, '#stageChamp')} · B Champion '{txt(B, '#champName')}' sichtbar={vis(B, '#stageChamp')} · B Kopfzeile '{txt(B, '#champPillName')}'")
    B.screenshot(path=f"{OUT}/g-5-b-champion.png")
    for nm, pg in (("A", A), ("B", B)):
        cache = json.loads(pg.evaluate(f"localStorage.getItem('fca-bier-roulette:g:{code}')") or "null")
        rs = cache["competitions"][0]["rounds"] if cache else []
        log.append(f"  {nm}: Kopfzeile '{txt(pg, '#champPillName')}', Runden im Speicher: {[(r['id'][:6], r['final']['winner']) for r in rs]}")
    rounds = [k for k in srv.docs if f"groups/{code}/comps/c1/rounds/" in k]
    log.append(f"Fertige Runden auf dem Server: {len(rounds)}")

    # 10) B verlässt die Gruppe: eigener (leerer) Stand ist zurück
    B.click('.tab[data-tab="squad"]'); B.wait_for_timeout(200)
    B.locator("#groupActions .btn", has_text="Verlassen").click(); B.wait_for_timeout(100)
    B.locator("#groupActions .btn", has_text="Wirklich verlassen?").click()
    B.wait_for_timeout(1200)
    log.append(f"B verlassen: URL '{B.url}', Punkt sichtbar={vis(B, '#syncDot')}, Champion-Anzeige={vis(B, '#champPill')}")
    print("Fehler:", errors[:12]); print("Serveraufrufe:", srv.calls)
    b.close()
