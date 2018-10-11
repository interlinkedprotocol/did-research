import { ethInstance, /* etherscanBaseUrl */ } from '../connect'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
  
export async function waitBlock(txHash) {
  while (true) {
    const receipt = await ethInstance.getTransactionReceipt(txHash)

    if(receipt) return receipt.status === '0x1'

    console.log(receipt || `Mining...`/* ${etherscanBaseUrl}/${txHash} */)
    await sleep(4000);
  }
}
