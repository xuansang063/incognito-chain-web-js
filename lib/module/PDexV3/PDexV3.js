import BaseModule from "@lib/module/BaseModule";
import { homePrototype } from "./features/Home";
import { followPoolsPrototype } from "./features/FollowPools";

class PDexV3 extends BaseModule {
  constructor() {
    super();
  }
}

Object.assign(PDexV3.prototype, homePrototype, followPoolsPrototype);

export default PDexV3;
