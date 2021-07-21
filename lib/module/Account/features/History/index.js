export * from "./history.constant";

import history from "./history";
import transactor from "./history.transactor";
import receiver from "./history.receiver";
import pToken from "./history.pToken";

const historyPrototype = {
  ...history,
  ...transactor,
  ...receiver,
  ...pToken,
};

export default historyPrototype;
