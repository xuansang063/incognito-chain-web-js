import coins from "./coins";
import keyImages from "./coins.keyImages";
import unspentCoins from "./coins.unspentCoins";
import outputCoins from "./coins.outputCoins";

const coinsPrototype = {
  ...coins,
  ...keyImages,
  ...outputCoins,
  ...unspentCoins,
};

export default coinsPrototype;
