import { ethers } from "ethers";

import Ethers from "./Ethers";

import config from "../config.json";
import contracts from "../contracts.json";

const accountChange = function() {
  this.wallet = Ethers.getWallet();
  this.setContract(this.address);
};

const networkChange = function(network) {
  let address = null;
  if (network === "homestead" || network === "rinkeby") {
    address = Contract.getAddress(
      this.contractName,
      network,
      this.protocolVersion
    );
  }

  if (address) {
    this.network = network;
    this.setContract(address);
  }
};

class Contract {
  /**
   * Contract
   *
   * @constructor
   * @param {Object} config - configuration for Contract
   * @param {Object} config.abi - contract abi
   * @param {Object} [config.contractName] - new contract address
   * @param {Object} config.protocolVersion - erasure protocolVersion
   * @param {Object} [config.registry] - for running tests
   */
  constructor({ abi, contractName, protocolVersion, registry }) {
    this.abi = abi;
    this.wallet = Ethers.getWallet();
    this.contractName = contractName;
    this.protocolVersion = protocolVersion;

    const onAccountChange = accountChange.bind(this);
    const onNetworkChange = networkChange.bind(this);

    if (registry && Ethers.isAddress(registry[contractName])) {
      this.network = "rinkeby"; // for test purposes.
      this.setContract(registry[contractName]);
    } else {
      // Contract object will be created when we get the network.
      Ethers.getNetworkSync(onNetworkChange);

      // Listen for any metamask changes.
      if (typeof window !== "undefined" && window.ethereum !== undefined) {
        window.ethereum.on("networkChanged", function(networkId) {
          const network = Ethers.getNetworkName(networkId);
          onNetworkChange(network);
        });
        window.ethereum.on("accountsChanged", onAccountChange);
      }
    }
  }

  /**
   * Login to metamask
   *
   */
  async login() {
    if (typeof window !== "undefined" && window.ethereum !== undefined) {
      console.log("Logging you in");
      await window.ethereum.enable();

      const network = await Ethers.getProvider().getNetwork();

      if (network.name === "homestead" || network.name === "rinkeby") {
        networkChange.bind(this)(network);
      } else {
        throw new Error("Only mainnet and rinkeby networks are supported!");
      }
    } else if (process.env.NODE_ENV !== "test") {
      throw new Error("Metamask not detected!");
    }
  }

  /**
   * Creates a new ethers contract object
   *
   * @param {Object} abi - contract abi
   * @param {string} address - contract address
   * @returns {Object} this object
   */
  setContract(address) {
    if (address) {
      this.address = address;
      this.wallet = Ethers.getWallet();

      // NMR contract.
      if (this.abi.mainnet !== undefined) {
        if (this.abi[this.network] !== undefined) {
          this.contract = new ethers.Contract(
            address,
            this.abi[this.network],
            this.wallet
          );
        }
      } else {
        this.contract = new ethers.Contract(address, this.abi, this.wallet);
      }
    }
  }

  getAddress() {
    return this.address;
  }

  /**
   * Creates a new ethers contract object
   *
   * @param {Object} abi - contract abi
   * @param {string} address - contract address
   * @returns {Object} this object
   */
  newContract(abi, address) {
    return new ethers.Contract(address, abi, this.wallet);
  }

  /**
   * Retrieves the contract json artifact
   *
   * @param {string} contract - contract address
   * @param {string} network - eth network
   * @returns {Object} contract json artifact
   */
  static getAddress(contract, network, protocolVersion) {
    try {
      return contracts[protocolVersion][network][contract];
    } catch (err) {
      throw new Error("This network is not supported!");
    }
  }
}

export default Contract;
