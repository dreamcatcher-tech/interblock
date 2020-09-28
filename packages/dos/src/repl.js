const debug = require('debug')('dos:repl')
const ora = require('ora')
const { effectorFactory } = require('@dreamcatcher-tech/interblock')
const { read } = require('./read')
const { evaluate } = require('./eval')
const { withAutoComplete } = require('./auto-complete')
const { withSpin } = require('./spinner')
const print = require('./print')
const loop = require('./loop')
const commands = require('./commands')
const wrap = require('wordwrap')(0, 80)

module.exports = async function repl(opts) {
  debug(`repl`)
  opts = opts || {}
  opts.read = opts.read || withAutoComplete(read)
  opts.evaluate = opts.evaluate || withSpin(evaluate)

  debug(`opts: `, Object.keys(opts))

  const ctx = await getInitialCtx(opts)

  debug(`changing to home directory`)
  await opts.evaluate(ctx, 'cd', [])
  // await opts.evaluate(ctx, 'login', [])

  return loop(async function rep() {
    const input = await opts.read(ctx)
    let [cmd, ...cmdArgs] = input.split(' ').filter(Boolean)
    debug(`command: `, cmd, cmdArgs)

    await print(async () => {
      if (!noTiming.includes(cmd) && commands[cmd]) {
        cmdArgs = [cmd, ...cmdArgs]
        cmd = 'time'
      }
      const result = await opts.evaluate(ctx, cmd, cmdArgs)
      if (result && result.ctx) {
        Object.assign(ctx, result.ctx)
      }
      return result
    })
  })
}

async function getInitialCtx({ blockchain, evaluate }) {
  // TODO move this to the reboot command
  // TODO get environment printout
  const spinner = ora({ spinner: 'arrow3' }).start()
  spinner.info(
    `begining boot sequence Ctrl+C to cancel and drop to local shell`
  )
  spinner.text = `checking for new app version on server "this webpage"`
  spinner.info(`current build version: 0.0.0`).start()
  spinner.text = `looking for previous chains under the domain "this webpage"`
  // TODO check if wasm support is available - TOR blocks this in strict mode
  spinner.info(`no previous chains found`).start()
  if (!blockchain) {
    spinner.text = `Initializing blockchain...`
    blockchain = effectorFactory('console')
  }
  if (blockchain.then) {
    blockchain = await blockchain
  }
  const chainId = blockchain.getState().getChainId()
  spinner.info(`Blockchain initialized with chainId: ${chainId}`).start()
  spinner.text = `connecting to mainnet...`
  await new Promise((resolve) => setTimeout(resolve, 700))
  spinner.info(`connection to mainnet established`).start()
  spinner.info(`mainnet latency: 543 ms`)
  spinner.info(`peer connection count: 1`).start()
  spinner.text = `benchmarking local system` // TODO move to dedicated command with params
  await new Promise((resolve) => setTimeout(resolve, 700))
  spinner.info(`local blockrate 23 blocks per second / 53 ms per block`)
  spinner.stop()
  await print(`Welcome to the HyperNet
  Blockchain core: v0.0.5
  Terminal:        v0.0.12
  type "help" to get started`)
  const user = 'root'
  const machineId = 'local'
  spinner.stop()
  return { user, machineId, blockchain }
}

const noTiming = ['time', 'clear', 'help']