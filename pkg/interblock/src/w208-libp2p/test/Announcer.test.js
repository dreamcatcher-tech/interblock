import { createLibp2p } from 'libp2p'
import { TCP } from '@libp2p/tcp'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { pipe } from 'it-pipe'
import { pushable } from 'it-pushable'
import { Announcer } from '..'

import Debug from 'debug'
import { Address, PulseLink } from '../../w008-ipld'
import assert from 'assert-fast'
const debug = Debug('test')

Debug.enable('*test* *Announcer *Connection')

const createNode = async () => {
  const node = await createLibp2p({
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/0'],
    },
    transports: [new TCP()],
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
  })
  await node.start()
  return node
}

describe('protocol', () => {
  const address = Address.createCI('test pulselink address')
  const pulselink = PulseLink.createCrossover(address)

  test.only('direct', async () => {
    const [node1, node2] = await Promise.all([createNode(), createNode()])
    debug(`nodes created`)
    debug(`node1`, node1.peerId.toString())
    debug(`node2`, node2.peerId.toString())

    const announcer1 = Announcer.create(node1)
    const announcer2 = Announcer.create(node2)
    const address = Address.createCI('test address')
    debug(address)

    announcer2.announce(address, pulselink)
    const self = announcer2.subscribe(address)
    for await (const announcement of self) {
      assert.strictEqual(announcement, pulselink)
      debug('self announce')
      break
    }

    announcer1.addAddressPeer(address, node2.peerId)
    const stream = announcer1.subscribe(address)
    await node1.peerStore.addressBook.set(node2.peerId, node2.getMultiaddrs())
    debug(`nodes connected`)
    for await (const announcement of stream) {
      assert(pulselink.equals(announcement))
      return
    }

    // store the streams by nodeid so we can look them up for active announces
  }, 2000)
  test('libp2p', async () => {
    // start a libp2p node
    // add the handler for the protocol
    const [node1, node2] = await Promise.all([createNode(), createNode()])
    debug(`nodes created`)
    // node1 connect to node2
    await node1.peerStore.addressBook.set(node2.peerId, node2.getMultiaddrs())
    await node1.dial(node2.peerId)
    debug(`nodes dialed`)

    let resolve
    const received = new Promise((_resolve) => {
      resolve = _resolve
    })
    let hs
    const n1 = await node1.handle('meow', async ({ connection, stream }) => {
      // store the streams by nodeid so we can look them up for active announces
      debug('connection', connection)
      debug('handle', stream)
      hs = stream
      //   for await (const m of stream.source) {
      //     debug('received:', m)
      //   }
      pipe(stream, async function (source) {
        for await (const msg of source) {
          debug(from(msg))
          resolve()
        }
      })
    })
    const stream = await node2.dialProtocol(node1.peerId, ['meow'])
    debug('stream', stream)

    const source = pushable({ objectMode: false })
    const request = { forAddress: 'meow' }
    source.push(to(request))
    pipe(source, stream)
    // await delay(2000)
    await received
  }, 5000)
})

const to = (js) => {
  return fromString(JSON.stringify(js), 'utf8')
}
const from = (arraylist) => {
  return JSON.parse(toString(arraylist.subarray(), 'utf8'))
}
