import assert from 'assert-fast'
import { isRxDatabase } from 'rxdb'
import lock from 'level-lock'
import Debug from 'debug'

let instanceId = 0
let ramLockId = 1
const locks = new Map()

const lockFactory = (rxdb) => {
  const debug = Debug(`interblock:aws:lock:id-${instanceId++}`)

  const tryAcquire = async (chainId, lockPrefix, expiryMs) => {
    rxdb = await rxdb
    assert(isRxDatabase(rxdb))
    const shortId = chainId.substring(0, 9)
    debug(`attempting to lock %o %o %o`, shortId, lockPrefix, expiryMs)
    const unlock = lock(rxdb, chainId, 'w')
    if (!unlock) {
      debug(`already locked to this thread: ${shortId}`)
      return
    }
    const uuid = 'ramLockId-' + ramLockId++
    const hardwareLock = {
      uuid,
      tryRelease() {
        debug(`ram tryRelease for uuid: %o and chainId: %o`, uuid, shortId)
        unlock()
      },
    }
    locks.set(chainId, hardwareLock)
    return uuid
  }

  const isValid = async (chainId, uuid) => {
    // TODO check lock has not expired
    if (!locks.has(chainId)) {
      debug(`unknown lock for ${chainId}`)
      return false
    }
    const hardwareLock = locks.get(chainId)
    return hardwareLock.uuid === uuid
  }

  const release = async (chainId, uuid) => {
    const hardwareLock = locks.get(chainId)
    if (hardwareLock.uuid === uuid) {
      await hardwareLock.tryRelease()
      locks.delete(chainId)
      return
    }
    throw new Error(`invalid lock: ${chainId} ${uuid}`)
  }

  return { tryAcquire, isValid, release }
}

export { lockFactory }
