import requests

TARGET_URL = "https://app.farsalish.ir"

r = requests.post(f"{TARGET_URL}/api/auth/login/", json={
    "username": "admin",
    "password": "123456"
})

assert r.status_code == 200, f"Expected 200, got {r.status_code}"
data = r.json()
assert "tokens" in data and "access" in data["tokens"], "Response missing 'tokens.access'"
assert "tokens" in data and "refresh" in data["tokens"], "Response missing 'tokens.refresh'"
