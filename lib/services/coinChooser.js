import * as sorted from 'sorted';
import { Interface } from "./interface";
import bn from "bn.js";

let CoinChooser = new Interface("CoinChooser", [
  "coinsForRing",
  "coinsToSpend",
]);

class BasicCoinChooser {
  constructor() {
    Interface.ensureImplements(this, CoinChooser);
  }

  coinsForRing(rpcClient, shardID, numOfOtherPks, tokenID) {
    return rpcClient.getOtherCoinsForRing(shardID, numOfOtherPks, tokenID);
  }

  coinsToSpend(inputCoins, amount) {
    if (amount.cmp(new bn(0)) === 0) {
      return {
        resultInputCoins: [],
        remainInputCoins: inputCoins,
        totalResultInputCoinAmount: new bn(0),
      };
    }
    let resultInputCoins = [];
    let remainInputCoins = [];
    let totalResultInputCoinAmount = new bn(0);
    // either take the smallest coins, or a single largest one
    let inCoinOverAmount = null;
    let inCoinsUnderAmount = [];
    for (let i = 0; i < inputCoins.length; i++) {
      if (new bn(inputCoins[i].Value).cmp(amount) === -1) {
        inCoinsUnderAmount.push(inputCoins[i]);
      } else if (inCoinOverAmount === null) {
        inCoinOverAmount = inputCoins[i];
      } else if (
        new bn(inCoinOverAmount.Value).cmp(new bn(inputCoins[i].Value)) === 1
      ) {
        remainInputCoins.push(inputCoins[i]);
      } else {
        remainInputCoins.push(inCoinOverAmount);
        inCoinOverAmount = inputCoins[i];
      }
    }
    inCoinsUnderAmount.sort(function(a, b) {
      return new bn(b.Value).cmp(new bn(a.Value));
    });
    for (let i = 0; i < inCoinsUnderAmount.length; i++) {
      if (totalResultInputCoinAmount.cmp(amount) === -1) {
        totalResultInputCoinAmount = totalResultInputCoinAmount.add(
          new bn(inCoinsUnderAmount[i].Value)
        );
        resultInputCoins.push(inCoinsUnderAmount[i]);
      } else {
        remainInputCoins.push(inCoinsUnderAmount[i]);
      }
    }
    if (
      inCoinOverAmount != null &&
      (new bn(inCoinOverAmount.Value).cmp(amount.mul(new bn(2))) === 1 ||
        totalResultInputCoinAmount.cmp(amount) === -1)
    ) {
      remainInputCoins.push(resultInputCoins);
      resultInputCoins = [inCoinOverAmount];
      totalResultInputCoinAmount = new bn(inCoinOverAmount.Value);
    } else if (inCoinOverAmount != null) {
      remainInputCoins.push(inCoinOverAmount);
    }
    if (totalResultInputCoinAmount.cmp(amount) === -1) {
      throw "Not enough coin";
    } else {
      return {
        resultInputCoins: resultInputCoins,
        remainInputCoins: remainInputCoins,
        totalResultInputCoinAmount: totalResultInputCoinAmount,
      };
    }
  }
}

class DefaultCoinChooser {
  constructor(sz = 20) {
    Interface.ensureImplements(this, CoinChooser);
    this.idealUtxoSize = sz;
  }

  coinsForRing(rpcClient, shardID, numOfOtherPks, tokenID) {
    return rpcClient.getOtherCoinsForRing(shardID, numOfOtherPks, tokenID);
  }

  coinsToSpend(inputCoins, amount, maxlen = 30) {
    if (amount.eqn(0)) return { resultInputCoins: [] };
    const coinCompare = (c1, c2) => {
      try {
        const a = new bn(c1.Value);
        const b = new bn(c2.Value);
        return a.cmp(b);
      } catch (e) {
        console.error(`Unstable comparison: ${JSON.stringify(c1)} vs ${JSON.stringify(c2)}`);
        throw e;
      }
    }
    const needReduce = inputCoins.length > this.idealUtxoSize;

    let total = new bn(0);

    let sortedCoins = sorted(inputCoins, coinCompare);
    let itemForFinding = { Value: amount };
    let bigCoinIndex = sortedCoins.findIndex(itemForFinding);
    let chosenCoins;
    if (bigCoinIndex >= sortedCoins.length) {
      // biggest coin does not reach amount
      let currentIndex = sortedCoins.length;
      while (total.lt(amount)) {
        currentIndex--;
        if (currentIndex < 0) throw `Not enough coin to spend ${amount.toString()}`;
        total = total.add(new bn(sortedCoins.get(currentIndex).Value));
      }
      chosenCoins = sortedCoins.splice(currentIndex, sortedCoins.length);

    } else {
      chosenCoins = sortedCoins.splice(bigCoinIndex, 1);
    }
    if (chosenCoins.length > maxlen) throw 'Error: maximum UTXO inclusion exceeded';
    if (needReduce) {
      console.log('adding dust to keep UTXO size down');
      // we assume output-coin length is 2 and make sure input count is larger by adding `dust` UTXOs
      // spending & dust coins must not exceed maxlen
      let coinAllowance = maxlen - chosenCoins.length;
      const dustCount = coinAllowance > 2 ? 2 : coinAllowance;
      let dustArr = sortedCoins.splice(0, coinAllowance);
      chosenCoins = chosenCoins.concat(dustArr);
    }
    console.log(`choosing ${JSON.stringify(chosenCoins, null, '\t')}, leaving ${JSON.stringify(sortedCoins, null, '\t')}`);

    return {
      resultInputCoins: chosenCoins
    };
  }
}
let defaultCoinChooser = new DefaultCoinChooser();

export { CoinChooser, defaultCoinChooser };