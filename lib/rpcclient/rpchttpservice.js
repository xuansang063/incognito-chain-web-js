const axios = require('axios');

class RPCHttpService {
  constructor(url = "http://localhost:9334", username, password) {
    this.auth = {
      username: username,
      password: password,
    }
    this.url = url;
  }

  postRequest = async (data) => {
    const response = await axios.post(this.url, data, {auth: this.auth});
    return response;
  }
}

export {RPCHttpService};
