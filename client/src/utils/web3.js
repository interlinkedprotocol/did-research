import Web3  from  'web3'
import HttpProvider from 'ethjs-provider-http'

const blockchainURL = `http://${process.env.REACT_APP_BLOCKCHAIN_PORT}:${process.env.REACT_APP_BLOCKCHAIN_PORT}`
const provider = new HttpProvider(blockchainURL)
export const web3Instance = new Web3(provider)

