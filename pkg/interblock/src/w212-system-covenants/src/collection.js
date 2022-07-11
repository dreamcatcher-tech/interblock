import assert from 'assert-fast'
import * as datum from './datum'
import { interchain } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:apps:collection')

const {
  convertToTemplate,
  demuxFormData,
  validateDatumTemplate,
  muxTemplateWithFormData,
} = datum

const add = async (payload, datumTemplate) => {
  _checkOnlyFormData(payload)
  const formData = demuxFormData(datumTemplate, payload)
  let name = _getChildName(datumTemplate, formData)
  const { covenantId } = datum
  const spawnAction = dmzReducer.actions.spawn(name, { covenantId })
  if (name) {
    interchain(spawnAction)
  } else {
    // TODO calculate name using same method as spawn, to save awaiting
    const { alias } = await interchain(spawnAction)
    name = alias
  }
  const muxed = muxTemplateWithFormData(datumTemplate, formData)
  const set = datum.actions.set(muxed)
  debug(`datum set action`, name)
  // TODO set this in the state of the spawn, to reduce action count
  const result = await interchain(set, name)
  debug(`add completed:`, name)
  return result
}

// TODO allow collection to also store formData as tho it was a datum, without children spec
const reducer = async (state, action) => {
  const { type, payload } = action
  if (type === '@@INIT') {
    debug('init')
    const template = state.datumTemplate || {}
    const datumTemplate = convertToTemplate(template)
    debug(`datumTemplate`, datumTemplate)
    return { ...state, datumTemplate }
  }
  const { datumTemplate } = state
  validateDatumTemplate(datumTemplate)

  // TODO remove test data from being inside the covenant at all
  switch (type) {
    case 'ADD': {
      await add(payload, datumTemplate, action)
      return state
    }
    case 'BATCH': {
      const { batch } = payload
      assert(Array.isArray(batch))

      const awaits = []
      for (const payload of batch) {
        const promise = add(payload, datumTemplate)
        awaits.push(promise)
      }
      for (const promise of awaits) {
        await promise
      }
      return state
    }
    case 'SET_TEMPLATE': {
      _checkNoFormData(payload)
      const datumTemplate = convertToTemplate(payload)
      return { ...state, datumTemplate }
    }
    default:
      debug(action)
      // throw new Error(`Unknown action type: ${action.type}`)
      return state
  }
}
const _checkOnlyFormData = (payload) => {
  const { formData, children, ...rest } = payload
  if (typeof formData === 'undefined') {
    throw new Error(`Must provide formData key`)
  }
  if (Object.keys(rest).length) {
    throw new Error(`Only allowed keys are formData and children`)
  }
  if (!children) {
    return
  }
  if (typeof children !== 'object') {
    throw new Error(`children must be object`)
  }
  const childValues = Object.values(children)
  return childValues.every(_checkOnlyFormData)
}
const _checkNoFormData = (datum) => {
  if (datum.formData) {
    throw new Error(`No formData allowed on datum template`)
  }
  if (!datum.children) {
    return
  }
  const childValues = Object.values(datum.children)
  return childValues.every(_checkNoFormData)
}

const _getChildName = (datumTemplate, payload) => {
  if (!datumTemplate.namePath.length) {
    debug(`_getChildName is blank`)
    return
  }
  let obj = payload.formData
  datumTemplate.namePath.forEach((name) => {
    obj = obj[name]
  })
  if (typeof obj === 'number') {
    obj = obj + ''
  }
  const prefix = datumTemplate.namePath.join('_')
  obj = prefix + '-' + obj
  assert.strictEqual(typeof obj, 'string')
  debug(`_getChildName`, obj)
  return obj
}

const actions = {
  add: (payload = {}) => ({ type: 'ADD', payload }),
  batch: (batch = []) => ({ type: 'BATCH', payload: { batch } }),
  setDatumTemplate: (datumTemplate) => ({
    type: 'SET_TEMPLATE',
    payload: datumTemplate,
  }),
  search: () => ({ type: 'SEARCH' }),
  lock: () => ({ type: 'LOCK' }), // block changes to the schema
  delete: () => ({ type: 'DELETE' }), // or can delete the child directly ?
}

export { reducer, actions }
