import EthContract from 'ethjs-contract'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
// import { REGISTRY } from 'ethr-did-resolver'

import { ethInstance } from '../connect'

export const REGISTRY = '0xf8fffe208c2a2140c12eb1d152ad994a2c0cd292'
export const didRegistryInstance = new EthContract(ethInstance)(DidRegistryABI).at(REGISTRY)
