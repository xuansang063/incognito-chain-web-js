package metadata

import (
	"incognito-chain/common"
)

type IssuingEVMResponse struct {
	MetadataBase
	RequestedTxID   common.Hash `json:"RequestedTxID"`
	UniqTx          []byte      `json:"UniqETHTx"`
	ExternalTokenID []byte      `json:"ExternalTokenID"`
	SharedRandom    []byte `json:"SharedRandom,omitempty"`
}

func NewIssuingEVMResponse(
	requestedTxID common.Hash,
	uniqTx []byte,
	externalTokenID []byte,
	metaType int,
) *IssuingEVMResponse {
	metadataBase := MetadataBase{
		Type: metaType,
	}
	return &IssuingEVMResponse{
		RequestedTxID:   requestedTxID,
		UniqTx:          uniqTx,
		ExternalTokenID: externalTokenID,
		MetadataBase:    metadataBase,
	}
}

func (iRes IssuingEVMResponse) Hash() *common.Hash {
	record := iRes.RequestedTxID.String()
	record += string(iRes.UniqTx)
	record += string(iRes.ExternalTokenID)
	record += iRes.MetadataBase.Hash().String()

	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (iRes *IssuingEVMResponse) SetSharedRandom(r []byte) {
	iRes.SharedRandom = r
}