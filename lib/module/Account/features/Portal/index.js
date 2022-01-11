export * from "./portal.constants";

import api from "./portal.api";
import portal from "./portal";
import storage from "./portal.storage";
import history from "./portal.histories";

const portalPrototype = {
  ...api,
  ...portal,
  ...storage,
  ...history,
};

export default portalPrototype;