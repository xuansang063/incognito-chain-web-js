import getLogger from 'webpack-log';
import { PRVIDSTR } from '../wallet/constants';
import createAxiosInstance from './axios';

const L = getLogger({ name: 'webpack-batman' });

let fullNodeServicesURL = '';

export const setFullNodeServicesURL = ({ url }) => (fullNodeServicesURL = url);

const getFullNodeServices = () =>
  createAxiosInstance({ baseURL: fullNodeServicesURL });

export const apiGetListOutputCoins = ({
  viewKey,
  offset,
  limit,
  tokenId = PRVIDSTR,
}) => {
  const http = getFullNodeServices();
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
      return allOutputCoinStrs;
    });
};

export const apiGetKeyInfo = ({ viewKey }) => {
  const http = getFullNodeServices();
  return http.get(`getkeyinfo?key=${viewKey}`);
};

export const apiCheckKeyImages = ({ keyImages, shardId }) => {
  const http = getFullNodeServices();
  const payload = {
    KeyImages: keyImages,
    ShardID: shardId,
  };
  return http.post(`checkkeyimages`, payload);
};
