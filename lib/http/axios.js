import axios from 'axios';

const TIMEOUT = 1e9;
const createAxiosInstance = ({ baseURL = '' }) => {
  const instance = axios.create({
    timeout: TIMEOUT,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Headers':
        'Content-Type, Cache-Control, X-Requested-With, X-CSRF-Token, Discourse-Visible, User-Api-Key, User-Api-Client-Id, *',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS, DELETE',
    },
  });

  instance.interceptors.request.use(
    (req) => {
      req.baseURL = baseURL;
      req.headers = {
        ...req.headers,
      };
      return req;
    },
    (error) => {
      Promise.reject(error);
    }
  );

  instance.interceptors.response.use(
    (res) => {
      const result = res?.data?.Result;
      const error = res?.data?.Error;
      if (error) {
        return Promise.reject(error);
      }
      return Promise.resolve(result);
    },
    (error) => {
      const errResponse = error?.response || error?.message;
      console.debug('errResponse', errResponse);
      // can not get response, alert to user
      if (error?.isAxiosError && !errResponse) {
        throw new Error(`Send request RPC failed ${errResponse}`);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export default createAxiosInstance;
