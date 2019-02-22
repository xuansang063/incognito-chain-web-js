const axios = require('axios');


// http://192.168.0.39:9334
async function requestAPI(data = {}, url = "http://localhost:9334", method = "POST", options = {}) {
  if (Object.keys(data).length <= 0) {
    return
  }

  let request = await axios({
    method: method,
    url: url,
    data: data,
    ...options,
  });
  return request;
}

module.exports = {requestAPI};
