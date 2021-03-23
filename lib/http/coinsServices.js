import getLogger from 'webpack-log';
import { PRVIDSTR } from '../wallet/constants';
import createAxiosInstance from './axios';

const L = getLogger({ name: 'webpack-batman' });

let coinsServicesURL = '';

export const setCoinsServicesURL = ({ url }) => (coinsServicesURL = url);

const getCoinsServices = () =>
  createAxiosInstance({ baseURL: coinsServicesURL });

export const apiGetListOutputCoins = ({
  viewKey,
  offset,
  limit,
  tokenId = PRVIDSTR
}) => {
  const http = getCoinsServices();
  L.info(
    'GET COINS PAYLOAD',
    JSON.stringify({ viewKey, offset, limit, tokenId })
  );
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

export const apiGetKeyInfo = ({ viewKey }) => {
  const http = getCoinsServices();
  return http.get(`getkeyinfo?key=${viewKey}`);
};

export const apiCheckKeyImages = ({ keyImages, shardId }) => {
  const http = getCoinsServices();
  const payload = {
    KeyImages: keyImages,
    ShardID: shardId
  };
  L.info('PAYLOAD CHECK KEY IMAGES', keyImages?.length, shardId);
  return http.post('checkkeyimages', payload);
};
