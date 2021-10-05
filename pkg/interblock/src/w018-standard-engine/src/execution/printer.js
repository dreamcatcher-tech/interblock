import assert from 'assert-fast'
import chalk from 'ansi-colors-browserify'
import pad from 'pad-left'
import prettyBytes from 'pretty-bytes'
import columnify from 'columnify'
import { interblockModel } from '../../../w015-models'
const grayUndefined = chalk.gray('undefined')

const interPrint = (interblock, msg, path, bg, fg) => {
  assert(interblockModel.isModel(interblock))
  msg = msg || 'INTERBLOCK'
  path = path || '(unknown)'
  bg = bg || 'bgYellow'
  fg = fg || 'yellow'
  const { provenance } = interblock
  let height = provenance.height

  const chainIdRaw = provenance.getAddress().getChainId()
  let chainId = shrink(chainIdRaw, bg)
  const hashRaw = interblock.getHash()
  let hash = chalk.dim(shrink(hashRaw, 'bgWhite', fg))
  let size = getSize(interblock)

  const messages = [{ msg, height, path, chainId, hash, size }]

  const remote = interblock.getRemote()
  if (remote) {
    msg = chalk.magenta('  └── channel')
    height = '-' // TODO replace with known height of remote
    path = chalk.gray(interblock.getOriginAlias())
    size = getSize(remote)
    messages.push({ msg, height, path, size })

    msg = chalk.cyan('      └── tx:')
    Object.keys(remote.requests).forEach((index) => {
      height = index
      chainId = remote.requests[index].type
      hash = grayUndefined
      size = getSize(remote.requests[index])
      messages.push({ msg, height, chainId, hash, size })
    })

    msg = chalk.yellow('      └── rx:')
    Object.keys(remote.replies).forEach((index) => {
      height = index
      chainId = grayUndefined
      hash = remote.replies[index].type
      size = getSize(remote.replies[index])
      messages.push({ msg, height, chainId, hash, size })
    })
  }
  return format(messages)
}
const blockPrint = (block, path, isNewChain, isDuplicate, options) => {
  const header = headerPrint(block, path, isNewChain, isDuplicate, options)
  const messages = [header]

  if (!isDuplicate && !options.headersOnly) {
    const networkLines = networkPrint(block.network, options)
    messages.push(...networkLines)
  }
  const text = print(messages)
  return text
}
const print = (messages) => {
  const options = {
    truncate: true,
    showHeaders: false,
    minWidth: 3,
    config: {
      msg: { minWidth: 15, maxWidth: 15 },
      height: { minWidth: 8, maxWidth: 8 },
      path: { minWidth: 18, maxWidth: 18 },
    },
  }
  const formatted = columnify(messages, options)
  return formatted
}
const headerPrint = (block, path, isNewChain, isDuplicate, options) => {
  const chainId = shrink(block.provenance.getAddress().getChainId())
  const height = chalk.green(block.provenance.height)
  const rawHash = block.getHash()
  const hash = chalk.dim(shrink(rawHash, 'bgWhite', 'green'))
  const msg = isDuplicate ? chalk.gray('NOCHANGE') : chalk.green('BLOCK')
  const header = { msg, height, path, chainId, hash }
  if (options.size) {
    header.size = getSize(block)
  }
  if (isNewChain) {
    header.msg = chalk.red('NEW_CHAIN')
  }
  return header
}
const networkPrint = (network, options) => {
  const messages = []
  const aliases = network.getAliases()
  aliases.forEach((alias) => {
    const channel = network[alias]
    const { address } = channel
    let height = '-'
    let chainId = grayUndefined
    let hash = grayUndefined
    if (address.isResolved()) {
      chainId = shrink(address.getChainId(), 'bgMagenta', 'gray')
    }
    if (address.isRoot() || address.isLoopback()) {
      chainId = shrink(address.getChainId(), 'bgBlack', 'gray')
      hash = ''
    }
    const remote = channel.getRemote()
    if (channel.heavy) {
      const { provenance } = channel.heavy
      const rawHash = provenance.getHash()
      hash = chalk.dim(shrink(rawHash, 'bgWhite', 'magenta'))
      const { lineageHeight, heavyHeight } = channel
      height = chalk.magenta(heavyHeight + '.' + lineageHeight)
    }
    const msg = chalk.magenta('  └── channel')
    const channelHeader = {
      msg,
      height,
      path: chalk.gray(alias),
      chainId,
      hash,
    }
    if (options.size) {
      channelHeader.size = pad(prettyBytes(channel.serialize().length * 2), 12)
    }

    messages.push(channelHeader)

    // get the tx and remote.replies span, then order them
    const tx = getIndexSpan(channel.requests, remote.replies)
    tx.forEach((index) => {
      const request = channel.requests[index]
      const reply = remote.replies[index]
      const msg = chalk.cyan('      └── tx:')
      const chainId = request ? request.type : grayUndefined
      const hash = chalk.gray(reply ? reply.type : grayUndefined)
      const height = chalk.cyan(index)
      const path = '' //chalk.dim('since: -4')
      // const size = request ? getSize(request) : grayUndefined
      const action = { msg, height, path, chainId, hash }
      messages.push(action)
    })
    const rx = getIndexSpan(remote.requests, channel.replies)
    rx.forEach((index) => {
      const request = remote.requests[index]
      const reply = channel.replies[index]
      const msg = chalk.yellow('      └── rx:')
      const height = chalk.yellow(index)
      const path = ''
      const chainId = chalk.gray(request ? request.type : grayUndefined)
      const hash = reply ? reply.type : grayUndefined
      // const size = reply ? getSize(reply) : grayUndefined // TODO sum size of req & rep

      const action = { msg, height, path, chainId, hash }
      messages.push(action)
    })
    // use previous blocks to know when the counters in remotes altered
  })
  return messages
}

const sizeCache = new WeakMap()
const getSize = (model) => {
  if (sizeCache.has(model)) {
    return sizeCache.get(model)
  }
  const size = pad(prettyBytes(model.serialize().length * 2), 12)
  sizeCache.set(model, size)
  return size
}
const shrink = (string = '', bg = 'bgGreen', fg = 'white') => {
  const shrunk = ` ${pad(string, 9).substring(0, 9)} `
  return chalk[fg][bg].bold(shrunk)
}

const format = (messages) => {
  const options = {
    truncate: true,
    showHeaders: false,
    minWidth: 3,
    config: {
      msg: { minWidth: 15, maxWidth: 15 },
      height: { minWidth: 8, maxWidth: 8 },
      path: { minWidth: 18, maxWidth: 18 },
    },
  }
  const formatted = columnify(messages, options)
  return formatted
}

// TODO move these to use model functions ?
const getIndexSpan = (requests, replies) => {
  const req = _getSortedIndices(requests)
  const rep = _getSortedIndices(replies)
  const merge = [...req, ...rep]
  const dedupe = new Set(merge)
  const indices = Array.from(dedupe)
  indices.sort((a, b) => a - b)
  return indices
}
const _getSortedIndices = (obj) => {
  const indices = []
  Object.keys(obj).forEach((key) => {
    const number = parseInt(key)
    indices.push(number)
  })
  indices.sort((first, second) => first - second)
  return indices
}
export { blockPrint, interPrint, headerPrint, networkPrint, print }