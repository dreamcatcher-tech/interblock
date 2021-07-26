const assert = require('assert')
const {
  networkModel,
  addressModel,
  channelModel,
} = require('../../w015-models')
const { channelProducer } = require('../../w016-producers')

const connect = (alias, chainId) => ({
  type: '@@CONNECT',
  payload: { alias, chainId },
})
const connectReducer = (network, action) => {
  assert(networkModel.isModel(network))
  const address = addressModel.create(action.payload.chainId)
  assert(address.isResolved())
  assert.strictEqual(address.getChainId(), action.payload.chainId)
  const { alias } = action.payload
  assert(alias && typeof alias === 'string')
  let channel = network[alias] || channelModel.create(address)
  // TODO blank the queues if changing address for existing alias ?
  // TODO beware unresolving an already resolved address
  channel = channelProducer.setAddress(channel, address)
  return networkModel.clone({ ...network, [alias]: channel })
}
module.exports = { connect, connectReducer }