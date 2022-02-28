import assert from 'assert-fast'
import {
  Accumulation,
  Block,
  Channel,
  Dmz,
  PublicKey,
  TxReply,
  TxRequest,
} from '../../w015-models'
import { channelProducer } from '..'

const generatePierceDmz = (targetBlock, pierceReplies, pierceRequests) => {
  assert(targetBlock instanceof Block)
  assert(Array.isArray(pierceReplies))
  assert(Array.isArray(pierceRequests))
  assert(pierceReplies.every((v) => v instanceof TxReply))
  assert(pierceRequests.every((v) => v instanceof TxRequest))
  if (targetBlock.network.has('.@@io')) {
    assert(targetBlock.network.get('.@@io').address.isResolved())
  }

  const pierceDmz = _extractPierceDmz(targetBlock)
  let txChannel = pierceDmz.network.get('@@PIERCE_TARGET')
  assert(txChannel.address.deepEquals(targetBlock.provenance.getAddress()))
  assert.strictEqual(txChannel.systemRole, 'PIERCE')

  for (const txReply of pierceReplies) {
    assert(txReply.getAddress().deepEquals(txChannel.address))
    txChannel = channelProducer.txReply(txChannel, txReply)
  }
  for (const txRequest of pierceRequests) {
    const request = txRequest.getRequest()
    txChannel = channelProducer.txRequest(txChannel, request)
  }

  const network = pierceDmz.network.update({ '@@PIERCE_TARGET': txChannel })
  return pierceDmz.update({ network })
}

const _extractPierceDmz = (block) => {
  const algorithm = '@@pierce'
  const key = '@@PIERCE_PUBLIC_KEY'
  const publicKey = PublicKey.create({ key, algorithm })
  const baseDmz = Dmz.create({ validators: { ['@@PIERCE']: publicKey } })
  const address = block.provenance.getAddress()
  let pierceChannel = Channel.create(address, 'PIERCE')
  if (block.network.has('.@@io')) {
    const { tip } = block.network.get('.@@io')
    if (tip) {
      pierceChannel = pierceChannel.update({ precedent: tip })
    }
  }
  const network = baseDmz.network.update({ '@@PIERCE_TARGET': pierceChannel })
  return baseDmz.update({ network })
}

const accumulate = (dmz, txReplies = [], txRequests = []) => {
  assert(dmz instanceof Dmz)
  assert(dmz.pending.getIsPending())
  assert(Array.isArray(txReplies))
  assert(txReplies.every((v) => v instanceof TxReply))
  assert(Array.isArray(txRequests))
  assert(txRequests.every((v) => v instanceof TxRequest))

  // first, extend if there are transmissions
  let { accumulator = [] } = dmz.pending
  accumulator = [...accumulator]
  for (const txReply of txReplies) {
    const { type, identifier } = txReply
    accumulator.push(Accumulation.create({ type, identifier }))
  }
  for (const txRequest of txRequests) {
    const { type, to } = txRequest
    accumulator.push(Accumulation.create({ type, to }))
  }

  // then resolve the accumulator as best we can
  const requestsMap = _mapUnIdentifiedRequests(accumulator)
  accumulator = accumulator.map((tx) => {
    assert(tx instanceof Accumulation)
    if (tx.to && !tx.identifier) {
      let channel = dmz.network.get(tx.to)
      if (dmz.network.get('..').address.isRoot()) {
        // TODO find how to reconcile with networkProducer.tx()
        if (tx.to === '/') {
          channel = dmz.network.get('.')
        } else if (tx.to.startsWith('/')) {
          channel = dmz.network.get(tx.to.slice(1))
        }
      }
      if (channel) {
        const { address } = channel
        if (address.isResolved() || address.isLoopback()) {
          const requests = requestsMap.get(tx.to)
          const chainId = address.getChainId()
          const height = dmz.getCurrentHeight()
          const index = channel.requests.length - requests.length
          assert(index >= 0)
          requests.shift()
          const identifier = `${chainId}_${height}_${index}`
          tx = tx.update({ identifier })
        }
      }
    }
    return tx
  })
  const pending = dmz.pending.update({ accumulator })
  return dmz.update({ pending })
}

const _mapUnIdentifiedRequests = (accumulator) => {
  const toMap = new Map()
  for (const tx of accumulator) {
    if (tx.to && !tx.identifier) {
      const { to } = tx
      if (!toMap.has(to)) {
        toMap.set(to, [])
      }
      const txRequests = toMap.get(to)
      txRequests.push(tx)
    }
  }
  return toMap
}

export { generatePierceDmz, accumulate }