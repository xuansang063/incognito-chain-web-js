import convert from "./convert";
import convertAirdrop from "./convert.airdrop";
import convertUtils from "./convert.utils";
import convertTransactor from "./convert.transactor";

const convertPrototype = {
  ...convert,
  ...convertUtils,
  ...convertAirdrop,
  ...convertTransactor,
};

export default convertPrototype;
