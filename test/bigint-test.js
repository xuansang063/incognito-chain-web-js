import bn from 'bn.js';
import bigInt from 'big-integer'

let ECC = require('elliptic');
let Elliptic = ECC.ec;

let n = bn.red((new Elliptic('p256')).n.clone())
let a = new bn("1")
let b = new bn("2")
console.time("1")
for (let i = 0; i < 100; i++) {
  let c = a.toRed(n).redAdd(b.toRed(n))
  let temp3 = c.redInvm().fromRed()
  // console.log(temp3.toString())
}
console.timeEnd("1")

// console.time("2")
// temp1 = BigInt(temp1 + '')
// temp2 = BigInt(temp2 + '')
// console.log((temp1 % temp2))
// console.timeEnd("2")

console.time("2")
for (let i = 0; i < 100; i++) {
  let c = bigInt(a.toString()).plus(bigInt(b.toString()))
  let temp3 = c.modInv(bigInt((new Elliptic('p256')).n.toString()))
  // console.log(temp3.toString())
}
console.timeEnd("2")
