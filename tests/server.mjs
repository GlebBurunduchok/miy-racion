import assert from 'node:assert/strict';
import { once } from 'node:events';
import { server } from '../server.mjs';
import { publicFiles, version } from '../project.config.mjs';

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  const health = await fetch(origin + '/api/health').then((response) => response.json());
  assert.equal(health.version, version);
  for (const file of publicFiles) {
    const response = await fetch(origin + '/' + file);
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    await response.arrayBuffer();
  }
  console.log(`PASS All ${publicFiles.length} public files are served correctly`);
  assert.equal((await fetch(origin + '/api/barcode?code=bad')).status, 400);
  assert.equal((await fetch(origin + '/api/search?q=x')).status, 400);
  assert.equal(
    (await fetch(origin + '/api/details?source=tablycja&slug=..%2FREADME.md')).status,
    400
  );
  assert.equal((await fetch(origin + '/api/health', { method: 'POST' })).status, 405);
  console.log('PASS Invalid API arguments and unsupported methods are rejected');
  assert.equal((await fetch(origin + '/README.md')).status, 403);
  assert.equal((await fetch(origin + '/assets/missing.jpg')).status, 404);
  assert.equal((await fetch(origin + '/assets/%2E%2E%5CREADME.md')).status, 403);
  console.log('PASS Source documents are private and missing assets return 404');
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
