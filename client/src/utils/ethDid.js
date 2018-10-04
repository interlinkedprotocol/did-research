// import { Buffer } from 'buffer'
import { ec as EC } from 'elliptic'
import { stringToBytes32, delegateTypes, REGISTRY } from 'ethr-did-resolver'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
import { createJWT, verifyJWT, SimpleSigner } from 'did-jwt'
import { toEthereumAddress } from 'did-jwt/lib/Digest'
import { logDecoder } from 'ethjs-abi'

import { ethInstance } from './connect'
import { didRegistryInstance } from './RegistryContract'
import { sendFundedTransaction } from './sendTransaction'

const secp256k1 = new EC('secp256k1')
// const { Secp256k1VerificationKey2018 } = delegateTypes
//
// function attributeToHex (key, value) {
//   if (Buffer.isBuffer(value)) {
//     return `0x${value.toString('hex')}`
//   }
//   const match = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)
//   if (match) {
//     const encoding = match[6]
//     // TODO add support for base58
//     if (encoding === 'base64') {
//       return `0x${Buffer.from(value, 'base64').toString('hex')}`
//     }
//   }
//   if (value.match(/^0x[0-9a-fA-F]*$/)) {
//     return value
//   }
//   return `0x${Buffer.from(value).toString('hex')}`
// }

const commonTxData = {
  to: REGISTRY,
  contractABI: DidRegistryABI
}

class EthrDID {
  static createKeyPair () {
    const kp = secp256k1.genKeyPair()
    const publicKey = kp.getPublic('hex')
    const privateKey = kp.getPrivate('hex')
    const address = toEthereumAddress(publicKey)
    return {address, privateKey}
  }

  static async lastChanged (identity) {
    const result = await didRegistryInstance.changed(identity)
    if (result) {
      return result['0']
    }
  }

  static async getDidEventHistory (identity) {
    let history = []

    let previousChange = await EthrDID.lastChanged(identity)

    while (previousChange) {
      const blockNumber = previousChange.toNumber()
      const block = await ethInstance.getBlockByNumber(blockNumber, false) // TODO what the fuck is 'true'
      console.log(blockNumber, block);
      const logs = await ethInstance.getLogs({
        address: REGISTRY,
        topics: [null, `0x000000000000000000000000${identity.slice(2)}`], 
        fromBlock: previousChange,
        toBlock: previousChange
      })
      const events = logDecoder(DidRegistryABI, false)(logs)

      previousChange = undefined
      for (let event of events) {
        history = [ { blockNumber, timestamp: block.timestamp, event }, ...history ]
        previousChange = event.previousChange
      }
    }
    return history
  }

  /*
  static async getDIDOwnerChangedEvents (identity) {
    const history = await EthrDID.getDidEventHistory(identity)
    return history.filter(item => item.event._eventName === 'DIDOwnerChanged')
  }
  */

  constructor (conf = {}) {
    if (!conf.address) throw new Error('No address is set for EthrDid')

    this.address = conf.address
    this.did = `did:ethr:${this.address}`

    if (conf.privateKey) {
      this.signer = SimpleSigner(conf.privateKey)
    }

    this.withPrivateKey = callback => (...args) => callback(conf.privateKey, ...args)
  }

  async lookupOwner (cache = true) {
    if (cache && this.owner) return this.owner
    const result = await didRegistryInstance.identityOwner(this.address)
    return result['0']
  }

  async changeOwner (newOwner) {
    const owner = await this.lookupOwner()
    const txData = {
      ...commonTxData,
      from: owner,
      methodName: 'changeOwner', 
      params: [this.address, newOwner]
    }
    const txResult = await this.withPrivateKey(sendFundedTransaction)(txData, true)
    this.owner = newOwner
    return txResult
  }

  async setAttribute (key, value, expiresIn = 86400) {
    const owner = await this.lookupOwner()

    const txData = { 
      ...commonTxData, 
      from: owner,
      methodName: 'setAttribute', 
      params: [
        this.address,
        stringToBytes32(key),
        stringToBytes32(key, value),
        expiresIn
      ]
    }

    return await this.withPrivateKey(sendFundedTransaction)(txData, true)
  }

  /*
  async addDelegate (delegate, options = {}) {
    const delegateType = options.delegateType || Secp256k1VerificationKey2018
    const expiresIn = options.expiresIn || 86400
    const owner = await this.lookupOwner()
    return didRegistryInstance.addDelegate(this.address, delegateType, delegate, expiresIn, {from: owner})
  }
  */

  /*
  async revokeDelegate (delegate, delegateType = Secp256k1VerificationKey2018) {
    const owner = await this.lookupOwner()
    return didRegistryInstance.revokeDelegate(this.address, delegateType, delegate, {from: owner})
  }
  */

  // Create a temporary signing delegate able to sign JWT on behalf of identity
  /*
  async createSigningDelegate (delegateType = Secp256k1VerificationKey2018, expiresIn = 86400) {
    const kp = EthrDID.createKeyPair()
    this.signer = SimpleSigner(kp.privateKey)
    const txHash = await this.addDelegate(kp.address, {delegateType, expiresIn})
    return {kp, txHash}
  }
  */

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


export default EthrDID