import {genImageFromStr} from "../lib/wallet/utils";
import {hashSha3BytesToBytes} from "privacy-js-lib/lib/privacy_utils";
import { convertHashToStr } from "../lib/common";


let bytes = [1,2,3];
let hash = hashSha3BytesToBytes(bytes);
let str = convertHashToStr(hash);
let res = genImageFromStr(str);
console.log("Result identicon: ", res);
