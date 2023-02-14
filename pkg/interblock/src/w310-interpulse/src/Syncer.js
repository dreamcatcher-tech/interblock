import assert from 'assert-fast'
import posix from 'path-browserify'
import Debug from 'debug'
import {
  Dmz,
  Hamt,
  IpldInterface,
  Pulse,
  PulseLink,
  HistoricalPulseLink,
} from '../../w008-ipld'
import { Crisp } from '..'
import Immutable from 'immutable'
import { pushable } from 'it-pushable'

const debug = Debug('interblock:api:Syncer')

export class Syncer {
  #pulseResolver
  #covenantResolver
  #actions
  #chroot
  #pulse
  #next
  #subscribers = new Set()

  static create(pulseResolver, covenantResolver, actions, chroot = '/') {
    assert.strictEqual(typeof pulseResolver, 'function')
    assert.strictEqual(typeof covenantResolver, 'function')
    assert.strictEqual(typeof actions, 'object')
    assert.strictEqual(typeof actions.dispatch, 'function')
    assert(posix.isAbsolute(chroot), `chroot must be absolute path: ${chroot}`)

    const syncer = new Syncer()
    syncer.#pulseResolver = pulseResolver
    syncer.#covenantResolver = covenantResolver
    syncer.#actions = actions
    syncer.#chroot = chroot || '/'
    return syncer
  }
  async update(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.cid.equals(this.#pulse?.cid))
    assert(!pulse.cid.equals(this.#next?.cid))
    // TODO assert lineage matches
    await this.#bake(pulse)
    this.#updateLatest(pulse)
    // TODO handle race conditions if called quickly
  }
  #updateLatest(latestRootPulse) {
    assert(latestRootPulse instanceof Pulse)
    assert(!latestRootPulse.cid.equals(this.#pulse?.cid))
    this.#pulse = latestRootPulse
    for (const source of this.#subscribers) {
      source.push(this.#pulse)
    }
  }

  /**
   * Will mutate instance and all children of instance
   * by expanding any PulseLinks to Pulses, and any Hamts to Maps.
   * @param {IpldInterface | [IpldInterface]} instance
   */
  async #bake(instance, prior) {
    if (Array.isArray(instance)) {
      assert(!prior || Array.isArray(prior))
      return await Promise.all(
        instance.map((v, i) => this.#bake(v, prior?.[i]))
      )
    }
    if (!(instance instanceof IpldInterface)) {
      return
    }
    assert(!prior || prior instanceof IpldInterface)
    if (instance instanceof HistoricalPulseLink) {
      return
    }
    if (instance instanceof PulseLink) {
      if (instance.bakedPulse) {
        return
      }
      const pulse = await this.#pulseResolver(instance)
      instance.bake(pulse)
      return await this.#bake(instance.bakedPulse, prior?.bakedPulse)
    }
    if (instance instanceof Hamt) {
      return await this.#updateHamt(instance, prior)
    }
    if (instance instanceof Dmz) {
      await this.#updateCovenant(instance, prior)
    }
    const { classMap = {}, defaultClass } = instance.constructor
    assert(!(Object.keys(classMap).length && defaultClass))
    await Promise.all(
      Object.keys(classMap).map(async (key) => {
        const value = instance[key]
        await this.#bake(value, prior?.[key])
      })
    )
    if (defaultClass) {
      const values = []
      const priorValues = []
      for (const [key, value] of Object.entries(instance)) {
        values.push(value)
        priorValues.push(prior?.[key])
      }
      await this.#bake(values, priorValues)
    }
  }
  async #updateCovenant(dmz, prior) {
    // TODO allow slow resolution to not block the rest of the bake
    // TODO is there a point to bake the covenant pulse too ?
    assert(dmz instanceof Dmz)
    assert(!prior || prior instanceof Dmz)
    if (dmz.bakedCovenant) {
      return
    }
    const path = dmz.getCovenantPath()
    const priorPath = prior?.getCovenantPath()

    if (path === priorPath) {
      dmz.bake(prior.bakedCovenant)
      return
    }
    const covenantPulse = await this.#covenantResolver(path)
    dmz.bake(covenantPulse)
  }
  async #updateHamt(hamt, prior) {
    assert(hamt instanceof Hamt)
    assert(!prior || prior instanceof Hamt)
    if (hamt.bakedMap || hamt.isBakeSkippable) {
      return
    }
    const diff = await hamt.compare(prior)
    const { added, deleted, modified } = diff
    let map = prior?.bakedMap ?? Immutable.Map()
    assert(map instanceof Immutable.Map)
    for (const key of deleted) {
      map = map.delete(key)
    }
    const mods = [...modified].map(async (key) => {
      const value = await hamt.get(key)
      map = map.set(key, value)
      let priorValue
      if (prior) {
        if (prior.bakedMap.has(key)) {
          priorValue = prior.bakedMap.get(key)
        } else {
          priorValue = await prior.get(key)
        }
      }
      await this.#bake(value, priorValue)
    })
    const adds = [...added].map(async (key) => {
      const value = await hamt.get(key)
      map = map.set(key, value)
      await this.#bake(value)
    })
    await Promise.all([...mods, ...adds])
    hamt.bake(map)
  }

  async *subscribe() {
    const source = pushable({ objectMode: true })
    this.#subscribers.add(source)
    if (this.#pulse) {
      source.push(this.#pulse)
    }
    try {
      for await (const pulse of source) {
        const crisp = Crisp.createRoot(pulse, this.#actions, this.#chroot)
        yield crisp
      }
    } finally {
      source.return()
      this.#subscribers.delete(source)
    }
  }
}