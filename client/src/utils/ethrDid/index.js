import { ec as EC } from 'elliptic'
import { HDNode, Wallet } from 'ethers'
import { logDecoder } from 'ethjs-abi'
import { fromWei } from 'ethjs-unit'
import { toEthereumAddress } from 'did-jwt/lib/Digest'
import { createJWT, verifyJWT, SimpleSigner } from 'did-jwt'
import { stringToBytes32, delegateTypes } from 'ethr-did-resolver'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'

import { ethInstance } from '../connect'
import { didRegistryInstance } from './RegistryContract'
import { getUpfrontCost } from '../transactions/estimateTransaction'
import { sendTx, sendRawTx, signTx, calcExtraFundsRequired, getRawTx } from '../transactions/sendTransaction'
import { attributeToHex } from './formatting'

export const REGISTRY = '0x7efe81ac780cf454c610ef12cb8e52dbb12a57de'
const DONATOR_MNEMONIC = 'wire lounge raccoon wise autumn utility face measure cliff aspect inspire sport'

const secp256k1 = new EC('secp256k1')
const { Secp256k1VerificationKey2018 } = delegateTypes

class EthrDID {
  commonTxData = {
    to: REGISTRY,
    contractABI: DidRegistryABI
  }

  static createKeyPair () {
    const kp = secp256k1.genKeyPair()
    const publicKey = kp.getPublic('hex')
    const privateKey = kp.getPrivate('hex')
    const address = toEthereumAddress(publicKey)
    return {address, publicKey, privateKey}
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
      const block = await ethInstance.getBlockByNumber(blockNumber, true)
      const timestamp = block ? block.timestamp : 0 // getBlockByNumber might fail and return undefined

      const logs = await ethInstance.getLogs({
        address: REGISTRY,
        topics: [null, `0x000000000000000000000000${identity.slice(2)}`], 
        fromBlock: previousChange,
        toBlock: previousChange
      })

      const events = logDecoder(DidRegistryABI, false)(logs)

      previousChange = undefined
      for (let event of events) {
        history = [ { blockNumber, timestamp, event }, ...history ]
        previousChange = event.previousChange
      }
    }

    return history
  }

  constructor (conf = {}) {
    if (!conf.address) throw new Error('No address is set for EthrDid')

    this.address = conf.address.toLowerCase() // TODO: REVIEW, is it okay to use toLowerCase() here?
    this.did = `did:ethr:${this.address}`

    if (conf.privateKey) {
      this.signer = SimpleSigner(conf.privateKey.slice(2))
    }

    this.withPrivateKeyOfCurrentWallet = callback => (...args) => callback(conf.privateKey, ...args)

    // TODO: REVIEW
    const donatorAddressNode = HDNode.fromMnemonic(DONATOR_MNEMONIC).derivePath(`m/44'/60'/0'/0/0`)
    // this.donatorAddress = new Wallet(donatorAddressNode.privateKey).address
    this.donatorAddress = '0xe144b89442cafa41482b11269ef0a08ccd591de6'

    // TODO: REVIEW
    this.withPrivateKeyOfDonator = callback => (...args) => callback(donatorAddressNode.privateKey, ...args)
  }

  async sendSignedTx (rawTx) {
    const sigHex = await this.withPrivateKeyOfCurrentWallet(signTx)(rawTx)
    return sendRawTx(sigHex)
  }

  async sendFundedTx (rawTx, methodName) {
    const sendTxFunctions = []

    const extra = await calcExtraFundsRequired(rawTx.from, getUpfrontCost(rawTx))
    if (extra) {
      const donatorBalance = await ethInstance.getBalance(this.donatorAddress, 'latest')

      if (donatorBalance.ucmp(extra) !== -1) {
        const tx = await getRawTx({
          from: this.donatorAddress,
          to: rawTx.from,
          value: extra
        })
        // const sigHex = await this.withPrivateKeyOfDonator(signTx)(tx)
        sendTxFunctions.push({ name: `Providing extra funds required for execution of ${methodName}`, func: () => sendTx(tx) })
      } else {
        throw new Error(
          `Requested extra funds ${fromWei(extra, 'ether')} Eth is above Donator's balance ${fromWei(donatorBalance, 'ether')} Eth`
        )
      }
    }
    sendTxFunctions.push({ name: methodName || 'Main function', func: () => this.sendSignedTx(rawTx) })
    return sendTxFunctions
  }

  async lookupOwner (cache = true) {
    if (cache && this.owner) return this.owner
    const result = await didRegistryInstance.identityOwner(this.address)
    return result['0']
  }

  async changeOwnerTx (newOwner) {
    const owner = await this.lookupOwner()

    if (this.address !== owner) {
      throw new Error(
        `Currently selected Wallet ${this.address} is not the owner of ${this.address}. The owner is ${owner}`
    )}

    const txData = {
      ...this.commonTxData,
      from: this.address,
      methodName: 'changeOwner', 
      params: [this.address, newOwner]
    }

    return await getRawTx(txData)
  }

  async setAttributeTx (key, value, expiresIn = 86400) {
    const owner = await this.lookupOwner()

    if (this.address !== owner) {
      throw new Error(
        `Currently selected Wallet ${this.address} is not the owner of ${this.address}. The owner is ${owner}`
    )}

    const attrKey = stringToBytes32(key)
    const attrValue = attributeToHex(key, value)

    const txData = { 
      ...this.commonTxData, 
      from: this.address,
      methodName: 'setAttribute',
      params: [
        this.address,
        attrKey,
        attrValue,
        expiresIn
      ]
    }

    return await getRawTx(txData)
  }

  async addDelegateTx (delegate, options = {}) {
    const delegateType = options.delegateType || Secp256k1VerificationKey2018
    const expiresIn = options.expiresIn || 86400
    const owner = await this.lookupOwner()

    if (this.address !== owner) {
      throw new Error(
        `Currently selected Wallet ${this.address} is not the owner of did:ethr:${this.address}. The owner is ${owner}`
    )}

    const txData = { 
      ...this.commonTxData,
      from: this.address,
      methodName: 'addDelegate', 
      params: [
        this.address,
        delegateType,
        delegate,
        expiresIn
      ]
    }

    return await getRawTx(txData)
  }

  /*
  async revokeDelegate (delegate, delegateType = Secp256k1VerificationKey2018) {
    const owner = await this.lookupOwner()
    return didRegistryInstance.revokeDelegate(this.address, delegateType, delegate, {from: owner})
  }
  */

  // Create a temporary signing delegate able to sign JWT on behalf of identity
  async addSigningDelegateTx (delegateType = Secp256k1VerificationKey2018, expiresIn = 86400) {
    const keypair = EthrDID.createKeyPair()
    console.log(keypair)
    this.signer = SimpleSigner(keypair.privateKey)
    const rawTx = await this.addDelegateTx(keypair.address, {delegateType, expiresIn})
    return {keypair, rawTx}
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


export default EthrDID