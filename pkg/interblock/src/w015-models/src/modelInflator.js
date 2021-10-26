import assert from 'assert-fast'
import { registry } from './registry'
import Ajv from 'ajv'
import AjvFormats from 'ajv-formats'
import Debug from 'debug'
const debug = Debug('interblock:models:modelInflator')
const ajv = new Ajv({ allErrors: true, verbose: true })
AjvFormats(ajv)

const modelInflator = (schema, instance) => {
  if (schema.title === 'State') {
    return { ...instance }
  }
  assert(schema.title, `only titled schemas can be inflated`)
  if (schema.patternProperties) {
    return inflatePattern(schema, instance)
  }
  if (schema.type === 'array') {
    return inflateArray(schema, instance)
  }

  assertKeysValidated(schema, instance)
  const inflated = {}
  const { properties } = schema
  Object.keys(instance).map((key) => {
    const { title, type, patternProperties } = properties[key]
    const slice = instance[key]
    if (registry.isRegistered(title)) {
      inflated[key] = registry.get(title).clone(slice)
      return
    }
    if (type === 'array') {
      inflated[key] = inflateArray(properties[key], slice)
      return
    }
    if (patternProperties) {
      inflated[key] = inflatePattern(properties[key], slice)
      return
    }
    validate(properties[key], slice)
    inflated[key] = slice
  })
  return inflated
}

const inflatePattern = (schema, instance) => {
  assert(schema.type === 'object')
  assert(schema.patternProperties)
  assert(!schema.additionalProperties)
  assert.strictEqual(Object.keys(schema.patternProperties).length, 1)
  // check min and max
  const regex = Object.keys(schema.patternProperties)[0]
  const isIntegerRegex = regex === '[0-9]*'
  const isCharRegex = regex === '(.*?)'
  const modelSchema = schema.patternProperties[regex]
  const model = registry.get(modelSchema.title)
  assert(model, `patternProperties must use models for values`)

  const inflated = {}
  Object.keys(instance).map((key) => {
    if (isIntegerRegex) {
      const int = parseInt(key)
      assert(Number.isInteger(int), `${key} is not number: ${int}`)
    }
    // TODO detect non chars at speed ?
    inflated[key] = model.clone(instance[key])
  })
  return inflated
}

const inflateArray = (schema, instance) => {
  assert(Array.isArray(instance))
  assert(schema.type === 'array')
  assert(schema.uniqueItems, `uniqueItems not set: ${schema.title}`)
  if (schema.items.type === 'number') {
    // TODO do proper check for number
    return instance
  }
  if (schema.items.type === 'string') {
    // TODO do proper check for string, including pattern checks
    return instance
  }

  const model = registry.get(schema.items.title)
  assert(model, `Arrays must be models`)
  // check the min and unique items props
  return instance.map(model.clone)
}

const assertKeysValidated = (schema, instance) => {
  assert(!schema.additionalProperties, `additionalProperties: ${schema.title}`)
  const instanceKeys = Object.keys(instance)
  const propKeys = Object.keys(schema.properties)
  const isRequired = schema.required.every(
    (key) => typeof instance[key] !== 'undefined'
  )
  assert(isRequired, `missing some required keys`)
  const isProps = instanceKeys.every((key) => schema.properties[key])
  assert(isProps, `fail ${schema.title}`)
}

const schemaMap = new Map()
const validate = (schema, instance) => {
  assert(schema, `No schema supplied`)
  let validator = schemaMap.get(schema)
  if (!validator) {
    validator = precompileSchema(schema)
  }
  const isValid = validator(instance)
  const errors = ajv.errorsText(validator.errors)
  if (!isValid) {
    throw new Error(`${schema.title} failed validation: ${errors}`)
  }
}
const precompileSchema = (schema) => {
  // this is not noticeably faster, but makes profiling cleaner
  // as it does inevitable compilation before the main runs
  assert(schema, `No schema supplied`)
  try {
    const validator = ajv.compile(schema)
    schemaMap.set(schema, validator)
    return validator
  } catch (e) {
    const msg = `Compilation failed: ${schema.title} ${e.message}`
    throw new Error(msg)
  }
}

export { modelInflator, precompileSchema }
