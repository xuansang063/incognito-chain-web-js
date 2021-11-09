package pdexv3

import (
	"encoding/json"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
)

type StakingRequest struct {
	metadataCommon.MetadataBase
	tokenID     string
	otaReceiver string
	nftID       string
	tokenAmount uint64
}

func NewStakingRequest() *StakingRequest {
	return &StakingRequest{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3StakingRequestMeta,
		},
	}
}

func NewStakingRequestWithValue(
	tokenID, nftID, otaReceiver string, tokenAmount uint64,
) *StakingRequest {
	return &StakingRequest{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3StakingRequestMeta,
		},
		tokenID:     tokenID,
		nftID:       nftID,
		tokenAmount: tokenAmount,
		otaReceiver: otaReceiver,
	}
}

func (request *StakingRequest) Hash() *common.Hash {
	rawBytes, _ := json.Marshal(&request)
	hash := common.HashH([]byte(rawBytes))
	return &hash
}

func (request *StakingRequest) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(struct {
		OtaReceiver string `json:"OtaReceiver"`
		TokenID     string `json:"TokenID"`
		NftID       string `json:"NftID"`
		TokenAmount uint64 `json:"TokenAmount"`
		metadataCommon.MetadataBase
	}{
		OtaReceiver:  request.otaReceiver,
		TokenID:      request.tokenID,
		NftID:        request.nftID,
		TokenAmount:  request.tokenAmount,
		MetadataBase: request.MetadataBase,
	})
	if err != nil {
		return []byte{}, err
	}
	return data, nil
}

func (request *StakingRequest) UnmarshalJSON(data []byte) error {
	temp := struct {
		OtaReceiver string                      `json:"OtaReceiver"`
		TokenID     string                      `json:"TokenID"`
		NftID       string                      `json:"NftID"`
		TokenAmount metadataCommon.Uint64Reader `json:"TokenAmount"`
		metadataCommon.MetadataBase
	}{}
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	request.otaReceiver = temp.OtaReceiver
	request.tokenID = temp.TokenID
	request.nftID = temp.NftID
	request.tokenAmount = uint64(temp.TokenAmount)
	request.MetadataBase = temp.MetadataBase
	return nil
}

func (request *StakingRequest) OtaReceiver() string {
	return request.otaReceiver
}

func (request *StakingRequest) TokenID() string {
	return request.tokenID
}

func (request *StakingRequest) TokenAmount() uint64 {
	return request.tokenAmount
}

func (request *StakingRequest) NftID() string {
	return request.nftID
}
