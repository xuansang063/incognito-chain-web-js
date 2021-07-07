import { checkEncode } from "@lib/common/base58";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "@lib/common/committeekey";
import { getChildIdFromChildNumberArray } from "@lib/common/common";
import { ENCODE_VERSION } from "@lib/common/constants";
import {
  KeyWallet,
  OTAKeyType,
  PaymentAddressType,
  PriKeyType,
  ReadonlyKeyType,
} from "@lib/core";
import { hashSha3BytesToBytes } from "@lib/privacy/utils";
import Validator from "@lib/utils/validator";
import { wasm } from "@lib/wasm";

const deserializedAccounts = {};

function getOTAKey() {
  return this.key.base58CheckSerialize(OTAKeyType);
}

function getPaymentAddress() {
  return this.key.base58CheckSerialize(PaymentAddressType);
}

function getPrivateKey() {
  return this.key.base58CheckSerialize(PriKeyType);
}

function getReadonlyKey() {
  return this.key.base58CheckSerialize(ReadonlyKeyType);
}

async function getSignPublicKeyEncode() {
  try {
    const privateKey = this.getPrivateKey();
    const result = await wasm.getSignPublicKey(
      JSON.stringify({ data: { privateKey } })
    );
    return result;
  } catch (error) {
    throw error;
  }
}

async function setKey(privateKey) {
  new Validator("privateKey", privateKey).required();
  // transactor needs private key to sign TXs. Read key in encoded or raw form
  if (typeof privateKey == "string") {
    this.key = KeyWallet.base58CheckDeserialize(privateKey);
  } else if (privateKey.length && privateKey.length == 32) {
    this.key = KeyWallet.deserialize(privateKey);
  } else {
    this.key = new KeyWallet();
    return this.key;
  }
  let result = await this.key.KeySet.importFromPrivateKey(
    this.key.KeySet.PrivateKey
  );
  return result;
}

async function getDeserializeInformation() {
  const privateKey = this.getPrivateKey();
  if (deserializedAccounts[privateKey]) {
    return {
      ...deserializedAccounts[privateKey],
      AccountName: this.name,
    };
  }
  const miningSeedKey = hashSha3BytesToBytes(
    hashSha3BytesToBytes(this.key.KeySet.PrivateKey)
  );
  const blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(
    miningSeedKey
  );
  const information = {
    ID: getChildIdFromChildNumberArray(this.key.ChildNumber),
    AccountName: this.name,
    PrivateKey: privateKey,
    PaymentAddress: this.key.base58CheckSerialize(PaymentAddressType),
    ReadonlyKey: this.key.base58CheckSerialize(ReadonlyKeyType),
    PublicKey: this.key.getPublicKeyByHex(),
    PublicKeyCheckEncode: this.key.getPublicKeyCheckEncode(),
    ValidatorKey: checkEncode(miningSeedKey, ENCODE_VERSION, true),
    BLSPublicKey: blsPublicKey,
    PublicKeyBytes: this.key.KeySet.PaymentAddress.Pk.toString(),
    OTAKey: this.getOTAKey(),
    PaymentAddressV1: this.getPaymentAddressV1(),
  };
  deserializedAccounts[privateKey] = information;
  return information;
}

// toSerializedAccountObj returns account with encoded key set
function toSerializedAccountObj() {
  return {
    AccountName: this.name,
    PrivateKey: this.getPrivateKey(),
    PaymentAddress: this.key.base58CheckSerialize(PaymentAddressType),
    ReadonlyKey: this.key.base58CheckSerialize(ReadonlyKeyType),
    PublicKey: this.key.getPublicKeyByHex(),
    PublicKeyCheckEncode: this.key.getPublicKeyCheckEncode(),
    PublicKeyBytes: this.key.KeySet.PaymentAddress.Pk.toString(),
    ValidatorKey: checkEncode(
      hashSha3BytesToBytes(hashSha3BytesToBytes(this.key.KeySet.PrivateKey)),
      ENCODE_VERSION,
      true
    ),
    PaymentAddressV1: this.getPaymentAddressV1(),
  };
}

function getPaymentAddressV1() {
  const newPaymentAddress = this.getPaymentAddress();
  return this.key.toLegacyPaymentAddress(newPaymentAddress);
}

export default {
  getOTAKey,
  getPaymentAddress,
  getPrivateKey,
  getSignPublicKeyEncode,
  getReadonlyKey,
  setKey,
  getDeserializeInformation,
  toSerializedAccountObj,
  getPaymentAddressV1,
};
