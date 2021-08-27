package pdexv3

import (
	"encoding/json"
	"strconv"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
)

type AddLiquidityRequest struct {
	poolPairID  string // only "" for the first contribution of pool
	pairHash    string
	otaReceive  string // receive nfct
	otaRefund   string // refund pToken
	tokenID     string
	nftID       string
	tokenAmount uint64
	amplifier   uint // only set for the first contribution
	metadataCommon.MetadataBase
}

func NewAddLiquidity() *AddLiquidityRequest {
	return &AddLiquidityRequest{}
}

func NewAddLiquidityRequestWithValue(
	poolPairID, pairHash,
	otaReceive, otaRefund,
	tokenID, nftID string, tokenAmount uint64, amplifier uint,
) *AddLiquidityRequest {
	metadataBase := metadataCommon.MetadataBase{
		Type: metadataCommon.Pdexv3AddLiquidityRequestMeta,
	}
	return &AddLiquidityRequest{
		poolPairID:   poolPairID,
		pairHash:     pairHash,
		otaReceive:   otaReceive,
		otaRefund:    otaRefund,
		tokenID:      tokenID,
		nftID:        nftID,
		tokenAmount:  tokenAmount,
		amplifier:    amplifier,
		MetadataBase: metadataBase,
	}
}

func (request *AddLiquidityRequest) Hash() *common.Hash {
	record := request.MetadataBase.Hash().String()
	record += request.poolPairID
	record += request.pairHash
	record += request.otaReceive
	record += request.otaRefund
	record += request.tokenID
	record += request.nftID
	record += strconv.FormatUint(uint64(request.amplifier), 10)
	record += strconv.FormatUint(request.tokenAmount, 10)
	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (request *AddLiquidityRequest) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(struct {
		PoolPairID  string `json:"PoolPairID"` // only "" for the first contribution of pool
		PairHash    string `json:"PairHash"`
		OtaReceive  string `json:"OtaReceive"` // receive nfct
		OtaRefund   string `json:"OtaRefund"`  // refund pToken
		TokenID     string `json:"TokenID"`
		NftID       string `json:"NftID"`
		TokenAmount uint64 `json:"TokenAmount"`
		Amplifier   uint   `json:"Amplifier"` // only set for the first contribution
		metadataCommon.MetadataBase
	}{
		PoolPairID:   request.poolPairID,
		PairHash:     request.pairHash,
		OtaReceive:   request.otaReceive,
		OtaRefund:    request.otaRefund,
		TokenID:      request.tokenID,
		NftID:        request.nftID,
		TokenAmount:  request.tokenAmount,
		Amplifier:    request.amplifier,
		MetadataBase: request.MetadataBase,
	})
	if err != nil {
		return []byte{}, err
	}
	return data, nil
}

func (request *AddLiquidityRequest) UnmarshalJSON(data []byte) error {
	temp := struct {
		PoolPairID  string `json:"PoolPairID"` // only "" for the first contribution of pool
		PairHash    string `json:"PairHash"`
		OtaReceive  string `json:"OtaReceive"` // receive nfct
		OtaRefund   string `json:"OtaRefund"`  // refund pToken
		TokenID     string `json:"TokenID"`
		NftID       string `json:"NftID"`
		TokenAmount uint64 `json:"TokenAmount"`
		Amplifier   uint   `json:"Amplifier"` // only set for the first contribution
		metadataCommon.MetadataBase
	}{}
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	request.poolPairID = temp.PoolPairID
	request.pairHash = temp.PairHash
	request.otaReceive = temp.OtaReceive
	request.otaRefund = temp.OtaRefund
	request.tokenID = temp.TokenID
	request.nftID = temp.NftID
	request.tokenAmount = temp.TokenAmount
	request.amplifier = temp.Amplifier
	request.MetadataBase = temp.MetadataBase
	return nil
}

func (request *AddLiquidityRequest) PoolPairID() string {
	return request.poolPairID
}

func (request *AddLiquidityRequest) PairHash() string {
	return request.pairHash
}

func (request *AddLiquidityRequest) OtaReceive() string {
	return request.otaReceive
}

func (request *AddLiquidityRequest) OtaRefund() string {
	return request.otaRefund
}

func (request *AddLiquidityRequest) TokenID() string {
	return request.tokenID
}

func (request *AddLiquidityRequest) TokenAmount() uint64 {
	return request.tokenAmount
}

func (request *AddLiquidityRequest) Amplifier() uint {
	return request.amplifier
}

func (request *AddLiquidityRequest) NftID() string {
	return request.nftID
}
