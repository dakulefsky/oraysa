const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/otzaria.js'), 'utf8');

function loadOtz(mockCall) {
  const window = {
    Otzaria: {
      call: mockCall,
      on() {}
    }
  };
  vm.runInNewContext(source, { window, Promise });
  return window.Otz;
}

test('probeRemoteFile sends a HEAD request and recognizes a public PDF', async () => {
  const calls = [];
  const Otz = loadOtz(async (method, payload) => {
    calls.push({ method, payload });
    return (async function* () {
      yield { type: 'response', status: 200, ok: true, headers: { 'content-type': 'application/pdf' } };
    })();
  });

  const result = await Otz.probeRemoteFile('https://oraysa-media.s3.amazonaws.com/oraysa/example.pdf', 12000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'network.fetchStream');
  assert.equal(calls[0].payload.method, 'HEAD');
  assert.equal(result.ok, true);
  assert.equal(result.definitive, true);
  assert.equal(result.status, 200);
});

test('probeRemoteFile treats S3 403/404 as definitive misses', async () => {
  for (const status of [403, 404]) {
    const Otz = loadOtz(async () => (async function* () {
      yield { type: 'response', status, ok: false, headers: {} };
    })());
    const result = await Otz.probeRemoteFile('https://oraysa-media.s3.amazonaws.com/oraysa/missing.pdf', 12000);
    assert.equal(result.ok, false);
    assert.equal(result.definitive, true);
    assert.equal(result.status, status);
  }
});

test('probeRemoteFile does not treat a bridge/network error as a missing PDF', async () => {
  const Otz = loadOtz(async () => ({
    success: false,
    error: { code: 'error.rate_limited', message: 'Rate limit exceeded' }
  }));
  const result = await Otz.probeRemoteFile('https://oraysa-media.s3.amazonaws.com/oraysa/example.pdf', 12000);
  assert.equal(result.ok, false);
  assert.equal(result.definitive, false);
  assert.equal(result.status, null);
  assert.match(result.error, /Rate limit exceeded/);
});
