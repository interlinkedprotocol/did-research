import React, { Component } from 'react';
import { fromWei } from 'ethjs-unit'
import { HDNode, Wallet } from 'ethers';
import bip39 from 'bip39';
import EthrDID from './utils/ethDid'
import resolve from 'did-resolver';
import { decodeJWT } from 'did-jwt'

import logo from './logo.png';
import './App.css';

import { ethInstance, etherscanBaseUrl } from './utils/connect'

class App extends Component {
  constructor(props){
    super (props)
    this.state = {
      roots: [],
      currentMnemonic: null,
      didDocument: null,
      didOwner: null,
      didBalance: null,
      derivationPath: `m/44'/60'/0'/0`,
      decodedJWT: null,
      verifiedJWT: null
    }
  }

  recoverHdWallet() {
    if(!this.mnemonic.value) return

    const mnemonic = this.mnemonic.value
    const masterNode = HDNode.fromMnemonic(mnemonic)

    this.setState(prevState => ({
      roots: [
        ...prevState.roots,
        { mnemonic, masterNode }
      ],
      currentMnemonic: mnemonic,
      didDocument: null,
      didOwner: null,
      didBalance: null
    }))
  }

  generateHdWallet() {
    const mnemonic = bip39.generateMnemonic()
    const masterNode = HDNode.fromMnemonic(mnemonic)

    this.setState(prevState => ({
      roots: [
        ...prevState.roots,
        { mnemonic, masterNode }
      ],
      currentMnemonic: mnemonic,
      didDocument: null,
      didOwner: null,
      didBalance: null
    }))
  }

  async deriveChildWallet() {
    const { currentMnemonic, roots, derivationPath } = this.state

    if(!currentMnemonic) return

    const currentRoot = roots.find(root => currentMnemonic === root.mnemonic)

    currentRoot.addressNodes = currentRoot.addressNodes || []
    currentRoot.currentAddressNode = currentRoot.masterNode.derivePath(`${derivationPath}/${currentRoot.addressNodes.length}`)
    currentRoot.currentAddressNode.txResults = []
    currentRoot.currentAddressNode.signedJWTs = []
    currentRoot.currentAddressNode.currentSignedJWT = null
    currentRoot.currentAddressNode.wallet = new Wallet(currentRoot.currentAddressNode.privateKey)
    currentRoot.currentAddressNode.ethrDid = this.buildEthrDid(currentRoot.currentAddressNode.wallet)
    currentRoot.addressNodes.push(currentRoot.currentAddressNode)

    try {
      const newDidOwner = await currentRoot.currentAddressNode.ethrDid.lookupOwner()
      const newDidDocument = await resolve(currentRoot.currentAddressNode.ethrDid.did)
      const newDidBalance = await ethInstance.getBalance(currentRoot.currentAddressNode.wallet.address, 'latest')

      this.setState(prevState => ({
        roots: prevState.roots.map(root => root.mnemonic === currentMnemonic ? currentRoot : root),
        didOwner: newDidOwner,
        didDocument: newDidDocument,
        didBalance: newDidBalance
      }))
    } catch (e) {
      throw e
    }

  }

  async selectMnemonic(selectedMnemonic) {
    const { currentMnemonic, roots } = this.state
    if (currentMnemonic === selectedMnemonic) return

    const selectedRoot = roots.find(root => root.mnemonic === selectedMnemonic)

    if(!selectedRoot.currentAddressNode){
      return this.setState({
        currentMnemonic: selectedMnemonic,
        didOwner: null,
        didDocument: null,
        didBalance: null
      })
    }

    try {
      const newDidOwner = await selectedRoot.currentAddressNode.ethrDid.lookupOwner()
      const newDidDocument = await resolve(selectedRoot.currentAddressNode.ethrDid.did)
      const newDidBalance = await ethInstance.getBalance(selectedRoot.currentAddressNode.wallet.address, 'latest')

      this.setState(prevState => ({
        currentMnemonic: selectedMnemonic,
        roots: prevState.roots.map(root => root.mnemonic === selectedMnemonic ? selectedRoot : root),
        didOwner: newDidOwner,
        didDocument: newDidDocument,
        didBalance: newDidBalance
      }))
    } catch (e) {
      throw e
    }
  }

  async selectAddress(selectedAddressNode) {
    const { currentMnemonic } = this.state

    const currentAddressNode = this.getCurrentAddressNode()

    if(currentAddressNode === selectedAddressNode) return

    try {
      const newDidOwner = await selectedAddressNode.ethrDid.lookupOwner()
      const newDidDocument = await resolve(selectedAddressNode.ethrDid.did)
      const newDidBalance = await ethInstance.getBalance(currentAddressNode.wallet.address, 'latest') 

      this.setState(prevState => ({
        roots: prevState.roots.map(root => {
          if(root.mnemonic === currentMnemonic) root.currentAddressNode = selectedAddressNode
          return root
        }),
        didOwner: newDidOwner,
        didDocument: newDidDocument,
        didBalance: newDidBalance
      }))
    } catch (e) {
      throw e
    }
  }

  did = address => `did:ethr:${address}`

  buildEthrDid = wallet => new EthrDID({
    address: wallet.address,
    privateKey: wallet.privateKey
  })

  async changeDidOwner() {
    const { currentMnemonic } = this.state
    const currentAddressNode = this.getCurrentAddressNode()

    if(!currentAddressNode || !this.newOwner.value) return

    try {
      const txResult = await currentAddressNode.ethrDid.changeOwner(this.newOwner.value)

      this.setState(prevState => ({
        roots: prevState.roots.map(root => {
          if(root.mnemonic === currentMnemonic) {
            root.currentAddressNode.txResults.push(txResult)
            root.addressNodes.map(addrNode => addrNode.privateKey === currentAddressNode.privateKey ? root.currentAddressNode : addrNode)
          }
          return root
        })
      }))
    } catch (err) {
      throw err
    }
  }

  async setAttribute() {
    const { currentMnemonic } = this.state
    const currentAddressNode = this.getCurrentAddressNode()

    if(!currentAddressNode || !this.attrKey.value || !this.attrKey.value) return

    try {
      const txResult = await currentAddressNode.ethrDid.setAttribute(this.attrKey.value, this.attrValue.value)

      this.setState(prevState => ({
        roots: prevState.roots.map(root => {
          if(root.mnemonic === currentMnemonic) {
            root.currentAddressNode.txResults.push(txResult)
            root.addressNodes.map(addrNode => addrNode.privateKey === currentAddressNode.privateKey ? root.currentAddressNode : addrNode)
          }
          return root
        })
      }))
    } catch (err) {
      throw err
    }
  }

  getCurrentAddressNode() {
    const { currentMnemonic, roots } = this.state

    const currentRoot = roots.find(root => root.mnemonic === currentMnemonic)
    return currentRoot && currentRoot.currentAddressNode
  }

  async signJWT() {
    const { currentMnemonic } = this.state

    const currentAddressNode = this.getCurrentAddressNode()
    if(!currentAddressNode || !this.rawJwt.value) return

    try {
      const signedJWT = await currentAddressNode.ethrDid.signJWT(this.rawJwt.value)

      this.setState(prevState => ({
        roots: prevState.roots.map(root => {
          if(root.mnemonic === currentMnemonic) {
            root.currentAddressNode.signedJWTs.push(signedJWT)
            root.currentAddressNode.currentSignedJWT = signedJWT
            root.addressNodes.map(addrNode => addrNode.privateKey === currentAddressNode.privateKey ? root.currentAddressNode : addrNode)
          }
          return root
        })
      }))
    } catch (err) {
      throw err
    }
  }

  async decodeJWT() {
    const currentAddressNode = this.getCurrentAddressNode()
    if(!currentAddressNode || !currentAddressNode.currentSignedJWT) return

    try {
      const decodedJWT = await decodeJWT(currentAddressNode.currentSignedJWT)
      this.setState({ decodedJWT })
    } catch (err) {
      throw err
    }
  }

  async verifyJWT() {
    const currentAddressNode = this.getCurrentAddressNode()
    if(!currentAddressNode || !currentAddressNode.currentSignedJWT) return

    try {
      const verifiedJWT = await currentAddressNode.ethrDid.verifyJWT(currentAddressNode.currentSignedJWT)
      this.setState({ verifiedJWT })
    }
    catch (err) {
      throw err
    }
  }

  selectSignedJWT(signedJWT) {
    const { currentMnemonic } = this.state

    const currentAddressNode = this.getCurrentAddressNode()
    if(!currentAddressNode || currentAddressNode.currentSignedJWT === signedJWT) return

    currentAddressNode.currentSignedJWT = signedJWT

    this.setState(prevState => ({
      roots: prevState.roots.map(root => {
        if(root.mnemonic === currentMnemonic) root.currentAddressNode = currentAddressNode
        return root
      })
    }))
  }

  checkTxStatusAndRender(status) {
    let el

    class StatusEl extends Component {
      constructor(props) {
        super(props)
        this.state = { status: '' }
      }
      render() {
        return (
          <span className={`${this.state.status === 'success' ? 'green' : 'red'}`}>{this.state.status}</span>
        )
      }
    }

    const StatusElement = <StatusEl ref={ref => {el = ref}}/>

    status.then(res => el.setState({status: 'success'}), err => el.setState({status: 'failed'}))
    return StatusElement
  }

  render() {
    const {
      currentMnemonic,
      roots,
      didOwner,
      didDocument,
      didBalance,
      decodedJWT,
      verifiedJWT
    } = this.state;

    const currentRoot = roots.find(root => root.mnemonic === currentMnemonic)
    const currentAddressNode = currentRoot && currentRoot.currentAddressNode

    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">DID demo</h1>
        </header>

        <div className="control">
          <input ref={el => this.mnemonic = el} type="text" />
          <button onClick={() => this.recoverHdWallet()}>Recover HD Wallet</button>
          <button onClick={ () => this.generateHdWallet() }>Generate HD Wallet</button>
          <button onClick={ () => this.deriveChildWallet() }>Derive new DID</button>
        </div>

        <div className="content">

          <div className="selected-mnemonic">
            <span>Selected Mnemonic:</span>
            <div className="mnemonic">{currentMnemonic || 'No Mnemonic selected'}</div>
          </div>

          <div className="selected-did">
            <span>Selected DID:</span>
            <div className="did">
              { currentAddressNode ? this.did(currentAddressNode.wallet.address) : 'No DID selected' }
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

            <div className="w-50 did-common">
              <div className="common-line title">DID</div>
              <div className="wrap">
                {
                  currentRoot && currentRoot.addressNodes && currentRoot.addressNodes.map(addressNode =>
                    <div
                      key={addressNode.wallet.address}
                      className={`did-item common-line ${addressNode === currentRoot.currentAddressNode ? 'selected' : ''}`}
                      onClick={() => this.selectAddress(addressNode)}>
                      {this.did(addressNode.wallet.address)}
                    </div>
                  )
                }
              </div>
            </div>
          </div>

        </div>

        <div className="content">
          <div className="did-common">
            <div className="common-line title">DID Document</div>
            <div className="wrap">
              { didDocument && <pre>{ JSON.stringify(didDocument, null, 2) }</pre> }
            </div>
          </div>
        </div>

        <div className="control">
          <button onClick={() => this.changeDidOwner()}>Change DID Owner</button>
          <input ref={el => this.newOwner = el} type="text" />

          <button onClick={() => this.setAttribute()}>Set DID Attribute</button>
          <input ref={el => this.attrKey = el} type="text" />
          <input ref={el => this.attrValue = el} type="text" />
        </div>

        <div className="content">
          <div className="did-common">
            <div className="common-line title">TX Hashes</div>
            <div className="wrap">
              {
                currentAddressNode && currentAddressNode.txResults.map(txResult =>
                  <div className="dflex did-item common-line" key={txResult.txHash}>
                    <a
                      href={`${etherscanBaseUrl}/${txResult.txHash}`}
                      target="_blank">
                      {txResult.txHash}
                    </a>
                    { this.checkTxStatusAndRender(txResult.txStatus) }
                  </div>
                )
              }
            </div>
          </div>
        </div>

        <div className="control">
          <button onClick={() => this.signJWT()}>Sign JWT</button>
          <input ref={el => this.rawJwt = el} type="text" />

          <button onClick={() => this.decodeJWT()}>Decode JWT</button>
          <button onClick={() => this.verifyJWT()}>Verify JWT</button>
        </div>

        <div className="content">
          <div className="selected-signedJWT">
            <span>Selected Signed JWT:</span>
            <div className="signedJWT">{ currentAddressNode && currentAddressNode.currentSignedJWT || 'No Signed JWT selected' }</div>
          </div>
          <div className="did-common">
            <div className="common-line title">Signed JWT</div>
            <div className="wrap">
              {
                currentAddressNode && currentAddressNode.signedJWTs.map(signedJWT =>
                  <div
                    key={signedJWT}
                    className={`node-mnemonics common-line ${currentAddressNode.currentSignedJWT === signedJWT ? 'selected' : ''}`}
                    onClick={ () => this.selectSignedJWT(signedJWT) }>
                    { signedJWT }
                  </div>
                )
              }
            </div>
          </div>
        </div>
        
        <div className="content">
          <div className="did-common">
            <div className="common-line title">Decoded JWT</div>
            <div className="wrap">
              { decodedJWT && <pre>{ JSON.stringify(decodedJWT, null, 2) }</pre> }
            </div>
          </div>
        </div>

        <div className="content">
          <div className="did-common">
            <div className="common-line title">Verified JWT</div>
            <div className="wrap">
              { verifiedJWT && <pre>{ JSON.stringify(verifiedJWT, null, 2) }</pre> }
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
