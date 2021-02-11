const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter.directConfig')
const {
  txReplyModel,
  rxReplyModel,
  rxRequestModel,
  addressModel,
  dmzModel,
  channelModel,
  reductionModel,
  pendingModel,
} = require('../../../w015-models')
const { networkProducer, pendingProducer } = require('../../../w016-producers')
const { definition } = require('../machines/direct')
const { assign } = require('xstate')

const config = {
  actions: {
    assignResolve: assign({
      reduceResolve: ({ dmz, anvil }, event) => {
        assert(dmzModel.isModel(dmz))
        const { reduceResolve } = event.data
        assert(reduceResolve)
        const { reduction, isPending, requests, replies } = reduceResolve
        debug(`assignResolve pending: %o`, isPending)
        return reductionModel.create(reduceResolve, anvil, dmz)
      },
    }),
    assignRejection: assign({
      reduceRejection: ({ anvil }, event) => {
        if (rxReplyModel.isModel(anvil)) {
          // TODO do something with replies that cause rejections
          // console.error(anvil)
          // console.error(event.data)
        }
        return event.data
      },
    }),
    respondRejection: assign({
      // one of lifes great challenges
      dmz: ({ dmz, anvil, reduceRejection }) => {
        assert(dmzModel.isModel(dmz))
        const network = networkProducer.respondRejection(
          dmz.network,
          anvil,
          reduceRejection
        )
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    assignDirectCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        assert(!dmz.pending.getAccumulator().length)
        return anvil
      },
    }),
    transmit: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        const { requests, replies } = reduceResolve
        debug('transmit req: %o rep %o', requests, replies)
        // TODO check if moving channels around inside dmz can affect tx ?
        // TODO deduplication before send, rather than relying on tx
        const network = networkProducer.tx(dmz.network, requests, replies)
        return dmzModel.clone({ ...dmz, network })
      },
      isExternalPromise: ({
        isExternalPromise,
        externalAction,
        reduceResolve,
      }) => {
        if (isExternalPromise) {
          return isExternalPromise
        }
        assert(reductionModel.isModel(reduceResolve))
        const { replies } = reduceResolve
        // TODO cleanup, since sometimes externalAction is an rxReply
        if (rxReplyModel.isModel(externalAction)) {
          debug(`transmit isExternalPromise`, false)
          return false
        }
        assert(rxRequestModel.isModel(externalAction))
        isExternalPromise = replies.some(
          (txReply) =>
            txReply.getReply().isPromise() &&
            txReply.request.sequence === externalAction.sequence
        )
        debug(`transmit isExternalPromise`, isExternalPromise)
        return isExternalPromise
      },
      isOriginPromise: ({ isOriginPromise, initialPending, reduceResolve }) => {
        if (isOriginPromise || !initialPending.getIsPending()) {
          debug(`transmit isOriginPromise`, isOriginPromise)
          return isOriginPromise
        }
        assert(pendingModel.isModel(initialPending))
        assert(reductionModel.isModel(reduceResolve))
        const { replies } = reduceResolve
        const { pendingRequest } = initialPending
        isOriginPromise = replies.some(
          (txReply) =>
            txReply.getReply().isPromise() &&
            txReply.request.sequence === pendingRequest.sequence
        )
        debug(`transmit isOriginPromise`, isOriginPromise)
        return isOriginPromise
      },
    }),
    warnReplyRejection: ({ reduceRejection }) => {
      // TODO reject all loopback actions and reject the external action
      debug(`warnReplyRejection`)
      console.warn(`Warning: rejection occured during reply`)
      console.warn(reduceRejection)
    },
    raisePending: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        debug(`raisePending`, anvil.type)
        const pending = pendingProducer.raisePending(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    assignInitialPending: assign({
      initialPending: ({ dmz }) => {
        // TODO this probably breaks other things in weird undiscovered ways
        // as it isn't supposed to change during execution
        // but this handles if a promise raises and lowers in a single interpreter cycle
        assert(dmzModel.isModel(dmz))
        assert(dmz.pending.getIsPending())
        debug(`assignInitialPending`)
        return dmz.pending
      },
    }),
    promiseOriginRequest: assign({
      dmz: ({ dmz, anvil, covenantAction }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(!covenantAction || anvil.equals(covenantAction))
        const { sequence } = anvil
        const promise = txReplyModel.create('@@PROMISE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [promise])
        debug(`promiseOriginRequest`, anvil.type)
        return dmzModel.clone({ ...dmz, network })
      },
      isExternalPromise: () => true,
    }),
    mergeState: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        debug(`mergeState`)
        return dmzModel.clone({ ...dmz, state: reduceResolve.reduction })
      },
    }),
    respondReply: assign({
      dmz: ({ dmz, address }) => {
        assert(dmzModel.isModel(dmz))
        const originalLoopback = dmz.network['.']
        assert(channelModel.isModel(originalLoopback))
        assert(addressModel.isModel(address))
        debug('respondReply')
        const network = networkProducer.respondReply(
          dmz.network,
          address,
          originalLoopback
        )
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    respondRequest: assign({
      dmz: ({ initialPending, externalAction, dmz, address, anvil }) => {
        debug('respondRequest')
        assert(pendingModel.isModel(initialPending))
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(anvil.getAddress().equals(address))
        const isFromBuffer = initialPending.getIsBuffered(anvil)
        const msg = `externalAction can only be responded to by auto resolvers`
        assert(!anvil.equals(externalAction) || isFromBuffer, msg)
        const network = networkProducer.respondRequest(dmz.network, anvil)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    shiftBufferedRequest: assign({
      dmz: ({ dmz, covenantAction }) => {
        debug(`shiftBufferedRequest`)
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(covenantAction))
        assert(dmz.pending.getIsBuffered(covenantAction))
        const { alias, event, channel } = dmz.pending.rxBufferedRequest(
          dmz.network
        )
        assert(dmz.network[alias].equals(channel))
        assert(event.equals(covenantAction))
        const index = covenantAction.getIndex()
        if (!channel.replies[index].isPromise()) {
          debugger
        }
        assert(channel.replies[index].isPromise())
        const network = networkProducer.removeBufferPromise(
          dmz.network,
          covenantAction
        )
        const pending = pendingProducer.shiftRequests(dmz.pending, dmz.network)
        return dmzModel.clone({ ...dmz, pending, network })
      },
    }),
  },
  guards: {
    isExternalAction: ({ externalAction, anvil, address }) => {
      // a non loopback external action will be responded to by autoresolvers
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      assert(addressModel.isModel(address))
      const isExternalAction = !address.isLoopback()
      assert(!isExternalAction || externalAction.equals(anvil))
      debug(`isExternalAction`, isExternalAction)
      return isExternalAction
    },
    isPending: ({ dmz }) => {
      const isPending = dmz.pending.getIsPending()
      debug(`isPending`, isPending)
      return isPending
    },
    isReductionPending: ({ reduceResolve }) => {
      assert(reductionModel.isModel(reduceResolve))
      const isReductionPending = reduceResolve.getIsPending()
      debug(`isReductionPending`, isReductionPending)
      return isReductionPending
    },
    isReply: ({ anvil }) => {
      const isReply = rxReplyModel.isModel(anvil)
      if (!isReply) {
        assert(rxRequestModel.isModel(anvil))
      }
      debug(`isReply: %o`, isReply)
      return isReply
    },
    isUnbuffered: ({ dmz, covenantAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(covenantAction))
      assert(dmzModel.isModel(dmz))
      const { pending } = dmz
      const isUnbuffered = !pending.getIsBuffered(covenantAction)
      debug(`isUnbuffered`, isUnbuffered)
      return isUnbuffered
    },
    isLoopbackResponseDone: ({ dmz, anvil, address }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      assert(anvil.getAddress().equals(address))
      assert(address.isLoopback())

      const isDone = !!dmz.network.getResponse(anvil)
      debug(`isLoopbackResponseDone: %o anvil: %o`, isDone, anvil.type)
      return isDone
    },
  },
  services: {
    reduceCovenant: async ({ dmz, covenantAction, isolatedTick }) => {
      // TODO test the actions are allowed actions using the ACL
      debug(`reduceCovenant: %o`, covenantAction.type)
      const isReply = rxReplyModel.isModel(covenantAction)
      const isRequest = rxRequestModel.isModel(covenantAction)
      assert(isReply || isRequest)

      const { state } = dmz
      const acc = dmz.pending.getAccumulator()
      const reduceResolve = await isolatedTick(state, covenantAction, acc)
      assert(reduceResolve, `Covenant returned: ${reduceResolve}`)
      debug(`reduceCovenant result pending: `, reduceResolve.isPending)
      return { reduceResolve }
    },
  },
}

const directConfig = (context) => {
  assert.strictEqual(typeof context, 'object')
  const machine = { ...definition, context }
  return { machine, config }
}

module.exports = { directConfig }
