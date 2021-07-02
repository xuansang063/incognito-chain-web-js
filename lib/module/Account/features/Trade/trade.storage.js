import uniq from 'lodash/uniq';
import Validator from '@lib/utils/validator';

const STORAGE_KEYS = {
  TRADE_TOKEN_IDS: '[trade] tokenIDs'
}

function getKeyTradeTokenIDs({ version }) {
  new Validator('version', version).required().number()
  const otaKey = this.getOTAKey();
  const prefix = this.getPrefixKeyStorage({ version });
  return `${prefix}-${otaKey}-${STORAGE_KEYS.TRADE_TOKEN_IDS}`;
}

async function getStorageTradeTokenIDs({ version }) {
  new Validator('version', version).required().number()
  const key = this.getKeyTradeTokenIDs({ version });
  return await this.getAccountStorage(key);
}

async function setStorageTradeTokenIDs({ tokenIDs = [], version }) {
  new Validator('version', version).required().number()
  new Validator('tokenIDs', tokenIDs).required().array()
  const oldTokenIDs = (await this.getStorageTradeTokenIDs({ version })) || [];
  const newTokenIDs = uniq(oldTokenIDs.concat(tokenIDs).filter(tokenID => !!tokenID));
  const key = this.getKeyTradeTokenIDs({ version });
  await this.setAccountStorage(key, newTokenIDs);
}

export default {
  getKeyTradeTokenIDs,
  getStorageTradeTokenIDs,
  setStorageTradeTokenIDs,
}
