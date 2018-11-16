import React, { Component, Fragment } from 'react'
import { startCase } from 'lodash'
import { HDNode } from 'ethers'
import bip39 from 'bip39'
import resolve from 'did-resolver'
import { decodeJWT } from 'did-jwt'
import { fromWei } from 'ethjs-unit'

import { ethInstance, etherscanBaseUrl } from './utils/connect'
import { EthrDID, bytes32toString, hexToAttribute, privateKeyToEthereumAddress  } from './utils/registry'
import { asyncForEach } from './utils/asyncForEach'
import { waitBlock } from './utils/transactions/waitBlock'
import { extractClaims, extractTimestamp, extractIssuerDid } from './utils/did-jwt'
import { getFormattedTime } from './utils/formatting'

import logo from './logo.svg';
import './App.css';

class App extends Component {
  constructor (props) {
    super (props)
    this.state = {
      derivationPath: `m/44'/60'/0'/0`,
      roots: [],
      currentMnemonic: null,
      didOwner: null,
      didDocument: null,
      didHistory: [],
      didBalance: null,
      inputDidJWT: null
    }
  }

  async execSendTxSequence(sendTxFunctions) {
    await asyncForEach(sendTxFunctions, async (sendTxFunction) => {
      const txResult = await sendTxFunction.func()
      txResult.txName = sendTxFunction.name    
      this.updateTxResults(txResult)

      txResult.txStatus = await waitBlock(txResult.txHash)
      this.updateTxResults(txResult)

      this.updateDidBalance()
    })
  }

  async updateDidBalance() {
    const currentAddressNode = this.getCurrentAddressNode()

    const newDidBalance = await ethInstance.getBalance(currentAddressNode.address, 'latest')

    this.setState(({
      didBalance: newDidBalance
    }))
  }

  getCurrentAddressNode() {
    const { currentMnemonic, roots } = this.state

    const currentRoot = roots.find(root => root.mnemonic === currentMnemonic)
    return currentRoot && currentRoot.currentAddressNode
  }

  recoverHdWallet() {
    if(!this.mnemonic.value) return

    const providedMnemonic = this.mnemonic.value
    const masterNode = HDNode.fromMnemonic(providedMnemonic)

    this.setState(prevState => ({
      currentMnemonic: providedMnemonic,
      roots: [ ...prevState.roots, { mnemonic: providedMnemonic, masterNode } ],
      didOwner: null,
      didDocument: null,
      didHistory: null,
      didBalance: null
    }))
  }

  generateHdWallet() {
    const generatedMnemonic = bip39.generateMnemonic()
    const masterNode = HDNode.fromMnemonic(generatedMnemonic)

    this.setState(prevState => ({
      currentMnemonic: generatedMnemonic,
      roots: [
        ...prevState.roots,
        { mnemonic: generatedMnemonic, masterNode }
      ],
      didOwner: null,
      didDocument: null,
      didHistory: null,
      didBalance: null
    }))
  }
//RICKY
handleSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  
  fetch('/api/form-submit-url', {
    method: 'POST',
    body: data,
  });
}//RICKY
  async deriveChildWallet() {
    const { currentMnemonic, roots, derivationPath } = this.state

    if(!currentMnemonic) return

    const currentRoot = roots.find(root => root.mnemonic === currentMnemonic)

    currentRoot.addressNodes = currentRoot.addressNodes || []
    currentRoot.currentAddressNode = currentRoot.masterNode.derivePath(`${derivationPath}/${currentRoot.addressNodes.length}`)
    currentRoot.currentAddressNode.address = privateKeyToEthereumAddress(currentRoot.currentAddressNode.privateKey)
    currentRoot.currentAddressNode.ethrDid = new EthrDID({ 
      privateKey: currentRoot.currentAddressNode.privateKey,
      address: currentRoot.currentAddressNode.address
    })
    currentRoot.currentAddressNode.txResults = []
    currentRoot.currentAddressNode.didJWTs = []
    currentRoot.currentAddressNode.currentDidJWT = null

    currentRoot.addressNodes.push(currentRoot.currentAddressNode)

    const newDidOwner = await currentRoot.currentAddressNode.ethrDid.lookupOwner()
    const newDidDocument = await resolve(currentRoot.currentAddressNode.ethrDid.did)
    const newDidHistory = await EthrDID.getDidEventHistory(currentRoot.currentAddressNode.address)
    const newDidBalance = await ethInstance.getBalance(currentRoot.currentAddressNode.address, 'latest')

    this.setState(prevState => ({
      roots: prevState.roots.map(root => root.mnemonic === currentMnemonic ? currentRoot : root),
      didOwner: newDidOwner,
      didDocument: newDidDocument,
      didHistory: newDidHistory,
      didBalance: newDidBalance
    }))
  }

  async selectMnemonic(selectedMnemonic) {
    const { currentMnemonic, roots } = this.state

    if (currentMnemonic === selectedMnemonic) return

    const selectedRoot = roots.find(root => root.mnemonic === selectedMnemonic)

    if(selectedRoot.currentAddressNode) {
      const newDidOwner = await selectedRoot.currentAddressNode.ethrDid.lookupOwner()
      const newDidDocument = await resolve(selectedRoot.currentAddressNode.ethrDid.did)
      const newDidHistory = await EthrDID.getDidEventHistory(selectedRoot.currentAddressNode.address)
      const newDidBalance = await ethInstance.getBalance(selectedRoot.currentAddressNode.address, 'latest')

      this.setState(prevState => ({
        currentMnemonic: selectedMnemonic,
        roots: prevState.roots.map(root => root.mnemonic === selectedMnemonic ? selectedRoot : root),
        didOwner: newDidOwner,
        didDocument: newDidDocument,
        didHistory: newDidHistory,
        didBalance: newDidBalance
      }))
    } else {
      this.setState(({
        currentMnemonic: selectedMnemonic,
        didOwner: null,
        didDocument: null,
        didHistory: null,
        didBalance: null
      }))
    }
  }

  async selectAddress(selectedAddressNode) {
    const { currentMnemonic } = this.state
    const currentAddressNode = this.getCurrentAddressNode()

    if (currentAddressNode === selectedAddressNode) return

    const newDidOwner = await selectedAddressNode.ethrDid.lookupOwner()
    const newDidDocument = await resolve(selectedAddressNode.ethrDid.did)
    const newDidHistory = await EthrDID.getDidEventHistory(selectedAddressNode.address)
    const newDidBalance = await ethInstance.getBalance(selectedAddressNode.address, 'latest')

    this.setState(prevState => ({
      roots: prevState.roots.map(root => {
        if(root.mnemonic === currentMnemonic) root.currentAddressNode = selectedAddressNode
        return root
      }),
      didOwner: newDidOwner,
      didDocument: newDidDocument,
      didHistory: newDidHistory,
      didBalance: newDidBalance
    }))
  }

  did = address => `did:ethr:${address}`

  updateTxResults (updatedTxResult) {
    const { currentMnemonic } = this.state
    const currentAddressNode = this.getCurrentAddressNode()

    this.setState(prevState => ({
      roots: prevState.roots.map(root => {
        if(root.mnemonic === currentMnemonic) {

          const existingTxResult = root.currentAddressNode.txResults.find(txResult => txResult.txHash === updatedTxResult.txHash)
          existingTxResult === undefined
            ? root.currentAddressNode.txResults.push(updatedTxResult)
            : root.currentAddressNode.txResults.map(txResult => 
              txResult.txHash === existingTxResult.txHash 
                ? updatedTxResult
                : txResult
            )

          root.addressNodes.map(addressNode => 
            addressNode.publicKey === currentAddressNode.publicKey 
              ? root.currentAddressNode
              : addressNode
          )
        }
        return root
      })
    }))
  }

  async changeDidOwner() {
    const currentAddressNode = this.getCurrentAddressNode()

    if(!currentAddressNode || !this.newOwner.value) return

    const rawTx = await currentAddressNode.ethrDid.changeOwnerTx(this.newOwner.value)
    const sendTxFunctions = await currentAddressNode.ethrDid.sendFundedTx(rawTx, 'changeDidOwner')
    await this.execSendTxSequence(sendTxFunctions)

    const newDidOwner = await currentAddressNode.ethrDid.lookupOwner()
    const newDidDocument = await resolve(currentAddressNode.ethrDid.did)
    const newDidHistory = await EthrDID.getDidEventHistory(currentAddressNode.address)

    this.setState(({
      didOwner: newDidOwner,
      didDocument: newDidDocument,
      didHistory: newDidHistory
    }))
  }

  async setAttribute() {
    const currentAddressNode = this.getCurrentAddressNode()

    if(!currentAddressNode || !this.attrKey.value || !this.attrKey.value) return

    const rawTx = await currentAddressNode.ethrDid.setAttributeTx(this.attrKey.value, this.attrValue.value)
    const sendTxFunctions = await currentAddressNode.ethrDid.sendFundedTx(rawTx, 'setAttribute')
    await this.execSendTxSequence(sendTxFunctions)

    const newDidDocument = await resolve(currentAddressNode.ethrDid.did)
    const newDidHistory = await EthrDID.getDidEventHistory(currentAddressNode.address)

    this.setState(({
      didDocument: newDidDocument,
      didHistory: newDidHistory
    }))
  }

  async addSigningDelegate() {
    const currentAddressNode = this.getCurrentAddressNode()

    const {rawTx} = await currentAddressNode.ethrDid.addSigningDelegateTx()
    const sendTxFunctions = await currentAddressNode.ethrDid.sendFundedTx(rawTx, 'addDelegate')
    await this.execSendTxSequence(sendTxFunctions)

    const newDidDocument = await resolve(currentAddressNode.ethrDid.did)
    const newDidHistory = await EthrDID.getDidEventHistory(currentAddressNode.address)

    this.setState(({
      didDocument: newDidDocument,
      didHistory: newDidHistory
    }))
  }

  selectSignedJWT (didJWT) {
    const { currentMnemonic } = this.state

    const currentAddressNode = this.getCurrentAddressNode()
    if(!currentAddressNode || currentAddressNode.currentDidJWT.token === didJWT.token) return

    currentAddressNode.currentDidJWT = didJWT

    this.setState(prevState => ({
      roots: prevState.roots.map(root => {
        if(root.mnemonic === currentMnemonic) root.currentAddressNode = currentAddressNode
        return root
      })
    }))
  }
  
  async signJWT() {
    const { currentMnemonic } = this.state

    const currentAddressNode = this.getCurrentAddressNode()
    if(!currentAddressNode || !this.rawJwt.value || !this.jwtLabel.value) return

    let didJWT = {}
    didJWT.label = this.jwtLabel.value
    didJWT.token = await currentAddressNode.ethrDid.signJWT(this.rawJwt.value)
    didJWT.decoded = await decodeJWT(didJWT.token)
    console.log('did-jwt content (decoded)', didJWT.decoded)
    didJWT.issueDate = getFormattedTime(extractTimestamp(didJWT.decoded))
    didJWT.issuer = extractIssuerDid(didJWT.decoded)
    didJWT.claims = extractClaims(didJWT.decoded)

    this.setState(prevState => ({
      roots: prevState.roots.map(root => {
        if(root.mnemonic === currentMnemonic) {
          root.currentAddressNode.didJWTs.push(didJWT)
          root.currentAddressNode.currentDidJWT = didJWT
          root.addressNodes.map(addrNode => addrNode.privateKey === currentAddressNode.privateKey ? root.currentAddressNode : addrNode)
        }
        return root
      })
    }))
  }

  async verifyJWT() {
    const currentAddressNode = this.getCurrentAddressNode()

    if(!currentAddressNode || !this.inputJwt.value) return

    let inputDidJWT = {}
    try {
      inputDidJWT.isValid = !!(await currentAddressNode.ethrDid.verifyJWT(this.inputJwt.value))
      inputDidJWT.decoded = await decodeJWT(this.inputJwt.value)
      console.log('did-jwt content (decoded)', inputDidJWT.decoded)
      inputDidJWT.issueDate = getFormattedTime(extractTimestamp(inputDidJWT.decoded))
      inputDidJWT.issuer = extractIssuerDid(inputDidJWT.decoded)
      inputDidJWT.claims = extractClaims(inputDidJWT.decoded)
    }
    catch(e) {
      console.log(e)
      inputDidJWT.isValid = false
      inputDidJWT.decoded = null
      inputDidJWT.issueDate = null
      inputDidJWT.issuer = null
      inputDidJWT.claims = null
    }

    this.setState({ inputDidJWT })
  }

  async verifySelectedJWT() {
    const { currentMnemonic } = this.state

    const currentAddressNode = this.getCurrentAddressNode()
    if(!currentAddressNode || !currentAddressNode.currentDidJWT) return

    const verifiedDidJWT = await currentAddressNode.ethrDid.verifyJWT(currentAddressNode.currentDidJWT.token)

    this.setState(prevState => ({
      roots: prevState.roots.map(root => {
        if(root.mnemonic === currentMnemonic) {
          root.currentAddressNode.currentDidJWT = { ...currentAddressNode.currentDidJWT, isValid: !!verifiedDidJWT }
          root.addressNodes.map(addressNode => 
            addressNode.publicKey === currentAddressNode.publicKey 
              ? root.currentAddressNode
              : addressNode
            )
        }
        return root
      })
    }))
  }

  render() {
    const {
      currentMnemonic,
      roots,
      didOwner,
      didDocument,
      didBalance,
      didHistory,
      inputDidJWT
    } = this.state;

    const currentRoot = roots.find(root => root.mnemonic === currentMnemonic)
    const currentAddressNode = currentRoot && currentRoot.currentAddressNode

    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">DID demo</h1>
        </header>
        <form onSubmit={this.handleSubmit}>
        <div className="control">
          <button onClick={ () => this.generateHdWallet() }>Generate HD Wallet</button>
          <button onClick={() => this.recoverHdWallet()}>Recover HD Wallet</button>
          <input ref={el => this.mnemonic = el} type="text" style={{ width:"800px" }} placeholder='Insert Mnemonic' defaultValue="maple leaf slender kite work lottery fashion joke box track want current" />
          <button onClick={ () => this.deriveChildWallet() }>Derive new DID</button>
        </div>

        <div className="control">
          <button onClick={() => this.setAttribute()}>Set DID Attribute</button>
          <input ref={el => this.attrKey = el} type="text" style={{ width:"600px" }} placeholder="Insert attribute key e.g. did/svc/example" defaultValue="did/svc/VehicleClaims" />
          <input ref={el => this.attrValue = el} type="text" style={{ width:"600px" }} placeholder="Insert attribute value e.g. https://example.com"  defaultValue="https://vehicle.claims.net" />
          <button onClick={() => this.changeDidOwner()}>Change DID Owner</button>
          <input ref={el => this.newOwner = el} type="text" style={{ width:"600px" }} placeholder="Insert DID of a new owner" />
        </div>

        <div className="content">

          <div className="selected-mnemonic">
            <span>Selected Mnemonic:</span>
            <div className="mnemonic">{currentMnemonic || 'No Mnemonic selected'}</div>
          </div>

          <div className="selected-did">
            <span>Selected DID:</span>
            <div className="did">
              { currentAddressNode ? this.did(currentAddressNode.address) : 'No DID selected' }
            </div>
          </div>

          <div className="selected-did-owner">
            <span>DID Owner:</span>
            <div className="did-owner">{ didOwner || 'No DID selected'}</div>
          </div>

          <div className="selected-did-balance">
            <span>DID Balance:</span>
            <div className="did-balance">
              { didBalance !== null && didBalance !== undefined ? `${fromWei(didBalance, 'ether')} Eth` : 'No DID selected' }
            </div>
          </div>

          <div className="mnemonic-did-content">

            <div className="w-50 did-common">
              <div className="common-line title">Mnemonic</div>
              <div className="wrap">
                {
                  roots.map(root =>
                    <div
                      key={root.mnemonic}
                      className={`mnemonic-item common-line ${root.mnemonic === currentMnemonic ? 'selected' : ''}`}
                      onClick={() => this.selectMnemonic(root.mnemonic)}>
                      {root.mnemonic}
                    </div>
                  )
                }
              </div>
            </div>

            <div className="w-25 did-common">
              <div className="common-line title">Wallet</div>
              <div className="wrap">
                {
                  currentRoot 
                  && currentRoot.addressNodes 
                  && currentRoot.addressNodes.map(addressNode =>
                    <div
                      key={addressNode.address}
                      className={`did-item common-line ${addressNode === currentRoot.currentAddressNode ? 'selected' : ''}`}
                      onClick={() => this.selectAddress(addressNode)}>
                      {addressNode.address}
                    </div>
                  )
                }
              </div>
            </div>

              <div className="w-25 did-common">
              <div className="common-line title">DID</div>
              <div className="wrap">
                {
                  currentRoot 
                  && currentRoot.addressNodes 
                  && currentRoot.addressNodes.map(addressNode =>
                    <div
                      key={addressNode.address}
                      className={`did-item common-line ${addressNode === currentRoot.currentAddressNode ? 'selected' : ''}`}
                      onClick={() => this.selectAddress(addressNode)}>
                      {this.did(addressNode.address)}
                    </div>
                  )
                }
              </div>
            </div>

          </div>

        </div>

        <div className="content">
          <div className="did-common">
            <div className="common-line title">DID document</div>
            <div className="wrap">
              { didDocument && <pre>{ JSON.stringify(didDocument, null, 2) }</pre> }
            </div>
          </div>
        </div>

        <div className="content">
          <div className="did-common">
            <div className="common-line title">DID audit trail</div>
            <div className="wrap">
              { 
                didHistory && didHistory.map(item => (
                  <div key={item.timestamp} className={`did-item common-line dflex`}>
                    <span className="m-r-10">{getFormattedTime(item.timestamp)}</span>
                    <span className="m-r-10">{item.event._eventName}</span>
                    {
                      item.event._eventName === 'DIDOwnerChanged'
                      && <span>{item.event.owner}</span>
                    }
                    {
                      item.event._eventName === 'DIDAttributeChanged'
                      && 
                        <Fragment>
                          <span className="m-r-10">{bytes32toString(item.event.name)}</span>
                          <span>{hexToAttribute(bytes32toString(item.event.name), item.event.value)}</span>
                        </Fragment>
                    }
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        <div className="content">
          <div className="did-common">
            <div className="common-line title">TX Hashes</div>
            <div className="wrap">
              {
                currentAddressNode && currentAddressNode.txResults.map(txResult =>
                  <div key={txResult.txHash} className="dflex jcsb did-item common-line">
                    <a
                      href={`${etherscanBaseUrl}/${txResult.txHash}`}
                      target="_blank">
                      {txResult.txHash}
                    </a>
                    <span>{startCase(txResult.txName)}</span>
                    { 
                      txResult.txStatus instanceof Promise 
                        ? <span className={'grey'}>{'Pending'}</span>
                        : <span className={`${txResult.txStatus ? 'green' : 'red'}`}>
                            {txResult.txStatus ? 'Success' : 'Failed'}
                          </span> 
                    }
                  </div>
                )
              }
            </div>
          </div>
        </div>

        <div className="control">
          <input ref={el => this.jwtLabel = el} type="text" style={{ width:"300px" }} placeholder="Insert label for your claim" defaultValue="Fuel level sensor"/>
          <input ref={el => this.rawJwt = el} type="text" style={{ width:"1500px" }} placeholder="Insert your claim" defaultValue='{ "created at": "08/10/2018 09:12:15", "created by": "did:ethr:0x1b94b563f3863e3cfff873fbcc8177d9c00057b7" }'/>
          <button onClick={() => this.signJWT()}>Sign Claim</button>
          <button onClick={() => this.verifySelectedJWT()}>Verify Selected Claim</button>
        </div>

        <div className="content">

          <div className="selected-signedJWT">
            <span>Selected Claim (which is represented by DID JSON Web Token):</span>
            <div className="signedJWT" style={{flex: 1, flexWrap: 'wrap'}}>
              { 
                (
                  currentAddressNode
                  && currentAddressNode.currentDidJWT 
                  && currentAddressNode.currentDidJWT.token
                )
                  ? currentAddressNode.currentDidJWT.token
                  : 'No selected claim' 
              }
            </div>
          </div>

          <div className="did-common">
            <div className="common-line title">Claim</div>
            <div className="wrap">
              {
                currentAddressNode 
                && currentAddressNode.currentDidJWT
                &&
                  <div
                    key='claims' 
                    className={
                      `
                        ${currentAddressNode.currentDidJWT.isValid === undefined 
                          ? 'background-lightgrey'
                          : currentAddressNode.currentDidJWT.isValid 
                            ? 'background-lightgreen' 
                            : 'background-lightcoral'
                        }
                      `
                    }
                  >
                    { 
                      currentAddressNode 
                      && currentAddressNode.currentDidJWT
                      && currentAddressNode.currentDidJWT.claims
                      && <pre>{ JSON.stringify(currentAddressNode.currentDidJWT.claims, null, 2) }</pre>
                    }
                  </div>
              }
            </div>
          </div>

          <div className="did-common">
            <div className="common-line title">Claim Label / Issue Date / Issuer DID </div>
            <div className="wrap">
              {
                currentAddressNode && currentAddressNode.didJWTs.map(didJWT =>
                  <div
                    key={didJWT.token}
                    className={
                      `
                        dflex jcsb did-item common-line 
                        ${currentAddressNode.currentDidJWT.token === didJWT.token ? 'selected' : ''} 
                      `
                    }
                    onClick={ () => this.selectSignedJWT(didJWT) }>
                    {
                      <Fragment>
                        <span className="m-r-10">{didJWT.label}</span>
                        <span className="m-r-10">{didJWT.issueDate}</span>
                        <span className="m-r-10">{didJWT.issuer}</span>
                      </Fragment>
                    }
                  </div>
                )
              }
            </div>
          </div>

        </div>

        <div className="content">
        
          <div className="control">
            <div className={
                `
                  control ${inputDidJWT === null || inputDidJWT.isValid === null
                    ? 'background-lightgrey'
                    : inputDidJWT.isValid
                      ? 'background-lightgreen' 
                      : 'background-lightcoral'
                  }
                `
              }
            >
              <input ref={el => this.inputJwt = el} type="text" style={{ width:"2200px" }} placeholder='Insert DID JWT (Json Web Token)' />
              <button onClick={() => this.verifyJWT()}>Verify Claim</button>
            </div>
          </div>

          <div className="did-common">
            <div className="common-line title">Claim</div>
            <div className="wrap">
              {
                inputDidJWT !== null 
                && inputDidJWT.isValid
                && 
                    <div key='claims' className={'dflex jcsb did-item common-line selected'}>
                      {<pre>{ JSON.stringify(inputDidJWT.claims, null, 2) }</pre>}
                    </div>
              }
            </div>
          </div>

          <div className="did-common">
            <div className="common-line title">Issue Date / Issuer DID </div>
            <div className="wrap">
              {
                inputDidJWT !== null 
                && inputDidJWT.isValid 
                &&
                  <div key={inputDidJWT.token} className={`dflex jcsb did-item common-line selected`}>
                    {
                      <Fragment>
                        <span className="m-r-10">{inputDidJWT.issueDate}</span>
                        <span className="m-r-10">{inputDidJWT.issuer}</span>
                      </Fragment>
                    }
                  </div>
              }
            </div>
          </div>

        </div>
        <button> send data</button>
</form>
      </div>
    );
  }
}

export default App;
