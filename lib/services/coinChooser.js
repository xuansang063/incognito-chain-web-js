import { Interface } from "./interface";
import bn from "bn.js";
import Validator from "@lib/utils/validator";
import BinarySortedArray from "binary-sorted-array";

let CoinChooser = new Interface("CoinChooser", [
  "coinsForRing",
  "coinsToSpend",
]);

class DefaultCoinChooser {
  constructor(sz = 20) {
    Interface.ensureImplements(this, CoinChooser);
    this.idealUtxoSize = sz;
  }

  coinsForRing(rpcClient, shardID, numOfOtherPks, tokenID) {
    return rpcClient.getOtherCoinsForRing(shardID, numOfOtherPks, tokenID);
  }

  coinsToSpend(inputCoins, amount, maxlen = 30) {
    try {
      new Validator("inputCoins", inputCoins).required().array();
      new Validator("amount", amount).amount();
      new Validator("maxlen", maxlen).number();
      if (amount.eqn(0)) return { resultInputCoins: [] };
      const coinCompare = (c1, c2) => {
        try {
          const a = new bn(c1.Value);
          const b = new bn(c2.Value);
          return a.cmp(b);
        } catch (e) {
          console.error(
            `Unstable comparison: ${JSON.stringify(c1)} vs ${JSON.stringify(
              c2
            )}`
          );
          throw e;
        }
      };
      const needReduce = inputCoins.length > this.idealUtxoSize;
      let total = new bn(0);
      let sortedCoins = new BinarySortedArray(inputCoins, coinCompare);
      let itemForFinding = { Value: amount };
      let bigCoinIndex = sortedCoins.indexOf(itemForFinding, true);
      sortedCoins = sortedCoins.getArray();
      let chosenCoins;
      if (bigCoinIndex >= sortedCoins.length) {
        // biggest coin does not reach amount
        let currentIndex = sortedCoins.length;
        while (total.lt(amount)) {
          currentIndex--;
          if (currentIndex < 0)
            throw `Not enough coin to spend ${amount.toString()}`;
          total = total.add(new bn(sortedCoins[currentIndex].Value));
        }
        chosenCoins = sortedCoins.splice(currentIndex, sortedCoins.length);
      } else {
        chosenCoins = sortedCoins.splice(bigCoinIndex, 1);
      }
      if (chosenCoins.length > maxlen)
        throw "Error: maximum UTXO inclusion exceeded";
      if (needReduce) {
        console.log("adding dust to keep UTXO size down");
        // we assume output-coin length is 2 and make sure input count is larger by adding `dust` UTXOs
        // spending & dust coins must not exceed maxlen
        let coinAllowance = maxlen - chosenCoins.length;
        const dustCount = coinAllowance > 2 ? 2 : coinAllowance;
        let dustArr = sortedCoins.splice(0, coinAllowance);
        chosenCoins = chosenCoins.concat(dustArr);
      }
      return {
        resultInputCoins: chosenCoins,
      };
    } catch (error) {
      throw error;
    }
  }
}
let defaultCoinChooser = new DefaultCoinChooser();

class CoinConsolidator {
  constructor() {
    Interface.ensureImplements(this, CoinChooser);
  }

  coinsForRing(rpcClient, shardID, numOfOtherPks, tokenID) {
    return rpcClient.getOtherCoinsForRing(shardID, numOfOtherPks, tokenID);
  }

  coinsToSpend(inputCoins, fee, maxlen, threshold) {
    try {
      new Validator("inputCoins", inputCoins).required().array();
      new Validator("fee", fee).number();
      new Validator("maxlen", maxlen).number();
      new Validator("threshold", threshold).number();
      const coinCompare = (c1, c2) => {
        try {
          const a = new bn(c1.Value);
          const b = new bn(c2.Value);
          return a.cmp(b);
        } catch (e) {
          console.error(
            `Unstable comparison: ${JSON.stringify(c1)} vs ${JSON.stringify(
              c2
            )}`
          );
          throw e;
        }
      };
      // discard big coins
      inputCoins = inputCoins.filter(c => new bn(c.Value).ltn(threshold));
      let sortedCoins = new BinarySortedArray(inputCoins, coinCompare);
      sortedCoins = sortedCoins.getArray();
      let results = [];
      for (let batch = sortedCoins.splice(0, maxlen); batch.length > 0; batch = sortedCoins.splice(0, maxlen)) {
        let total = batch.reduce((total, v) => total.add(new bn(v.Value)), new bn(0));
        if (total.ltn(fee)) {
          console.log('WARNING: Consolidate ending early - UTXOs too small to pay fee');
          break;
        }
        results.push(batch);
      }
      return results;
    } catch (error) {
      throw error;
    }
  }
  
}
let coinConsolidator = new CoinConsolidator()

export { CoinChooser, defaultCoinChooser, coinConsolidator };
