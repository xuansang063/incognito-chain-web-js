package pdexv3

import (
	"encoding/json"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
	"incognito-chain/privacy"
)

// AddOrderRequest
type AddOrderRequest struct {
	TokenToSell         common.Hash                         `json:"TokenToSell"`
	PoolPairID          string                              `json:"PoolPairID"`
	SellAmount          uint64                              `json:"SellAmount"`
	MinAcceptableAmount uint64                              `json:"MinAcceptableAmount"`
	Receiver            map[common.Hash]privacy.OTAReceiver `json:"Receiver"`
	NftID               common.Hash                         `json:"NftID"`
	metadataCommon.MetadataBase
}

func NewAddOrderRequest(
	tokenToSell common.Hash,
	pairID string,
	sellAmount uint64,
	minAcceptableAmount uint64,
	recv map[common.Hash]privacy.OTAReceiver,
	nftID common.Hash,
	metaType int,
) (*AddOrderRequest, error) {
	r := &AddOrderRequest{
		TokenToSell:         tokenToSell,
		PoolPairID:          pairID,
		SellAmount:          sellAmount,
		MinAcceptableAmount: minAcceptableAmount,
		Receiver:            recv,
		NftID:               nftID,
		MetadataBase: metadataCommon.MetadataBase{
			Type: metaType,
		},
	}
	return r, nil
}

func (req AddOrderRequest) ValidateMetadataByItself() bool {
	return req.Type == metadataCommon.Pdexv3AddOrderRequestMeta
}

func (req AddOrderRequest) Hash() *common.Hash {
	rawBytes, _ := json.Marshal(req)
	hash := common.HashH([]byte(rawBytes))
	return &hash
}

func (req *AddOrderRequest) UnmarshalJSON(raw []byte) error {
	var temp struct {
		TokenToSell         common.Hash                         `json:"TokenToSell"`
		PoolPairID          string                              `json:"PoolPairID"`
		SellAmount          metadataCommon.Uint64Reader         `json:"SellAmount"`
		MinAcceptableAmount metadataCommon.Uint64Reader         `json:"MinAcceptableAmount"`
		Receiver            map[common.Hash]privacy.OTAReceiver `json:"Receiver"`
		NftID               common.Hash                         `json:"NftID"`
		metadataCommon.MetadataBase
	}
	err := json.Unmarshal(raw, &temp)
	*req = AddOrderRequest{
		TokenToSell:         temp.TokenToSell,
		PoolPairID:          temp.PoolPairID,
		SellAmount:          uint64(temp.SellAmount),
		MinAcceptableAmount: uint64(temp.MinAcceptableAmount),
		Receiver:            temp.Receiver,
		NftID:               temp.NftID,
		MetadataBase:        temp.MetadataBase,
	}
	return err
}
