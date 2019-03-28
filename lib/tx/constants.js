const TxNormalType             = "n";  // normal tx(send and receive coin)
const TxSalaryType             = "s";  // salary tx(gov pay salary for block producer)
const TxCustomTokenType        = "t";  // token  tx with no supporting privacy
const TxCustomTokenPrivacyType = "tp"; // token  tx with supporting privacy

const CustomTokenInit = 0;
const CustomTokenTransfer = 1;
const TxVersion = 1;

export {TxNormalType, TxSalaryType, TxCustomTokenType, TxCustomTokenPrivacyType, CustomTokenInit, CustomTokenTransfer, TxVersion};