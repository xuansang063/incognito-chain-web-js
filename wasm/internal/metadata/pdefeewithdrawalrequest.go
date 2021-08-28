package metadata

import (
	"encoding/json"
	"strconv"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
)

// PDEFeeWithdrawalRequest - privacy dex withdrawal request
type PDEFeeWithdrawalRequest struct {
	WithdrawerAddressStr  string
	WithdrawalToken1IDStr string
	WithdrawalToken2IDStr string
	WithdrawalFeeAmt      uint64
	MetadataBaseWithSignature
}

type PDEFeeWithdrawalRequestAction struct {
	Meta    PDEFeeWithdrawalRequest
	TxReqID common.Hash
	ShardID byte
}

func NewPDEFeeWithdrawalRequest(
	withdrawerAddressStr string,
	withdrawalToken1IDStr string,
	withdrawalToken2IDStr string,
	withdrawalFeeAmt uint64,
	metaType int,
) (*PDEFeeWithdrawalRequest, error) {
	metadataBase := NewMetadataBaseWithSignature(metaType)
	pdeFeeWithdrawalRequest := &PDEFeeWithdrawalRequest{
		WithdrawerAddressStr:  withdrawerAddressStr,
		WithdrawalToken1IDStr: withdrawalToken1IDStr,
		WithdrawalToken2IDStr: withdrawalToken2IDStr,
		WithdrawalFeeAmt:      withdrawalFeeAmt,
	}
	pdeFeeWithdrawalRequest.MetadataBaseWithSignature = *metadataBase
	return pdeFeeWithdrawalRequest, nil
}

func (pc PDEFeeWithdrawalRequest) Hash() *common.Hash {
	record := pc.MetadataBase.Hash().String()
	record += pc.WithdrawerAddressStr
	record += pc.WithdrawalToken1IDStr
	record += pc.WithdrawalToken2IDStr
	record += strconv.FormatUint(pc.WithdrawalFeeAmt, 10)
	if pc.Sig != nil && len(pc.Sig) != 0 {
		record += string(pc.Sig)
	}
	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (pc PDEFeeWithdrawalRequest) HashWithoutSig() *common.Hash {
	record := pc.MetadataBase.Hash().String()
	record += pc.WithdrawerAddressStr
	record += pc.WithdrawalToken1IDStr
	record += pc.WithdrawalToken2IDStr
	record += strconv.FormatUint(pc.WithdrawalFeeAmt, 10)
	// final hash
	hash := common.HashH([]byte(record))
	return &hash
}

func (pc *PDEFeeWithdrawalRequest) UnmarshalJSON(raw []byte) error {
	var temp struct {
		WithdrawerAddressStr  string
		WithdrawalToken1IDStr string
		WithdrawalToken2IDStr string
		WithdrawalFeeAmt      metadataCommon.Uint64Reader
		MetadataBaseWithSignature
	}
	err := json.Unmarshal(raw, &temp)
	*pc = PDEFeeWithdrawalRequest{
		WithdrawerAddressStr:      temp.WithdrawerAddressStr,
		WithdrawalToken1IDStr:     temp.WithdrawalToken1IDStr,
		WithdrawalToken2IDStr:     temp.WithdrawalToken2IDStr,
		WithdrawalFeeAmt:          uint64(temp.WithdrawalFeeAmt),
		MetadataBaseWithSignature: temp.MetadataBaseWithSignature,
	}
	return err
}
