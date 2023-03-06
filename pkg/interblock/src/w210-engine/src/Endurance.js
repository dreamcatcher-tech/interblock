import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import {
  decode,
  Address,
  Pulse,
  PulseLink,
  Channel,
} from '../../w008-ipld/index.mjs'
import { Logger } from './Logger'
import Debug from 'debug'
const debug = Debug('interblock:engine:Endurance')

export class Endurance {
  static create() {
    const instance = new Endurance()
    return instance
  }
  #isStarted = true
  #selfLatest
  #selfAddress
  #logger = new Logger()
  #blockCache = new Map()
  #importsCache = new Map()
  #pulseCache = new Map()
  #cacheSize = 0
  #lru = new Set() // TODO make an LRU that calculates block size
  #latests = new Map() // chainId : PulseLink
  get logger() {
    return this.#logger
  }
  get selfLatest() {
    return this.#selfLatest
  }
  get selfAddress() {
    return this.#selfAddress
  }
  _flushLatests() {
    this.#latests.clear()
  }
  hasLatest(address) {
    assert(address instanceof Address)
    if (address.equals(this.selfAddress)) {
      return true
    }
    return this.#latests.has(address.getChainId())
  }
  suggestLatest(address, latestLink) {
    assert(address instanceof Address)
    assert(latestLink instanceof PulseLink)
    const chainId = address.getChainId()
    if (!this.#latests.has(chainId)) {
      this.#latests.set(chainId, latestLink)
    }
  }
  async findLatest(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    this.assertStarted()
    if (address.equals(this.selfAddress)) {
      return this.selfLatest
    }
    const chainId = address.getChainId()
    if (!this.#latests.has(chainId)) {
      throw new Error(`latest not found for ${chainId}`)
    }
    const pulseLink = this.#latests.get(chainId)
    return await this.recover(pulseLink)
  }
  async endure(latest) {
    assert(latest instanceof Pulse)
    assert(latest.isVerified())
    this.assertStarted()

    if (!this.selfAddress) {
      // the first thing saved must be the node identity
      assert(!this.selfLatest)
      assert(!this.#latests.size)
      this.#selfAddress = latest.getAddress()
    }
    const chainId = latest.getAddress().getChainId()
    const latestLink = this.#latests.get(chainId)
    if (latestLink) {
      const current = await this.recover(latestLink)
      assert(current.isNext(latest))
      // TODO implement some cache ejection
    }
    this.#latests.set(chainId, latest.getPulseLink())

    if (this.selfAddress.equals(latest.getAddress())) {
      this.#selfLatest = latest
    }
    this.cachePulse(latest)
    this.#cacheBlocks(latest)

    await this.#logger.pulse(latest)
    debug(`endure`, latest.getAddress(), latest.getPulseLink())
  }
  cachePulse(pulse) {
    assert(pulse instanceof Pulse)
    const key = pulse.cid.toString()
    if (this.#pulseCache.has(key)) {
      // TODO update the LRU tracker
      return
    }
    this.#pulseCache.set(key, pulse)
    this.#cacheBlocks(pulse)
  }
  cacheBlock(block) {
    assert(CID.asCID(block.cid))
    assert.strictEqual(typeof block.value, 'object')
    const key = block.cid.toString()
    this.#blockCache.set(key, block)
  }
  #cacheBlocks(pulse) {
    const diffs = pulse.getDiffBlocks()
    for (const [, block] of diffs) {
      this.cacheBlock(block)
    }
  }
  async recover(pulselink) {
    assert(pulselink instanceof PulseLink)
    this.assertStarted()
    debug(`recover`, pulselink)
    const { cid } = pulselink
    const cidString = cid.toString()

    if (this.#pulseCache.has(cidString)) {
      // TODO update the LRU tracker
      return this.#pulseCache.get(cidString)
    }
    if (this.#blockCache.has(cidString) || this.#importsCache.has(cidString)) {
      const resolver = this.getResolver(cid)
      const pulse = await Pulse.uncrush(cid, resolver)
      assert(pulse, `pulse not found but root block is in cache`)
      this.cachePulse(pulse)
      return pulse
    }
  }
  getResolver(treetop) {
    assert(CID.asCID(treetop))
    // TODO WARNING permissions must be honoured
    // use treetop to only fetch things below this CID
    // TODO block historical pulselinks
    return async (cid) => {
      assert(CID.asCID(cid), `not cid: ${cid}`)
      this.assertStarted()

      const key = cid.toString()
      if (this.#importsCache.has(key)) {
        const bytes = this.#importsCache.get(key)
        const block = await decode(bytes)
        this.cacheBlock(block)
      }
      if (this.#blockCache.has(key)) {
        return this.#blockCache.get(key)
      }
    }
  }
  async import(blockIterable) {
    let count = 0
    for await (const { cid, bytes } of blockIterable) {
      this.#importsCache.set(cid.toString(), bytes)
      count++
    }
    return count
  }
  assertStarted() {
    if (!this.#isStarted) {
      throw new Error('Endurance is stopped')
    }
  }
  stop() {
    this.#isStarted = false
  }
  async isLocal(toChannel, fromPulse) {
    assert(toChannel instanceof Channel)
    assert(fromPulse instanceof Pulse)

    const { tip } = toChannel.rx
    if (tip) {
      // TODO recover just the validators
      const evilFullPulse = await this.recover(tip)
      const { validators } = evilFullPulse.provenance
      if (fromPulse.provenance.validators.hasOverlap(validators)) {
        return true
      }
      return false
    }
    const [alias] = toChannel.aliases
    if (isMtab(fromPulse)) {
      // TODO move to using aliases sychronously
      const isHardlink = await fromPulse.getNetwork().hardlinks.has(alias)
      if (isHardlink) {
        return false
      }
    }
    // else if the channel alias goes thru mtab, then is remote
    // TODO safer to work off the full supervisor path using whoami()
    if (alias && alias.startsWith('.mtab/')) {
      return false
    }
    return true
  }
}
const isMtab = (pulse) => {
  assert(pulse instanceof Pulse)
  return pulse.getCovenantPath() === '/system:/net'
}
