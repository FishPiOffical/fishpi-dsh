import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject } from '../index.js'
import { PLUGIN_VERSION } from '../fishpi.js'

/**
 * A Cordis-shaped Host context with just the seams the plugin uses.
 * @param {{ records?: Map<string, object> }} [options] - seeded credential records.
 * @returns {{ctx: object, routes: Map<string, object>, cleanups: Function[], records: Map<string, object>}}
 */
function createHost(options = {}) {
  const routes = new Map()
  const cleanups = []
  const records = options.records ?? new Map()
  const services = options.services ?? {}
  const ctx = {
    get(name) { return services[name] },
    effect(callback) {
      const cleanup = callback()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
      return cleanup
    },
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route)
          return async () => { routes.delete(route.path) }
        },
      },
    },
    credentials: {
      async readRecord(key) { return records.get(key) },
      async modifyRecord(key, update) {
        const next = await update(records.get(key))
        records.set(key, next)
        return next
      },
      async deleteRecord(key) { records.delete(key) },
    },
    logger: { warn() {} },
  }
  return { ctx, routes, cleanups, records }
}

test('the Host registers the authenticated FishPi routes', async () => {
  assert.deepEqual(inject, ['connection', 'credentials'])
  const { ctx, routes, cleanups } = createHost()
  apply(ctx, { updateCheck: false })
  await new Promise(resolve => setTimeout(resolve, 20))

  for (const path of [
    '/api/fishpi/state',
    '/api/fishpi/login',
    '/api/fishpi/logout',
    '/api/fishpi/messages',
    '/api/fishpi/send',
    '/api/fishpi/recall',
    '/api/fishpi/medals',
    '/api/fishpi/user',
    '/api/fishpi/users',
    '/api/fishpi/upload',
    '/api/fishpi/red-packet',
    '/api/fishpi/red-packet/claim',
    '/api/fishpi/topic',
    '/api/fishpi/online',
    '/api/fishpi/update/check',
    '/api/fishpi/update/install',
    '/api/fishpi/events',
  ]) {
    assert.ok(routes.has(path), path)
  }

  const stateRoute = routes.get('/api/fishpi/state')
  const state = await (await stateRoute.fetch(new Request('http://host/api/fishpi/state'))).json()
  assert.equal(state.ok, true)
  assert.equal(state.loggedIn, false)
  assert.equal(state.ready, true)
  assert.equal(state.hostVersion, PLUGIN_VERSION)

  const loginRoute = routes.get('/api/fishpi/login')
  const empty = await (await loginRoute.fetch(new Request('http://host/api/fishpi/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nameOrEmail: '', password: '' }),
  }))).json()
  assert.equal(empty.ok, false)
  assert.equal(empty.code, 'invalid_input')

  for (const cleanup of cleanups.reverse()) await cleanup()
})

test('a stored refresh cookie restores the session after DSH restarts', async () => {
  const now = Date.now()
  const records = new Map([
    ['fishpi-chat/account', {
      kind: 'grant',
      payload: {
        version: 2,
        accessToken: 'EXPIRED',
        tokenExpiresAt: now - 1_000,
        refreshExpiresAt: now + 86_400_000,
        refreshCookie: 'OLDCOOKIE',
        remember: true,
        user: { id: '1', userName: 'iwpz', userNickname: '和平哥', userAvatarURL: '' },
      },
    }],
  ])
  const calls = []
  const originalFetch = globalThis.fetch
  const originalWebSocket = globalThis.WebSocket

  globalThis.fetch = async (url, init) => {
    const href = String(url)
    const path = new URL(href).pathname
    calls.push({ href, init })
    if (path === '/api/v3/auth/refresh') {
      assert.equal(init.method, 'POST')
      assert.equal(init.headers.origin, 'https://fishpi.cn')
      assert.equal(init.headers.cookie, 'fp_v3_refresh=OLDCOOKIE')
      assert.equal(init.body, '{}')
      return new Response(JSON.stringify({
        code: 0,
        data: { accessToken: 'NEW', tokenType: 'Bearer', expiresIn: 900, refreshExpiresIn: 2_592_000, scope: 'content.read content.write profile.read' },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'fp_v3_refresh=NEWCOOKIE; Path=/api/v3/auth; HttpOnly; Secure; SameSite=Strict',
        },
      })
    }
    if (path === '/api/v3/me') {
      if (init.headers.authorization === 'Bearer EXPIRED') {
        return new Response(JSON.stringify({ code: 'unauthorized', msg: '登录凭据无效', data: null }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      }
      assert.equal(init.headers.authorization, 'Bearer NEW')
      return new Response(JSON.stringify({
        code: 0,
        data: { id: '1', userName: 'iwpz', userNickname: '和平哥', userAvatarURL: '', userPoint: 1 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (path === '/api/v3/chat/realtime-ticket') {
      assert.equal(init.headers.authorization, 'Bearer NEW')
      return new Response(JSON.stringify({
        code: 0,
        data: { ticket: 'TICKET', path: '/api/v3/chat/realtime', expiresIn: 60 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new Error(`unexpected request ${href}`)
  }
  globalThis.WebSocket = class FakeWebSocket extends EventTarget {
    constructor(url) {
      super()
      this.url = url
      this.readyState = 0
    }
    send() {}
    close() { this.readyState = 3 }
  }

  const { ctx, routes, cleanups } = createHost({ records })
  try {
    apply(ctx, { updateCheck: false })
    await new Promise(resolve => setTimeout(resolve, 60))

    const stateRoute = routes.get('/api/fishpi/state')
    const state = await (await stateRoute.fetch(new Request('http://host/api/fishpi/state'))).json()
    assert.equal(state.loggedIn, true)
    assert.equal(state.persistent, true)
    assert.equal(state.user.userName, 'iwpz')

    const stored = records.get('fishpi-chat/account')
    assert.equal(stored.payload.accessToken, 'NEW')
    assert.equal(stored.payload.refreshCookie, 'NEWCOOKIE')
    assert.equal(stored.payload.user.userName, 'iwpz')
    assert.ok(calls.some(call => call.href.endsWith('/api/v3/auth/refresh')))
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup()
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
  }
})

test('signing in stores the refresh cookie and not the password digest', async () => {
  const records = new Map()
  const originalFetch = globalThis.fetch
  const originalWebSocket = globalThis.WebSocket
  const calls = []
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname
    calls.push({ path, init })
    if (path === '/api/v3/auth/login') {
      assert.equal(JSON.parse(init.body).userPassword.length, 32)
      return new Response(JSON.stringify({
        code: 0,
        data: { accessToken: 'LOGIN', tokenType: 'Bearer', expiresIn: 900, refreshExpiresIn: 2_592_000, scope: 'content.read content.write profile.read' },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'fp_v3_refresh=LOGINCOOKIE; Path=/api/v3/auth; HttpOnly; Secure; SameSite=Strict',
        },
      })
    }
    if (path === '/api/v3/me') {
      return new Response(JSON.stringify({
        code: 0,
        data: { id: '1', userName: 'iwpz', userNickname: '和平哥', userAvatarURL: '', userPoint: 1 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (path === '/api/v3/chat/realtime-ticket') {
      return new Response(JSON.stringify({
        code: 0,
        data: { ticket: 'TICKET', path: '/api/v3/chat/realtime', expiresIn: 60 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new Error(`unexpected request ${url}`)
  }
  globalThis.WebSocket = class FakeWebSocket extends EventTarget {
    constructor(url) {
      super()
      this.url = url
      this.readyState = 0
    }
    send() {}
    close() { this.readyState = 3 }
  }

  const { ctx, routes, cleanups } = createHost({ records })
  try {
    apply(ctx, { updateCheck: false })
    await new Promise(resolve => setTimeout(resolve, 30))
    const loginRoute = routes.get('/api/fishpi/login')
    const response = await loginRoute.fetch(new Request('http://host/api/fishpi/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nameOrEmail: 'iwpz', password: 'secret', remember: true }),
    }))
    const data = await response.json()
    assert.equal(data.ok, true)
    assert.equal(data.user.userName, 'iwpz')
    const stored = records.get('fishpi-chat/account')
    assert.equal(stored.payload.accessToken, 'LOGIN')
    assert.equal(stored.payload.refreshCookie, 'LOGINCOOKIE')
    assert.equal('passwordMd5' in stored.payload, false)
    assert.ok(calls.some(call => call.path === '/api/v3/auth/login'))
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup()
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
  }
})

test('the Host checks npm and reports an available plugin update', async () => {
  const originalFetch = globalThis.fetch
  let latest = '9.9.9'
  globalThis.fetch = async url => {
    assert.match(String(url), /registry\.npmjs\.org/)
    return new Response(JSON.stringify({ name: '@iwpz/fishpi-dsh', version: latest }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { ctx, routes, cleanups } = createHost()
  try {
    apply(ctx, { updateCheck: false })
    await new Promise(resolve => setTimeout(resolve, 20))
    const route = routes.get('/api/fishpi/update/check')
    const first = await (await route.fetch(new Request('http://host/api/fishpi/update/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }))).json()
    assert.equal(first.ok, true)
    assert.equal(first.update.available, true)
    assert.equal(first.update.localAhead, false)
    assert.equal(first.update.latest, '9.9.9')
    assert.match(first.update.url, /npmjs\.com/)

    latest = '0.0.1'
    const second = await (await route.fetch(new Request('http://host/api/fishpi/update/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }))).json()
    assert.equal(second.ok, true)
    assert.equal(second.update.available, false)
    assert.equal(second.update.localAhead, true)
    assert.equal(second.update.latest, '0.0.1')
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup()
    globalThis.fetch = originalFetch
  }
})

test('the Host checks npm automatically after activation', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async url => {
    assert.match(String(url), /registry\.npmjs\.org/)
    return new Response(JSON.stringify({ name: '@iwpz/fishpi-dsh', version: '9.9.9' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const { ctx, routes, cleanups } = createHost()
  try {
    apply(ctx)
    await new Promise(resolve => setTimeout(resolve, 50))
    const state = await (await routes.get('/api/fishpi/state').fetch(new Request('http://host/api/fishpi/state'))).json()
    assert.equal(state.update.available, true)
    assert.equal(state.update.latest, '9.9.9')
    assert.ok(state.update.checkedAt > 0)
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup()
    globalThis.fetch = originalFetch
  }
})

test('the Host recalls a message through the v3 endpoint with an idempotency key', async () => {
  const now = Date.now()
  const records = new Map([
    ['fishpi-chat/account', {
      kind: 'grant',
      payload: {
        version: 2,
        accessToken: 'TOKEN',
        tokenExpiresAt: now + 3_600_000,
        refreshExpiresAt: 0,
        refreshCookie: '',
        remember: true,
        user: { id: '1', userName: 'iwpz', userNickname: '和平哥', userAvatarURL: '' },
      },
    }],
  ])
  const calls = []
  const originalFetch = globalThis.fetch
  const originalWebSocket = globalThis.WebSocket
  globalThis.fetch = async (url, init) => {
    const href = String(url)
    const path = new URL(href).pathname
    calls.push({ href, init })
    if (path === '/api/v3/me') {
      return new Response(JSON.stringify({
        code: 0,
        data: { id: '1', userName: 'iwpz', userNickname: '和平哥', userAvatarURL: '', userPoint: 1 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (path === '/api/v3/chat/realtime-ticket') {
      return new Response(JSON.stringify({
        code: 0,
        data: { ticket: 'TICKET', path: '/api/v3/chat/realtime', expiresIn: 60 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (path === '/api/v3/chat/messages/1792304100000') {
      assert.equal(init.method, 'DELETE')
      assert.equal(init.headers.authorization, 'Bearer TOKEN')
      assert.equal(init.headers['idempotency-key'], 'fishpi-chat-revoke-req1')
      return new Response(JSON.stringify({ code: 0, data: { removed: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected request ${href}`)
  }
  globalThis.WebSocket = class FakeWebSocket extends EventTarget {
    constructor(url) {
      super()
      this.url = url
      this.readyState = 0
    }
    send() {}
    close() { this.readyState = 3 }
  }

  const { ctx, routes, cleanups } = createHost({ records })
  try {
    apply(ctx, { updateCheck: false })
    await new Promise(resolve => setTimeout(resolve, 40))
    const route = routes.get('/api/fishpi/recall')
    const response = await route.fetch(new Request('http://host/api/fishpi/recall', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '1792304100000', requestId: 'req1' }),
    }))
    const data = await response.json()
    assert.equal(data.ok, true)
    assert.equal(data.id, '1792304100000')
    assert.ok(calls.some(call => call.init.method === 'DELETE'))
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup()
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
  }
})

test('the Host installs an available registry update through the plugin manager', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ name: '@iwpz/fishpi-dsh', version: '9.9.9' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
  const updates = []
  const services = {
    pluginManager: {
      async listBundles() {
        return [{ name: '@iwpz/fishpi-dsh', update: 'registry' }]
      },
      async updateBundle(name, version) {
        updates.push({ name, version })
        return { application: 'applied' }
      },
    },
  }
  const { ctx, routes, cleanups } = createHost({ services })
  try {
    apply(ctx, { updateCheck: false })
    await new Promise(resolve => setTimeout(resolve, 20))
    await routes.get('/api/fishpi/update/check').fetch(new Request('http://host/api/fishpi/update/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }))
    const response = await routes.get('/api/fishpi/update/install').fetch(new Request('http://host/api/fishpi/update/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }))
    const data = await response.json()
    assert.equal(data.ok, true)
    assert.equal(data.version, '9.9.9')
    assert.deepEqual(updates, [{ name: '@iwpz/fishpi-dsh', version: '9.9.9' }])
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup()
    globalThis.fetch = originalFetch
  }
})
