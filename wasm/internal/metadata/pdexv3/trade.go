package pdexv3

import (
	"encoding/json"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
	"incognito-chain/privacy"
)

// TradeRequest
type TradeRequest struct {
	TradePath           []string                            `json:"TradePath"`
	TokenToSell         common.Hash                         `json:"TokenToSell"`
	SellAmount          uint64                              `json:"SellAmount"`
	MinAcceptableAmount uint64                              `json:"MinAcceptableAmount"`
	TradingFee          uint64                              `json:"TradingFee"`
	Receiver            map[common.Hash]privacy.OTAReceiver `json:"Receiver"`
	metadataCommon.MetadataBase
}

func NewTradeRequest(
	tradePath []string,
	tokenToSell common.Hash,
	sellAmount uint64,
	minAcceptableAmount uint64,
	tradingFee uint64,
	recv map[common.Hash]privacy.OTAReceiver,
	metaType int,
) (*TradeRequest, error) {
	pdeTradeRequest := &TradeRequest{
		TradePath:           tradePath,
		TokenToSell:         tokenToSell,
		SellAmount:          sellAmount,
		MinAcceptableAmount: minAcceptableAmount,
		TradingFee:          tradingFee,
		Receiver:            recv,
		MetadataBase: metadataCommon.MetadataBase{
			Type: metaType,
		},
	}
	return pdeTradeRequest, nil
}

func (req TradeRequest) Hash() *common.Hash {
	rawBytes, _ := json.Marshal(req)
	hash := common.HashH([]byte(rawBytes))
	return &hash
}
