import liquidity from "./liquidity";
import liquidityStorage from "./liquidity.storage";
import liquidityHistories from "./Liquidity.histories";

const liquidityPrototype = {
  ...liquidityStorage,
  ...liquidityHistories,
  ...liquidity,
};

export default liquidityPrototype;
