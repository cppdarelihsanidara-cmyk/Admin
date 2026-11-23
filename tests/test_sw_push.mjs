import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function testSw(swPath) {
  const code = fs.readFileSync(swPath, 'utf8');
  const listeners = {};
  const shown = [];
  const opened = [];
  const navigated = [];
  const focused = [];
  const deletedCaches = [];

  const scope = 'https://parents.darelihsan.dz/';
  const sandbox = {
    URL,
    Promise,
    Date,
    Object,
    String,
    console,
    self: {
      location: new URL(scope),
      registration: {
        scope,
        showNotification: async (title, opts) => {
          shown.push({ title, opts });
        },
        pushManager: {
          subscribe: async () => ({ toJSON: () => ({ endpoint: 'https://fcm.example/new' }) })
        }
      },
      clients: {
        claim: async () => {},
        matchAll: async () => sandbox._mockClients,
        openWindow: async (url) => { opened.push(url); return {}; }
      },
      skipWaiting: async () => {},
      addEventListener: (ev, fn) => { listeners[ev] = fn; }
    },
    _mockClients: [],
    caches: {
      open: async () => ({ add: async () => {}, put: async () => {} }),
      keys: async () => ['de-parents-old-1', 'de-parents-prod-20261123-pushfix7', 'other-app-cache'],
      delete: async (k) => { deletedCaches.push(k); return true; },
      match: async () => null
    }
  };
  sandbox.self.self = sandbox.self;
  vm.runInNewContext(code, sandbox);

  const runWaitUntil = async (evName, eventObj) => {
    let p = Promise.resolve();
    eventObj.waitUntil = (prom) => { p = prom; };
    listeners[evName](eventObj);
    await p;
  };

  return (async () => {
    // 1. Activate cleans only de-parents-* old caches
    await runWaitUntil('activate', {});
    assert.deepEqual(deletedCaches, ['de-parents-old-1'], 'Only old de-parents-* cache should be deleted');

    // 2. Push with canonical JSON payload
    await runWaitUntil('push', {
      data: {
        json: () => ({
          title: 'إعلان جديد',
          body: 'اجتماع الأولياء غداً',
          icon: './icon-192.png',
          badge: './logo-sq.png',
          url: './parent.html#msgs',
          tag: 'de-msg-1',
          data: { url: './parent.html#msgs', outboxId: '123' }
        })
      }
    });
    assert.equal(shown[0].title, 'إعلان جديد');
    assert.equal(shown[0].opts.data.url, 'https://parents.darelihsan.dz/parent.html#msgs');
    assert.equal(shown[0].opts.icon, 'https://parents.darelihsan.dz/icon-192.png');

    // 3. Push with plain text fallback
    await runWaitUntil('push', {
      data: {
        json: () => { throw new Error('not json'); },
        text: () => 'نص عادي للاختبار'
      }
    });
    assert.equal(shown[1].title, 'دار الإحسان');
    assert.equal(shown[1].opts.body, 'نص عادي للاختبار');

    // 4. Push with null/empty data
    await runWaitUntil('push', { data: null });
    assert.equal(shown[2].title, 'دار الإحسان');
    assert.ok(shown[2].opts.body.length > 0);

    // 5. notificationclick when app is closed -> openWindow
    sandbox._mockClients = [];
    await runWaitUntil('notificationclick', {
      notification: {
        close: () => {},
        data: { url: 'https://parents.darelihsan.dz/parent.html#evaluations' }
      }
    });
    assert.deepEqual(opened, ['https://parents.darelihsan.dz/parent.html#evaluations']);

    // 6. notificationclick when app is open -> navigate + focus
    sandbox._mockClients = [{
      url: 'https://parents.darelihsan.dz/index.html',
      navigate: async (u) => { navigated.push(u); return sandbox._mockClients[0]; },
      focus: async () => { focused.push(true); }
    }];
    await runWaitUntil('notificationclick', {
      notification: {
        close: () => {},
        data: { url: './parent.html#reports' }
      }
    });
    assert.deepEqual(navigated, ['https://parents.darelihsan.dz/parent.html#reports']);
    assert.equal(focused.length, 1);

    // 7. notificationclick blocks external URLs
    sandbox._mockClients = [];
    await runWaitUntil('notificationclick', {
      notification: {
        close: () => {},
        data: { url: 'https://evil.example/phish' }
      }
    });
    assert.equal(opened[1], 'https://parents.darelihsan.dz/parent.html');

    console.log('ALL SW TESTS PASSED:', swPath);
  })();
}

await testSw('repos/Parents-main/sw.js');
await testSw('repos/Admin-main/sw.js');
