import { Interface } from './interface';
import bn from 'bn.js';

let CoinChooser = new Interface('CoinChooser', ['coinsForRing', 'coinsToSpend']);

class DefaultCoinChooser {
    constructor(){
        Interface.ensureImplements(this, CoinChooser);
    }

    coinsForRing(rpcClient, shardID, numOfOtherPks, tokenID){
        return rpcClient.getOtherCoinsForRing(shardID, numOfOtherPks, tokenID);
    }

    coinsToSpend(inputCoins, amount) {
        if (amount.cmp(new bn(0)) === 0) {
            return {
                resultInputCoins: [],
                remainInputCoins: inputCoins,
                totalResultInputCoinAmount: new bn(0)
            }
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
            } else if (new bn(inCoinOverAmount.Value).cmp(new bn(inputCoins[i].Value)) === 1) {
                remainInputCoins.push(inputCoins[i]);
            } else {
                remainInputCoins.push(inCoinOverAmount);
                inCoinOverAmount = inputCoins[i];
            }
        }

        inCoinsUnderAmount.sort(function(a, b) {
            return new bn(a.Value).cmp(new bn(b.Value));
        });

        for (let i = 0; i < inCoinsUnderAmount.length; i++) {
            if (totalResultInputCoinAmount.cmp(amount) === -1) {
                totalResultInputCoinAmount = totalResultInputCoinAmount.add(new bn(inCoinsUnderAmount[i].Value));
                resultInputCoins.push(inCoinsUnderAmount[i]);
            } else {
                remainInputCoins.push(inCoinsUnderAmount[i]);
            }
        }


        if (inCoinOverAmount != null && (new bn(inCoinOverAmount.Value).cmp(amount.mul(new bn(2))) === 1 || totalResultInputCoinAmount.cmp(amount) === -1)) {
            remainInputCoins.push(resultInputCoins);
            resultInputCoins = [inCoinOverAmount];
            totalResultInputCoinAmount = new bn(inCoinOverAmount.Value);
        } else if (inCoinOverAmount != null) {
            remainInputCoins.push(inCoinOverAmount);
        }

        if (totalResultInputCoinAmount.cmp(amount) === -1) {
            throw new CustomError(ErrorObject.NotEnoughCoinError, "Not enough coin");
        } else {
            return {
                resultInputCoins: resultInputCoins,
                remainInputCoins: remainInputCoins,
                totalResultInputCoinAmount: totalResultInputCoinAmount
            };
        }
    }
}
let defaultCoinChooser = new DefaultCoinChooser();

export {
    CoinChooser,
    defaultCoinChooser
}