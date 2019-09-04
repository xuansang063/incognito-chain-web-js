const {P256} = require("privacy-js-lib/lib/ec");
const {randScalar} = require("privacy-js-lib/lib/privacy_utils");


// let res = P256.decompress([3, 103, 241, 191, 95, 98, 86, 222, 240, 109, 106, 109, 126, 66, 253, 33, 157, 113, 186, 196, 99, 190, 65, 40, 140, 27, 106, 0, 101, 208, 231, 112, 150]);
// console.log("res: ", res);

function TestRandScalar(){
    for (let i =0; i< 1000000; i++){
        let a = randScalar();
        let b = randScalar();
        let c = randScalar();
        let d = randScalar();

        let sum = a.add(b);
        sum = sum.add(c);
        sum = sum.add(d);
        let sum1 = sum.mod(P256.n);
        let sum2 = sum.umod(P256.n);

        let e = randScalar();
        let diff1 = e.sub(sum1);
        diff1 = diff1.umod(P256.n);

        let diff2 = e.sub(sum2);
        diff2 = diff2.umod(P256.n);

        if (!diff1.eq(diff2)){
            console.log("sum1: ", sum1);
            console.log("sum2: ", sum2);
            console.log("diff1: ", diff1);
            console.log("diff2: ", diff2);
            console.log("False");
        }
    }

    console.log("TRue");
}

// TestRandScalar()

function TestEllipticEqual(){
    let p1 = P256.randomize();
    let p2 = P256.randomize();

    if (p1.eq(p2)){
        console.log("Equal");
    } else{
        console.log("Not equal")
    }

}

TestEllipticEqual();


