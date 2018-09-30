import React, { Component } from 'react';
import bip39 from 'bip39';
import { HDNode, Wallet } from 'ethers';
import resolve from "did-resolver";
import EthrDID from "ethr-did";
import { decodeJWT } from 'did-jwt'
import logo from './logo.png';
import './App.css';

import { web3Instance } from './utils/web3'


class App extends Component {
  constructor(props){
    super (props)
    this.state = {
      roots: [],
      currentMnemonic: null,
      didDocument: null,
      didOwner: null,
      derivationPath: `m/44'/60'/0'/0`,
      decodedJWT: null,
      verifiedJWT: null
    }
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
      didOwner: null
    }))
  }

  async deriveChildWallet() {
    const { currentMnemonic, roots, derivationPath } = this.state

    if(!currentMnemonic) return

    const currentRoot = roots.find(root => currentMnemonic === root.mnemonic)

    currentRoot.addressNodes = currentRoot.addressNodes || []
    currentRoot.currentAddressNode = currentRoot.masterNode.derivePath(`${derivationPath}/${currentRoot.addressNodes.length}`)
    currentRoot.currentAddressNode.txHashes = []
    currentRoot.currentAddressNode.signedJWTs = []
    currentRoot.currentAddressNode.currentSignedJWT = null
    currentRoot.currentAddressNode.wallet = this.buildWallet(currentRoot.currentAddressNode)
    currentRoot.currentAddressNode.ethrDid = this.buildEthrDid(currentRoot.currentAddressNode.wallet)
    currentRoot.addressNodes.push(currentRoot.currentAddressNode)

    try {
      const newDidOwner = await currentRoot.currentAddressNode.ethrDid.lookupOwner()
      const newDidDocument = await resolve(currentRoot.currentAddressNode.ethrDid.did)

      this.setState(prevState => ({
        roots: prevState.roots.map(root => root.mnemonic === currentMnemonic ? currentRoot : root),
        didOwner: newDidOwner,
        didDocument: newDidDocument
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
        didDocument: null
      })
    }

    try {
      const newDidOwner = await selectedRoot.currentAddressNode.ethrDid.lookupOwner()
      const newDidDocument = await resolve(selectedRoot.currentAddressNode.ethrDid.did)

      this.setState(prevState => ({
        currentMnemonic: selectedMnemonic,
        roots: prevState.roots.map(root => root.mnemonic === selectedMnemonic ? selectedRoot : root),
        didOwner: newDidOwner,
        didDocument: newDidDocument
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

      this.setState(prevState => ({
        roots: prevState.roots.map(root => {
          if(root.mnemonic === currentMnemonic) root.currentAddressNode = selectedAddressNode
          return root
        }),
        didOwner: newDidOwner,
        didDocument: newDidDocument
      }))
    } catch (e) {
      throw e
    }
  }

  buildDid = address => `did:ethr:${address}`

  buildWallet = addressNode => new Wallet(addressNode.privateKey)

  buildEthrDid = wallet => new EthrDID({
    web3: web3Instance,
    address: wallet.address,
    privateKey: wallet.privateKey
  })

  async changeDidOwner() {
    const { currentMnemonic } = this.state
    const currentAddressNode = this.getCurrentAddressNode()

    if(!currentAddressNode || !this.newOwner.value) return

    try {
      const txHash = await currentAddressNode.ethrDid.changeOwner(this.newOwner.value)

      this.setState(prevState => ({
        roots: prevState.roots.map(root => {
          if(root.mnemonic === currentMnemonic) {
            root.currentAddressNode.txHashes.push(txHash)
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
      const txHash = await currentAddressNode.ethrDid.setAttribute(this.attrKey.value, this.attrValue.value)

      this.setState(prevState => ({
        roots: prevState.roots.map(root => {
          if(root.mnemonic === currentMnemonic) {
            root.currentAddressNode.txHashes.push(txHash)
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

  render() {
    const {
      currentMnemonic,
      roots,
      didOwner,
      didDocument,
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
              { currentAddressNode ? this.buildDid(currentAddressNode.wallet.address) : 'No DID selected' }
            </div>
          </div>

          <div className="selected-did-owner">
            <span>DID Owner:</span>
            <div className="did-owner">{ didOwner || 'No DID selected'}</div>
          </div>

          <div className="mnemonic-did-content">

            <div className="mnemonic-list did-common">
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

            <div className="did-list did-common">
              <div className="common-line title">DID</div>
              <div className="wrap">
                {
                  currentRoot && currentRoot.addressNodes && currentRoot.addressNodes.map(addressNode =>
                    <div
                      key={addressNode.wallet.address}
                      className={`did-item common-line ${addressNode === currentRoot.currentAddressNode ? 'selected' : ''}`}
                      onClick={() => this.selectAddress(addressNode)}>
                      {this.buildDid(addressNode.wallet.address)}
                    </div>
                  )
                }
              </div>
            </div>
          </div>

        </div>

        <div className="content">
          <div className="did-document did-common">
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
          <div className="jwt-signed">
            <div className="jwt-list did-common">
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
        </div>
        
        <div className="content">
          <div className="jwt-decoded did-common">
            <div className="common-line title">Decoded JWT</div>
            <div className="wrap">
              { decodedJWT && <pre>{ JSON.stringify(decodedJWT, null, 2) }</pre> }
            </div>
          </div>
        </div>

        <div className="content">
          <div className="jwt-verified did-common">
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
