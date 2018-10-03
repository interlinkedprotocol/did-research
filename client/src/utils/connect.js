import Eth from 'ethjs-query'
import HttpProvider from 'ethjs-provider-http'

export const etherscanBaseUrl = 'https://ropsten.etherscan.io/tx'

// const blockchainURL = `http://${process.env.REACT_APP_NETWORK_HOST}:${process.env.REACT_APP_BLOCKCHAIN_PORT}`
const blockchainURL = `https://ropsten.infura.io/ethr-did'`
console.log(blockchainURL)

const provider = new HttpProvider(blockchainURL)
export const ethInstance = new Eth(provider)

ethInstance.blockNumber().then(console.log)
