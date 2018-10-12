import EthContract from 'ethjs-contract'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
// import { REGISTRY } from 'ethr-did-resolver'

import { ethInstance } from '../connect'

export const REGISTRY = '0x58a575d85afc18912ee1bdb1353871631dcdfa81'
export const didRegistryInstance = new EthContract(ethInstance)(DidRegistryABI).at(REGISTRY)
