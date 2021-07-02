import Validator from "@lib/utils/validator";

async function handleGetPortalMinShieldAmount({ tokenID }) {
    try {
      new Validator("tokenID", tokenID).required().string();
      let result = await this.rpcPortalService.apiGetMinShieldAmount(tokenID);
      if (!!result) {
        return result.MinShieldAmt;
      }
    } catch (error) {
      console.log("HANDLE GET PORTAL MIN SHIELD AMOUNT FAILED", error);
    }
    return null;
};

async function handleCheckPortalShieldingAddresssExisted({ incAddress, shieldingAddress }) {
    try {
      new Validator("incAddress", incAddress).required().string();
      new Validator("shieldingAddress", shieldingAddress).required().string();
      let result = await this.rpcPortalService.apiCheckPortalShieldingAddresssExisted({ incAddress, shieldingAddress });
      if (!!result) {
        return {
          ...result,
        };
      }
    } catch (error) {
      console.log("HANDLE GET PORTAL SHIELDING ADDRESS EXISTED FAILED", error);
    }
    return null;
};

async function handleAddPortalShieldingAddresss({ incAddress, shieldingAddress }) {
    try {
      new Validator("incAddress", incAddress).required().string();
      new Validator("shieldingAddress", shieldingAddress).required().string();
      let result = await this.rpcPortalService.apiAddPortalShieldingAddresss({ incAddress, shieldingAddress });
      if (!!result) {
        return {
          ...result,
        };
      }
    } catch (error) {
      console.log("HANDLE ADD PORTAL SHIELDING ADDRESS FAILED", error);
    }
    return null;
};

async function handleGetAverageUnshieldFee() {
    try {
      let result = await this.rpcPortalService.apiGetEstimateUnshieldFee();
      if (!!result) {
        return {
          ...result,
        };
      }
    } catch (error) {
      console.log("HANDLE GET AVERAGE UNSHIELD FEE FAILED", error);
    }
    return null;
};


export default {
    handleGetPortalMinShieldAmount,
    handleCheckPortalShieldingAddresssExisted,
    handleAddPortalShieldingAddresss,
    handleGetAverageUnshieldFee,
}