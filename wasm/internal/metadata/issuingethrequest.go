package metadata

import (
	"encoding/hex"
	"encoding/json"
	"errors"

	"incognito-chain/common"
)

type BytesAsHex []byte

func (b BytesAsHex) MarshalJSON() ([]byte, error) {
	s := "0x" + hex.EncodeToString(b)
	return json.Marshal(s)
}

func (b *BytesAsHex) UnmarshalJSON(raw []byte) error {
	var s string
	err := json.Unmarshal(raw, &s)
	if err != nil {
		return err
	}
	// must haev prefix
	if len(s) < 2 || s[:2] != "0x" {
		return errors.New("hex string invalid : prefix missing")
	}
	temp, err := hex.DecodeString(s[2:])
	*b = temp
	return err
}

type IssuingETHRequest struct {
	BlockHash  BytesAsHex
	TxIndex    uint
	ProofStrs  []string
	IncTokenID common.Hash
	MetadataBase
}

// type IssuingETHReqAction struct {
// 	Meta       IssuingETHRequest `json:"meta"`
// 	TxReqID    common.Hash       `json:"txReqId"`
// 	ETHReceipt *types.Receipt    `json:"ethReceipt"`
// }

// func ParseETHIssuingInstContent(instContentStr string) (*IssuingETHReqAction, error) {
// 	contentBytes, err := base64.StdEncoding.DecodeString(instContentStr)
// 	if err != nil {
// 		return nil, err
// 	}
// 	var issuingETHReqAction IssuingETHReqAction
// 	err = json.Unmarshal(contentBytes, &issuingETHReqAction)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return &issuingETHReqAction, nil
// }

func NewIssuingETHRequest(
	blockHash []byte,
	txIndex uint,
	proofStrs []string,
	incTokenID common.Hash,
	metaType int,
) (*IssuingETHRequest, error) {
	metadataBase := MetadataBase{
		Type: metaType,
	}
	issuingETHReq := &IssuingETHRequest{
		BlockHash:  blockHash,
		TxIndex:    txIndex,
		ProofStrs:  proofStrs,
		IncTokenID: incTokenID,
	}
	issuingETHReq.MetadataBase = metadataBase
	return issuingETHReq, nil
}

func (iReq IssuingETHRequest) Hash() *common.Hash {
	record := hex.EncodeToString(iReq.BlockHash)
	record += string(iReq.TxIndex)
	proofStrs := iReq.ProofStrs
	for _, proofStr := range proofStrs {
		record += proofStr
	}
	record += iReq.MetadataBase.Hash().String()
	record += iReq.IncTokenID.String()

	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}