import { isJsonString } from "@lib/utils/json";
import Validator from "@lib/utils/validator";

async function getAccountStorage(key) {
  let result;
  try {
    new Validator("key", key).required().string();
    if (this.storage) {
      const data = await this.storage.getItem(key);
      result = data;
      if (isJsonString(data)) {
        result = JSON.parse(data);
      }
    }
  } catch (error) {
    console.debug("ERROR GET ACCOUNT STORAGE", error?.message);
  }
  return result;
}

async function setAccountStorage(key, value) {
  try {
    new Validator("key", key).required().string();
    new Validator("value", value).required();
    new Validator("storage", this.storage).required().object();
    if (this.storage) {
      await this.storage.setItem(
        key,
        typeof value !== "string" ? JSON.stringify(value) : value
      );
    }
  } catch (error) {
    throw error;
  }
}

async function clearAccountStorage(key) {
  try {
    new Validator("key", key).required().string();
    if (this.storage) {
      return this.storage.removeItem(key);
    }
  } catch (error) {
    throw error;
  }
}

export default {
  getAccountStorage,
  setAccountStorage,
  clearAccountStorage,
};
