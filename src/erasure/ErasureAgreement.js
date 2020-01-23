import { ethers } from "ethers";

import Abi from "../utils/Abi";
import IPFS from "../utils/IPFS";
import Crypto from "../utils/Crypto";
import Ethers from "../utils/Ethers";
import ErasurePost from "./ErasurePost";

import simpleContract from "../../artifacts/SimpleGriefing.json";
import countdownContract from "../../artifacts/CountdownGriefing.json";

class ErasureAgreement {
  #abi = null;
  #nmr = null;
  #type = "";
  #staker = null;
  #contract = null;
  #counterparty = null;
  #protocolVersion = "";
  #ethersProvider = null;
  #agreementAddress = null;

  /**
   * @param {Object} config
   * @param {('simple'|'countdown')} config.type
   * @param {address} config.staker
   * @param {address} config.counterparty
   * @param {Object} config.web3Provider
   * @param {string} config.protocolVersion
   * @param {address} config.agreementAddress
   */
  constructor({
    type,
    staker,
    counterparty,
    ethersProvider,
    protocolVersion,
    agreementAddress
  }) {
    this.#type = type;
    this.#staker = staker;
    this.#counterparty = counterparty;
    this.#ethersProvider = ethersProvider;
    this.#protocolVersion = protocolVersion;
    this.#agreementAddress = agreementAddress;

    if (type === "countdown") {
      this.#abi = countdownContract.abi;
    } else if (type === "simple") {
      this.#abi = simpleContract.abi;
    }

    this.#contract = new ethers.Contract(
      agreementAddress,
      this.#abi,
      Ethers.getWallet(this.#ethersProvider)
    );
  }

  /**
   * Access the web3 contract class
   *
   * @memberof ErasureAgreement
   * @method contract
   * @returns {Object} contract object
   */
  contract = () => {
    return this.#contract;
  };

  /**
   * Get the address of this agreement
   *
   * @memberof ErasureAgreement
   * @method address
   * @returns {address} address of the agreement
   */
  address = () => {
    return this.#agreementAddress;
  };

  /**
   *
   * Get the type of this agreement (simple | countdown)
   *
   * @memberof ErasureAgreement
   * @method type
   * @returns {('simple'|'countdown')} type of the agreement
   */
  type = () => {
    return this.#type;
  };

  /**
   *
   * Get the address of the staker of this agreement
   *
   * @memberof ErasureAgreement
   * @method staker
   * @returns {address} address of the staker
   */
  staker = () => {
    return this.#staker;
  };

  /**
   * Get the address of the counterparty of this agreement
   *
   * @memberof ErasureAgreement
   * @method counterparty
   * @returns {address} address of the counterparty
   */
  counterparty = () => {
    return this.#counterparty;
  };

  /**
   * Called by staker to increase the stake
   *
   * @memberof ErasureAgreement
   * @method stake
   * @param {string} amount - amount by which to increase the stake
   * @returns {Promise} transaction receipt
   */
  stake = async amount => {
    const operator = await Ethers.getAccount(this.#ethersProvider);
    if (Ethers.getAddress(operator) !== Ethers.getAddress(this.staker())) {
      throw new Error(`stake() can be called only by staker: ${this.staker()}`);
    }

    const tx = await this.contract().increaseStake(Ethers.parseEther(amount));
    return await tx.wait();
  };

  /**
   * Called by counterparty to increase the stake
   *
   * @memberof ErasureAgreement
   * @method reward
   * @param {string} amount - amount by which to increase the stake (in NMR)
   * @returns {Promise} transaction receipt
   */
  reward = async amount => {
    const operator = await Ethers.getAccount(this.#ethersProvider);
    if (
      Ethers.getAddress(operator) !== Ethers.getAddress(this.counterparty())
    ) {
      throw new Error(
        `reward() can be called only by counterparty: ${this.counterparty()}`
      );
    }

    const tx = await this.contract().increaseStake(Ethers.parseEther(amount));
    return await tx.wait();
  };

  /**
   * Called by counterparty to burn some stake
   *
   * @memberof ErasureAgreement
   * @method punish
   * @param {string} amount - punishment amount to burn from the stake (in NMR)
   * @param {string} message - message to indicate reason for the punishment
   * @returns {Promise} amount it cost to punish
   * @returns {Promise} transaction receipt
   */
  punish = async (amount, message) => {
    const operator = await Ethers.getAccount(this.#ethersProvider);
    if (
      Ethers.getAddress(operator) !== Ethers.getAddress(this.counterparty())
    ) {
      throw new Error(
        `punish() can be called only by counterparty: ${this.counterparty()}`
      );
    }

    const tx = await this.contract().punish(
      Ethers.parseEther(amount),
      Buffer.from(message)
    );
    const receipt = await tx.wait();

    const events = receipt.events.reduce((p, c) => {
      p[c.event] = c;
      return p;
    }, {});

    const cost = Ethers.formatEther(
      Abi.decode(
        ["address", "address", "uint256", "uint256", "bytes"],
        events.Griefed.data
      )[3]
    );

    return {
      cost,
      receipt
    };
  };

  /**
   * Called by counterparty to release the stake
   *
   * @memberof ErasureAgreement
   * @method release
   * @param {string} amount - amount to release from the stake (in NMR)
   * @returns {Promise} transaction receipt
   */
  release = async amount => {
    const tx = await this.contract().releaseStake(Ethers.parseEther(amount));
    return await tx.wait();
  };

  /**
   * Called by staker to start the countdown to withdraw the stake
   *
   * @memberof ErasureAgreement
   * @method requestWithdraw
   * @returns {Promise} deadline timestamp when withdraw will be available
   * @returns {Promise} transaction receipts
   */
  requestWithdraw = async () => {
    const operator = await Ethers.getAccount(this.#ethersProvider);
    if (Ethers.getAddress(operator) !== Ethers.getAddress(this.staker())) {
      throw new Error(
        `requestWithdraw() can be called only by staker: ${this.staker()}`
      );
    }

    const tx = await this.contract().startCountdown();
    const receipt = await tx.wait();

    const events = receipt.events.reduce((p, c) => {
      p[c.event] = c;
      return p;
    }, {});

    const deadline = Ethers.formatEther(
      Abi.decode(["uint256"], events.DeadlineSet.data)[0]
    );

    return {
      receipt,
      deadline
    };
  };

  /**
   * Called by staker to withdraw the stake
   *
   * @memberof ErasureAgreement
   * @method withdraw
   * @param {address} recipient
   * @returns {Promise} amount withdrawn
   * @returns {Promise} transaction receipt
   */
  withdraw = async recipient => {
    if (this.type() !== "countdown") {
      throw new Error("'withdraw' is supported only for countdown agreement");
    }

    const tx = await this.contract().retrieveStake(recipient);
    const receipt = await tx.wait();

    const events = receipt.events.reduce((p, c) => {
      p[c.event] = c;
      return p;
    }, {});

    const amountWithdrawn = Ethers.formatEther(
      Abi.decode(
        ["uint8", "address", "uint256", "uint256"],
        events.DepositDecreased.data
      )[2]
    );

    return {
      receipt,
      amountWithdrawn
    };
  };

  /**
   * Get the status of the agreement
   *
   * @memberof ErasureAgreement
   * @method checkStatus
   * @returns {Promise} object with all relevant data
   */
  checkStatus = async () => {
    return await this.contract().getAgreementStatus();
  };
}

export default ErasureAgreement;
