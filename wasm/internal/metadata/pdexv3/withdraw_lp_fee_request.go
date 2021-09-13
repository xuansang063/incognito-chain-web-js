package pdexv3

import (
	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
	"incognito-chain/privacy"
)

type WithdrawalLPFeeRequest struct {
	metadataCommon.MetadataBase
	PoolPairID string                              `json:"PoolPairID"`
	NftID      common.Hash                         `json:"NftID"`
	Receivers  map[common.Hash]privacy.OTAReceiver `json:"Receivers"`
}

type WithdrawalLPFeeContent struct {
	PoolPairID string                       `json:"PoolPairID"`
	NftID      common.Hash                  `json:"NftID"`
	TokenID    common.Hash                  `json:"TokenID"`
	Receivers  map[common.Hash]ReceiverInfo `json:"Receivers"`
	TxReqID    common.Hash                  `json:"TxReqID"`
	ShardID    byte                         `json:"ShardID"`
}

type WithdrawalLPFeeStatus struct {
	Status    int                          `json:"Status"`
	Receivers map[common.Hash]ReceiverInfo `json:"Receivers"`
}

func NewPdexv3WithdrawalLPFeeRequest(
	metaType int,
	pairID string,
	nftID common.Hash,
	receivers map[common.Hash]privacy.OTAReceiver,
) (*WithdrawalLPFeeRequest, error) {
	metadataBase := metadataCommon.NewMetadataBase(metaType)

	return &WithdrawalLPFeeRequest{
		MetadataBase: *metadataBase,
		PoolPairID:   pairID,
		NftID:        nftID,
		Receivers:    receivers,
	}, nil
}
