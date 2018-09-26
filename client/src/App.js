import React, { Component } from 'react';
import bip39 from 'bip39';
import { HDNode, Wallet } from 'ethers';
import logo from './logo.png';
import './App.css';
import resolve from "did-resolver";
import EthrDID from "ethr-did";
import { decodeJWT, verifyJWT } from 'did-jwt'

import config from './config/ethereum'
import { getRpcUrl } from './utils/web3'

import resolver from 'ethr-did-resolver'
resolver()

const rpcUrl = getRpcUrl(config.network, config.infura.apiKeys.ethrDid)

const derivationPath = `m/44'/60'/0'/0'`

class App extends Component {
  constructor(props){
    super (props)
    this.state = {
      roots: [],
      currentMnemonic: null,
      didDocument: null,
      didOwner: null,
      txHashes: [],
      rawJWTs: [],
      signedJWTs: [],
      currentSignedJWT: null,
      decodedJWT: null,
      verifiedJWTs: null,
    }
  }

  ///////////////
  /// Actions ///
  ///////////////

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
    const { currentMnemonic, roots } = this.state

    if(!currentMnemonic) return

    const updatedRootsPromisses = roots.map(async (root) => {
      if (root.mnemonic === currentMnemonic) {
        root.addressNodes = root.addressNodes || []

        root.currentAddressNode = root.masterNode.derivePath(`${derivationPath}/${root.addressNodes.length}`)
        root.currentAddressNode.wallet = this.buildWallet(root.currentAddressNode)

        root.addressNodes.push(root.currentAddressNode)

        await Promise.all([
          this.lookupDidOwner(root.currentAddressNode),
          this.resolveDidDocument(root.currentAddressNode)
        ])
      }
      return root
    })

    const updatedRoots = await Promise.all(updatedRootsPromisses) 

    this.setState({ roots: updatedRoots })
  }

  async selectMnemonic(selectedMnemonic, isSelected) {
    if (isSelected) return

    this.setState({ currentMnemonic: selectedMnemonic })

    const { roots } = this.state

    const selectedRoot = roots.find(root => root.mnemonic === selectedMnemonic)

    if (selectedRoot.currentAddressNode) {
      await Promise.all([
        this.lookupDidOwner(selectedRoot.currentAddressNode),
        this.resolveDidDocument(selectedRoot.currentAddressNode)
      ])
    }
    else { 
      this.setState({ didOwner: null, didDocument: null })
    }
  }

  async selectAddress(selectedAddressNode, isSelected) {
    const { currentMnemonic, roots } = this.state

    let currentAddressNodeUpdate

    const updatedRoots = roots.reduce((res, root) => {
      return root.mnemonic !== currentMnemonic || isSelected
        ? [ ...res, root ]
        : [ ...res, {
              ...root, 
              currentAddressNode: (currentAddressNodeUpdate = selectedAddressNode)
            } 
          ]
    }, [])

    this.setState({ roots: updatedRoots })

    if (currentAddressNodeUpdate) {
      await Promise.all([
        this.resolveDidDocument(currentAddressNodeUpdate),
        this.lookupDidOwner(currentAddressNodeUpdate)
      ])
    }
  }

  //////////////////
  /// DID method ///
  //////////////////

  buildDid(address) {
    return `did:ethr:${address}`
  }

  //////////////////////
  /// Ethers library ///
  //////////////////////

  buildWallet(addressNode) { 
    return new Wallet(addressNode.privateKey)
  }

  ////////////////////////
  /// Ethr DiD library ///
  ////////////////////////

  buildEthrDid(addressNode) {
    const wallet = this.buildWallet(addressNode)

    return new EthrDID({
      rpcUrl,
      address: wallet.address,
      privateKey: wallet.privateKey
    })
  }

  async resolveDidDocument(addressNode) {
    let didDocument
    try {
      const ethrDid = this.buildEthrDid(addressNode)
      didDocument = await resolve(ethrDid.did)
    }
    catch (err) {
      didDocument = err
    }
    finally {
      this.setState({ didDocument })
    }
  }

  async lookupDidOwner(addressNode) {
    if(!addressNode) return

    let didOwner
    try {
      const ethrDid = this.buildEthrDid(addressNode)
      didOwner = await ethrDid.lookupOwner()
    }
    catch (err) {
      didOwner = err
    }
    finally {
      this.setState({ didOwner })
    }
  }

  async changeDidOwner(addressNode) {
    if(!addressNode || !this.newOwner.value) return

    let txHash
    try {
      const ethrDid = this.buildEthrDid(addressNode)
      txHash = await ethrDid.changeOwner(this.newOwner.value)
    }
    catch (err) {
      txHash = err
    }
    finally {
      this.setState(prevState => ({ txHashes: [ ...prevState.txHashes, txHash ] }))
    }
  }

  async setAttribute(addressNode) {
    if(!addressNode || !this.attrKey.value || !this.attrValue.value) return

    let txHash
    try {
      const ethrDid = this.buildEthrDid(addressNode)
      txHash = ethrDid.setAttribute(this.attrKey.value, this.attrValue.value)
    }
    catch (err) {
      txHash = err
    }
    finally {
      this.setState(prevState => ({ txHashes: [ ...prevState.txHashes, txHash ] }))
    }
  }

  async signJWT(addressNode) {
    if(!addressNode || !this.rawJwt.value) return

    let signedJWT
    try {
      const ethrDid = this.buildEthrDid(addressNode)
      signedJWT = await ethrDid.signJWT(this.rawJwt.value)
    }
    catch (err) {
      signedJWT = err
    }
    finally {
      this.setState(prevState => ({ 
        signedJWTs: [ ...prevState.signedJWTs, signedJWT ],
        currentSignedJWT: signedJWT
      }))
    }
  }

  async decodeJWT(currentSignedJWT) {
    if (!currentSignedJWT) return

    let decodedJWT
    try {
      decodedJWT = await decodeJWT(currentSignedJWT)
    }
    catch (err) {
      decodedJWT = err
    }
    finally {
      this.setState({ decodedJWT })
    }
  }

  async verifyJWT(currentSignedJWT, addressNode) {
    if(!currentSignedJWT) return

    let payload, issuer
    payload, issuer = await verifyJWT(currentSignedJWT)

    try {
    // const ethrDid = this.buildEthrDid(addressNode)
    // payload, issuer = await ethrDid.verifyJWT(currentSignedJWT)
    // payload, issuer = await verifyJWT(currentSignedJWT)
    }
    catch (err) {
      payload = err
      issuer = null
    }
    finally {
      this.setState({ verifiedJWT: { payload, issuer } })
    }
  }

  selectSignedJWT(selectedSignedJWT, isSelected) {
    if (isSelected) return

    this.setState({ currentSignedJWT: selectedSignedJWT })
  }

  //////////////
  /// Render ///
  //////////////

  renderMnemonic(mnemonic, isSelected) {
    return (
      <div
        className={ `mnemonic-item common-line ${isSelected && 'selected'}` }
        onClick={ () => this.selectMnemonic(mnemonic, isSelected) }
        key={ mnemonic }>
        { mnemonic }
      </div>
    )
  }

  renderDid(addressNode, isSelected) {
    return (
      <div
        className={ `did-item common-line ${isSelected && 'selected'}` }
        onClick={ () => this.selectAddress(addressNode, isSelected) }
        key={ addressNode.wallet.address }>
        { this.buildDid(addressNode.wallet.address) }
      </div>
    )
  }

  renderSignedJWT(jwt, isSelected) {
    return (
      <div
        className={ `node-mnemonics common-line ${isSelected && 'selected'}` }
        onClick={ () => this.selectSignedJWT(jwt, isSelected) }
        key={ jwt }>
        { jwt }
      </div>
    )
  }

  renderJSON(json) {
    return (
      <pre>{ JSON.stringify(json, null, 2) }</pre>
    )
  }

  render() {
    const {
      currentMnemonic,
      roots,
      didOwner,
      didDocument,
      txHashes,
      signedJWTs,
      currentSignedJWT,
      decodedJWT,
      verifiedJWT
    } = this.state;

    const currentRoot = roots.find(root => root.mnemonic === currentMnemonic)
    const currentAddressNode = currentRoot ? currentRoot.currentAddressNode : undefined

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
              {
                currentAddressNode
                && this.buildDid(currentAddressNode.wallet.address)
                || 'No DID selected'
              }
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
                  roots.map(root => this.renderMnemonic(root.mnemonic, (root.mnemonic === currentMnemonic))) 
                }
              </div>
            </div>
            <div className="did-list did-common">
              <div className="common-line title">DID</div>
              <div className="wrap">
                {
                  currentRoot
                  && currentRoot.addressNodes
                  && currentRoot.addressNodes.map(
                    addressNode => this.renderDid(addressNode, (addressNode === currentRoot.currentAddressNode))
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
              { 
                didDocument && this.renderJSON(didDocument) 
              }
            </div>
          </div>
        </div>

        <div className="control">
          <button onClick={ () => this.changeDidOwner(currentAddressNode) }>Change DID Owner</button>
          <input ref={ el => this.newOwner = el } type="text" />

          <button onClick={ () => this.setAttribute(currentAddressNode) }>Set DID Attribute</button>
          <input ref={ el => this.attrKey = el } type="text" />
          <input ref={ el => this.attrValue = el } type="text" />
        </div>

        <div className="control">
          <button onClick={ () => this.signJWT(currentAddressNode) }>Sign JWT</button>
          <input ref={ el => this.rawJwt = el } type="text" />

          <button onClick={ () => this.decodeJWT(currentSignedJWT) }>Decode JWT</button>
          <button onClick={ () => this.verifyJWT(currentSignedJWT, currentAddressNode) }>Verify JWT</button>
        </div>

        <div className="content">
          <div className="selected-signedJWT">
            <span>Selected Signed JWT:</span>
            <div className="signedJWT">{ currentSignedJWT || 'No Signed JWT selected' }</div>
          </div>
          <div className="jwt-signed">
            <div className="jwt-list did-common">
              <div className="common-line title">Signed JWT</div>
              <div className="wrap">
                { 
                  signedJWTs.map(signedJWT => this.renderSignedJWT(signedJWT, (signedJWT === currentSignedJWT))) 
                }
              </div>
            </div>
          </div>
        </div>
        
        <div className="content">
          <div className="jwt-decoded did-common">
            <div className="common-line title">Decoded JWT</div>
            <div className="wrap">
              {
                decodedJWT && this.renderJSON(decodedJWT)
              }
            </div>
          </div>
        </div>

        <div className="content">
          <div className="jwt-verified did-common">
            <div className="common-line title">Verified JWT</div>
            <div className="wrap">
              { 
                verifiedJWT && this.renderJSON(verifiedJWT)
              }
            </div>
          </div>
        </div>
        
        <div className="content">
          <div className="tx-hash did-common">
            <div className="tx-hash-list did-common">
              <div className="common-line title">Tx Hashes</div>
              <div className="wrap">
                { 
                  txHashes.map(txHash => this.renderJSON(txHash)) 
                }
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }
}

export default App;
