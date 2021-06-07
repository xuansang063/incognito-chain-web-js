// simulate react native's async-storage
class StorageServices {
  constructor() {
    this.storage = {};
  }

  async setItem(key, value) {
    this.storage[key] = value;
  }

  async getItem(key) {
    return this.storage[key] || undefined;
  }

  async removeItem(key) {
    delete this.storage[key];
  }
}

export default StorageServices;
