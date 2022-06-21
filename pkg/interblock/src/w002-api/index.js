import assert from 'assert-fast'

export const interchain = (type, payload, to) => {
  const { interchain } = globalThis[Symbol.for('interblock:api:hook')]
  assert(interchain, `global hook detached`)
  return interchain(type, payload, to)
}
export const useState = (path = '.') => {
  const { useState } = globalThis[Symbol.for('interblock:api:hook')]
  assert(useState, `global hook detached`)
  return useState(path)
}
