const fromFunctions = (consistencySource) => async (action) => {
  switch (action.type) {
    case 'PUT_SOCKET':
      return consistencySource.putSocket(action.payload)
    case 'GET_SOCKETS':
      return consistencySource.getSockets(action.payload)
    case 'DEL_SOCKET':
      return consistencySource.delSocket(action.payload)
    case 'POOL':
      return consistencySource.putPoolInterblock(action.payload)
    case 'LOCK':
      return consistencySource.putLockChain(action.payload)
    case 'UNLOCK':
      return consistencySource.putUnlockChain(action.payload)
    case 'LOCKINIT':
      return consistencySource.putLockSystemInit()
    case 'UNLOCKINIT':
      return consistencySource.putUnlockSystemInit(action.payload)
    case 'IS_PRESENT':
      return consistencySource.getIsPresent(action.payload)
    case 'GET_BLOCK':
      return consistencySource.getBlock(action.payload)
    case 'GET_BLOCKS':
      return consistencySource.getBlocks(action.payload)
    case 'BASE_ADDRESS':
      return consistencySource.getBaseAddress()
    case 'PIERCE_REQ':
      return consistencySource.putPierceRequest(action.payload)
    case 'PIERCE_REP':
      return consistencySource.putPierceReply(action.payload)
    default:
      throw new Error(`Unknown action type: ${action && action.type}`)
  }
}

const toFunctions = (queue) => ({
  putSocket: (payload) => queue.push({ type: 'PUT_SOCKET', payload }),
  getSockets: (payload) => queue.push({ type: 'GET_SOCKETS', payload }),
  delSocket: (payload) => queue.push({ type: 'DEL_SOCKET', payload }),
  putPoolInterblock: (payload) => queue.push({ type: 'POOL', payload }),
  putLockChain: (payload) => queue.push({ type: 'LOCK', payload }),
  putUnlockChain: (payload) => queue.push({ type: 'UNLOCK', payload }),
  putLockSystemInit: () => queue.push({ type: 'LOCKINIT', payload: {} }),
  putUnlockSystemInit: (payload) => queue.push({ type: 'UNLOCKINIT', payload }),
  getIsPresent: (payload) => queue.push({ type: 'IS_PRESENT', payload }),
  getBlock: (payload) => queue.push({ type: 'GET_BLOCK', payload }),
  getBlocks: (payload) => queue.push({ type: 'GET_BLOCKS', payload }),
  getBaseAddress: () => queue.push({ type: 'BASE_ADDRESS', payload: {} }),
  putPierceRequest: (payload) => queue.push({ type: 'PIERCE_REQ', payload }),
  putPierceReply: (payload) => queue.push({ type: 'PIERCE_REP', payload }),
})

export { toFunctions, fromFunctions }