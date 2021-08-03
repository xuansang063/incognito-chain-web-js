import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { MaxInputNumberForDefragment } from "@lib/module/Account/account.constants";
import { prepareInputForTxV2 } from "@lib/module/Account/account.utils";

// recursively sweep up everything into one UTXO
async function defragmentNativeCoin({
  transfer: { fee } = {},
  extra: { noOfInputPerTx = MaxInputNumberForDefragment } = {},
}) {
  const info = "defragment";
  // loop up to 30 times
  const MAX_ITERATIONS = 100;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    await this.updateProgressTx(i + 1, `Combining UTXOs - TX #${i}`);
    try {
      let inputForTx;
      try {
        inputForTx = await prepareInputForTxV2(
          {
            amountTransfer: totalAmountTransfer,
            fee,
            account: this,
            tokenID: PRVIDSTR,
          } - 1,
          fee,
          null,
          this,
          2,
          0,
          noOfInputPerTx
        );
      } catch (e) {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          "Error while preparing inputs",
          e
        );
      }
      if (inputForTx.inputCoinStrs.length == 1) {
        break;
      }
      let result = await this.transact({
        transfer: { fee, info },
        extra: { noOfInputPerTx },
      });
      await this.updateProgressTx(100, "Completed");
      return result;
    } catch (e) {
      throw e;
    }
  }
}

export default {
  defragmentNativeCoin,
};
