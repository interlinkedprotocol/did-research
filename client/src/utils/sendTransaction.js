import { encodeMethod } from 'ethjs-abi'
import { toWei, fromWei } from 'ethjs-unit'
import { sign } from 'ethjs-signer'
import { find } from 'lodash'
import { HDNode, Wallet } from 'ethers'

import { ethInstance, etherscanBaseUrl } from './connect'
import { getBaseFee, getUpfrontCost } from './estimateTransaction';
import { waitBlock } from './waitBlock'

const DONATOR_MNEMONIC = 'wire lounge raccoon wise autumn utility face measure cliff aspect inspire sport'

const TX_NO_BYTECODE = '0x'
const TX_GAS_PRICE = toWei(40, 'gwei')
const TX_GAS_LIMIT = 3000000

const GAS_REQUIRED = {
  'donateFunds': 21000,
  'changeOwner': 67627
}

const getBytecode = (contractABI, methodName, params) => encodeMethod(find(contractABI, { name: methodName }), params)

/*
const getBytecode = (contractABI, methodName, params) => {
  const contract = new web3Instance.eth.Contract(contractABI)
  const txObject = contract.methods[methodName](...params)
  return txObject.encodeABI()
}
*/

export async function sendFundedTransaction (data, privateKey) {
  const rawTx = await getRawTransaction(data)

  const txCost = getUpfrontCost(rawTx)
  console.log('txCost in Ether', fromWei(txCost, 'ether'))

  const senderBalance = await ethInstance.getBalance(data.from, 'latest')
  console.log('senderBalance', fromWei(senderBalance, 'ether'))

  const toBeFunded = txCost.sub(senderBalance)
  console.log('toBeFunded', fromWei(toBeFunded, 'ether'))

  if (senderBalance.ucmp(txCost) === -1) await donateFunds(data.from, toBeFunded)

  const senderBalance2 = await ethInstance.getBalance(data.from, 'latest')
  console.log('senderBalance2', fromWei(senderBalance2, 'ether'))

  const sigHex = sign(rawTx, privateKey)

  const txHash = await ethInstance.sendRawTransaction(sigHex)
  console.log(`${etherscanBaseUrl}/${txHash}`)

  await waitBlock(txHash)
  return txHash
} 

async function donateFunds(to, value) {
  if (!to || !value) throw new Error('Missing required parameters')

  const masterNode = HDNode.fromMnemonic(DONATOR_MNEMONIC)
  const addressNode = masterNode.derivePath(`m/44'/60'/0'/0/0`)
  const donatorWallet = new Wallet(addressNode.privateKey)
  
  // TODO: do we neeed 'return' here?
  return await sendSignedTransaction({ from: donatorWallet.address, to: to, value: value }, donatorWallet.privateKey)
}

async function getRawTransaction (data) {
  console.log(data)

  if (!data.from) throw new Error('Missing required parameters', data)

  const rawTx = {}
  rawTx.from = data.from
  rawTx.to = data.to
  rawTx.data = data.contractABI && data.methodName && data.params 
    ? getBytecode(data.contractABI, data.methodName, data.params)
    : TX_NO_BYTECODE
  console.log(rawTx.data)
  rawTx.nonce = await ethInstance.getTransactionCount(data.from)
  rawTx.value = data.value
  rawTx.gasPrice = data.gasPrice || TX_GAS_PRICE
  rawTx.gasLimit = data.gasLimit || 3000000

  console.log('rawTx.value', rawTx.value)
  console.log('rawTx.gasPrice', rawTx.gasPrice)
  console.log('rawTx.gasLimit', rawTx.gasLimit)
  console.log('baseFee', getBaseFee(rawTx).toString())

  return rawTx
}

export async function sendSignedTransaction (data, privateKey) {
  const rawTx = await getRawTransaction(data)

  const txCost = getUpfrontCost(rawTx)
  console.log('txCost in Ether', fromWei(txCost, 'ether'))

  const senderBalance = await ethInstance.getBalance(data.from, 'latest')
  console.log('senderBalance', fromWei(senderBalance, 'ether'))

  if (senderBalance.ucmp(txCost) === -1)
    throw new Error(
      `Transaction requires ${fromWei(txCost)} Eth, but sender holds ${fromWei(senderBalance)} Eth\nRawTx:${rawTx}`
    )

  const sigHex = sign(rawTx, privateKey)

  const txHash = await ethInstance.sendRawTransaction(sigHex)
  console.log(`${etherscanBaseUrl}/${txHash}`)

  await waitBlock(txHash)
  return txHash
}
