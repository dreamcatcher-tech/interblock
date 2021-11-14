import assert from 'assert-fast'
import { modelInflator, precompileSchema } from './modelInflator'
import { registry } from './registry'
import * as crypto from '../../w012-crypto'
import equal from 'fast-deep-equal'
import flatstr from 'flatstr'
import fastJson from 'fast-json-stringify'
import jsonpack from 'jsonpack'
import Debug from 'debug'
const debug = Debug('interblock:models:utils')

const standardize = (model) => {
  checkStructure(model)
  precompileSchema(model.schema)
  const create = model.create
  let defaultInstance
  const modelWeakSet = new WeakSet()
  const objectToModelWeakMap = new WeakMap()
  const isModel = (test) => modelWeakSet.has(test)

  const clone = (object) => {
    if (!object) {
      if (!defaultInstance) {
        defaultInstance = standardModel.create()
      }
      return defaultInstance
    }
    if (isModel(object)) {
      return object
    }
    if (typeof object === 'string') {
      object = JSON.parse(object)
    }
    if (objectToModelWeakMap.has(object)) {
      return objectToModelWeakMap.get(object)
    }
    const inflated = modelInflator(model.schema, object)

    const modelFunctions = model.logicize(inflated)

    const { serialize, getHash, getProof, equals } = closure(
      model.schema,
      inflated,
      isModel
    )
    const functions = {
      ...modelFunctions,
      serialize,
      getHash,
      getProof,
      equals,
    }
    defineFunctions(inflated, functions)
    deepFreeze(inflated)

    modelWeakSet.add(inflated)
    objectToModelWeakMap.set(object, inflated)
    return inflated
  }

  // TODO add produce function so clone isn't overloaded
  const standardModel = Object.freeze({
    ...model,
    create,
    clone,
    isModel,
  })
  return standardModel
}

const closure = (schema, inflated, isModel) => {
  const equals = (other) => {
    if (!isModel(other)) {
      return false
    }
    return equal(inflated, other)
  }
  let stringify
  const serialize = () => {
    /**
     * Tested on serializing a network object with 20,000 channels.
     * JSON.stringify takes 23ms
     * jsonpack takes 14s but takes 5MB down to 2MB
     * fastJsonStringify takes 200ms
     * snappy compression in nodejs takes it down to 1MB in 9ms
     * snappyjs compression takes it down to 1MB is 72ms
     * zipson down to 1.3MB in 134ms
     */
    // TODO strangely is 10x faster to use JSON.stringify() :shrug:
    // if (!stringify) {
    //   stringify = fastJson(schema)
    // }
    // const string = stringify(inflated)
    // flatstr(string)
    // return string
    // const string = jsonpack.pack(inflated)
    // return string
    return JSON.stringify(inflated)
  }
  let cachedHash, cachedProof
  const _generateHashWithProof = () => {
    assert.strictEqual(typeof inflated, 'object')
    const { hash, proof } = generateHash(schema, inflated)
    cachedHash = hash
    cachedProof = proof
  }
  const getHash = () => {
    if (!cachedHash) {
      _generateHashWithProof()
      assert(cachedHash)
    }
    return cachedHash
  }
  const getProof = () => {
    if (!cachedProof) {
      _generateHashWithProof()
      assert(cachedProof)
    }
    return cachedProof
  }
  return { equals, serialize, getHash, getProof }
}

const generateHash = (schema, instance) => {
  switch (schema.title) {
    case 'Action': {
      if (instance.type === '@@GENESIS' && instance.payload.genesis) {
        const { genesis } = instance.payload
        const blockModel = registry.get('Block')
        assert(blockModel.isModel(genesis))
        const modified = { ...instance, payload: { ...instance.payload } }
        modified.payload.genesis = genesis.getHash()
        return hashFromSchema(schema, modified)
      }
      return hashFromSchema(schema, instance)
    }
    case 'Integrity': {
      return { hash: instance.hash }
    }
    case 'Interblock':
    case 'Block': {
      return {
        // TODO check if hash is calculated correctly
        hash: instance.provenance.reflectIntegrity().hash,
        proof: 'no proof needed',
      }
    }
    case 'Network': {
      const { hash, proof: networkChannels } = hashPattern(instance)
      return { hash, proof: { networkChannels } }
    }
    case 'Channel': {
      const remote = _pickRemote(instance)
      const restOfChannelKeys = ['systemRole', 'requestsLength', 'tip']
      const restOfChannel = _pick(instance, restOfChannelKeys)
      const properties = _pick(schema.properties, restOfChannelKeys)
      const { hash: proof } = hashFromSchema({ properties }, restOfChannel)
      const hash = crypto.objectHash({ remote: remote.getHash(), proof })
      return { hash, proof }
    }
    case 'State': {
      return { hash: crypto.objectHash(instance) }
    }
    case 'SimpleArray': {
      // TODO remove this when can handle pattern properties correctly
      return { hash: crypto.objectHash(instance) }
    }
    // TODO lock, rx* do not need true hashing - can speed up by using stringify for them ?
    default: {
      return hashFromSchema(schema, instance)
    }
  }
}
const _pickRemote = (instance) => {
  const remoteModel = registry.get('Remote')
  const remotePick = _pick(instance, [
    'address',
    'replies',
    'requests',
    'precedent',
  ])
  const remote = remoteModel.clone(remotePick)
  return remote
}
const _pick = (obj, keys) => {
  // much faster than lodash pick
  const blank = {}
  keys.forEach((key) => {
    if (typeof obj[key] !== 'undefined') {
      blank[key] = obj[key]
    }
  })
  return blank
}

const hashFromSchema = (schema, instance) => {
  if (schema.patternProperties) {
    const { hash } = hashPattern(instance) // strip proof
    return { hash }
  }
  const hashes = {}
  const { properties } = schema
  Object.keys(instance).forEach((key) => {
    const { title, type, patternProperties, items } = properties[key]
    const slice = instance[key]
    if (registry.isRegistered(title)) {
      hashes[key] = slice.getHash()
      return
    }
    if (type === 'array') {
      hashes[key] = hashArray(slice, items)
      return
    }
    if (patternProperties) {
      const { hash } = hashPattern(slice)
      hashes[key] = hash
      return
    }
    hashes[key] = slice
  })
  return { hash: crypto.objectHash(hashes) }
}

const hashArray = (instance, items) => {
  if (registry.isRegistered(items.title)) {
    const arrayOfHashes = instance.map((item) => {
      return item.getHash()
    })
    return crypto.objectHash(arrayOfHashes)
  }
  return crypto.objectHash(instance)
}

const hashPattern = (instance) => {
  const proof = Object.keys(instance).map((key) =>
    crypto.objectHash({ [key]: instance[key].getHash() })
  )
  proof.sort()
  const hash = crypto.objectHash(proof)
  return { hash, proof }
}

const defineFunctions = (target, functions) => {
  for (const prop in target) {
    assert(!functions[prop], `function collision: ${prop}`)
  }
  const properties = {}
  for (const functionName in functions) {
    properties[functionName] = {
      enumerable: false,
      configurable: false,
      writable: false,
      value: functions[functionName],
    }
  }
  Object.defineProperties(target, properties)
}

const checkStructure = (model) => {
  const { title } = model.schema
  const functionCheck = ['create', 'logicize']
  functionCheck.forEach((key) => {
    if (typeof model[key] !== 'function') {
      throw new Error(`Model: ${title} needs function: ${key}`)
    }
  })
  const propertiesCount = Object.keys(model).length
  if (propertiesCount !== 3) {
    throw new Error(`Model: ${title} has ${propertiesCount} properties, not 3`)
  }
}
const deepFreeze = (o) => {
  Object.freeze(o)
  for (const prop in o) {
    if (o[prop] === undefined) {
      // undefined values have their keys removed in json
      throw new Error(`Values cannot be undefined: ${prop}`)
    }
    if (typeof o[prop] === 'function') {
      throw new Error(`No functions allowed in deepFreeze: ${prop}`)
    }
    if (typeof o[prop] === 'object' && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop])
    }
  }
}

export { standardize }
