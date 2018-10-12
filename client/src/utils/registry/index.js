import registryResolver, { bytes32toString, stringToBytes32 } from './resolver'
import EthrDID from './ethrDid'

import {
  REGISTRY,
  didRegistryInstance
} from './RegistryContract'

import { 
  attributeToHex,
  hexToAttribute,
  privateKeyToEthereumAddress,
  publicKeyToEthereumAddress
} from './formatting'

export {
  bytes32toString,
  stringToBytes32,
  registryResolver,
  EthrDID,
  REGISTRY,
  didRegistryInstance,
  attributeToHex,
  hexToAttribute,
  privateKeyToEthereumAddress,
  publicKeyToEthereumAddress
}