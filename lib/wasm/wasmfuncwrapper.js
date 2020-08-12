import { Wallet } from "../wallet/wallet";

const requiredTimeFuncName = [
    'initPrivacyTx',
  'stopAutoStaking',
  'staking',
  'initPrivacyTokenTx',
  'initBurningRequestTx',
  'initWithdrawRewardTx',
  'initPRVContributionTx',
  'initPTokenContributionTx',
  'initPRVTradeTx',
  'initPTokenTradeTx',
  'withdrawDexTx',
];

const asyncFuncName = [
    'generateBLSKeyPairFromSeed',
    'deriveSerialNumber',
    'randomScalars',
    'hybridEncryptionASM',
    'hybridDecryptionASM',
]

const syncFuncName = [
    'generateKeyFromSeed',
    'scalarMultBase',
]


async function getNodeTime() {
    return Wallet.RpcClient.getNodeTime();
}

function getGlobalFunc(funcName) {
    let globalFunc;
    
    if (typeof window !== 'undefined') {
        // browser
        globalFunc = window[funcName];
    } else if (typeof global !== 'undefined') { 
        // node, react native 
        globalFunc = global[funcName];
    }

    if (globalFunc) {
        return globalFunc;
    }

    throw new Error(`Can not found global function ${funcName}`);    
}

function createWrapperAsyncFunc(funcName) {
    const globalFunc = getGlobalFunc(funcName);

    return async function(data) {
        return globalFunc(data);
    };
}

function createWrapperSyncFunc(funcName) {
    const globalFunc = getGlobalFunc(funcName);

    return function(data) {
        return globalFunc(data);
    };
}

function createWrapperRequiredTimeFunc(funcName) {
    const globalFunc = getGlobalFunc(funcName);

    return async function(data) {
        const time = await getNodeTime();
        return globalFunc(data, time);
    }
}

function getWrapperFunc(funcName) {
    let func;
    if (requiredTimeFuncName.includes(funcName)) {
        func = createWrapperRequiredTimeFunc(funcName);
    } else if (asyncFuncName.includes(funcName)) {
        func = createWrapperAsyncFunc(funcName);
        console.log("Func from async: ", func);
    } else if (syncFuncName.includes(funcName)){
        func = createWrapperSyncFunc(funcName);
    }

    if (typeof func === 'function') {
        wasmFuncs[funcName] = func;
        return func;
    } else {
        console.log(`Not found wasm function name ${funcName}`);
        throw new Error("Invalid wasm function name");
    }
}

const wasmFuncs = new Proxy({
    deriveSerialNumber: null,
    initPrivacyTx: null,
    randomScalars: null,
    staking: null,
    stopAutoStaking: null,
    initPrivacyTokenTx: null,
    withdrawDexTx: null,
    initPTokenTradeTx: null,
    initPRVTradeTx: null,
    initPTokenContributionTx: null,
    initPRVContributionTx: null,
    initWithdrawRewardTx: null,
    initBurningRequestTx: null,
    generateKeyFromSeed: null,
    scalarMultBase: null,
    hybridEncryptionASM: null,
    hybridDecryptionASM: null,
    generateBLSKeyPairFromSeed: null,
  }, {
    get: function(obj, prop) {
      return obj[prop] || getWrapperFunc(prop);
    },
    set: function(obj, prop, value) {
      if (typeof value === 'function') {
        obj[prop] = value;
      } else {
        throw new Error(`${prop} must be a function`);
      }
  
      return true;
    }
  });


export default wasmFuncs;