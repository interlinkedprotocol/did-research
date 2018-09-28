import Web3  from  'web3'
import HttpProvider from 'ethjs-provider-http'

// const blockchainURL = `http://${process.env.REACT_APP_NETWORK_HOST}:${process.env.REACT_APP_BLOCKCHAIN_PORT}`
const blockchainURL = `https://ropsten.infura.io/ethr-did'`
console.log(blockchainURL);
const provider = new HttpProvider(blockchainURL)
export const web3Instance = new Web3(provider)

web3Instance.eth.getBlock('latest').then(console.log)