package pdexv3

import (
	"encoding/json"
	"errors"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
	"incognito-chain/privacy"
)

type ReceiverInfo struct {
	Address privacy.OTAReceiver `json:"Address"`
	Amount  uint64              `json:"Amount"`
}

// Check if the given OTA address is a valid address and has the expected shard ID
func isValidOTAReceiver(receiverAddress privacy.OTAReceiver, expectedShardID byte) (privacy.OTAReceiver, error) {
	if !receiverAddress.IsValid() {
		return receiverAddress, errors.New("ReceiverAddress is invalid")
	}

	pkb := receiverAddress.PublicKey.ToBytesS()
	currentShardID := common.GetShardIDFromLastByte(pkb[len(pkb)-1])
	if currentShardID != expectedShardID {
		return receiverAddress, errors.New("ReceiverAddress shard ID is wrong")
	}

	return receiverAddress, nil
}

func (inf *ReceiverInfo) UnmarshalJSON(raw []byte) error {
	var temp struct {
		Address privacy.OTAReceiver         `json:"Address"`
		Amount  metadataCommon.Uint64Reader `json:"Amount"`
	}
	err := json.Unmarshal(raw, &temp)
	*inf = ReceiverInfo{
		Address: temp.Address,
		Amount:  uint64(temp.Amount),
	}
	return err
}

type AccessOTA privacy.Point

func (ota AccessOTA) MarshalJSON() ([]byte, error) {
	temp := common.Hash((privacy.Point)(ota).ToBytes())
	return json.Marshal(temp)
}

func (ota *AccessOTA) UnmarshalJSON(data []byte) error {
	var temp common.Hash
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	p, err := (&privacy.Point{}).FromBytes([32]byte(temp))
	if p != nil {
		*ota = AccessOTA(*p)
	}
	return err
}

func (ota AccessOTA) Bytes() [32]byte {
	return privacy.Point(ota).ToBytes()
}

func (ota *AccessOTA) FromBytes(data [32]byte) error {
	_, err := (*privacy.Point)(ota).FromBytes(data)
	return err
}

type AccessOption struct {
	NextOTA  *AccessOTA  `json:"NextOTA,omitempty"`
	BurntOTA *AccessOTA  `json:"BurntOTA,omitempty"`
	NftID    common.Hash `json:"NftID,omitempty"`
}
