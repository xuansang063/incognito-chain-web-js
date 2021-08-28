package pdexv3

import (
	"encoding/json"
	"strconv"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
)

type WithdrawLiquidityRequest struct {
	metadataCommon.MetadataBase
	poolPairID       string
	nftID            string
	otaReceiveNft    string
	otaReceiveToken0 string
	otaReceiveToken1 string
	shareAmount      uint64
}

func NewWithdrawLiquidityRequest() *WithdrawLiquidityRequest {
	return &WithdrawLiquidityRequest{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3WithdrawLiquidityRequestMeta,
		},
	}
}

func NewWithdrawLiquidityRequestWithValue(
	poolPairID, nftID, otaReceiveNft,
	otaReceiveToken0, otaReceiveToken1 string,
	shareAmount uint64,
) *WithdrawLiquidityRequest {
	return &WithdrawLiquidityRequest{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3WithdrawLiquidityRequestMeta,
		},
		poolPairID:       poolPairID,
		nftID:            nftID,
		otaReceiveNft:    otaReceiveNft,
		otaReceiveToken0: otaReceiveToken0,
		otaReceiveToken1: otaReceiveToken1,
		shareAmount:      shareAmount,
	}
}

func (request *WithdrawLiquidityRequest) Hash() *common.Hash {
	record := request.MetadataBase.Hash().String()
	record += request.poolPairID
	record += request.nftID
	record += request.otaReceiveNft
	record += request.otaReceiveToken0
	record += request.otaReceiveToken1
	record += strconv.FormatUint(uint64(request.shareAmount), 10)
	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (request *WithdrawLiquidityRequest) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(struct {
		PoolPairID       string `json:"PoolPairID"`
		NftID            string `json:"NftID"`
		OtaReceiveNft    string `json:"OtaReceiveNft"`
		OtaReceiveToken0 string `json:"OtaReceiveToken0"`
		OtaReceiveToken1 string `json:"OtaReceiveToken1"`
		ShareAmount      uint64 `json:"ShareAmount"`
		metadataCommon.MetadataBase
	}{
		PoolPairID:       request.poolPairID,
		NftID:            request.nftID,
		OtaReceiveNft:    request.otaReceiveNft,
		OtaReceiveToken0: request.otaReceiveToken0,
		OtaReceiveToken1: request.otaReceiveToken1,
		ShareAmount:      request.shareAmount,
		MetadataBase:     request.MetadataBase,
	})
	if err != nil {
		return []byte{}, err
	}
	return data, nil
}

func (request *WithdrawLiquidityRequest) UnmarshalJSON(data []byte) error {
	temp := struct {
		PoolPairID       string `json:"PoolPairID"`
		NftID            string `json:"NftID"`
		OtaReceiveNft    string `json:"OtaReceiveNft"`
		OtaReceiveToken0 string `json:"OtaReceiveToken0"`
		OtaReceiveToken1 string `json:"OtaReceiveToken1"`
		ShareAmount      uint64 `json:"ShareAmount"`
		metadataCommon.MetadataBase
	}{}
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	request.poolPairID = temp.PoolPairID
	request.nftID = temp.NftID
	request.otaReceiveNft = temp.OtaReceiveNft
	request.otaReceiveToken0 = temp.OtaReceiveToken0
	request.otaReceiveToken1 = temp.OtaReceiveToken1
	request.shareAmount = temp.ShareAmount
	request.MetadataBase = temp.MetadataBase
	return nil
}

func (request *WithdrawLiquidityRequest) PoolPairID() string {
	return request.poolPairID
}

func (request *WithdrawLiquidityRequest) OtaReceiveNft() string {
	return request.otaReceiveNft
}

func (request *WithdrawLiquidityRequest) ShareAmount() uint64 {
	return request.shareAmount
}

func (request *WithdrawLiquidityRequest) NftID() string {
	return request.nftID
}

func (request *WithdrawLiquidityRequest) OtaReceiveToken0() string {
	return request.otaReceiveToken0
}

func (request *WithdrawLiquidityRequest) OtaReceiveToken1() string {
	return request.otaReceiveToken1
}
