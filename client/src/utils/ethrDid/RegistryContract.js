import EthContract from 'ethjs-contract'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
// import { REGISTRY } from 'ethr-did-resolver'

import { ethInstance } from '../connect'

const REGISTRY = '0x7efe81ac780cf454c610ef12cb8e52dbb12a57de'
const DidRegistryContract = new EthContract(ethInstance)(DidRegistryABI)
export const didRegistryInstance = DidRegistryContract.at(REGISTRY)
