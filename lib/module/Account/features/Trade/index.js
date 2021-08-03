import trade from "./trade";
import tradeHistories from "./trade.histories";
import tradeStorage from "./trade.storage";

const tradePrototype = {
  ...trade,
  ...tradeHistories,
  ...tradeStorage,
};

export default tradePrototype;
