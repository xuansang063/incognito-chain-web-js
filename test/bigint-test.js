import bn from 'bn.js';

console.time("1")
let temp1 = new bn('100000000000')
let temp2 = new bn('400000000000')
let temp3 = temp1.umod(temp2)
console.log(temp3 + '')
console.timeEnd("1")

console.time("2")
temp1 = BigInt(temp1 + '')
temp2 = BigInt(temp2 + '')
console.log((temp1 % temp2))
console.timeEnd("2")
