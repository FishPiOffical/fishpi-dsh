import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject } from '../index.js'

/**
 * A Cordis-shaped Host context with just the seams the plugin uses.
 * @returns {{ctx: object, routes: Map<string, object>, cleanups: Function[]}}
 */
function createHost() {
  const routes = new Map()
  const cleanups = []
  const ctx = {
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
      async readRecord() { return undefined },
      async modifyRecord() { return undefined },
      async deleteRecord() {},
    },
    logger: { warn() {} },
  }
  return { ctx, routes, cleanups }
}

test('the Host registers the authenticated FishPi routes', async () => {
  assert.deepEqual(inject, ['connection', 'credentials'])
  const { ctx, routes, cleanups } = createHost()
  apply(ctx)
  await new Promise(resolve => setTimeout(resolve, 20))

  for (const path of [
    '/api/fishpi/state',
    '/api/fishpi/login',
    '/api/fishpi/logout',
    '/api/fishpi/messages',
    '/api/fishpi/send',
    '/api/fishpi/medals',
    '/api/fishpi/user',
    '/api/fishpi/users',
    '/api/fishpi/upload',
    '/api/fishpi/red-packet',
    '/api/fishpi/red-packet/claim',
    '/api/fishpi/topic',
    '/api/fishpi/online',
    '/api/fishpi/events',
  ]) {
    assert.ok(routes.has(path), path)
  }

  const stateRoute = routes.get('/api/fishpi/state')
  const state = await (await stateRoute.fetch(new Request('http://host/api/fishpi/state'))).json()
  assert.equal(state.ok, true)
  assert.equal(state.loggedIn, false)
  assert.equal(state.ready, true)

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
