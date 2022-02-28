import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import Debug from 'debug'
import { interpret, Machine, assign } from 'xstate'
import { pure } from '..'
import { _skipNextErrorLog } from '../src/xstatePure'
chai.use(chaiAsPromised)

const debug = Debug('interblock:tests:xstatePure')
Debug.enable()
const definition = {
  initial: 'idle',
  strict: true,
  context: {
    answer: 0,
  },
  states: {
    idle: {
      entry: 'hello',
      on: {
        TICK: 'asyncCall',
        ERROR: 'errorAsyncCall',
        UNHANDLED: 'errorAsyncUnhandled',
      },
    },
    asyncCall: {
      invoke: { src: 'asyncCall', onDone: 'process' },
    },
    errorAsyncCall: {
      invoke: {
        src: 'asyncError',
        onDone: { target: 'process', actions: 'bomb' },
        onError: { target: 'process', actions: 'logError' },
      },
    },
    errorAsyncUnhandled: {
      invoke: {
        src: 'asyncError',
        onDone: { target: 'process' },
      },
    },
    process: {
      entry: 'assignAnswer',
      always: [
        { target: 'obfuscate', cond: 'isAnswerCorrect' },
        { target: 'done' },
      ],
    },
    obfuscate: {
      exit: 'assignObfuscation',
      always: 'nested',
    },
    nested: {
      entry: 'nestedEntry',
      initial: 'inner',
      states: {
        inner: {
          always: 'final',
        },
        final: { type: 'final' },
      },
      onDone: 'parallel',
    },
    parallel: {
      type: 'parallel',
      states: {
        p1: {
          initial: 'start',
          states: {
            start: {
              invoke: {
                src: 'asyncCall',
                onDone: 'stop',
              },
            },
            stop: {
              type: 'final',
            },
          },
        },
        p2: {
          initial: 'start',
          states: {
            start: {
              invoke: {
                src: 'asyncCall2',
                onDone: 'stop',
              },
            },
            stop: {
              type: 'final',
            },
          },
        },
      },
      onDone: 'done',
    },
    done: {
      type: 'final',
      data: (context, event) => {
        debug(`done data: context: %O event %O`, context, event)
        return context.answer
      },
    },
  },
}
const config = {
  actions: {
    hello: (context, event) => debug(`actions.hello(%o,%o)`, context, event),
    assignAnswer: assign({
      answer: (context, event) => {
        debug(`assignAnswer: `, context, event)
        const { answer } = context
        assert.strictEqual(answer, 0)
        return event.data
      },
    }),
    assignObfuscation: assign({
      answer: () => 7,
    }),
    nestedEntry: () => debug(`nestedEntry`),
    bomb: () => {
      throw new Error(`bomb`)
    },
    logError: (context, event) => {
      debug(`logError: %o`, event.data.message)
    },
  },
  guards: {
    isAnswerCorrect: ({ answer }, event) => {
      return answer === 42
    },
  },
  services: {
    asyncCall: async (context, event) => {
      debug(`asyncCall: `, context, event)
      return await Promise.resolve(42)
    },
    asyncCall2: async (context, event) => {
      debug(`asyncCall: `, context, event)
      return await Promise.resolve(42)
    },
    asyncError: async () => {
      throw new Error(`asyncError`)
    },
  },
}

describe('baseline', () => {
  test('original xstate loop with awaits comparison', async () => {
    const machine = Machine(definition, config)
    const service = interpret(machine)
    service.start()
    const done = new Promise((resolve) => {
      service.onDone((result) => {
        resolve(result)
      })
    })
    service.send('TICK')
    const result = await done
    debug(`result`, result)
    assert.strictEqual(result.data, 7)
  })
  test('original xstate error', async () => {
    const machine = Machine(definition, config)
    const service = interpret(machine)
    service.start()
    const done = new Promise((resolve) => {
      service.onDone((result) => {
        resolve(result)
      })
    })
    service.send('ERROR')
    const result = await done
    debug(result)
    assert.strictEqual(result.data.message, 'asyncError')
  })
  test('pure xstate', async () => {
    debug('')
    debug('')
    debug('')
    debug('')
    const result = await pure('TICK', definition, config)
    debug(`test result: `, result)
    assert.strictEqual(result, 7)
  })
  test('pure xstate with error', async () => {
    debug('')
    debug('')
    debug('')
    debug('')
    const result = await pure('ERROR', definition, config)
    debug(`test result: `, result)
    assert.strictEqual(result.message, 'asyncError')
  })
  test('pure xstate with unhandled error', async () => {
    debug('')
    debug('')
    debug('')
    debug('')
    _skipNextErrorLog()
    await assert.isRejected(pure('UNHANDLED', definition, config))
  })
})