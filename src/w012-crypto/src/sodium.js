import { Buffer } from 'buffer'
import assert from 'assert'
import SodiumPlusLibrary from 'sodium-plus'
import { objectHash } from './common'
import Debug from 'debug'

const debug = Debug('interblock:crypto:sodium')
const { SodiumPlus, Ed25519PublicKey, Ed25519SecretKey } = SodiumPlusLibrary

/**
 *  needed for libsodium as does not import Buffer correctly.
 * Any global called in a dependency seems to be able to be patched
 * by assigning to globalThis.
 * Just has to be defined before the dependency code is used, so
 * impossible if called as part of the import process in the module.
 */
globalThis.Buffer = Buffer

const ciKeypair = {
  publicKey: 'I7xUkSwebpLEqGglyGfif/3FVb/71CRPF6Jqv//ull0=',
  secretKey:
    'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYjvFSRLB5uksSoaCXIZ+J//cVVv/vUJE8Xomq//+6WXQ==',
}
const pierceKeypair = {
  publicKey: '8aktZHsVyr/yy6arJiJP8F1OI4Na5eQw9pIH6f7XrV0=',
  secretKey:
    'r6m8nU2GqsSg38+0TXKXrIgd8WHsJfr5qlSZZDz7GN7xqS1kexXKv/LLpqsmIk/wXU4jg1rl5DD2kgfp/tetXQ==',
}
const _verifiedSet = new Set([
  `${ciKeypair.publicKey}_${ciKeypair.secretKey}`, // TODO use hashes, to obscure in memory
  `${pierceKeypair.publicKey}_${pierceKeypair.secretKey}`,
])

let _sodiumPromise
const sodiumLoader = () => {
  // apiGateway loads module multiple times - only instantiate when called directly.
  if (!_sodiumPromise) {
    debug('loading sodiumPlus')
    _sodiumPromise = SodiumPlus.auto()
    _sodiumPromise.then(() => debug('sodiumPlus loaded'))
  }
  return _sodiumPromise
}
// sodiumLoader() // web bundlers sometimes load multiple instances

const _hashTemplate = objectHash('template')

const generateKeyPair = async (seed = '') => {
  const sodium = await sodiumLoader()
  // TODO pad out seed or truncate if too long - make it easy to supply
  assert.strictEqual(typeof seed, 'string')
  assert(seed.length <= 32, `seed too long: ${seed.length}`)
  if (seed.length) {
    debug(`INSECURE padding seed to 32 bytes - got ${seed.length}`)
  }
  while (seed.length && seed.length < 32) {
    seed += '_'
  }
  if (!seed.length) {
    seed = await sodium.randombytes_buf(32)
  }
  const keypairRaw = await sodium.crypto_sign_seed_keypair(seed)
  const secret = await sodium.crypto_sign_secretkey(keypairRaw)
  const pub = await sodium.crypto_sign_publickey(keypairRaw)
  const keypair = {
    publicKey: pub.toString('base64'),
    secretKey: secret.toString('base64'),
  }
  const { publicKey, secretKey } = keypair
  const mapKey = `${publicKey}_${secretKey}`
  _verifiedSet.add(mapKey)
  return keypair
}

const verifyKeyPairSync = ({ publicKey, secretKey }) =>
  _verifiedSet.has(`${publicKey}_${secretKey}`)

const verifyKeyPair = async ({ publicKey, secretKey }) => {
  assert.strictEqual(typeof publicKey, 'string')
  assert.strictEqual(typeof secretKey, 'string')
  const mapKey = `${publicKey}_${secretKey}`
  try {
    const { signature } = await signHash(_hashTemplate, secretKey)
    const verified = await verifyHash(_hashTemplate, signature, publicKey)
    if (verified) {
      _verifiedSet.add(mapKey)
    }
  } catch (e) {
    // key not found
  }
  return _verifiedSet.has(mapKey)
}

const signHash = async (hash, secretKey) => {
  assert.strictEqual(hash.length, _hashTemplate.length, `use objectHash()`)
  const secret = Ed25519SecretKey.from(secretKey, 'base64')
  const sodium = await sodiumLoader()
  const sig = await sodium.crypto_sign_detached(hash, secret)
  const signature = sig.toString('base64')
  return { messageHash: hash, signature }
}

const verifyHashSync = (messageHash, signature, publicKey) => {
  const key = `${messageHash}_${signature}_${publicKey}`
  const isVerified = _verifiedSet.has(key)
  return isVerified
}

const verifyHash = async (messageHash, signature, publicKey) => {
  const sig = Buffer.from(signature, 'base64')
  const pub = Ed25519PublicKey.from(publicKey, 'base64')
  const sodium = await sodiumLoader()
  const ver = await sodium.crypto_sign_verify_detached(messageHash, pub, sig)
  const key = `${messageHash}_${signature}_${publicKey}`
  if (ver) {
    _verifiedSet.add(key)
  } else {
    debug(`verifyHash failed`)
  }
  return ver
}

const _getBackend = async () => {
  const sodium = await sodiumLoader()
  return sodium.getBackendName()
}

export {
  signHash,
  verifyHash,
  verifyHashSync,
  generateKeyPair,
  verifyKeyPair,
  verifyKeyPairSync,
  ciKeypair,
  pierceKeypair,
  _verifiedSet,
  _getBackend,
}
