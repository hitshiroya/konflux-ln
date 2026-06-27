import pytest
from fastapi.testclient import TestClient
from main import app, history

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_history_between_tests():
    """Reset in-memory history before every test."""
    history.clear()
    yield
    history.clear()


# ── Root ──────────────────────────────────────────────────────────────────────

class TestRoot:
    def test_health_check(self):
        res = client.get("/")
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "service": "random-number-generator"}


# ── Generate ──────────────────────────────────────────────────────────────────

class TestGenerate:
    def test_returns_number_within_range(self):
        res = client.get("/generate?min=1&max=10")
        assert res.status_code == 200
        data = res.json()
        assert 1 <= data["number"] <= 10

    def test_response_contains_all_fields(self):
        res = client.get("/generate?min=5&max=50")
        data = res.json()
        assert "number" in data
        assert "min" in data
        assert "max" in data
        assert "timestamp" in data
        assert data["min"] == 5
        assert data["max"] == 50

    def test_default_range(self):
        res = client.get("/generate")
        assert res.status_code == 200
        data = res.json()
        assert 1 <= data["number"] <= 100

    def test_min_equal_to_max_returns_400(self):
        res = client.get("/generate?min=5&max=5")
        assert res.status_code == 400
        assert "min must be strictly less than max" in res.json()["detail"]

    def test_min_greater_than_max_returns_400(self):
        res = client.get("/generate?min=50&max=10")
        assert res.status_code == 400

    def test_range_exceeding_limit_returns_400(self):
        res = client.get("/generate?min=0&max=2000000")
        assert res.status_code == 400
        assert "1,000,000" in res.json()["detail"]

    def test_negative_range_is_valid(self):
        res = client.get("/generate?min=-100&max=-1")
        assert res.status_code == 200
        data = res.json()
        assert -100 <= data["number"] <= -1

    def test_generate_adds_to_history(self):
        client.get("/generate?min=1&max=10")
        res = client.get("/history")
        assert res.json()["total"] == 1

    def test_history_capped_at_50(self):
        for _ in range(55):
            client.get("/generate?min=1&max=100")
        res = client.get("/history")
        assert res.json()["total"] == 50

    def test_timestamp_format(self):
        res = client.get("/generate?min=1&max=10")
        ts = res.json()["timestamp"]
        assert ts.endswith("Z")
        assert "T" in ts


# ── History ───────────────────────────────────────────────────────────────────

class TestHistory:
    def test_empty_history_on_start(self):
        res = client.get("/history")
        assert res.status_code == 200
        data = res.json()
        assert data["history"] == []
        assert data["total"] == 0

    def test_history_returns_most_recent_first(self):
        client.get("/generate?min=1&max=10")
        client.get("/generate?min=100&max=200")
        res = client.get("/history")
        items = res.json()["history"]
        # Most recent (min=100) should be first
        assert items[0]["min"] == 100
        assert items[1]["min"] == 1

    def test_history_total_matches_count(self):
        for _ in range(5):
            client.get("/generate?min=1&max=100")
        res = client.get("/history")
        data = res.json()
        assert data["total"] == len(data["history"]) == 5


# ── Clear History ─────────────────────────────────────────────────────────────

class TestClearHistory:
    def test_clear_history(self):
        client.get("/generate?min=1&max=10")
        client.get("/generate?min=1&max=10")
        res = client.delete("/history")
        assert res.status_code == 200
        assert res.json() == {"message": "History cleared"}

    def test_history_empty_after_clear(self):
        client.get("/generate?min=1&max=10")
        client.delete("/history")
        res = client.get("/history")
        assert res.json()["total"] == 0
        assert res.json()["history"] == []
