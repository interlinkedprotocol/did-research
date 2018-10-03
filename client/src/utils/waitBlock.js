import { ethInstance } from './connect'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
  
export async function waitBlock(txHash) {
  while (true) {
    const receipt = await ethInstance.getTransactionReceipt(txHash)
    console.log(receipt);
    if(receipt) return receipt.status === '0x1'

    await sleep(4000);
  }
}
