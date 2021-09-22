import Validator from "@lib/utils/validator";
import {
  base64Encode,
} from "@lib/privacy/utils";
import {
  TESTNET_MASTER_PUBKEYS,
  MAINNET_MASTER_PUBKEYS,
  TESTNET_REQUIRED_NUMBER_SIGS,
  MAINNET_REQUIRED_NUMBER_SIGS,
} from "./portal.constants";
import { wasm } from "@lib/wasm";

async function handleGetPortalMinShieldAmount({ tokenID }) {
    try {
      new Validator("tokenID", tokenID).required().string();
      let portalParams = await this.rpc.getPortalV4Params(0);

      if (portalParams.MinShieldAmts[tokenID] >= 0) {
        return portalParams.MinShieldAmts[tokenID];
      }
      throw new Error("Can not get min shield amount");
    } catch (error) {
      console.log("HANDLE GET PORTAL MIN SHIELD AMOUNT FAILED", error);
      throw error;
    }
};

async function handleGetPortalMinUnShieldAmount({ tokenID }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    let portalParams = await this.rpc.getPortalV4Params(0);

    if (portalParams.MinUnshieldAmts[tokenID] >= 0) {
      return portalParams.MinUnshieldAmts[tokenID];
    }
    throw new Error("Can not get min unshield amount");
  } catch (error) {
    console.log("HANDLE GET PORTAL MIN UNSHIELD AMOUNT FAILED", error);
    throw error;
  }
};

async function handleCheckIsPortalToken({ tokenID }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    let portalParams = await this.rpc.getPortalV4Params(0);

    if (portalParams.PortalV4TokenIDs.includes(tokenID)) {
      return true;
    }
    return false;
  } catch (error) {
    console.log("HANDLE CHECK IS PORTAL TOKEN FAILED", error);
    throw error;
  }
};

async function handleRequestGenerateShieldingAddress({ incAddress, tokenID }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    let shieldingAddress = await this.rpc.generatePortalShieldingAddress(incAddress, tokenID);
    return shieldingAddress;
  } catch (error) {
    console.log("HANDLE REQUEST NODE TO GENERATE SHIELDING ADDRESS FAILED", error);
    throw error;
  }
};

async function generateShieldingAddress({ tokenID, incAddress, chainName }) {
  // get portal params
  let portalMasterPubKeys;
  let numRequiredSigs;

  if (chainName == "mainnet") {
    portalMasterPubKeys = [...MAINNET_MASTER_PUBKEYS[tokenID]];
    numRequiredSigs = MAINNET_REQUIRED_NUMBER_SIGS;
  } else if (chainName == "testnet") {
    portalMasterPubKeys = [...TESTNET_MASTER_PUBKEYS[tokenID]];
    numRequiredSigs = TESTNET_REQUIRED_NUMBER_SIGS;
  } 

  // encode portal master pubkeys
  portalMasterPubKeys.forEach((item, index, arr) => {
    arr[index] = base64Encode(item);
  })
  let params = {
      MasterPubKeys: portalMasterPubKeys,
      NumSigsRequired: numRequiredSigs,
      ChainName: chainName,
      ChainCodeSeed: incAddress,
  }
  let resp = await wasm.generateBTCMultisigAddress(JSON.stringify(params))
  return String(resp);
};

async function handleGenerateShieldingAddress({ tokenID, incAddress, chainName }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    new Validator("incAddress", incAddress).required().string();
    new Validator("chainName", chainName).required().inList(["testnet", "mainnet"]);

    // generate shielding address client-side
    // and generate shielding address server-side (fullnode)
    const [shieldAddress1, shieldAddress2] = await Promise.all([
      generateShieldingAddress({ tokenID, incAddress, chainName }),
      this.rpc.generatePortalShieldingAddress(incAddress, tokenID),
    ])

    if (String(shieldAddress1) !== shieldAddress2) {
      throw Error("Shielding address is not compatible");
    }

    return shieldAddress2;
  } catch (error) {
    console.log("HANDLE GENERATE SHIELDING ADDRESS FAILED", error);
    throw error;
  }
};

async function handleGetMinShieldAmtAndGenerateShieldAddress({ tokenID, incAddress, chainName }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    new Validator("incAddress", incAddress).required().string();
    new Validator("chainName", chainName).required().string();

    let portalParams = await this.rpc.getPortalV4Params(0);
    let masterPubKeysEncoded = portalParams.MasterPubKeys[tokenID];
    let params = {
        MasterPubKeys: masterPubKeysEncoded,
        NumSigsRequired: portalParams.NumRequiredSigs,
        ChainName: chainName,
        ChainCodeSeed: incAddress,
    }
    let resp = await wasm.generateBTCMultisigAddress(JSON.stringify(params));
    return {
      minShieldAmt: portalParams.MinShieldAmts[tokenID],
      shieldingAddress: String(resp)
    };
  } catch (error) {
    console.log("HANDLE GET MIN SHIELD AMOUNT AND GENERATE SHIELDING ADDRESS FAILED", error);
    throw error;
  }
};

async function handleGetPortalShieldStatusByTxID({ txID }) {
  try {
    new Validator("txID", txID).required().string();
    let shieldStatus = await this.rpc.getPortalShieldStatus(txID);

    if (!!shieldStatus){
      return shieldStatus;
    }
    throw new Error("Can not get portal shield status");
  } catch (error) {
    console.log("HANDLE GET PORTAL SHIELD STATUS FAILED", error);
    throw error;
  }
};

async function handleGetPortalUnShieldStatusByTxID({ txID }) {
  try {
    new Validator("txID", txID).required().string();
    let unshieldStatus = await this.rpc.getPortalUnShieldStatus(txID);

    if (!!unshieldStatus){
      return unshieldStatus;
    }
    throw new Error("Can not get portal unshield status");
  } catch (error) {
    console.log("HANDLE GET PORTAL UNSHIELD STATUS FAILED", error);
    throw error;
  }
};

async function handleCheckPortalShieldingAddresssExisted({ incAddress, shieldingAddress }) {
    try {
      new Validator("incAddress", incAddress).required().string();
      new Validator("shieldingAddress", shieldingAddress).required().string();
      let result = await this.rpcPortalService.apiCheckPortalShieldingAddresssExisted({ incAddress, shieldingAddress });
      return !!result;
    } catch (error) {
      console.log("HANDLE GET PORTAL SHIELDING ADDRESS EXISTED FAILED", error);
      throw error;
    }
};

async function handleAddPortalShieldingAddresss({ incAddress, shieldingAddress }) {
    try {
        new Validator("incAddress", incAddress).required().string();
        new Validator("shieldingAddress", shieldingAddress).required().string();
        let result = await this.rpcPortalService.apiAddPortalShieldingAddresss({ incAddress, shieldingAddress });
        return !!result;
    } catch (error) {
        console.log("HANDLE ADD PORTAL SHIELDING ADDRESS FAILED", error);
        throw error;
    }
};

async function handleGetAverageUnshieldFee() {
    try {
      let resp = await this.rpcPortalService.apiGetEstimateUnshieldFee();
      return resp*10; // return nano pbtc
    } catch (error) {
      console.log("HANDLE GET AVERAGE UNSHIELD FEE FAILED", error);
      throw error;
    }
};

async function handleGetPortalShieldingHistory({ incAddress, tokenID }) {
  try {
    new Validator("incAddress", incAddress).required().string();
    new Validator("tokenID", tokenID).required().string();
    let res = await this.rpcPortalService.apiGetPortalShieldingHistory({ incAddress, tokenID });
    return res;
  } catch (error) {
    console.log("HANDLE GET PORTAL SHIELDING HISTORY FAILED", error);
    throw error;
  }
};

async function handleGetPortalShieldStatusByExternalTxID({ externalTxID, tokenID }) {
  try {
    new Validator("externalTxID", externalTxID).required().string();
    new Validator("tokenID", tokenID).required().string();
    let res = await this.rpcPortalService.apiGetPortalShieldingHistoryByExternalTxID({ externalTxID, tokenID });
    return res;
  } catch (error) {
    console.log("HANDLE GET PORTAL SHIELDING HISTORY BY EXTERNAL TXID FAILED", error);
    throw error;
  }
};

export default {
    handleGetPortalMinShieldAmount,
    handleGetPortalMinUnShieldAmount,
    handleCheckIsPortalToken,
    handleGenerateShieldingAddress,
    handleGetMinShieldAmtAndGenerateShieldAddress,
    handleCheckPortalShieldingAddresssExisted,
    handleAddPortalShieldingAddresss,
    handleGetAverageUnshieldFee,
    handleGetPortalShieldStatusByTxID,
    handleGetPortalUnShieldStatusByTxID,
    handleRequestGenerateShieldingAddress,
    handleGetPortalShieldingHistory,
    handleGetPortalShieldStatusByExternalTxID,
}