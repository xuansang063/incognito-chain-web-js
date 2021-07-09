import portal from "./api";
import unshield from "./unshield";

const portalPrototype = {
  ...portal,
  ...unshield,
};

export default portalPrototype;