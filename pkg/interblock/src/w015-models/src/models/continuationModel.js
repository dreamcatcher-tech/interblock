import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { continuationSchema } from '../schemas/modelSchemas'

const continuationModel = standardize({
  schema: continuationSchema,
  // TODO if not promise or reject, then use the action model to avoid enveloping ?
  create(type = '@@RESOLVE', payload = {}) {
    return continuationModel.clone({ type, payload })
  },
  logicize(instance) {
    if (instance.type === '@@PROMISE') {
      assert.strictEqual(
        Object.keys(instance.payload).length,
        0,
        `Promises cannot have payloads`
      )
    }

    const isPromise = () => instance.type === '@@PROMISE'
    const isRejection = () => instance.type === '@@REJECT'
    const isResolve = () => instance.type === '@@RESOLVE'
    return { isPromise, isRejection, isResolve }
  },
})

export { continuationModel }