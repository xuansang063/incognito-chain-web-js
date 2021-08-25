package pdexv3

import (
	"encoding/json"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
)

type MintNft struct {
	nftID       string
	otaReceiver string
	metadataCommon.MetadataBase
}

func NewMintNft() *MintNft {
	return &MintNft{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3MintNft,
		},
	}
}

func NewMintNftWithValue(nftID string, otaReceiver string) *MintNft {
	return &MintNft{
		MetadataBase: metadataCommon.MetadataBase{
			Type: metadataCommon.Pdexv3MintNft,
		},
		nftID:       nftID,
		otaReceiver: otaReceiver,
	}
}

func (mintNft *MintNft) Hash() *common.Hash {
	record := mintNft.MetadataBase.Hash().String()
	record += mintNft.nftID
	record += mintNft.otaReceiver
	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (mintNft *MintNft) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(struct {
		NftID       string `json:"NftID"`
		OtaReceiver string `json:"OtaReceiver"`
		metadataCommon.MetadataBase
	}{
		NftID:        mintNft.nftID,
		OtaReceiver:  mintNft.otaReceiver,
		MetadataBase: mintNft.MetadataBase,
	})
	if err != nil {
		return []byte{}, err
	}
	return data, nil
}

func (mintNft *MintNft) UnmarshalJSON(data []byte) error {
	temp := struct {
		NftID       string `json:"NftID"`
		OtaReceiver string `json:"OtaReceiver"`
		metadataCommon.MetadataBase
	}{}
	err := json.Unmarshal(data, &temp)
	if err != nil {
		return err
	}
	mintNft.otaReceiver = temp.OtaReceiver
	mintNft.nftID = temp.NftID
	mintNft.MetadataBase = temp.MetadataBase
	return nil
}

func (mintNft *MintNft) OtaReceiver() string {
	return mintNft.otaReceiver
}

func (mintNft *MintNft) NftID() string {
	return mintNft.nftID
}

type MintNftData struct {
	NftID       common.Hash `json:"NftID"`
	OtaReceiver string      `json:"OtaReceiver"`
	ShardID     byte        `json:"ShardID"`
}
