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
