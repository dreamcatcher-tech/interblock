import assert from 'assert-fast'
import { pure } from '../../../w001-xstate-direct'
import { RxReply, RxRequest, Address, Dmz } from '../../../w015-models'
import { networkProducer, channelProducer } from '../../../w016-producers'
import * as dmzReducer from '../../../w017-dmz-producer'
import { interpreterMachine } from '../machines'
import { directConfig } from './directConfig'
import { pendingConfig } from './pendingConfig'
import { autoResolvesConfig } from './autoResolvesConfig'
import { dmzConfig } from './dmzConfig'
import { assign } from 'xstate'
import Debug from 'debug'
const debug = Debug('interblock:cfg:interpreter')

const config = {
  actions: {
    assignExternalAction: assign({
      externalAction: (context, event) => {
        const { rxAction } = event.payload
        return rxAction
      },
    }),
    assignDmz: assign({
      dmz: (context, event) => {
        const { dmz } = event.payload
        assert(dmz instanceof Dmz)
        return dmz
      },
      initialDmz: ({ dmz }, event) => {
        // TODO replace initial pending with initialDmz
        assert.strictEqual(dmz, event.payload.dmz)
        assert(dmz instanceof Dmz)
        return dmz
      },
      initialPending: ({ dmz }, event) => {
        assert.strictEqual(dmz, event.payload.dmz)
        assert(dmz instanceof Dmz)
        return dmz.pending
      },
    }),
    assignAnvil: assign({
      anvil: (context, event) => {
        const { rxAction } = event.payload
        const anvil = rxAction
        assert(anvil instanceof RxRequest || anvil instanceof RxReply)
        return anvil
      },
    }),
    shiftLoopback: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        const loopback = channelProducer.shiftLoopback(dmz.network.get('.'))
        debug(`shiftLoopback`)
        const network = dmz.network.set('.', loopback)
        return dmz.update({ network })
      },
    }),
    loadSelfAnvil: assign({
      anvil: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        const loopback = dmz.network.get('.')
        const anvil = loopback.rxLoopback()
        debug(`loadSelfAnvil anvil: %o`, anvil.type, anvil.identifier)
        return anvil
      },
    }),
    openPaths: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        debug(`openPaths`)
        dmz = dmzReducer.openPaths(dmz)
        assert(dmz instanceof Dmz)
        return dmz
      },
    }),
    invalidateLocalPaths: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        debug('invalidateLocalPaths')
        const network = networkProducer.invalidateLocal(dmz.network)
        return dmz.update({ network })
      },
    }),
    removeEmptyInvalidChannels: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        const network = networkProducer.reaper(dmz.network)
        const startCount = Object.keys(dmz.network).length
        const endCount = Object.keys(network).length
        debug(`removeEmptyInvalidChannels removed: ${startCount - endCount}`)
        return dmz.update({ network })
      },
    }),
    assertLoopbackEmpty: ({ dmz }) => {
      // TODO move to being a test, not a live assertion
      debug(`assertLoopbackEmpty`)
      const loopback = dmz.network.get('.')
      assert(loopback.isLoopbackExhausted())
    },
    assignDirectMachine: assign((context, event) => {
      assert(!event.data.then)
      const nextContext = { ...context, ...event.data }
      debug(`assignDirectMachine`)
      return nextContext
    }),
  },
  guards: {
    isSystem: ({ dmz, anvil }) => {
      assert(dmz instanceof Dmz)
      assert(anvil instanceof RxRequest || anvil instanceof RxReply)
      const isSystem =
        dmzReducer.isSystemReply(dmz, anvil) ||
        dmzReducer.isSystemRequest(anvil)
      debug(`isSystem: ${isSystem}`)
      return isSystem
    },
    isLoopbackShiftable: ({ dmz, anvil }) => {
      assert(dmz instanceof Dmz)
      assert(anvil instanceof RxRequest || anvil instanceof RxReply)
      const isFromLoopback = anvil.getAddress().isLoopback()
      const isReply = anvil instanceof RxReply
      const isPromised = dmz.network.get('.').isLoopbackReplyPromised()
      const isLoopbackShiftable = isFromLoopback && (isReply || isPromised)
      debug(`isLoopbackShiftable`, isLoopbackShiftable)
      return isLoopbackShiftable
    },
    isSelfExhausted: ({ dmz }) => {
      assert(dmz instanceof Dmz)
      const loopback = dmz.network.get('.')
      const isSelfExhausted = loopback.isLoopbackExhausted()
      debug(`isSelfExhausted: ${isSelfExhausted}`)
      return isSelfExhausted
    },
    isPending: ({ dmz }) => {
      const isPending = dmz.pending.getIsPending()
      debug(`isPending`, isPending)
      return isPending
    },
  },
  // TODO move to synchronous where possible, for speed ?
  services: {
    // TODO split out exactly what pieces of context are used in each machine
    direct: async (context) => {
      debug(`direct machine`)
      // const { covenantAction, dmz, anvil,reduceRejection,reduceResolve }
      const { machine, config } = directConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
    pending: async (context) => {
      debug(`pending machine`)
      // const {covenantAction, dmz, anvil, reduceResolve, reduceRejection}
      const { machine, config } = pendingConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
    autoResolves: async (context) => {
      debug(`autoResolves machine`)
      // TODO move this synchronous machine to an action
      // const {dmz, initialPending, isExternalPromise, externalAction}
      const { machine, config } = autoResolvesConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
    dmz: async (context) => {
      debug(`dmz machine`)
      // TODO move to sync action since no async anywhere ?
      // const { dmz, reduceResolve, anvil}
      const { machine, config } = dmzConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
  },
}

const interpreterConfig = (isolatedTick) => {
  assert.strictEqual(typeof isolatedTick, 'function')
  // TODO multiplex the function with a code, so can use the same machine repeatedly
  const machine = { ...interpreterMachine, context: { isolatedTick } }
  return { machine, config }
}

export { interpreterConfig }