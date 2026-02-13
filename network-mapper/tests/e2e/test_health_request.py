import pytest

# Minimal Playwright-based smoke test that expects the server to be reachable at localhost:5000
@pytest.mark.skip(reason="Requires server running at http://localhost:5000; enable when CI starts service")
async def test_health_ok(request_context):
    r = await request_context.get('http://localhost:5000/api/health')
    assert r.ok
    j = await r.json()
    assert j.get('status') == 'ok'
