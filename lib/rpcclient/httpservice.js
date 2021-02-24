const axios = require('axios');

const defaultHeader = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

class HttpService {

  constructor(url = "http://51.161.119.68:8080", username, password) {
    this.auth = {
      username: username,
      password: password,
    }
    this.url = url;
    this.header = defaultHeader;
    this.axios = axios;
    this.axios.defaults.baseURL = `${url}/api/`;
  }

  get = async (url, body) => {
    const response = await this.axios.get(url, {
      ...this.config,
      params: {
        ...body,
      },
      headers: {
        ...this.headers,
      },
    });
    return response;
  };

  post = async (url, body, params) => {
    const response = await this.axios.post(url, body, {
      ...this.config,
      headers: {
        ...this.headers,
      },
      params: {
        ...params,
      },
    });
    return response;
  };
}

export { HttpService };