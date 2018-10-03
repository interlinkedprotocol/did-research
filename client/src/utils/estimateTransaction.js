import { BN } from 'ethereumjs-util'

const fees = require('ethereum-common/params.json')

/**
 * If the tx's `to` is to the creation address
 * @return {Boolean}
 */
function toCreationAddress (to) {
  return to.toString('hex') === ''
}

/**
 * The amount of gas paid for the data in this tx
 * @param {string} bytecode for transaction data
 * @return {BN}
 */
export function getDataFee (bytecode) {
  const cost = new BN(0)
  for (let i = 0; i < bytecode.length; i++) {
    bytecode[i] === 0 ? cost.iaddn(fees.txDataZeroGas.v) : cost.iaddn(fees.txDataNonZeroGas.v)
  }
  return cost
}

/**
 * the minimum amount of gas the tx must have (DataFee + TxFee + Creation Fee)
 * @param {Object} transaction object
 * @return {BN}
 */
export function getBaseFee (rawTx, homestead = true) { 
  if (!rawTx.data || !rawTx.to) throw new Error('Missing required parameter')

  const fee = getDataFee(rawTx.data).iaddn(fees.txGas.v)
  if (homestead && toCreationAddress(rawTx.to)) {
    fee.iaddn(fees.txCreation.v)
  }
  return fee
}

/**
 * the up front amount that an account must have for this transaction to be valid
 * @param {Object} transaction object 
 * @return {BN}
 */
export function getUpfrontCost (rawTx) {
  if (!rawTx.gasLimit || !rawTx.gasPrice) throw new Error('Missing required parameter')

  console.log('rawTx.value', rawTx.value ? rawTx.value.toString() : rawTx.value)

  return new BN(rawTx.gasLimit)
    .imul(new BN(rawTx.gasPrice))
    .iadd(new BN(rawTx.value))
}