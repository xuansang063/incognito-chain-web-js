package pdexv3

import (
	"encoding/json"
	"math/big"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
	"incognito-chain/privacy"
)

// TradeStatus containns the info tracked by feature statedb, which is then displayed in RPC status queries.
// For refunded trade, all fields except Status are ignored
type TradeStatus struct {
	Status     int         `json:"Status"`
	BuyAmount  uint64      `json:"BuyAmount"`
	TokenToBuy common.Hash `json:"TokenToBuy"`
}

// TradeResponse is the metadata inside response tx for trade
type TradeResponse struct {
	Status      int         `json:"Status"`
	RequestTxID common.Hash `json:"RequestTxID"`
	metadataCommon.MetadataBase
}

// AcceptedTrade is added as Content for produced beacon Instructions after handling a trade successfully
type AcceptedTrade struct {
	Receiver     privacy.OTAReceiver      `json:"Receiver"`
	Amount       uint64                   `json:"Amount"`
	TradePath    []string                 `json:"TradePath"`
	TokenToBuy   common.Hash              `json:"TokenToBuy"`
	PairChanges  [][2]*big.Int            `json:"PairChanges"`
	OrderChanges []map[string][2]*big.Int `json:"OrderChanges"`
}

func (md AcceptedTrade) GetType() int {
	return metadataCommon.Pdexv3TradeRequestMeta
}

func (md AcceptedTrade) GetStatus() int {
	return TradeAcceptedStatus
}

// RefundedTrade is added as Content for produced beacon instruction after failure to handle a trade
type RefundedTrade struct {
	Receiver privacy.OTAReceiver `json:"Receiver"`
	TokenID  common.Hash         `json:"TokenToSell"`
	Amount   uint64              `json:"Amount"`
}

func (md RefundedTrade) GetType() int {
	return metadataCommon.Pdexv3TradeRequestMeta
}

func (md RefundedTrade) GetStatus() int {
	return TradeRefundedStatus
}

func (res TradeResponse) Hash() *common.Hash {
	rawBytes, _ := json.Marshal(res)
	hash := common.HashH([]byte(rawBytes))
	return &hash
}
