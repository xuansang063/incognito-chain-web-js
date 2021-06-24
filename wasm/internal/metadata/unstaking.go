package metadata

import (
	"strconv"

	"incognito-chain/common"
)

// UnStakingMetadata : unstaking metadata
type UnStakingMetadata struct {
	MetadataBaseWithSignature
	CommitteePublicKey string
}

func (meta *UnStakingMetadata) Hash() *common.Hash {
	record := strconv.Itoa(meta.Type)
	data := []byte(record)
	hash := common.HashH(data)
	return &hash
}

func (meta *UnStakingMetadata) HashWithoutSig() *common.Hash {
	return meta.MetadataBaseWithSignature.Hash()
}

func (unStakingMetadata UnStakingMetadata) GetType() int {
	return unStakingMetadata.Type
}
