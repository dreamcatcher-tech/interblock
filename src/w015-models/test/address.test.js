import { assert } from 'chai/index.mjs'
import { addressModel, integrityModel } from '..'

describe('address', () => {
  test('no params makes unknown address', () => {
    const address = addressModel.create()
    assert(!address.isGenesis())
    assert(address.isUnknown())
    assert.throws(address.getChainId)
    const genesis = addressModel.create('GENESIS')
    assert(genesis.isGenesis())
    assert(!genesis.isUnknown())
    assert.throws(genesis.getChainId)

    const clone = addressModel.clone()
    assert(!clone.isGenesis())
    assert(clone.isUnknown())
  })
  test('rejects random objects', () => {
    assert.throws(() => addressModel.create({ some: 'random thing' }))
  })
  test('test addresses from strings', () => {
    const { hash } = integrityModel.create('test address')
    assert.strictEqual(typeof hash, 'string')
    assert.strictEqual(hash.length, 64)
    const address = addressModel.create(hash)
    assert(!address.isUnknown())
    assert(!address.isGenesis())
    const clone = addressModel.create(hash)
    assert(clone.equals(address))
  })
  test('clone equivalence', () => {
    const address = addressModel.create()
    const clone = addressModel.clone(address)
    const empty = addressModel.clone()
    assert(address.equals(clone))
    assert(address.equals(empty))
  })
  test('from integrity', () => {
    const integrity = integrityModel.create({ some: 'object' })
    const address = addressModel.create(integrity)
    assert(!address.isGenesis())
    assert(!address.isUnknown())
    assert.strictEqual(address.getChainId(), integrity.hash)
    const clone = addressModel.clone(address)
    assert(clone.equals(address))
  })
  test('genesis is randomized', () => {
    const a1 = addressModel.create('GENESIS')
    const a2 = addressModel.create('GENESIS')
    assert(!a1.equals(a2))
    const u1 = addressModel.create()
    const u2 = addressModel.create()
    assert(u1.equals(u2))
    assert(!a1.equals(u1))
    assert(!a2.equals(u1))
  })
})
