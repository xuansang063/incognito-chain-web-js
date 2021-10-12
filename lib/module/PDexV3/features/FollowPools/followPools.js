import Validator from "@lib/utils/validator";
import uniq from "lodash/uniq";

function getKeyDefaultPool() {
  const otaKey = this.getOTAKey();
  return `DEFAULT-POOL-${otaKey}`;
}

async function setDefaultPool(poolId) {
  new Validator("setDefaultPool-poolId", poolId).required().string();
  const key = this.getKeyDefaultPool();
  await this.setStorage(key, poolId);
}

async function getDefaultPool() {
  return await this.getStorage(this.getKeyDefaultPool());
}

function getKeyFollowPools() {
  const otaKey = this.getOTAKey();
  return `FOLLOWING-POOLS-${otaKey}`;
}

function getKeyFollowedDefaultPools() {
  const otaKey = this.getOTAKey();
  return `FOLLOWED-DEFAULT-POOLS-${otaKey}`;
}

async function getListFollowingPools() {
  let list = [];
  try {
    const key = this.getKeyFollowPools();
    list = (await this.getStorage(key)) || [];
  } catch (error) {
    throw error;
  }
  return list;
}

async function isFollowedDefaultPools() {
  try {
    const key = this.getKeyFollowedDefaultPools();
    const isFollowed = (await this.getStorage(key)) || false;
    return isFollowed;
  } catch (error) {
    throw error;
  }
}

async function followingDefaultPools(params) {
  try {
    const { poolsIDs } = params;
    new Validator("followingDefaultPools-poolsIDs", poolsIDs)
      .required()
      .array();
    const key = this.getKeyFollowedDefaultPools();
    const isFollowed = await this.isFollowedDefaultPools();
    if (!isFollowed) {
      await Promise.all([
        this.addListFollowingPool({ poolsIDs }),
        this.setStorage(key, true),
      ]);
    }
  } catch (error) {
    throw error;
  }
}

async function setListFollowingPools({ list }) {
  try {
    new Validator("setListFollowingPools-list", list).required().array();
    const key = this.getKeyFollowPools();
    await this.setStorage(key, list);
    return true;
  } catch (error) {
    throw error;
  }
}

async function addFollowingPool(params) {
  try {
    const { poolId } = params;
    new Validator("addFollowingPool-poolId", poolId).required().string();
    const oldList = await this.getListFollowingPools();
    new Validator("addFollowingPool-oldList", oldList).required().array();
    const isExist = oldList.includes(poolId);
    if (!isExist) {
      await this.setListFollowingPools({ list: [poolId, ...oldList] });
    }
  } catch (error) {
    console.log("addFollowingPool error", error);
    throw error;
  }
}

async function addListFollowingPool(params) {
  try {
    const { poolsIDs } = params;
    new Validator("addListFollowingPool-poolsIDs", poolsIDs).required().array();
    const oldList = await this.getListFollowingPools();
    new Validator("addListFollowingPool-oldList", oldList).required().array();
    const list = uniq([...poolsIDs, ...oldList]);
    await this.setListFollowingPools({ list });
  } catch (error) {
    console.log("addListFollowingPool error", error);
    throw error;
  }
}

async function removeFollowingPool(params) {
  try {
    const { poolId } = params;
    new Validator("removeFollowingPool-poolId", poolId).required().string();
    const oldList = await this.getListFollowingPools();
    new Validator("removeFollowingPool-oldList", oldList).required().array();
    const isExist = oldList.includes(poolId);
    if (isExist) {
      await this.setListFollowingPools({
        list: oldList.filter((_poolID) => _poolID !== poolId),
      });
    }
  } catch (error) {
    console.log("removeFollowingPool error", error);
    throw error;
  }
}

export default {
  addFollowingPool,
  removeFollowingPool,
  setListFollowingPools,
  getListFollowingPools,
  getKeyFollowPools,
  addListFollowingPool,
  followingDefaultPools,
  getKeyFollowedDefaultPools,
  isFollowedDefaultPools,
  //
  getKeyDefaultPool,
  setDefaultPool,
  getDefaultPool,
};
