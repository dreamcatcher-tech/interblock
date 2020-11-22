const assert = require('assert')
const debug = require('debug')('interblock:tests:hooks')
const { '@@GLOBAL_HOOK': hook, interchain, effect } = require('..')
describe.only('hooks', () => {
  //   require('debug').enable('*hooks')
  const nested = (id, depth = 0) => async () => {
    interchain(`id: ${id} depth: ${depth}`)
    if (depth === 0) {
      return { id }
    } else {
      return nested(id, depth - 1)()
    }
  }

  test('nested hooks awaited', async () => {
    const result = await hook(nested(57, 100))
    assert.strictEqual(result.reduction.id, 57)
    assert.strictEqual(result.requests.length, 101)
  })
  test('nested parallel hooks do not collide', async () => {
    // make many simultaneous calls, and ensure none of them throw an error, and all return correct data
    const inits = Array(100).fill(true)
    const nestedDepth = 10
    const awaits = inits.map((_, index) => {
      return hook(nested(index, nestedDepth))
    })
    const results = await Promise.all(awaits)
    assert(results.every(({ reduction: { id } }, index) => id === index))
  })
  test('reduction must be an object', async () => {
    await assert.rejects(hook(() => () => 'this is a function'))
    await assert.rejects(hook(() => true))
    await assert.rejects(hook(() => 'string'))
  })
})
