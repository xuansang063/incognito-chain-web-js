import { PRVIDSTR } from '../core';
import createAxiosInstance from './axios';

let coinsServicesURL = '';

export const setCoinsServicesURL = ({ url }) => (coinsServicesURL = url);

const getCoinsServices = () =>
  createAxiosInstance({ baseURL: coinsServicesURL });

export const apiGetListOutputCoins = (payload) => {
  const { viewKey, offset, limit, tokenId = PRVIDSTR } = payload;
  const http = getCoinsServices();
  console.debug('CALL API GET COINS', JSON.stringify(payload));
  return http
    .get(
      `getcoins?viewkey=${viewKey}&limit=${limit}&offset=${offset}&tokenid=${tokenId}`
    )
    .then((response) => {
      const outputs = response?.Outputs || {};
      let allOutputCoinStrs;
      if (outputs) {
        allOutputCoinStrs = outputs[Object.keys(outputs)[0]];
      }
      return allOutputCoinStrs || [];
    });
};

export const apiGetListOutputCoinsV2 = (payload) => {
  const { otaKey, offset, limit, tokenId = PRVIDSTR } = payload;
  const http = getCoinsServices();
  console.debug('CALL API GET COINS V2', JSON.stringify(payload));
  return http
    .get(
      `getcoins?otakey=${otaKey}&limit=${limit}&offset=${offset}&tokenid=${tokenId}&version=2`
    )
    .then((response) => {
      const outputs = response?.Outputs || {};
      let allOutputCoinStrs;
      if (outputs) {
        allOutputCoinStrs = outputs[Object.keys(outputs)[0]];
      }
      return allOutputCoinStrs || [];
    });
};


export const apiGetKeyInfo = ({ viewKey }) => {
  const http = getCoinsServices();
  console.debug('CALL API GET KEY INFO');
  return http.get(`getkeyinfo?key=${viewKey}`);
};

export const apiCheckKeyImages = ({ keyImages, shardId }) => {
  const http = getCoinsServices();
  const payload = {
    KeyImages: keyImages,
    ShardID: shardId,
  };
  return http.post('checkkeyimages', payload);
};

export const apiGetSpendingCoinInMemPool = () => {
  const http = getCoinsServices();
  return http.get('getcoinspending').then((res) => res || []);
};
