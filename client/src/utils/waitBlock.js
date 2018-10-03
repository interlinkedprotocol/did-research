import { ethInstance } from './connect'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
  
export async function waitBlock(txHash) {
  while (true) {
    const receipt = await ethInstance.getTransactionReceipt(txHash)
    if (receipt && receipt.blockHash) {
      console.log('TX receipt was generated')
      if (receipt.blockHash) {
        console.log('TX has been mined i.e. blockHash was included in TX receipt')
        console.log('gasUsed', receipt.gasUsed.toString())
        console.log('gasUsed', receipt.blockHash)
        console.log('receipt', receipt)
        break
      }
    }
    console.log("Waiting a mined block to include your transaction... currently in block " + await ethInstance.blockNumber());
    await sleep(4000);
  }
}
