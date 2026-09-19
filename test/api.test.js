const assert = require('assert');
const http = require('http');
const app = require('../server.js');

const PORT = 3099;
let server;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('Starting API Engine integration tests...\n');

  server = app.listen(PORT);

  try {
    // 1. Root API
    console.log('Test 1: GET /api');
    const rootRes = await request('/api');
    assert.strictEqual(rootRes.status, 200);
    assert.strictEqual(rootRes.body.name, 'iOSArsenal API');
    assert.ok(rootRes.body.endpoints.playbooks);
    console.log('  ✓ Root API returns metadata & endpoints');

    // 2. Stats
    console.log('Test 2: GET /api/stats');
    const statsRes = await request('/api/stats');
    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsRes.body.data.playbooks, 61);
    assert.strictEqual(statsRes.body.data.categoriesCount, 8);
    console.log('  ✓ Stats match expectations (61 playbooks, 8 categories)');

    // 3. Categories
    console.log('Test 3: GET /api/categories');
    const catsRes = await request('/api/categories');
    assert.strictEqual(catsRes.status, 200);
    assert.strictEqual(catsRes.body.total, 8);
    const storageCat = catsRes.body.data.find((c) => c.key === 'storage');
    assert.ok(storageCat);
    assert.strictEqual(storageCat.count, 7);
    console.log('  ✓ Categories list returns 8 categories with accurate playbook counts');

    // 4. Category Detail
    console.log('Test 4: GET /api/categories/storage');
    const catDetail = await request('/api/categories/storage');
    assert.strictEqual(catDetail.status, 200);
    assert.strictEqual(catDetail.body.data.key, 'storage');
    assert.strictEqual(catDetail.body.data.playbooks.length, 7);
    console.log('  ✓ Category detail returns playbooks');

    // 5. Playbooks query & filters
    console.log('Test 5: GET /api/playbooks (with filters)');
    const allPlaybooks = await request('/api/playbooks');
    assert.strictEqual(allPlaybooks.status, 200);
    assert.strictEqual(allPlaybooks.body.total, 61);

    const critOnly = await request('/api/playbooks?sev=critical');
    assert.strictEqual(critOnly.status, 200);
    assert.ok(critOnly.body.count > 0);
    assert.ok(critOnly.body.data.every((d) => d.sev === 'critical'));

    const searchRes = await request('/api/playbooks?q=keychain');
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchRes.body.count > 0);
    console.log('  ✓ Playbooks filter and query work accurately');

    // 6. Playbook detail
    console.log('Test 6: GET /api/playbooks/stor-1');
    const pbDetail = await request('/api/playbooks/stor-1');
    assert.strictEqual(pbDetail.status, 200);
    assert.strictEqual(pbDetail.body.data.id, 'stor-1');
    assert.ok(pbDetail.body.data.methods.length >= 1);
    console.log('  ✓ Single playbook lookup returns playbook details');

    // 7. Modules
    console.log('Test 7: GET /api/modules and /api/modules/jailbreaks');
    const modulesRes = await request('/api/modules');
    assert.strictEqual(modulesRes.status, 200);
    assert.ok(modulesRes.body.data.jailbreaks);
    assert.ok(modulesRes.body.data.jbdetect);
    assert.ok(modulesRes.body.data.sslpin);

    const jbRes = await request('/api/modules/jailbreaks');
    assert.strictEqual(jbRes.status, 200);
    assert.strictEqual(jbRes.body.count, 3);
    console.log('  ✓ Modules endpoints return deep-dive guide data');

    // 8. Reviewed state toggle & clear
    console.log('Test 8: POST /api/reviewed and DELETE /api/reviewed');
    const postReview = await request('/api/reviewed', {
      method: 'POST',
      body: { id: 'stor-1', reviewed: true }
    });
    assert.strictEqual(postReview.status, 200);
    assert.strictEqual(postReview.body.data['stor-1'], true);

    const getReviewed = await request('/api/reviewed');
    assert.strictEqual(getReviewed.body.data['stor-1'], true);

    const delReview = await request('/api/reviewed', { method: 'DELETE' });
    assert.strictEqual(delReview.status, 200);
    assert.strictEqual(Object.keys(delReview.body.data).length, 0);
    console.log('  ✓ Reviewed state API persistence and reset work');

    console.log('\nAll 8 API Engine tests passed successfully! 🎉');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
