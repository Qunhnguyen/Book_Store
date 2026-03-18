"""
Phase 6 — Automated test script for Resilience + Observability

What is verified:
  1. GET /api/health/   → 200, {"status": "ok", "service": "api-gateway"}
  2. GET /health/       → 200 on order-service, pay-service, ship-service directly
  3. GET /api/metrics/  → 200, starts with '# HELP'
  4. GET /metrics/      → 200 on order-service directly
  5. /api/health/ requires NO JWT token (auth bypass works)
  6. Phase 4/5 Saga flow still works (one quick Happy Path order)

Run inside the Docker network:
  docker run --rm --network book_store_be_default \\
    -v $(pwd):/app -w /app python:3.11-slim \\
    bash -c "pip install requests > /dev/null 2>&1 && python test_phase6.py"
"""
import sys
import time
import uuid
import requests

GATEWAY          = "http://api-gateway:8000"
ORDER_SERVICE    = "http://order-service:8000"
PAY_SERVICE      = "http://pay-service:8000"
SHIP_SERVICE     = "http://ship-service:8000"

PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
_all_passed = True


def check(label, ok, detail=""):
    global _all_passed
    icon = PASS if ok else FAIL
    print(f"  {icon} {label}{(':  ' + str(detail)) if detail else ''}")
    if not ok:
        _all_passed = False


def test_health():
    print("\n=== 1. Health Check Endpoints ===")

    # api-gateway /api/health/ — no JWT
    r = requests.get(f"{GATEWAY}/api/health/", timeout=5)
    check("/api/health/ returns 200", r.status_code == 200, r.status_code)
    check("/api/health/ has status=ok", r.json().get("status") == "ok", r.json())

    # order-service directly
    r = requests.get(f"{ORDER_SERVICE}/health/", timeout=5)
    check("order-service /health/ returns 200", r.status_code == 200, r.status_code)

    # pay-service directly
    r = requests.get(f"{PAY_SERVICE}/health/", timeout=5)
    check("pay-service /health/ returns 200", r.status_code == 200, r.status_code)

    # ship-service directly
    r = requests.get(f"{SHIP_SERVICE}/health/", timeout=5)
    check("ship-service /health/ returns 200", r.status_code == 200, r.status_code)


def test_health_no_jwt():
    print("\n=== 2. /api/health/ accessible without JWT ===")
    # Explicitly send NO Authorization header
    r = requests.get(f"{GATEWAY}/api/health/", headers={}, timeout=5)
    check("/api/health/ returns 200 without JWT", r.status_code == 200, r.status_code)
    check("response is not 401", r.status_code != 401)


def test_metrics():
    print("\n=== 3. Metrics Endpoints ===")

    # api-gateway /api/metrics/
    r = requests.get(f"{GATEWAY}/api/metrics/", timeout=5)
    check("/api/metrics/ returns 200", r.status_code == 200, r.status_code)
    check("/api/metrics/ has Prometheus format", "# HELP" in r.text, r.text[:80])

    # order-service /metrics/
    r = requests.get(f"{ORDER_SERVICE}/metrics/", timeout=5)
    check("order-service /metrics/ returns 200", r.status_code == 200, r.status_code)
    check("order-service /metrics/ has Prometheus format", "# HELP" in r.text, r.text[:80])

    # pay-service /metrics/
    r = requests.get(f"{PAY_SERVICE}/metrics/", timeout=5)
    check("pay-service /metrics/ returns 200", r.status_code == 200, r.status_code)

    # ship-service /metrics/
    r = requests.get(f"{SHIP_SERVICE}/metrics/", timeout=5)
    check("ship-service /metrics/ returns 200", r.status_code == 200, r.status_code)


def test_saga_still_works():
    """Quick smoke test — Happy Path Saga to ensure Phase 4/5 not broken."""
    print("\n=== 4. Saga Happy Path (regression) ===")

    email = f"p6test_{int(time.time())}@example.com"
    r = requests.post(f"{GATEWAY}/api/register/", json={
        "name": "P6Tester", "email": email, "password": "123", "phone": "000"
    }, timeout=5)
    check("register", r.status_code in [200, 201], r.status_code)

    r = requests.post(f"{GATEWAY}/api/login/", json={"email": email, "password": "123"}, timeout=5)
    check("login", r.status_code == 200, r.status_code)
    token = r.json().get("token", "")
    customer_id = r.json().get("customer_id")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.post(f"{GATEWAY}/api/carts/", json={"customer_id": customer_id}, headers=headers, timeout=5)
    cart_id = r.json().get("id")
    requests.post(f"{GATEWAY}/api/cart-items/",
                  json={"cart": cart_id, "book_id": 1, "quantity": 1}, headers=headers, timeout=5)

    r = requests.post(f"{GATEWAY}/api/orders/",
                      json={"customer_id": customer_id, "force_payment_failure": False,
                            "force_shipping_failure": False},
                      headers=headers, timeout=5)
    check("create order", r.status_code == 201, r.status_code)
    order_id = r.json().get("id")

    print("  ... waiting for Saga to complete (up to 15s) ...")
    final_status = None
    for _ in range(15):
        time.sleep(1)
        r = requests.get(f"{GATEWAY}/api/orders/{customer_id}/", headers=headers, timeout=5)
        orders = r.json()
        o = next((x for x in orders if x["id"] == order_id), None)
        if o:
            final_status = o["status"]
            if final_status == "CONFIRMED":
                break

    check("order reaches CONFIRMED", final_status == "CONFIRMED", f"final_status={final_status}")


def main():
    test_health()
    test_health_no_jwt()
    test_metrics()
    test_saga_still_works()

    print()
    if _all_passed:
        print("=== ALL PHASE 6 TESTS PASSED ===")
        sys.exit(0)
    else:
        print("=== SOME PHASE 6 TESTS FAILED ===")
        sys.exit(1)


if __name__ == "__main__":
    main()
