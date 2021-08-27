package pdexv3

import (
	"encoding/json"
	"strconv"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
)

type UserMintNftRequest struct {
	metadataCommon.MetadataBase
	otaReceive string
	amount     uint64
}

func NewUserMintNftRequest() *UserMintNftRequest {
	return &UserMintNftRequest{}
}

func NewUserMintNftRequestWithValue(otaReceive string, amount uint64) *UserMintNftRequest {
	metadataBase := metadataCommon.MetadataBase{
		Type: metadataCommon.Pdexv3UserMintNftRequestMeta,
	}
	return &UserMintNftRequest{
		otaReceive:   otaReceive,
		amount:       amount,
		MetadataBase: metadataBase,
	}
}

func (request *UserMintNftRequest) Hash() *common.Hash {
	record := request.MetadataBase.Hash().String()
	record += request.otaReceive
	record += strconv.FormatUint(uint64(request.amount), 10)
	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (request *UserMintNftRequest) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(struct {
		OtaReceive string `json:"OtaReceive"`
		Amount     uint64 `json:"Amount"`
		metadataCommon.MetadataBase
	}{
		Amount:       request.amount,
		OtaReceive:   request.otaReceive,
		MetadataBase: request.MetadataBase,
	})
	if err != nil {
		return []byte{}, err
	}
	return data, nil
}

func (request *UserMintNftRequest) UnmarshalJSON(data []byte) error {
	temp := struct {
		OtaReceive string `json:"OtaReceive"`
		Amount     uint64 `json:"Amount"`
		metadataCommon.MetadataBase
	}{}
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	request.amount = temp.Amount
	request.otaReceive = temp.OtaReceive
	request.MetadataBase = temp.MetadataBase
	return nil
}

func (request *UserMintNftRequest) OtaReceive() string {
	return request.otaReceive
}

func (request *UserMintNftRequest) Amount() uint64 {
	return request.amount
}
