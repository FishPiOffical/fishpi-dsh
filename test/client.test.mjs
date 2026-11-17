import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

/** A React-shaped stub: the registration test never renders a component. */
const reactStub = {
  Component: class Component { constructor(props) { this.props = props } },
  createElement: () => undefined,
  useCallback: fn => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
  useRef: () => ({ current: null }),
  useState: value => [typeof value === 'function' ? value() : value, () => {}],
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

test('the Client module registers every surface against a fake Cordis context', async () => {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  let factory
  globalThis.window = {
    __ModuleLoader__: {
      load(definition) {
        assert.equal(definition.id, '@iwpz/fishpi-dsh')
        factory = definition.factory
      },
    },
  }
  vm.runInThisContext(source, { filename: 'client.js' })
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }

  const registrations = []
  const cleanups = []
  const ctx = {
    effect(callback) {
      const cleanup = callback()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
      return cleanup
    },
    locale: {
      bind: () => key => key,
      register: () => () => {},
    },
    sidebarRightTabs: {
      register(definition) {
        registrations.push({ surface: 'tab', definition })
        return () => {}
      },
    },
    sidebarRight: { openTab() {} },
    slots: {
      inject(_owner, callback) { return callback() },
      register(options, component) {
        registrations.push({ surface: 'slot', options, component })
        return () => {}
      },
    },
  }

  globalThis.fetch = async url => {
    if (String(url).includes('/events')) return new Promise(() => {})
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, loggedIn: false, cursor: 0, ready: true }),
    }
  }

  const client = factory(requireReact)
  assert.deepEqual(client.inject, ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight'])
  client.apply(ctx)
  await new Promise(resolve => setTimeout(resolve, 20))

  const tab = registrations.find(entry => entry.surface === 'tab')
  assert.equal(tab.definition.kind, 'fishpi.chat')
  assert.equal(tab.definition.id, '@iwpz/fishpi-dsh')
  assert.equal(tab.definition.guide[0].id, 'open')

  const slots = registrations.filter(entry => entry.surface === 'slot').map(entry => entry.options)
  assert.ok(slots.some(options => options.name === 'sidebar.right.pane.tab' && options.key === '@iwpz/fishpi-dsh'))
  assert.ok(slots.some(options => options.name === 'sidebar.right.pane.tab.title' && options.key === '@iwpz/fishpi-dsh'))
  assert.ok(slots.some(options => options.name === 'conversation.session.header.utilities' && options.id === 'fishpi-chat'))
  assert.ok(slots.some(options => options.name === 'settings.section' && options.id === 'fishpi-chat'))
  assert.ok(slots.some(options => options.name === 'settings.section.icon' && options.id === 'fishpi-chat'))

  for (const cleanup of cleanups.reverse()) await cleanup()
  delete globalThis.window
  delete globalThis.document
})

/**
 * Resolve the browser module table's `react` request to the stub above.
 * @param {string} name - requested module name.
 * @returns {object}
 */
function requireReact(name) {
  assert.equal(name, 'react')
  return reactStub
}
