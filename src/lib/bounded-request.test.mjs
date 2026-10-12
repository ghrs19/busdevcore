import test from 'node:test';
import assert from 'node:assert/strict';
import { readBoundedRequest } from './bounded-request.mjs';

function streamedRequest(body, headers = {}) {
  const bytes = new TextEncoder().encode(body);
  let sent = false;
  return new Request('http://localhost/upload', {
    method: 'POST', headers,
    body: new ReadableStream({
      pull(controller) {
        if (sent) return controller.close();
        sent = true;
        controller.enqueue(bytes);
      },
    }),
    duplex: 'half',
  });
}

test('rejects streamed body over limit when Content-Length is absent or false', async () => {
  const body = '--boundary\r\nContent-Disposition: form-data; name="file"; filename="x.txt"\r\nContent-Type: text/plain\r\n\r\nx\r\n--boundary--\r\n';
  for (const headers of [{ 'content-type': 'multipart/form-data; boundary=boundary' }, { 'content-type': 'multipart/form-data; boundary=boundary', 'content-length': '1' }]) {
    const request = streamedRequest(body, headers);
    assert.equal(await readBoundedRequest(request, 8), null);
  }
});

test('bounded request parses multipart body within limit', async () => {
  const body = '--boundary\r\nContent-Disposition: form-data; name="file"; filename="x.txt"\r\nContent-Type: text/plain\r\n\r\nx\r\n--boundary--\r\n';
  const request = streamedRequest(body, { 'content-type': 'multipart/form-data; boundary=boundary' });
  const bounded = await readBoundedRequest(request, new TextEncoder().encode(body).byteLength);
  assert.ok(bounded);
  assert.equal((await bounded.formData()).get('file').name, 'x.txt');
});
