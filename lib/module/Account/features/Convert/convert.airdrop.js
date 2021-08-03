import { PaymentAddressType } from '@lib/core';
import { AIRDROP_STATUS } from '@lib/module/Account/account.constants';
import { CustomError, ErrorObject } from '@lib/common/errorhandler';

function getKeyFlagRequestAirdrop() {
  return this.getOTAKey() + "_REQUEST_AIRDROP";
}

async function getFlagRequestAirdrop() {
  let requested = false;
  try {
    const key = this.getKeyFlagRequestAirdrop();
    requested = await this.getAccountStorage(key);
  } catch (error) {
    console.log("error", error);
  }
  return !!requested;
}

async function setFlagRequestAirdrop() {
  let requested = false;
  try {
    const key = this.getKeyFlagRequestAirdrop();
    requested = await this.setAccountStorage(key, true);
  } catch (error) {
    console.log("error", error);
  }
  return !!requested;
}

async function requestAirdrop() {
  try {
    const submited = await this.getFlagRequestAirdrop();
    if (!submited) {
      const paymentAddress = this.key.base58CheckSerialize(PaymentAddressType);
      const status = await this.rpcRequestService.apiRequestAirdrop({ paymentAddress });
      if (AIRDROP_STATUS.SUCCESS !== status) return;
      await this.setFlagRequestAirdrop();
    }
  } catch (e) {
    throw new CustomError(ErrorObject.RequestAirdropErr, ErrorObject.RequestAirdropErr.description);
  }
}

export default {
  getKeyFlagRequestAirdrop,
  getFlagRequestAirdrop,
  setFlagRequestAirdrop,
  requestAirdrop,
};
