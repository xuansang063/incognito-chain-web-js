import coins from "./coins";
import keyImages from "./coins.keyImages";
import spendingCoins from "./coins.spendingCoins";
import spentCoins from "./coins.spentCoins";
import unspentCoins from "./coins.unspentCoins";
import keyInfo from "./coins.keyInfo";
import outputCoins from "./coins.outputCoins";

const coinsPrototype = {
  ...coins,
  ...keyImages,
  ...spendingCoins,
  ...spentCoins,
  ...unspentCoins,
  ...outputCoins,
  ...keyInfo,
};

export default coinsPrototype;
