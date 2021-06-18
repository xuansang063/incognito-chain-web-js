import coins from "./coins";
import keyImages from "./coins.keyImages";
import spendingCoins from "./coins.spendingCoins";
import spentCoins from "./coins.spentCoins";
import unspentCoins from "./coins.unspentCoins";

const coinsPrototype = {
  ...coins,
  ...keyImages,
  ...spendingCoins,
  ...spentCoins,
  ...unspentCoins,
};

export default coinsPrototype;
