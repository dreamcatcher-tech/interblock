import { assert } from 'chai/index.mjs'
import Debug from 'debug'
import { networkModel, channelModel, addressModel } from '..'
import * as snappy from 'snappy'
import * as snappyjs from 'snappyjs'
import flatstr from 'flatstr'
import { Buffer } from 'buffer'
import { stringify } from 'zipson'
const debug = Debug('interblock:tests:network')

describe('network', () => {
  test('creates default', () => {
    const network = networkModel.create()
    assert(network['..'])
    assert(network['.'])
    assert.strictEqual(network.getAliases().length, 2)
  })
  test('parent is unknown by default', () => {
    const network = networkModel.create()
    const parent = network['..']
    assert(parent)
    assert(parent.address.isUnknown())
  })
  test('aliases cannot be tampered with', () => {
    const network = networkModel.create()
    const aliases = network.getAliases()
    assert.strictEqual(aliases.length, 2)
    assert.throws(aliases.pop)
    assert.strictEqual(aliases.length, 2)
    assert.strictEqual(network.getAliases().length, 2)
  })
  test.skip('large network', () => {
    Debug.enable('*tests*')
    let network = networkModel.create()
    let channel = channelModel.create()
    const count = 200000
    const next = {}
    for (let i = 0; i < count; i++) {
      const alias = `alias${i}`
      const address = addressModel.create('GENESIS')
      channel = channelModel.create(address)
      // network = network.merge({ [alias]: channel })
      next[alias] = channel
    }
    let start = Date.now()
    network = network.merge(next)
    debug(`time to %o: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = network.merge({ addOne: channel })
    debug(`add one time %o ms`, Date.now() - start)
    start = Date.now()
    const hash = network.getHash()
    debug(`hash time: %o ms`, Date.now() - start)
    network = network.merge({ addTwo: channel })
    start = Date.now()
    const hash2 = network.getHash()
    debug(`hash2 time: %o ms`, Date.now() - start)
    start = Date.now()
    const string = network.serialize()
    debug(`serialize: %o ms size: %o`, Date.now() - start, string.length)
    start = Date.now()
    flatstr(string)
    const buf = Buffer.from(string)
    debug(`conversion time: %o ms`, Date.now() - start)
    start = Date.now()
    const compressed = snappy.compressSync(buf)
    debug(`snappy %o ms size: %o`, Date.now() - start, compressed.length)
    start = Date.now()
    const compressed2 = snappyjs.compress(buf)
    debug(`snappyjs %o ms size: %o`, Date.now() - start, compressed2.length)
    start = Date.now()
    const compressed3 = stringify(network)
    debug(`zipson %o ms size: %o`, Date.now() - start, compressed3.length)
  })
  test.todo('rxReply always selected before rxRequest')
  test.todo('rxReply( request ) throws if non existant channel in request')
  test.todo('empty string cannot be used as channel name')
})