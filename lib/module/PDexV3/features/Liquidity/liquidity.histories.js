import { LIQUIDITY_STATUS, LIQUIDITY_STATUS_STR } from '@lib/module/Account/account.constants';

function mapperStatus({
  histories
}) {
  return histories.map(history => {
    const { status } = history;
    let statusText;
    if (
      LIQUIDITY_STATUS.REFUND.includes(status) ||
      LIQUIDITY_STATUS.REJECTED.includes(status) ||
      LIQUIDITY_STATUS.FAIL.includes(status))
    {
      statusText = LIQUIDITY_STATUS_STR.FAILED;
    } else if (LIQUIDITY_STATUS.ACCEPTED.includes(status)) {
      statusText = LIQUIDITY_STATUS_STR.SUCCESSFUL;
    } else {
      statusText = LIQUIDITY_STATUS_STR.PENDING;
    }
    return {
      ...history,
      statusText,
    };
  })
}

export default ({
  mapperStatus
})
