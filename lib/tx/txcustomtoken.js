import {Tx} from 'txprivacy';
import {TxTokenVin, TxTokenVout, TxTokenData} from 'txcustomtokendata';



class TxCustomToken extends Tx{
    constructor(rpcUrl){
        super(rpcUrl);

        this.txTokenData = new TxTokenData();
    }
}