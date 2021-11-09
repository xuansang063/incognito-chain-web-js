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

func (req *TradeRequest) UnmarshalJSON(raw []byte) error {
	var temp struct {
		TradePath           []string                            `json:"TradePath"`
		TokenToSell         common.Hash                         `json:"TokenToSell"`
		SellAmount          metadataCommon.Uint64Reader         `json:"SellAmount"`
		MinAcceptableAmount metadataCommon.Uint64Reader         `json:"MinAcceptableAmount"`
		TradingFee          metadataCommon.Uint64Reader         `json:"TradingFee"`
		Receiver            map[common.Hash]privacy.OTAReceiver `json:"Receiver"`
		metadataCommon.MetadataBase
	}
	err := json.Unmarshal(raw, &temp)
	*req = TradeRequest{
		TradePath:           temp.TradePath,
		TokenToSell:         temp.TokenToSell,
		SellAmount:          uint64(temp.SellAmount),
		MinAcceptableAmount: uint64(temp.MinAcceptableAmount),
		TradingFee:          uint64(temp.TradingFee),
		Receiver:            temp.Receiver,
		MetadataBase:        temp.MetadataBase,
	}
	return err
}
