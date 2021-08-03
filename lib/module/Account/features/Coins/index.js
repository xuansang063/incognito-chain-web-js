import coins from "./coins";
import keyImages from "./coins.keyImages";
import outputCoins from "./coins.outputCoins";
import spendingCoins from "./coins.spendingCoins";
import spentCoins from "./coins.spentCoins";
import storage from "./coins.storage";
import total from "./coins.total";
import unspentCoins from "./coins.unspentCoins";

const coinsPrototype = {
  ...coins,
  ...keyImages,
  ...outputCoins,
  ...spendingCoins,
  ...spentCoins,
  ...unspentCoins,
  ...total,
  ...storage,
};

export default coinsPrototype;
