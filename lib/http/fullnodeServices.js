import createAxiosInstance from "./axios";

let fullNodeServicesURL = "";

export const setFullNodeServicesURL = ({ url }) => (fullNodeServicesURL = url);

const getFullNodeServices = () =>
  createAxiosInstance({ baseURL: fullNodeServicesURL });

export const getListOutputCoins = ({
  viewKey,
  fromHeight = 0,
  toHeight = 1000000000,
  tokenId = "0000000000000000000000000000000000000000000000000000000000000004",
}) => {
  let http = getFullNodeServices();
  return http.get(
    `getcoins?viewkey=${viewKey}&fromheight=${fromHeight}&toheight=${toHeight}&tokenid=${tokenId}`
  );
};
