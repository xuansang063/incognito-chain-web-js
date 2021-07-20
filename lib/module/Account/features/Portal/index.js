import api from "./portal.api";
import portal from "./portal";
import storage from "./portal.storage";

const portalPrototype = {
  ...api,
  ...portal,
  ...storage,
};

export default portalPrototype;