import { assert } from 'chai/index.mjs'
import { standardize } from '../modelUtils'
import { splitSequence } from './splitSequence'
import { actionModel } from '../models/actionModel'
import { addressModel } from '../models/addressModel'
import { rxRequestSchema } from '../schemas/transientSchemas'

const rxRequestModel = standardize({
  schema: rxRequestSchema,
  create(type, payload, address, index) {
    assert(Number.isInteger(index))
    assert(addressModel.isModel(address))
    assert(!address.isUnknown())
    const sequence = `${address.getChainId()}_${index}`
    const rxRequest = { type, payload, sequence }
    return rxRequestModel.clone(rxRequest)
  },
  logicize(instance) {
    const { type, payload, sequence } = instance
    const { address, index } = splitSequence(sequence)
    assert(!address.isUnknown())
    assert(Number.isInteger(index))
    assert(index >= 0)

    const request = actionModel.create({ type, payload })

    const getAddress = () => address
    const getIndex = () => index
    const getRequest = () => request
    const isReply = () => false

    return { getAddress, getIndex, getRequest, isReply }
  },
})

export { rxRequestModel }