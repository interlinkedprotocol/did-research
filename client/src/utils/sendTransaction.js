import { encodeMethod } from 'ethjs-abi'
import { toWei, fromWei } from 'ethjs-unit'
import { sign } from 'ethjs-signer'
import { find } from 'lodash'
import { HDNode, Wallet } from 'ethers'

import { ethInstance, etherscanBaseUrl } from './connect'
import { getUpfrontCost } from './estimateTransaction';
import { waitBlock } from './waitBlock'
import PromiseWithStatus from './promiseWithStatus'

const DONATOR_MNEMONIC = 'wire lounge raccoon wise autumn utility face measure cliff aspect inspire sport'

const TX_NO_BYTECODE = '0x'
const TX_GAS_PRICE = toWei(100, 'gwei')
const TX_GAS_LIMIT = 3000000

// const GAS_REQUIRED = {
//   'donateFunds': 21000,
//   'changeOwner': 67627
// }

const getBytecode = (contractABI, methodName, params) => encodeMethod(find(contractABI, { name: methodName }), params)

/*
const getBytecode = (contractABI, methodName, params) => {
  const contract = new web3Instance.eth.Contract(contractABI)
  const txObject = contract.methods[methodName](...params)
  return txObject.encodeABI()
}
*/

export async function sendFundedTransaction (privateKey, data, needWaitReceipt = false) {
  const rawTx = await getRawTransaction(data)

  const txCost = getUpfrontCost(rawTx)
  const senderBalance = await ethInstance.getBalance(data.from, 'latest')
  const toBeFunded = txCost.sub(senderBalance)
  if(senderBalance.ucmp(txCost) === -1) {
    const txResult = await donateFunds(data.from, toBeFunded)
    if(!txResult.txStatus) return
  }

  const sigHex = sign(rawTx, privateKey)
  const txHash = await ethInstance.sendRawTransaction(sigHex)
  console.log(`${etherscanBaseUrl}/${txHash}`)

  const txStatus = needWaitReceipt ? await waitBlock(txHash) : PromiseWithStatus(waitBlock(txHash))

  return { txHash, txStatus }
} 

async function donateFunds(to, value) {
  if (!to || !value) throw new Error('Missing required parameters')

  const masterNode = HDNode.fromMnemonic(DONATOR_MNEMONIC)
  const addressNode = masterNode.derivePath(`m/44'/60'/0'/0/0`)
  const donatorWallet = new Wallet(addressNode.privateKey)

  return await sendSignedTransaction({ from: donatorWallet.address, to: to, value: value }, donatorWallet.privateKey, true)
}

async function getRawTransaction (data) {
  if (!data.from) throw new Error('Missing required parameters', data)

  const nonce = await ethInstance.getTransactionCount(data.from)
  const rawTx = {
    from: data.from,
    to: data.to,
    data: TX_NO_BYTECODE,
    nonce,
    value: data.value,
    gasPrice: data.gasPrice || TX_GAS_PRICE,
    gasLimit: data.gasLimit || TX_GAS_LIMIT
  }

  if(data.contractABI && data.methodName && data.params) rawTx.data = getBytecode(data.contractABI, data.methodName, data.params)

  return rawTx
}

export async function sendSignedTransaction (data, privateKey, needWaitReceipt = false) {
  const rawTx = await getRawTransaction(data)

  const txCost = getUpfrontCost(rawTx)

  const senderBalance = await ethInstance.getBalance(data.from, 'latest')

  if (senderBalance.ucmp(txCost) === -1)
    throw new Error(
      `Transaction requires ${fromWei(txCost, 'ether')} Eth, but sender holds ${fromWei(senderBalance, 'ether')} Eth\nRawTx:${rawTx}`
    )

  const sigHex = sign(rawTx, privateKey)

  const txHash = await ethInstance.sendRawTransaction(sigHex)
  console.log(`${etherscanBaseUrl}/${txHash}`)

  const txStatus = needWaitReceipt ? await waitBlock(txHash) : PromiseWithStatus(waitBlock(txHash))

  return { txHash, txStatus }
}
