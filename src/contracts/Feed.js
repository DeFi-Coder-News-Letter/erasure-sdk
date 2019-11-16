import bs58 from "bs58";
import CryptoIPFS from "@erasure/crypto-ipfs";

import IPFS from "../utils/IPFS";
import Contract from "../utils/Contract";

import contract from "../../artifacts/Feed.json";

class Feed {
  constructor({ network, web3 }) {
    this.web3 = web3;
    this.network = network;

    this.contract = new Contract({
      network,
      web3,
      abi: contract.abi,
      contract: "Feed"
    });
  }

  setAddress(address) {
    this.contract = this.contract.setContract(contract.abi, address);
  }

  async createPost(ipfsHash, opts) {
    const postFactory = Contract.getAddress("Post_Factory", this.network);
    if (!this.web3.utils.isAddress(postFactory)) {
      throw new Error(`PostFactory ${postFactory} is not an address`);
    }

    const accounts = await this.web3.eth.getAccounts();

    const optsIpfsHash = await IPFS.add(JSON.stringify(opts));

    const initData = this.web3.eth.abi.encodeParameters(
      ["address", "bytes", "bytes", "bytes"],
      [
        accounts[0],
        `0x${bs58.decode(ipfsHash).toString("hex")}`,
        `0x${bs58.decode(optsIpfsHash).toString("hex")}`, // static metadata
        `0x${bs58.decode(optsIpfsHash).toString("hex")}` // variable metadata
      ]
    );

    // Creates a post contract.
    const txReceipt = await this.contract.invokeFn(
      "createPost",
      true,
      postFactory,
      initData
    );

    return {
      ipfsHash,
      address: txReceipt.logs[0].address,
      txHash: txReceipt.logs[0].transactionHash
    };
  }

  async getPosts() {
    try {
      return await this.contract.invokeFn("getPosts", false);
    } catch (err) {
      throw err;
    }
  }
}

export default Feed;
