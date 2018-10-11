import Eth from 'ethjs-query'
import HttpProvider from 'ethjs-provider-http'

export const etherscanBaseUrl = 'https://ropsten.etherscan.io/tx'

// const blockchainURL = `https://ropsten.infura.io/ethr-did'`
const blockchainURL = `http://localhost:22001`
console.log(blockchainURL)

const provider = new HttpProvider(blockchainURL)
export const ethInstance = new Eth(provider)
