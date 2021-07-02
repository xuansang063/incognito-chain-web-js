import { PaymentAddressType } from '@lib/core';
import { AIRDROP_STATUS } from '@lib/module/Account/account.constants';

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
  const paymentAddress = this.key.base58CheckSerialize(PaymentAddressType);
  const status = await this.rpcRequestService.apiRequestAirdrop({
    paymentAddress,
  });
  if (AIRDROP_STATUS.SUCCESS === status) {
    await this.setFlagRequestAirdrop();
  }
}

export default {
  getKeyFlagRequestAirdrop,
  getFlagRequestAirdrop,
  setFlagRequestAirdrop,
  requestAirdrop,
};
