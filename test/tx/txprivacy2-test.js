const { Tx2} = require("../../lib/tx/txprivacy2");

async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestInitTx2() {

    await sleep(5000);
    let senderSK =  "1111111Cn12xMDjtrERbEauPtp3YS6yq3WnjuuYnndZmM9eyTJVbaYbzF5GbzAUmHcfAnCZPhmcNgGrWDNgtaGybAJhjDtnAKqGU5X42p8U";
    let amountTransfer = 15;
    let paramPaymentInfos = {"12S6aqNPEQpkxQrw2CcviWsupakwLdBnnHvVqaYdqXsudDdaFqSEKHc4da3Wzt6erP5J1apAZLhvst2CEvTKXqYhSUPyrp4t13okH6a" : amountTransfer};
    let fee  = 10;
    let hasPrivacy = true;
    let tokenID = null;
    let metaData = null;
    let info = "";

    let result = await Tx2.init(senderSK, paramPaymentInfos, fee, hasPrivacy, tokenID, metaData, info);
    console.log("Result: ", result);


    let privateKey = "112t8rnaWQbUWmdGZW2LtF2dzBFVfWBBzH3xviG7TWvwCVNZ3tPygcTKK8kv4jzYQwHo3BDZvERWJHL9Kp9AhAMtG4my9GoARtXDxTUyWSRD";
    // let snds = [

    // ];


}

TestInitTx2();