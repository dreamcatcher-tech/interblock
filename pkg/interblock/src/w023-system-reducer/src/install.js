import assert from 'assert-fast'
import { Request } from '../../w008-ipld'
import { useState, interchain, usePulse } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:install')

export const installReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')
  assert.strictEqual(Object.keys(payload).length, 1)
  assert.strictEqual(typeof payload.installer, 'object')
  debug(`payload`, payload)
  const covenant = await interchain('@@COVENANT')
  debug(`covenantState`, covenant)
  let { installer } = covenant
  installer = { ...installer, ...payload.installer }
  const { network = {}, state = {} } = installer
  assert.strictEqual(typeof network, 'object')
  assert.strictEqual(typeof state, 'object')
  if (!payload.installer.state && isState(covenant)) {
    const [currentState, setState] = await useState()
    assert.strictEqual(Object.keys(currentState).length, 0)
    await setState(state)
  }

  // TODO clean up failed partial deployments ?
  // TODO accomodate existing children already ? or throw ?

  const awaits = []
  for (const child in network) {
    debug('installing child: ', child)
    const installer = network[child]
    debug('installing child options: ', installer)
    const spawn = Request.createSpawn(child, installer)
    awaits.push(interchain(spawn))
  }
  const results = await Promise.all(awaits)
}
const isState = (installer) => {
  const { state = {} } = installer
  return Object.keys(state).length !== 0
}