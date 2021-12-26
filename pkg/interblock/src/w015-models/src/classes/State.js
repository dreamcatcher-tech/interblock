import assert from 'assert-fast'
import { produceWithPatches, freeze } from 'immer'
import equals from 'fast-deep-equal'
import * as crypto from '../../../w012-crypto'
import { Buffer } from 'buffer'
import { Base } from '../MapFactory'

const schema = {
  title: 'State',
  //   description: `The result of running a covenant is stored here.
  // It checks the state minus the actions is serializable
  // Includes the array of requests and replies returned from
  // reducing the covenant.  These actions are intended to be transmitted
  // via the network.  This model enforces the format and logic of the
  // returns from the reducer

  // This is how covenant info is ingested back into the trusted system.
  // It is crucial that the format of this data is correct

  // Entry point from covenant to system.

  // Maximally inflates actions with defaults.  Logical checking is done inside
  // the networkProducer as needs context of the initiating action to fill in
  // remaining defaults

  // The actions in from the covenant are refined over three states:
  // 1. create( state ) inflates actions to pass schema validation
  // 2. logicize( state ) checks static logic
  // 3. networkProducer.tx( state ) checks context logic

  // The returned model is forbidden to have an actions key on it.
  // The validation is run during clone, then logicize strips the actions out.

  // Create is only called immediately after a reducer call returns some state.
  // Therefore, we always know what the default action is, so we require it of create.
  // `,

  type: 'object',
  required: [],
}
const deepFreeze = true
freeze(schema, deepFreeze)
const insidersOnly = Symbol()

export const assertNoUndefined = (obj, path = '/') => {
  if (obj === undefined) {
    throw new Error(`undefined value at ${path}`)
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj)) {
      assertNoUndefined(obj[key], `${path}/${key}`)
    }
  }
}
export class State extends Base {
  static get schema() {
    return schema
  }
  static restore(backingArray) {
    assert(Array.isArray(backingArray))
    assert.strictEqual(backingArray.length, 1)
    assert.strictEqual(typeof backingArray[0], 'object')
    return State.create(backingArray[0])
  }
  static create(base) {
    return new State(insidersOnly, base)
  }
  #base = {}
  #next
  #diffFor = this.#next
  #lastDiff
  #lastMerge
  constructor(LOCKED_CONSTRUCTOR, base = {}) {
    if (LOCKED_CONSTRUCTOR !== insidersOnly) {
      throw new Error('Locked constructor - use State.create()')
    }
    super()
    assert.strictEqual(typeof base, 'object')
    freeze(base, deepFreeze)
    this.#base = base
    this.assertLogic()
  }
  assertLogic() {
    // TODO ensure no functions attempted to be stored ? or just blank them between blocks ?
    assert.strictEqual(typeof this.#base, 'object')
    assert(this.#base !== null)
    assertNoUndefined(this.#base)
  }
  equals(other) {
    if (!other || !(other instanceof State)) {
      return false
    }
    return equals(this.#base, other.#base)
  }
  merge() {
    this.diff()
    return new State(insidersOnly, this.getState())
  }
  update(updatedState) {
    const next = this.#clone()
    next.#next = updatedState
    freeze(next.#next, deepFreeze)
    return next
  }
  #clone() {
    const next = new State(insidersOnly, this.#base)
    next.#base = this.#base
    next.#next = this.#next
    next.#diffFor = this.#diffFor
    next.#lastDiff = this.#lastDiff
    next.#lastMerge = this.#lastMerge
    return next
  }
  size() {
    // estimate the size based on the total bytes of just the patches
    // apply the diff to a blank object to see the result
    // serialize it to get the size
    // given that all objects ultimately get serialized in diff or full,
    // size calculation should be low cost
  }
  diff() {
    if (!this.next) {
      return []
    }
    if (this.#diffFor === this.#next && this.#lastDiff) {
      return this.#lastDiff
    }
    const [nextState, patches] = produceWithPatches(this.#base, (draft) => {
      // TODO verify this will do structural sharing
      // if not, we will need to use the draft and detect differences ourselves
      return this.#next
    })
    this.#lastDiff = patches
    this.#lastMerge = nextState
    this.#diffFor = this.#next
    return patches
  }
  toArray() {
    return [this.getState()]
  }
  toJS() {
    // TODO ensure that merging has happened already
    return this.getState()
  }
  getState() {
    if (this.#next) {
      return this.#next
    }
    return this.#base
  }
  #assertIsClean() {
    assert.strictEqual(this.#next, undefined, 'State is dirty')
  }
  hashRaw() {
    this.#assertIsClean()
    const hash = crypto.objectHash(this.getState())
    // TODO check if this hashes correctly
    return Uint8Array.from(Buffer.from(hash, 'hex'))
  }
}
