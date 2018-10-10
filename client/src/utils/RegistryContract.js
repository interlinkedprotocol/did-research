import EthContract from 'ethjs-contract'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
// import { REGISTRY } from 'ethr-did-resolver'

import { ethInstance } from './connect'
export const REGISTRY = '0x7797c955f91f985b249103d7038e21b3412e72e2'


const DidRegistryContract = new EthContract(ethInstance)(DidRegistryABI)
export const didRegistryInstance = DidRegistryContract.at(REGISTRY)
