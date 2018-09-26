import React, { Component } from 'react';
import bip39 from 'bip39';
import { HDNode, Wallet } from 'ethers';
import resolve from "did-resolver";
import EthrDID from "ethr-did";
import { decodeJWT, verifyJWT } from 'did-jwt'

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

      txHashes: [],
      rawJWTs: [],
      signedJWTs: [],
      currentSignedJWT: null,
      decodedJWT: null,
      verifiedJWTs: null,
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
    currentRoot.currentAddressNode.wallet = this.buildWallet(currentRoot.currentAddressNode)
    currentRoot.addressNodes.push(currentRoot.currentAddressNode)

    try {
      const newDidOwner = await this.lookupDidOwner(currentRoot.currentAddressNode)
      const newDidDocument = await this.resolveDidDocument(currentRoot.currentAddressNode)

      this.setState(prevState => ({
        roots: prevState.map(root => root.mnemonic === currentMnemonic ? currentRoot : root),
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
      const newDidOwner = await this.lookupDidOwner(selectedRoot.currentAddressNode)
      const newDidDocument = await this.resolveDidDocument(selectedRoot.currentAddressNode)

      this.setState(prevState => ({
        currentMnemonic: selectedMnemonic,
        roots: prevState.map(root => root.mnemonic === selectedMnemonic ? selectedRoot : root),
        didOwner: newDidOwner,
        didDocument: newDidDocument
      }))
    } catch (e) {
      throw e
    }
  }

  async selectAddress(selectedAddressNode) {
    const { currentMnemonic, roots } = this.state

    const currentRoot = roots.find(root => currentMnemonic === root.mnemonic)

    if(currentRoot.currentAddressNode === selectedAddressNode) return

    try {
      const newDidOwner = await this.lookupDidOwner(selectedAddressNode)
      const newDidDocument = await this.resolveDidDocument(selectedAddressNode)

      this.setState(prevState => ({
        roots: prevState.map(root => {
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

  buildEthrDid(addressNode) {
    const wallet = new Wallet(addressNode.privateKey)

    return new EthrDID({
      web3: web3Instance,
      address: wallet.address,
      privateKey: wallet.privateKey
    })
  }

  async resolveDidDocument(addressNode) {
    const ethrDid = this.buildEthrDid(addressNode)
    try {
      return await resolve(ethrDid.did)
    } catch (e) {
      throw e
    }
  }

  async lookupDidOwner(addressNode) {
    const ethrDid = this.buildEthrDid(addressNode)
    try {
      return await ethrDid.lookupOwner()
    } catch (e) {
      throw e
    }
  }



  // to continue
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
