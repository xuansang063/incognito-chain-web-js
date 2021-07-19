import { PrivacyVersion } from '@lib/core/constants';
import Validator from '@lib/utils/validator';

async function getKeyInfoV1() {
  const version = PrivacyVersion.ver1;
  const result = await this.measureAsyncFn(
    this.getKeyInfo,
    "timeGetKeysInfoV1",
    { version }
  );

  const coinsIndex = result?.coinindex || {};
  let keysInfo = {};
  if (
    coinsIndex &&
    typeof coinsIndex === "object" &&
    Object.keys(coinsIndex).length > 0
  ) {
    Object.keys(coinsIndex).forEach((tokenId) => {
      keysInfo[tokenId] = { total: coinsIndex[tokenId].Total || 0 };
    });
  }
  keysInfo = Object.keys(keysInfo).map((tokenID) => ({
    tokenID,
    total: keysInfo[tokenID].total
  }));
  return keysInfo;
}

async function getKeyInfoByTokenIdV1({ tokenID }) {
  new Validator('tokenID', tokenID).required().string();
  const version = PrivacyVersion.ver1;
  const result = await this.measureAsyncFn(
    this.getKeyInfo,
    "timeGetKeysInfoV1",
    { version }
  );
  let total = 0;
  if (result && result.coinindex && result.coinindex[tokenID]) {
    total = result.coinindex[tokenID].Total || 0;
  }
  return total;
}

export default {
  getKeyInfoV1,
  getKeyInfoByTokenIdV1
}
