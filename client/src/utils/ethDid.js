import { Buffer } from 'buffer'
import { ec as EC } from 'elliptic'
import { stringToBytes32, delegateTypes, REGISTRY } from 'ethr-did-resolver'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
import { createJWT, verifyJWT, SimpleSigner } from 'did-jwt'
import { toEthereumAddress } from 'did-jwt/lib/Digest'


import { didRegistryInstance } from './RegistryContract'
import { sendFundedTransaction } from './sendTransaction'

const secp256k1 = new EC('secp256k1')
const { Secp256k1VerificationKey2018 } = delegateTypes

function attributeToHex (key, value) {
  if (Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`
  }
  const match = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)
  if (match) {
    const encoding = match[6]
    // TODO add support for base58
    if (encoding === 'base64') {
      return `0x${Buffer.from(value, 'base64').toString('hex')}`
    }
  }
  if (value.match(/^0x[0-9a-fA-F]*$/)) {
    return value
  }
  return `0x${Buffer.from(value).toString('hex')}`
}

export function createKeyPair () {
  const kp = secp256k1.genKeyPair()
  const publicKey = kp.getPublic('hex')
  const privateKey = kp.getPrivate('hex')
  const address = toEthereumAddress(publicKey)
  return {address, privateKey}
}

const commonTxData = {
  to: REGISTRY,
  contractABI: DidRegistryABI
}

class EthrDID {
  constructor (conf = {}) {
    if (!conf.address) throw new Error('No address is set for EthrDid')

    this.address = conf.address
    this.did = `did:ethr:${this.address}`

    if (conf.privateKey) {
      this.privateKey = conf.privateKey // TODO
      this.signer = SimpleSigner(conf.privateKey)
    }
  }

  async lookupOwner (cache = true) {
    if (cache && this.owner) return this.owner
    const result = await didRegistryInstance.identityOwner(this.address)
    return result['0']
  }

  async changeOwner (newOwner) {
    const owner = await this.lookupOwner()
    const txData = { ...commonTxData, from: owner, methodName: 'changeOwner',  params: [this.address, newOwner] }
    const txHash = await sendFundedTransaction(txData, this.privateKey) // TODO
    this.owner = newOwner
    return txHash
  }

  async addDelegate (delegate, options = {}) {
    const delegateType = options.delegateType || Secp256k1VerificationKey2018
    const expiresIn = options.expiresIn || 86400
    const owner = await this.lookupOwner()
    return didRegistryInstance.addDelegate(this.address, delegateType, delegate, expiresIn, {from: owner})
  }

  async revokeDelegate (delegate, delegateType = Secp256k1VerificationKey2018) {
    const owner = await this.lookupOwner()
    return didRegistryInstance.revokeDelegate(this.address, delegateType, delegate, {from: owner})
  }

  async setAttribute (key, value, expiresIn = 86400) {
    const owner = await this.lookupOwner()
    return didRegistryInstance.setAttribute(this.address, stringToBytes32(key), attributeToHex(key, value), expiresIn, {from: owner})
  }

  // Create a temporary signing delegate able to sign JWT on behalf of identity
  async createSigningDelegate (delegateType = Secp256k1VerificationKey2018, expiresIn = 86400) {
    const kp = createKeyPair()
    this.signer = SimpleSigner(kp.privateKey)
    const txHash = await this.addDelegate(kp.address, {delegateType, expiresIn})
    return {kp, txHash}
  }

  async signJWT (payload, expiresIn) {
    if (typeof this.signer !== 'function') throw new Error('No signer configured')
    const options = {signer: this.signer, alg: 'ES256K-R', issuer: this.did}
    if (expiresIn) options.expiresIn = expiresIn
    return createJWT(payload, options)
  }

  async verifyJWT (jwt, audience=this.did) {
    return verifyJWT(jwt, {audience})
  }
}
EthrDID.createKeyPair = createKeyPair
// module.exports = EthrDID
export default EthrDID