import {bytesToString, stringToBytes} from "../../lib/privacy/utils";

function TestConvertStringAndBytesArray(){
    let str = "rose's so cute";
    let bytes = stringToBytes(str);
    console.log("bytes: ", bytes);

    let str2 = bytesToString(bytes);
    console.log("str2: ", str2);

}

TestConvertStringAndBytesArray();