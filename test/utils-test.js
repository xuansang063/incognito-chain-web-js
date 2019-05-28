
import {toConstant} from '../lib/wallet/utils';

const res = toConstant(1000);

console.log(res);
console.log(typeof res);



function a(){
    if (1){
        throw new Error("AAAAAA");
    }

    console.log("BBBBBBBB");
}

a()
