import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { privateToAddress, pubToAddress } from 'ethereumjs-util'


export function attributeToHex (key, value) {
  if (Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`
  }
  const match = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)
  if (match) {
    const section = match[1]
    const encoding = match[6]
    switch (section) {
      case 'pub':
      case 'auth':
        switch (encoding) {
          case 'hex':
            return value
          case 'base64':
            return `0x${Buffer.from(value, 'base64').toString('hex')}`
          case 'base58':
            return bs58.encode(new Buffer(value, 'hex'))
          default:
            return value
        }
      case 'svc':
        return `0x${Buffer.from(value).toString('hex')}`
      default:
        throw new Error(`DID document section '${section}' is not defined`)
    }
  }
  if (value.match(/^0x[0-9a-fA-F]*$/)) {
    return value
  }
  return `0x${Buffer.from(value).toString('hex')}`
}

export function hexToAttribute (key, value) {
  const match = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)
  if (match) {
    const section = match[1]
    const encoding = match[6]

    if (!value.match(/^0x[0-9a-fA-F]*$/)) throw new Error(`Provided value '${value}' is invalid HEX`)

    switch (section) {
      case 'pub':
      case 'auth': {
        switch (encoding) {
          case 'hex':
            return value.slice(2)
          case 'base64':
            return Buffer.from(value.slice(2), 'hex').toString('base64')
          case 'base58':
            return bs58.decode(value)
          default:
            return value
        }
      }
      case 'svc': {
        return Buffer.from(value.slice(2), 'hex').toString()
      }
      default:
        throw new Error(`DID document section '${section}' is not defined`)
    }
  }
  return value
}

export const privateKeyToEthereumAddress = privateKey => `0x${privateToAddress(privateKey).toString('hex')}`

export const publicKeyToEthereumAddress = (publicKey) => `0x${pubToAddress(publicKey).toString('hex')}`
