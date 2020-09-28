import { assert } from 'chai/index.mjs'
import { openChildReducer, openChildReply, openPaths } from './openChild'
import { uplinkReducer, uplinkReply } from './uplink'
import { connect, connectReducer } from './connect'
import { ping, pingReducer } from './ping'
import { spawn, spawnReducer } from './spawn'
import { install, deploy, deployReducer, deployReply } from './deploy'
import { getChannel, getChannelReducer } from './getChannel'
import { genesisReducer, genesisReply } from './genesis'
import { getStateReducer, getState } from './getState'
import { dmzModel, rxRequestModel, rxReplyModel } from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:dmz')
/**
 * DmzReducer is responsible for:
 *  1. altering the structure of the DMZ
 *  2. checking the ACL for all actions coming in
 *
 * It is modelled the same as a covenant reducer so that:
 *  1. the interpreter logic is the same for covenants and system
 *  2. users interact with the dmz logic the same was as with other chains
 *  3. foreign chains can control the dmz logic easily
 *
 * These are all the commands that are possible to invoke remotely.
 * Whilst transmissions could be entered directly into the dmz in this
 * reducer, using the api methods for sending allows greater debug ability.
 *
 * @param {*} dmz
 * @param {*} action
 */

const actions = {
  connect,
  ping,
  spawn,
  install,
  deploy,
  getChannel,
  getState,
}

const reducer = async (dmz, action) => {
  // TODO check the ACL each time ?
  debug(`reducer( ${action.type} )`)
  assert(dmzModel.isModel(dmz))
  assert(rxReplyModel.isModel(action) || rxRequestModel.isModel(action))
  let { network } = dmz

  switch (action.type) {
    case '@@PING':
      pingReducer(action)
      break
    case '@@SPAWN':
      network = await spawnReducer(dmz, action)
      break
    case '@@CONNECT':
      network = connectReducer(network, action)
      break
    case '@@UPLINK':
      network = uplinkReducer(network, action)
      break
    case '@@GENESIS':
      genesisReducer(network, action)
      break
    case '@@OPEN_CHILD':
      openChildReducer(network, action)
      break
    case '@@INTRO':
      break
    case '@@ACCEPT':
      // just default responding is enough to trigger lineage catchup
      break
    case '@@INSTALL': // allows user to connect with recursive deployment calls
    case '@@DEPLOY':
      network = await deployReducer(dmz, action)
      break
    case '@@GET_CHAN':
      getChannelReducer(network, action)
      break
    case '@@CAT':
      getStateReducer(dmz)
      break
    case '@@RESOLVE':
    case '@@REJECT':
      switch (action.getRequest().type) {
        case '@@GENESIS':
          genesisReply(action)
          break
        case '@@UPLINK':
          uplinkReply(network, action)
          break
        case '@@OPEN_CHILD':
          network = openChildReply(network, action)
          break
        case '@@DEPLOY':
          deployReply(network, action)
          break
      }
      break
    default:
      throw new Error(`Unrecognized type: ${action.type}`)
  }

  return { ...dmz, network }
}

const rm = (id) => {
  // id either alias or address
  // if we are parent, kill the tree
}
const mv = () => {
  // tricky, as needs to handover with ability to rollback
}

const systemTypes = [
  '@@PING',
  '@@SPAWN',
  '@@GENESIS',
  '@@CONNECT',
  '@@UPLINK',
  '@@INTRO',
  '@@ACCEPT',
  '@@OPEN_CHILD',
  '@@GET_GIVEN_NAME', // TODO may delete ?
  '@@DEPLOY',
  '@@INSTALL',
  '@@GET_CHAN', // TODO may delete ?
  '@@CAT',
]
const isSystemRequest = (request) => {
  if (!rxRequestModel.isModel(request)) {
    return false
  }
  const isSystemAction = systemTypes.includes(request.type)
  debug(`isSystemAction: ${isSystemAction} type: ${request.type}`)
  return isSystemAction
}

const systemReplyTypes = [
  '@@INIT',
  '@@GENESIS',
  '@@UPLINK',
  '@@OPEN_CHILD',
  '@@DEPLOY',
]
const isSystemReply = (reply) => {
  if (!rxReplyModel.isModel(reply)) {
    return false
  }
  const request = reply.getRequest()
  const isSystemReply = systemReplyTypes.includes(request.type)
  debug(`isSystemReply: ${isSystemReply} type: ${request.type}`)
  return isSystemReply
}

export { actions, reducer, isSystemRequest, isSystemReply, openPaths }