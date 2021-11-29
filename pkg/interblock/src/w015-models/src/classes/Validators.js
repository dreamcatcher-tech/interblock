import { validatorsSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
import { Keypair, PublicKey } from '.'
import assert from 'assert-fast'

export class Validators extends mixin(validatorsSchema) {
  static create(validators = {}) {
    // TODO pass flattree options to MerkleArray
    assert.strictEqual(typeof validators, 'object')
    assert(Object.values(validators).every((key) => key instanceof PublicKey))
    if (!Object.keys(validators).length) {
      const ciKeypair = Keypair.create()
      validators = ciKeypair.getValidatorEntry()
    }
    return super.create(validators)
  }
  assertLogic() {
    const keyset = new Set()
    let algorithm
    for (const [key, value] of this.entries()) {
      assert(value instanceof PublicKey)
      if (keyset.has(value.key)) {
        throw new Error(`duplicate key ${key} ${value.key}`)
      }
      keyset.add(value.key)
      if (!algorithm) {
        algorithm = value.algorithm
      }
      assert.strictEqual(value.algorithm, algorithm)
    }
  }
}