const assert = require('assert')
const debug = require('debug')('interblock:tests:metrology')
const { metrologyFactory } = require('..')

describe('metrology', () => {
  describe('spawn', () => {
    test.skip('spawn many times', async () => {
      jest.setTimeout(100000)
      require('debug').enable('interblock:tests:metrology')
      const client = await metrologyFactory()
      client.enableLogging()
      let count = 0
      const awaits = []
      const start = Date.now()
      while (count < 100) {
        const result = client.spawn()
        awaits.push(result)
        if (count % 10 === 0) {
          debug(await result)
        }
        count++
      }
      const bulkResult = await Promise.all(awaits)
      debug(`time for ${count} children: ${Date.now() - start}`)
      assert(bulkResult.every(({ chainId }) => chainId))
      /**
       * need to see 1000 children spawned in under 5 seconds, with blocksize of 20kB
       *
       * 2020-07-17 1,000 seconds 800 children, 5.33 MB block size
       */
    })
  })
  describe('actions', () => {
    /**
     * Try different action sizes and see which gives the highest tx rate.
     * Try different sizes of the actions.
     * Try different amounts of computation per action.
     * Generate all interblocks first, using pause, before executing
     */
    test.todo('benchmark max tx thruput')
  })
})
