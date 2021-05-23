const assert = require('assert')
const posix = require('path')
const { blockModel } = require('../../../w015-models')
const debug = require('debug')('interblock:query')
const { toFunctions } = require('./consistencyFactory')
const queryFactory = (ioConsistency, block) => {
  assert(blockModel.isModel(block))
  let isQueryEnabled = true
  const consistency = toFunctions(ioConsistency)
  const query = (query) => {
    // TODO turn into a queryModel object
    debug(`query: `, query)
    if (!isQueryEnabled) {
      throw new Error(`query attempted after execution: ${query.type}`)
    }
    const { type, payload } = query
    switch (type) {
      case '@@USE_BLOCKS':
        const { path, height, count } = payload
        return useBlocks(path, height, count)
      default:
        throw new Error(`Unknown query: ${type}`)
    }
  }
  const disable = () => (isQueryEnabled = false)
  const useBlocks = async (path, height, count) => {
    // TODO discover the absolute path from partial path
    // TODO implement height and count parameters
    assert.strictEqual(typeof path, 'string')
    assert(Number.isInteger(height))
    assert(height >= -1)
    assert(Number.isInteger(count))
    assert(count > 0)
    path = posix.normalize(path)
    if (path === '.') {
      return block // TODO honour height and count params
    }
    // TODO allow fetching '.' and '..' items directly
    // may walk to root, then use this as absolute
    assert(posix.isAbsolute(path))

    debug(`@@USE_BLOCKS`, path, height, count)
    let parentBlock = block
    while (!parentBlock.network.getParent().address.isRoot()) {
      debug(`loop`)
      const channel = parentBlock.network.getParent()
      const { address, lineageHeight: height } = channel
      // TODO walk height based on root knowledge
      parentBlock = await consistency.getBlock({ address })
    }
    if (path === '/') {
      return parentBlock // TODO honour height and count params
    }
    // TODO cache queries for the same block and height using a weakmap
    // start the walk downwards
    const children = path.substring(1).split('/')
    debug(`children`, children)
    let subpath = ''
    let childBlock = parentBlock
    for (const child of children) {
      subpath += '/' + child
      if (!childBlock.network[child]) {
        throw new Error(`Non existent path: ${subpath}`)
      }
      const { address, lineageHeight: height } = childBlock.network[child]
      // TODO walk height based on root knowledge
      childBlock = await consistency.getBlock({ address })
      debug(`fetched ${subpath} at height: ${height}`)
    }
    return childBlock // TODO honour height and count params
  }
  return { query, disable }
}

module.exports = { queryFactory }
