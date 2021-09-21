import { PRIORITY_LIST, PRV, PRVIDSTR } from '@lib/core/constants';
import Validator from '@lib/utils/validator';
import { uniqBy, map, orderBy , isString, isEmpty } from 'lodash';
import { toRealTokenValue } from '@lib/privacy/utils';

const mergeTokens = ({ chainTokens, pTokens, chainPairs, paymentAddressV1 } = {}) => {
  new Validator('chainTokens', chainTokens).required().array();
  new Validator('pTokens', pTokens).required().array();
  new Validator('chainPairs', chainPairs).required().object();
  new Validator('paymentAddressV1', paymentAddressV1).required().string();

  let tokens = uniqBy([...chainTokens, ...pTokens], (item) => item.tokenId || item.id);
  tokens = map(tokens, (item) => {
    const pToken = pTokens.find(
      (token) => token.tokenId === (item.tokenId || item.id),
    );
    if (pToken && pToken.symbol === 'ETH' && pToken.currencyType === 1) {
      pToken.address = '0x0000000000000000000000000000000000000000';
    }
    return {
      ...item,
      address: pToken?.address || pToken?.contractId,
      id: item.tokenId || item.id,
      pDecimals: Math.min(pToken?.pDecimals || 0, 9),
      decimals: pToken?.decimals,
      hasIcon: !!pToken,
      symbol: pToken?.symbol || item.symbol,
      displayName: pToken
        ? `Privacy ${pToken.symbol}`
        : `Incognito ${item.name}`,
      name: pToken ? pToken.name : item.name,
      isVerified: item.verified || pToken?.verified,
    };
  });

  tokens = orderBy(tokens, [
      'hasIcon',
      (item) =>
        PRIORITY_LIST.indexOf(item?.id) > -1
          ? PRIORITY_LIST.indexOf(item?.id)
          : 100,
      (item) => isString(item.symbol) && item.symbol.toLowerCase(),
    ],
    ['desc', 'asc'],);

  tokens = [PRV, ...tokens]

  const pdePoolPairs = chainPairs?.PDEPoolPairs;
  let pairs = Object.keys(pdePoolPairs).map(key => {
    const pair = pdePoolPairs[key];
    const token1Value = toRealTokenValue(tokens, pair.Token1IDStr, pair.Token1PoolValue);
    const token2Value = toRealTokenValue(tokens, pair.Token2IDStr, pair.Token2PoolValue);
    return {
      [pair.Token1IDStr]: pair.Token1PoolValue,
      [pair.Token2IDStr]: pair.Token2PoolValue,
      total: token1Value + token2Value,
      keys: [pair.Token1IDStr, pair.Token2IDStr],
    }
  });
  pairs = pairs.filter(pair => pair.total)
  pairs = orderBy(pairs, 'total', 'desc')

  const shares = chainPairs.PDEShares;
  const sharesFee = chainPairs.PDETradingFees;

  Object.keys(shares).forEach(key => {
    if (shares[key] === 0){
      delete shares[key];
    }
  });

  Object.keys(sharesFee).forEach(key => {
    if (sharesFee[key] === 0){
      delete sharesFee[key];
    }
  });

  let pairTokens = tokens.filter(token => pairs.find(pair => pair.keys.includes(token.id)));

  const {
    userPairs,
    feePairs
  } = pairs.reduce((prev, pairInfo) => {
    let { userPairs, feePairs } = prev;
    const tokenIds = pairInfo.keys;
    const token1 = pairTokens.find(item => item.id === tokenIds[0]);
    const token2 = pairTokens.find(item => item.id === tokenIds[1]);
    const mergeKey = `${tokenIds.join('-')}-${paymentAddressV1}`;
    let shareKey = Object.keys(shares).find(key => key.includes(mergeKey));
    let feeShareKey = Object.keys(sharesFee).find(key => key.includes(mergeKey));

    if (!token1 || !token2) {
      return {
        userPairs,
        feePairs
      }
    }

    if (shareKey) {
      let totalShare = 0;
      map(shares, (value, key) => {
        if (key.includes(tokenIds[0]) && key.includes(tokenIds[1])) {
          totalShare += value;
        }
      });
      userPairs.push({
        shareKey: shareKey.slice(shareKey.indexOf(tokenIds[0])),
        token1,
        token2,
        [tokenIds[0]]: pairInfo[tokenIds[0]],
        [tokenIds[1]]: pairInfo[tokenIds[1]],
        share: shares[shareKey],
        totalShare,
      });
    }

    if (feeShareKey) {
      let totalShare = 0;
      map(sharesFee, (value, key) => {
        if (key.includes(tokenIds[0]) && key.includes(tokenIds[1])) {
          totalShare += value;
        }
      });
      feePairs.push({
        shareKey: feeShareKey.slice(feeShareKey.indexOf(tokenIds[0])),
        token1,
        token2,
        [tokenIds[0]]: pairInfo[tokenIds[0]],
        [tokenIds[1]]: pairInfo[tokenIds[1]],
        share: sharesFee[feeShareKey],
        totalShare,
      });
    }
    return {
      userPairs,
      feePairs
    }
  }, { userPairs: [], feePairs: [] });


  tokens = tokens.map(token => {
    let share = 0;
    let shareFee = 0;
    userPairs.forEach(pair => {
      const { token1, token2 } = pair;
      if(token1 && token2 && token.id !== PRVIDSTR && (token.id === token1.id || token.id === token2.id)) {
        share = pair?.share;
      }
    })

    feePairs.forEach(pair => {
      const { token1, token2 } = pair;
      if(token1 && token2 && token.id !== PRVIDSTR && (token.id === token1.id || token.id === token2.id)) {
        shareFee = pair?.share;
      }
    })

    return {
      ...token,
      share,
      shareFee
    };
  });

  tokens = orderBy(tokens, ['share'], ['desc']);

  console.debug('Log: pairs', pairs);
  console.debug('Log: tokens', tokens);
  console.debug('Log: feePairs', feePairs);
  console.debug('Log: userPairs', userPairs);
  return { pairs, tokens, feePairs, userPairs, shares };
}

const formatContributeHistory = (contribute) => {
  new Validator('formatContributeHistory-contribute', contribute).required().object();
  return {
    id: contribute?.id,
    createdAt: new Date(contribute?.created_at).getTime(),
    updatedAt: new Date(contribute?.updated_at).getTime(),
    requestTx: contribute?.requesttx,
    respondTx: contribute?.respondtx,
    status: contribute?.status,
    pairID: contribute?.pairid,
    tokenId: contribute?.tokenid,
    amount: contribute?.amount,
    returnAmount: contribute?.returnamount,
    paymentAddress: contribute?.contributor,
    blockHeight: contribute?.respondblock,
    lockTime: contribute?.Locktime,
    isStorage: false,
  }
};

const formatWithdrawFeeHistory = (history) => {
  new Validator('formatWithdrawHistory-history', history).required().object();
  return {
    id: history?.requesttx,
    createdAt: new Date(history?.created_at).getTime(),
    updatedAt: new Date(history?.updated_at).getTime(),
    requestTx: history?.requesttx,
    respondTx: history?.respondtx,
    status: history?.status,
    tokenId1: history?.tokenid1,
    tokenId2: history?.tokenid2,
    amount: history?.amount,
    paymentAddress: history?.contributor,
    lockTime: history?.respondtime
  }
};

const formatWithdrawHistory = (history) => {
  new Validator('formatWithdrawHistory-history', history).required().object();
  let responseTx1 = '';
  let responseTx2 = '';
  const responseTxs = history?.respondtx;
  if (!isEmpty(responseTxs)) {
    responseTx1 = responseTxs[0];
    if (responseTxs.length > 1) {
      responseTx2 = responseTxs[1]
    }
  }
  return {
    id: history?.requesttx,
    createdAt: new Date(history?.created_at).getTime(),
    updatedAt: new Date(history?.updated_at).getTime(),
    respondTx: history?.respondtx,
    status: history?.status,
    responseTx1,
    responseTx2,
    tokenId1: history?.tokenid1,
    tokenId2: history?.tokenid2,
    amount1: history?.amount1,
    amount2: history?.amount2,
    paymentAddress: history?.contributor,
    lockTime: history?.respondtime,
    requestTx: history?.requesttx,
  }
};

const createPairHash = ({ tokenId1, tokenId2 }) => {
  new Validator('createPairHash-tokenId1', tokenId1).required().string();
  new Validator('createPairHash-tokenId1', tokenId2).required().string();
  const now = new Date().getTime();
  return `${tokenId1}-${tokenId2}-${now}`
}

export {
  mergeTokens,
  formatContributeHistory,
  formatWithdrawFeeHistory,
  formatWithdrawHistory,
  createPairHash,
}
