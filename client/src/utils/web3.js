import Web3  from  'web3'
import config from '../config/ethereum'

export function getRpcUrl(networkName, apiKey) {
  return `https://${networkName}.infura.io/${apiKey}`
}

// http://localhost:8545

export function getWeb3() {
  return new Web3(new Web3.providers.HttpProvider(getRpcUrl(config.network, config.infura.apiKeys.ethrDid)))
}
