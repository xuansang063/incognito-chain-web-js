package pdexv3

import (
	"encoding/json"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
	"incognito-chain/privacy"
)

// WithdrawOrderRequest
type WithdrawOrderRequest struct {
	PoolPairID string              `json:"PoolPairID"`
	OrderID    string              `json:"OrderID"`
	TokenID    common.Hash         `json:"TokenID"`
	Amount     uint64              `json:"Amount"`
	Receiver   privacy.OTAReceiver `json:"Receiver"`
	NftID      common.Hash         `json:"NftID"`
	metadataCommon.MetadataBase
}

func NewWithdrawOrderRequest(
	pairID, orderID string,
	tokenID common.Hash,
	amount uint64,
	recv privacy.OTAReceiver,
	nftID common.Hash,
	metaType int,
) (*WithdrawOrderRequest, error) {
	r := &WithdrawOrderRequest{
		PoolPairID: pairID,
		OrderID:    orderID,
		TokenID:    tokenID,
		Amount:     amount,
		Receiver:   recv,
		NftID:      nftID,
		MetadataBase: metadataCommon.MetadataBase{
			Type: metaType,
		},
	}
	return r, nil
}

func (req WithdrawOrderRequest) Hash() *common.Hash {
	rawBytes, _ := json.Marshal(req)
	hash := common.HashH([]byte(rawBytes))
	return &hash
}

func (req *WithdrawOrderRequest) GetOTADeclarations() []metadataCommon.OTADeclaration {
	var result []metadataCommon.OTADeclaration
	tokenID := req.TokenID
	if tokenID != common.PRVCoinID {
		tokenID = common.ConfidentialAssetID
	}
	result = append(result, metadataCommon.OTADeclaration{
		PublicKey: req.Receiver.PublicKey.ToBytes(), TokenID: tokenID,
	})
	return result
}
