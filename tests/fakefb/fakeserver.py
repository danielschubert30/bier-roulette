import json
class FakeFirestore:
    """Test-Datenbank: Dokumente mit Versionen, Transaktionen, Abfrage von Änderungen."""
    def __init__(self):
        self.docs, self.vers, self.ver, self.changes = {}, {}, 0, []
        self.offline = set()
        self.calls = 0
    def handler(self, source, op, payload):
        self.calls += 1
        if source["page"].context in self.offline:
            return json.dumps({"error": "unavailable"})
        p = json.loads(payload)
        if op == "auth":
            return json.dumps({"value": "u%d" % (id(source["page"].context) % 100000)})
        if op == "get":
            return json.dumps({"value": {"data": self.docs.get(p["path"]), "v": self.vers.get(p["path"], 0)}})
        if op == "commit":
            for path, v in p["reads"].items():
                if self.vers.get(path, 0) != v:
                    return json.dumps({"value": False})
            for w in p["writes"]:
                self.ver += 1
                if w["op"] == "delete":
                    self.docs.pop(w["path"], None)
                else:
                    data = dict(self.docs.get(w["path"]) or {}) if w.get("merge") else {}
                    data.update(w["data"])
                    self.docs[w["path"]] = data
                self.vers[w["path"]] = self.ver
                self.changes.append((self.ver, w["path"]))
            return json.dumps({"value": True})
        if op == "poll":
            since = p["since"]
            paths = []
            for v, path in self.changes:
                if v > since and path not in paths:
                    paths.append(path)
            return json.dumps({"value": {"ver": self.ver, "changes": [{"path": x, "data": self.docs.get(x)} for x in paths]}})
        return json.dumps({"error": "unknown"})
    def comp(self, code):
        for path, d in self.docs.items():
            if path.startswith(f"groups/{code}/comps/") and path.count("/") == 3:
                return json.loads(d["s"]), d
        return None, None
