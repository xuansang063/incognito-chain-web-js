package pdexv3

import (
	"encoding/json"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
)

type WithdrawLiquidityResponse struct {
	metadataCommon.MetadataBase
	status  string
	txReqID string
}

func NewWithdrawLiquidityResponse() *WithdrawLiquidityResponse {
	return &WithdrawLiquidityResponse{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3WithdrawLiquidityResponseMeta,
		},
	}
}

func NewWithdrawLiquidityResponseWithValue(status, txReqID string) *WithdrawLiquidityResponse {
	return &WithdrawLiquidityResponse{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3WithdrawLiquidityResponseMeta,
		},
		status:  status,
		txReqID: txReqID,
	}
}

func (response *WithdrawLiquidityResponse) Hash() *common.Hash {
	record := response.MetadataBase.Hash().String()
	record += response.status
	record += response.txReqID
	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (response *WithdrawLiquidityResponse) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(struct {
		Status  string `json:"Status"`
		TxReqID string `json:"TxReqID"`
		metadataCommon.MetadataBase
	}{
		Status:       response.status,
		TxReqID:      response.txReqID,
		MetadataBase: response.MetadataBase,
	})
	if err != nil {
		return []byte{}, err
	}
	return data, nil
}

func (response *WithdrawLiquidityResponse) UnmarshalJSON(data []byte) error {
	temp := struct {
		Status  string `json:"Status"`
		TxReqID string `json:"TxReqID"`
		metadataCommon.MetadataBase
	}{}
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	response.txReqID = temp.TxReqID
	response.status = temp.Status
	response.MetadataBase = temp.MetadataBase
	return nil
}

func (response *WithdrawLiquidityResponse) TxReqID() string {
	return response.txReqID
}

func (response *WithdrawLiquidityResponse) Status() string {
	return response.status
}

type AcceptWithdrawLiquidity struct {
	PoolPairID  string      `json:"PoolPairID"`
	NftID       common.Hash `json:"NftID"`
	TokenID     common.Hash `json:"TokenID"`
	TokenAmount uint64      `json:"TokenAmount"`
	OtaReceive  string      `json:"OtaReceive"`
	ShareAmount uint64      `json:"ShareAmount"`
	TxReqID     common.Hash `json:"TxReqID"`
	ShardID     byte        `jdon:"ShardID"`
}
