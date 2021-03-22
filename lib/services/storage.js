class StorageServices {
  constructor() {
    this.rootStorage = {};
  }

  async setItem(key, value) {
    const rootStorage = { ...this.rootStorage, [key]: value };
    this.rootStorage = { ...rootStorage };
  }

  async getItem(key) {
    return this.rootStorage[key] || undefined;
  }

  async removeItem(key) {
    let rootStorage = { ...this.rootStorage };
    delete rootStorage[key];
    this.rootStorage = { ...rootStorage };
  }
}

export default new StorageServices();
