/**
 * HTTP smoke tests against a running API.
 * Usage: node scripts/ci/smoke-api.mjs [baseUrl]
 *
 * Exit 0 on all checks pass, 1 otherwise.
 */
const BASE = (process.argv[2] || process.env.SMOKE_API_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);

const results = [];

function ok(name, detail) {
  results.push({ name, status: 'passed', detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, status: 'failed', detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

async function waitForHealth(maxAttempts = 30, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { res, body } = await request('/api/health');
      if (res.ok && body?.status === 'ok') {
        ok('health', `attempt ${i}, backend=${body.retrievalBackend}`);
        return body;
      }
      console.log(`  health attempt ${i}/${maxAttempts}: status=${body?.status ?? res.status}`);
    } catch (err) {
      console.log(`  health attempt ${i}/${maxAttempts}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  fail('health', 'API did not become healthy in time');
  return null;
}

async function main() {
  console.log(`\nSmoke tests → ${BASE}\n`);

  const health = await waitForHealth();
  if (!health) {
    process.exit(1);
  }

  if (!health.checks?.database) {
    fail('database', 'health.checks.database is false');
  } else {
    ok('database');
  }

  if (!health.checks?.redis) {
    fail('redis', 'health.checks.redis is false');
  } else {
    ok('redis');
  }

  // Login
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@meridiangrid.com',
      password: 'password123',
    }),
  });

  if (!login.res.ok || !login.body?.accessToken) {
    fail('login', `status=${login.res.status} body=${JSON.stringify(login.body)}`);
  } else {
    ok('login', `role=${login.body.user?.role}`);
  }

  const token = login.body?.accessToken;
  if (!token) {
    console.error('\nSmoke tests FAILED (no token)\n');
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  // Documents list
  const docs = await request('/api/documents', { headers: auth });
  if (!docs.res.ok || !Array.isArray(docs.body) || docs.body.length < 1) {
    fail('documents', `status=${docs.res.status} count=${docs.body?.length ?? 'n/a'}`);
  } else {
    ok('documents', `${docs.body.length} documents`);
  }

  // RAG query
  const rag = await request('/api/agents/rag/query', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      question: 'What is the lockout-tagout procedure for Substation Alpha?',
    }),
  });

  if (!rag.res.ok || !rag.body?.answer) {
    fail('rag_query', `status=${rag.res.status} body=${JSON.stringify(rag.body)?.slice(0, 200)}`);
  } else {
    const citations = Array.isArray(rag.body.citations) ? rag.body.citations.length : 0;
    ok('rag_query', `citations=${citations} intent=${rag.body.detectedIntent?.intent ?? 'n/a'}`);
  }

  // Executive dashboard (admin)
  const dash = await request('/api/dashboard/executive', { headers: auth });
  if (!dash.res.ok || !dash.body?.documents) {
    fail('executive_dashboard', `status=${dash.res.status}`);
  } else {
    ok('executive_dashboard', `docs=${dash.body.documents.total}`);
  }

  const failed = results.filter((r) => r.status === 'failed');
  console.log(`\n── Smoke summary: ${results.length - failed.length}/${results.length} passed ──\n`);

  if (failed.length > 0) {
    process.exit(1);
  }
  console.log('Smoke tests PASSED\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
