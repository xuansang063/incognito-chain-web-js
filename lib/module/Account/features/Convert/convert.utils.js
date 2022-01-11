import { PrivacyVersion, PRV, PRVIDSTR } from '@lib/core/constants';
import bn from 'bn.js';
import { MAX_COUNT_BALANCE, MAX_FEE_PER_TX, TIME_COUNT_BALANCE } from '@lib/module/Account/account.constants';
import { sleep } from '@lib/module/Account/account.utils';

async function clearCacheBalanceV1() {
  const version = PrivacyVersion.ver1;
  const keyInfo = (await this.getKeyInfoV1()) || [];
  const tasks = keyInfo.map(async ({ tokenID }) => {
    const key = await this.getSpendingCoinsStorageByTokenId({ tokenID, version });
    return this.clearAccountStorage(key);
  });
  await Promise.all(tasks);
}

async function checkBalanceNativeTokenV2() {
  const unspentCoins = await this.getUnspentCoinsExcludeSpendingCoins({
    tokenID: PRVIDSTR,
    version: PrivacyVersion.ver2,
  });
  let balance = unspentCoins?.reduce((prev, coin) => {
    let balance = prev;
    const amount = new bn(coin.Value);
    return balance.add(amount);
  }, new bn(0));

  console.log("Convert: Balance v2: ", balance.toNumber());
  return balance;
}

async function waitingBalanceNativeTokenV2({
  maxCounter = MAX_COUNT_BALANCE,
  timeCount = TIME_COUNT_BALANCE,
} = {}) {
  let counterStep = 0;
  let nextStep = false;
  while (true) {
    if (maxCounter < counterStep) {
      nextStep = false;
      break;
    }
    const balance = (await this.checkBalanceNativeTokenV2()) || 0;
    const humanAmount = new bn(balance).div(
      new bn(10).pow(new bn(PRV.pDecimals)),
    ).toString();
    await this.updateProgressTx(10, `Getting Balance CoinsV2: ${humanAmount} PRV Time ${counterStep + 1}`);
    if (balance.gte(new bn(MAX_FEE_PER_TX))) {
      nextStep = true;
      break;
    }
    counterStep += 1;
    await sleep(timeCount * 1000);
  }
  return nextStep;
}

export default {
  clearCacheBalanceV1,
  checkBalanceNativeTokenV2,
  waitingBalanceNativeTokenV2,
}
