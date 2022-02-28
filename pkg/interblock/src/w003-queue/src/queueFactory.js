import assert from 'assert-fast'
import setImmediate from 'set-immediate-shim'
import Debug from 'debug'

const ioQueueFactory = (name, model) => {
  assert(name && typeof name === 'string')
  const debug = Debug('interblock:queue:' + name)

  const _requests = []
  const _awaiting = new Set()
  let _isActive = true
  let _concurrency = Number.MAX_SAFE_INTEGER
  let _requestCount = 0
  let _processor

  const loop = async () => {
    if (!_processor) {
      return
    }
    // await Promise.resolve() // TODO ensure no need to thread break

    while (_isActive && _awaiting.size < _concurrency && _requests.length) {
      debug(`awaiting size: ${_awaiting.size}`)
      const envelope = _requests.shift()
      _awaiting.add(envelope)
      invoker(envelope)
    }
  }

  const invoker = async (envelope) => {
    assert(envelope && typeof envelope === 'object')
    const { action, resolve, reject, promise } = envelope
    assert(resolve && reject)
    try {
      const result = await _processor(action)
      resolve(result) // calling resolve in a promise does not yield control
    } catch (e) {
      debug(`${name} rejected: %O %O`, envelope, e)
      reject(e)
    }
    loop()
    assert(_awaiting.has(envelope))
    _awaiting.delete(envelope)
  }

  const subscribers = new Set()

  const queue = {
    name,
    settle: async () => {
      while (_awaiting.size || _requests.length) {
        debug(
          `settle _awaiting.size: %o _requests.length: %o`,
          _awaiting.size,
          _requests.length
        )
        if (_awaiting.size) {
          const promises = [..._awaiting].map(({ promise }) => promise)
          await Promise.race(promises)
        } else {
          await new Promise(setImmediate) // wait for requests to be processed
        }
      }
      debug(`settled`)
    },
    length: () => _requests.length,
    awaitingLength: () => _awaiting.size,
    awaitNextPush: async () =>
      new Promise((resolve) => {
        const unsubscribe = queue.subscribe((action, promise) => {
          unsubscribe()
          resolve(action)
        })
      }),
    subscribe: (callback) => {
      assert(typeof callback === 'function')
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    getProcessor: () => {
      return _processor
    },
    rejectAll: () => {
      queue.setProcessor((action) => {
        throw new Error(`Tried to process: ${JSON.parse(action, null, 2)}`)
      })
    },
    setConcurrency: (concurrency) => {
      _concurrency = concurrency
      loop()
    },
    push: async (action) => {
      debug(`push ${action.type || model.schema.title}`)
      _assertAddable(model, action)
      let envelope
      const promise = new Promise((resolve, reject) => {
        const id = _requestCount++
        envelope = { id, action, resolve, reject }
      })
      envelope.promise = promise
      _requests.push(envelope)
      loop()
      try {
        // without trycatch, can receive unhandled rejection error
        const awaits = []
        for (const subscriber of subscribers.values()) {
          awaits.push(subscriber(action, promise))
        }
        await Promise.all(awaits)
      } catch (e) {
        debug(`subscriber rejected: %O %O`, envelope, e)
        throw e
      }
      return promise
    },
    setProcessor: (processor) => {
      // when breaking a queue, the processor is the push of the other queue
      assert(!_requestCount || !_processor, `cannot switch after commencing`)
      assert(typeof processor === 'function')
      _processor = processor
    },
    halt: async (timeout) => {
      _isActive = false
      await new Promise((resolve) => setTimeout(resolve, timeout))
      const haltingError = new Error('Queue is halting operation')
      _awaiting.values().forEach(({ reject }) => reject(haltingError))
      _awaiting.clear()
    },
  }
  return queue
}

const _assertAddable = (model, action) => {
  if (model) {
    assert(action instanceof model, `model is not addable`)
  }
}

/**
 * For an SQS queue, push resolving means the queue has received the message.
 * For an IO queue, push resolving comes with the response of the processor.
 */
const sqsQueueFactory = (name, model) => {
  assert(name && typeof name === 'string')
  const debug = Debug('interblock:queue:sqs:' + name)
  const queue = ioQueueFactory(name, model)
  /**
   * Bypasses whatever infrastructure is connected to the queue,
   * pushing straight onto the engine queue underneath.  Used in
   * aws to execute actions in the same thread, rather than going
   * via SQS queues, or any other means.
   * @param {object} action
   */
  const pushDirect = queue.push
  let _sqsProcessor = (action) => {
    // push without waiting for the calculation is the purpose of sqs queues
    queue.push(action)
  }

  const assertQueueEmpty = () =>
    !queue.getProcessor() || queue.setProcessor(queue.getProcessor())
  return {
    ...queue,
    push: async (action) => {
      debug(`push sqs ${name}`)
      _assertAddable(model, action)
      await _sqsProcessor(action)
    },
    pushDirect,
    setSqsProcessor: (processor) => {
      assertQueueEmpty()
      _sqsProcessor = processor
    },
  }
}

export { ioQueueFactory, sqsQueueFactory }