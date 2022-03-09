package metadata

import (
	"encoding/json"

	"incognito-chain/common"
)

// whoever can send this type of tx
type BurningSOLRequest struct {
	BurningAmount uint64 // must be equal to vout value
	TokenID       common.Hash
	RemoteAddress string
	MetadataBase
}

func NewBurningSOLRequest(
	burningAmount uint64,
	tokenID common.Hash,
	remoteAddress string,
	metaType int,
) (*BurningSOLRequest, error) {
	metadataBase := MetadataBase{
		Type: metaType,
	}
	burningReq := &BurningSOLRequest{
		BurningAmount: burningAmount,
		TokenID:       tokenID,
		RemoteAddress: remoteAddress,
	}
	burningReq.MetadataBase = metadataBase
	return burningReq, nil
}

func (bReq *BurningSOLRequest) Hash() *common.Hash {
	rawBytes, _ := json.Marshal(&bReq)
	hash := common.HashH([]byte(rawBytes))
	return &hash
}

func (bReq BurningSOLRequest) HashWithoutSig() *common.Hash {
	rawBytes, _ := json.Marshal(&bReq)
	hash := common.HashH([]byte(rawBytes))
	return &hash
}

func (bReq *BurningSOLRequest) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(struct {
		BurningAmount uint64      `json:"BurningAmount"`
		TokenID       common.Hash `json:"TokenID"`
		RemoteAddress string      `json:"RemoteAddress"`
		MetadataBase
	}{
		BurningAmount: bReq.BurningAmount,
		TokenID:       bReq.TokenID,
		RemoteAddress: bReq.RemoteAddress,
		MetadataBase:  bReq.MetadataBase,
	})
	if err != nil {
		return []byte{}, err
	}
	return data, nil
}

func (bReq *BurningSOLRequest) UnmarshalJSON(data []byte) error {
	temp := struct {
		BurningAmount uint64      `json:"BurningAmount"`
		TokenID       common.Hash `json:"TokenID"`
		RemoteAddress string      `json:"RemoteAddress"`
		MetadataBase
	}{}
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	bReq.BurningAmount = temp.BurningAmount
	bReq.TokenID = temp.TokenID
	bReq.RemoteAddress = temp.RemoteAddress
	bReq.MetadataBase = temp.MetadataBase

	return nil
}
