import EthContract from 'ethjs-contract'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
import { REGISTRY } from 'ethr-did-resolver'

import { ethInstance } from '../connect'

const DidRegistryContract = new EthContract(ethInstance)(DidRegistryABI)
export const didRegistryInstance = DidRegistryContract.at(REGISTRY)
