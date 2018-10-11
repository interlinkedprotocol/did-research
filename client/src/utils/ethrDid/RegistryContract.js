import EthContract from 'ethjs-contract'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
// import { REGISTRY } from 'ethr-did-resolver'

import { ethInstance } from '../connect'

const REGISTRY = '0xb4a20951974be9ec1ea54bb04b646f113f649b82'
const DidRegistryContract = new EthContract(ethInstance)(DidRegistryABI)
export const didRegistryInstance = DidRegistryContract.at(REGISTRY)
