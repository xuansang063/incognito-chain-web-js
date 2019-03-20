import ec from "privacy-js-lib/lib/ec";
const P256 = ec.P256;
import bn from "bn.js";

let a = BigInt("2783456789034567894567895678905678");
let aBN = new bn("2783456789034567894567895678905678");

let sp = BigInt(20);
let spBN = new bn(20);

console.time("Derive 1: ");
let result1 = P256.g.derive(spBN, aBN);
console.log("Result1: ", result1);
console.timeEnd("Derive 1: ");

console.time("Derive 2: ");
let result2 = P256.g.deriveOptimized(sp, a);
console.log("Result1: ", result2);
console.timeEnd("Derive 2: ");


console.time("Mul 1: ");
let result3 = P256.g.mul(aBN);
console.log("Result1: ", result3);
console.timeEnd("Mul 1: ");

console.time("Mul 2: ");
let result4 = P256.g.mulOptimized(a);
console.log("Result2: ", result4);
console.timeEnd("Mul 2: ");




