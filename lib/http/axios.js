import axios from "axios";

const TIMEOUT = 1e9;
const createAxiosInstance = ({ baseURL = "", token = "" } = {}) => {
  const instance = axios.create({
    baseURL,
    timeout: TIMEOUT,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Access-Control-Allow-Headers":
        "Content-Type, Cache-Control, X-Requested-With, X-CSRF-Token, Discourse-Visible, User-Api-Key, User-Api-Client-Id, *",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, PUT, GET, OPTIONS, DELETE",
      Authorization: "Bearer " + token,
    },
  });

  instance.interceptors.request.use(
    (req) => {
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
      if (error && result === null) {
        return Promise.reject(error);
      }
      return Promise.resolve(result);
    },
    (error) => {
      const errResponse = error?.response?.data?.Error || error?.response;
      // can not get response, alert to user
      if (error?.isAxiosError && !errResponse) {
        throw new Error(
          `Send request RPC failed:
          \nBaseURL: ${baseURL}
          \nError:${errResponse}`
        );
      }
      return Promise.reject({
        name: "API_ERROR",
        code: error?.response?.status,
        error: errResponse,
      });
    }
  );

  return instance;
};

export default createAxiosInstance;
