import chai, { assert } from 'chai/index.mjs'
import posix from 'path-browserify'
import { shell } from '..'
import Debug from 'debug'
import { Engine } from '../../w210-engine'
const debug = Debug('interblock:tests:shell')

describe('machine validation', () => {
  describe('state machine', () => {
    test('buffered request is processed', async () => {
      const base = await metrologyFactory('s', { hyper: shell })
      await base.spawn('child1')
      base.enableLogging()
      const cd = shell.actions.cd('child1')
      const cdPromise = base.pierce(cd)
      const ls = shell.actions.ls('/')
      const lsPromise = base.pierce(ls)
      const [cdResult, lsResult] = await Promise.all([cdPromise, lsPromise])
      assert.strictEqual(cdResult.absolutePath, '/child1')
      assert.strictEqual(Object.keys(lsResult.children).length, 4)
      await base.shutdown()
    })
  })
  test.todo('opens up a path')
  test.todo('coordinates with simultaneous path openings')
  test.todo('detects changes in filesystem')
  describe('cd', () => {
    test.only('cd to valid nested path', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const addResult = await engine.pierce(shell.actions.add('child1'))
      debug(addResult)

      const cdAction = shell.actions.cd('child1')
      const cdResult = await engine.pierce(cdAction)
      assert.strictEqual(cdResult.absolutePath, '/child1')
      debug(`result`, cdResult)

      const { wd } = engine.latest.getState().toJS()
      assert.strictEqual(wd, '/child1')

      await engine.pierce(shell.actions.add('nested1'))
      const cdNested = shell.actions.cd('nested1')

      const nestedResult = await engine.pierce(cdNested)
      debug(`nestedResult`, nestedResult)
      const { wd: wdNested } = engine.latest.getState().toJS()
      assert.strictEqual(wdNested, '/child1/nested1')
      assert.strictEqual(engine.logger.pulseCount, 14)
    })
    test('cd errors on garbage path', async () => {
      const base = await metrologyFactory('e', { hyper: shell })
      const cd = shell.actions.cd('garbagePath')
      await assert.isRejected(base.pierce(cd), '/garbagePath')
      await base.shutdown()
    })
    test('cd errors on nested garbage path', async () => {
      const base = await metrologyFactory('e', { hyper: shell })
      await base.spawn('child1')
      const cd = shell.actions.cd('child1/garbagePath')
      await assert.isRejected(base.pierce(cd))
      const cdTrailing = shell.actions.cd('child1/garbagePath/')
      await assert.isRejected(base.pierce(cdTrailing))
      const cdLong = shell.actions.cd('child1/garbagePath/asdf/asdf/')
      await assert.isRejected(base.pierce(cdLong))
      await base.shutdown()
    })
    test('. is resolved', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()

      const cd = shell.actions.cd()
      const result = await base.pierce(cd)
      debug(`result`, result)

      const context = await base.getContext()
      debug(`context:`, context)
      assert.strictEqual(context.wd, '/')
      await base.shutdown()
    })
    test(`.. is valid`, async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      await base.spawn('child1')
      const cdChild = shell.actions.cd('child1')
      await base.pierce(cdChild)
      const { wd } = await base.getContext()
      assert.strictEqual(wd, '/child1')

      const cdParent = shell.actions.cd('..')
      const parentResult = await base.pierce(cdParent)
      debug(`parentResult`, parentResult)
      const { wd: wdParent } = await base.getContext()
      assert.strictEqual(wdParent, '/')
      await base.shutdown()
    })
    test(`cd .. at root stays at root`, async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const cd = shell.actions.cd('.')
      await base.pierce(cd)
      const { wd } = await base.getContext()
      assert.strictEqual(wd, '/')
      const cdUp = shell.actions.cd('..')
      await base.pierce(cdUp)
      const { wd: wdCd } = await base.getContext()
      assert.strictEqual(wdCd, '/')
      await base.shutdown()
    })
    test.todo('cd rejects if non existent path')
    test.todo('absolute path')
    test.todo('parent path')
  })
  describe('ls', () => {
    test('list current directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls()
      const { children } = await base.pierce(ls)
      debug(`ls: `, children)
      assert.deepEqual(Object.keys(children), ['..', '.'])
      const { children: repeated } = await base.pierce(ls)
      assert.deepEqual(Object.keys(repeated), ['..', '.', '.@@io'])
      await base.shutdown()
    })
    test('list remote directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      await base.spawn('child1')
      const ls = shell.actions.ls('child1')
      const { children } = await base.pierce(ls)
      assert.deepEqual(Object.keys(children), ['..', '.'])
      const lsAbsolute = shell.actions.ls('child1')
      const { children: childrenAbsolute } = await base.pierce(lsAbsolute)
      assert.deepEqual(Object.keys(childrenAbsolute), ['..', '.'])
      await base.shutdown()
    })
    test('throws on invalid directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild')
      await assert.isRejected(
        base.pierce(ls),
        'Non existent path: /nonExistentChild'
      )
      await base.shutdown()
    })
    test('throws on invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild/nested')
      await assert.isRejected(
        base.pierce(ls),
        'Non existent path: /nonExistentChild'
      )
      await base.shutdown()
    })
    test('throws on invalid double nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild/nested1/nested2')
      await assert.isRejected(base.pierce(ls))
      await base.shutdown()
    })
    test('throws on shallow invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('child1')
      base.enableLogging()
      const ls = shell.actions.ls('validChild/nonExistentChild')
      await assert.isRejected(base.pierce(ls), 'Non existent path: /validChild')
      await base.shutdown()
    })
    test('throws on deep invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('c1')
      await base.pierce(shell.actions.add('c1/nested1'))
      base.enableLogging()

      const ls = shell.actions.ls('c1/nested1/invalid')
      await assert.isRejected(
        base.pierce(ls),
        'Non existent path: /c1/nested1/invalid'
      )
      await base.shutdown()
    })
    test('root path when cd is child', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('child')
      await base.pierce(shell.actions.cd('child'))
      const { wd } = await base.getContext()
      assert.strictEqual(wd, '/child')

      const ls = shell.actions.ls('/child')
      const result = await base.pierce(ls)
      debug(result)
      await base.shutdown()
    })
    test.todo('simultaneous requests')
  })
  describe('getState', () => {
    test('basic', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('child')
      const state = await base.pierce(shell.actions.cat('child'))
      debug(state)
      await base.shutdown()
    })
  })
  describe('normalize', () => {
    test('normalize tests', () => {
      const { resolve } = posix
      assert.strictEqual(resolve('/something', '/other/path/.'), '/other/path')
      assert.strictEqual(resolve(`/child/..`), `/`)
      assert.strictEqual(resolve(`/child/../random/..`), `/`)
      assert.strictEqual(resolve(`/child/../random/../`), `/`)
      // TODO more tests of how we expect path normalization to work
    })
  })
  describe('add', () => {
    test.todo('invalid parent path rejects')
    test.todo('grandchild can spawn')
  })
  describe('install', () => {
    test('deep child runs custom covenant', async () => {
      let isExecuted = false
      const covenant = {
        installer: {
          children: {
            testChild: {
              covenant: 'testChildCovenant',
            },
          },
        },
        covenants: {
          testChildCovenant: {
            reducer: (state, action) => {
              debug(`testChildCovenant`, action)
              isExecuted = true
              return state
            },
          },
        },
      }
      const overloads = { hyper: shell, dpkgTest: covenant }
      const blockchain = await metrologyFactory('install', overloads)
      blockchain.enableLogging()
      const publish = shell.actions.publish('dpkgTest', covenant.installer)
      const { dpkgPath } = await blockchain.pierce(publish)
      debug(`dpkgPath: `, dpkgPath)
      const install = shell.actions.install(dpkgPath, 'appTest')
      const installResult = await blockchain.pierce(install)
      debug(`installResult`, installResult)
      assert(isExecuted)
      await blockchain.shutdown()
    })
  })
})
