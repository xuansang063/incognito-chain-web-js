import BaseModule from "@lib/module/BaseModule";
import { homePrototype } from "./features/Home";
import { followPoolsPrototype } from "./features/FollowPools";
import tradePrototype from "./features/Trade";

class PDexV3 extends BaseModule {
  constructor() {
    super();
  }
}

Object.assign(
  PDexV3.prototype,
  homePrototype,
  followPoolsPrototype,
  tradePrototype
);

export default PDexV3;
