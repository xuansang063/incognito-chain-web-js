package metadata

import (
	"encoding/json"
	"strconv"

    "incognito-chain/common"
    metadataCommon "incognito-chain/metadata/common"
)

type InitTokenRequest struct {
    OTAStr      string
    TxRandomStr string
    Amount      uint64
    TokenName   string
    TokenSymbol string
    MetadataBase
}

func NewInitTokenRequest(otaStr string, txRandomStr string, amount uint64, tokenName, tokenSymbol string, metaType int) (*InitTokenRequest, error) {
    metadataBase := MetadataBase{
        Type: metaType,
    }
    initPTokenMeta := &InitTokenRequest{
        OTAStr:      otaStr,
        TxRandomStr: txRandomStr,
        TokenName:   tokenName,
        TokenSymbol: tokenSymbol,
        Amount:      amount,
    }
    initPTokenMeta.MetadataBase = metadataBase
    return initPTokenMeta, nil
}

//Hash returns the hash of all components in the request.
func (iReq InitTokenRequest) Hash() *common.Hash {
    record := iReq.MetadataBase.Hash().String()
    record += iReq.OTAStr
    record += iReq.TxRandomStr
    record += iReq.TokenName
    record += iReq.TokenSymbol
    record += strconv.FormatUint(iReq.Amount, 10)

    // final hash
    hash := common.HashH([]byte(record))
    return &hash
}

//genTokenID generates a (deterministically) random tokenID for the request transaction.
//From now on, users cannot generate their own tokenID.
//The generated tokenID is calculated as the hash of the following components:
//  - The InitTokenRequest hash
//  - The Tx hash
//  - The shardID at which the request is sent
func (iReq *InitTokenRequest) genTokenID(tx Transaction, shardID byte) *common.Hash {
    // record := iReq.Hash().String()
    record := tx.Hash().String()
    record += strconv.FormatUint(uint64(shardID), 10)

    tokenID := common.HashH([]byte(record))
    return &tokenID
}

func (iReq *InitTokenRequest) UnmarshalJSON(raw []byte) error{
	var temp struct{
		OTAStr      string
	    TxRandomStr string
	    Amount      metadataCommon.Uint64Reader
	    TokenName   string
	    TokenSymbol string
	    MetadataBase
	}
	err := json.Unmarshal(raw, &temp)
	*iReq = InitTokenRequest{
		OTAStr: temp.OTAStr,
		TxRandomStr: temp.TxRandomStr,
		Amount: uint64(temp.Amount),
		TokenName: temp.TokenName,
		TokenSymbol: temp.TokenSymbol,
		MetadataBase: temp.MetadataBase,
	}
	return err
}

