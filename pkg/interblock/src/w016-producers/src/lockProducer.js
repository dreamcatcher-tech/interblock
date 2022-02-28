import assert from 'assert-fast'
import { Lock, Block } from '../../w015-models'
/**
 * Given a lock and a block, return a new lock with the pool reconciled,
 * as the latest block may already contain some of the interblock pool,
 * which will be removed.  Used to purge the interblock pool.
 *
 * Allows book keeping to be out of the isolation FSM.
 * Simplifies the code paths if generation isn't concerned
 * with this book keeping.
 */
const reconcile = (lock, block) => {
  assert(lock instanceof Lock)
  assert(block instanceof Block)
  const piercings = { requests: [], replies: [] }
  const interblocks = []
  return lock.update({ block, piercings, interblocks })
}

export { reconcile }