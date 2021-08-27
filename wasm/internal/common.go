package gomobile

import (
	"crypto/rand"
	"math"
	"math/big"

	"incognito-chain/common"
	metadataCommon "incognito-chain/metadata/common"
	"incognito-chain/privacy"
)

const (
	HashSize          = 32
	MaxHashStringSize = HashSize * 2
)
const (
	TxNormalType          = "n"   // normal tx(send and receive coin)
	TxRewardType          = "s"   // reward tx
	TxReturnStakingType   = "rs"  //
	TxConversionType      = "cv"  // Convert 1 - 2 normal tx
	TxTokenConversionType = "tcv" // Convert 1 - 2 token tx
	//TxCustomTokenType        = "t"  // token  tx with no supporting privacy
	TxCustomTokenPrivacyType = "tp" // token  tx with supporting privacy
)

var (
	PRVCoinID = common.Hash{4}
)

func RandBigIntMaxRange(max *big.Int) (*big.Int, error) {
	return rand.Int(rand.Reader, max)
}

func grabBytes(coinBytes *[]byte, offset *int) ([]byte, error) {
	b := *coinBytes
	if *offset >= len(b) {
		return nil, genericError
	}
	lenField := b[*offset]
	*offset += 1
	result := make([]byte, lenField)
	if lenField != 0 {
		if *offset+int(lenField) > len(b) {
			return nil, genericError
		}
		data := b[*offset : *offset+int(lenField)]
		copy(result, data)
		*offset += int(lenField)
	}
	return result, nil
}

type EstimateTxSizeParam struct {
	NumInputCoins            int                     `json:"NumInputs"`
	NumPayments              int                     `json:"NumPayments"`
	Metadata                 metadataCommon.Metadata `json:"Metadata"`
	PrivacyCustomTokenParams *TokenInnerParams       `json:"TokenParams"`
}

func toB64Len(numOfBytes uint64) uint64 {
	l := (numOfBytes*4 + 2) / 3
	l = ((l + 3) / 4) * 4
	return l
}

func EstimateProofSize(numIn, numOut uint64) uint64 {
	coinSizeBound := uint64(257) + (privacy.Ed25519KeySize+1)*7 + privacy.TxRandomGroupSize + 1
	ipProofLRLen := uint64(math.Log2(float64(numOut))) + 1
	aggProofSizeBound := uint64(4) + 1 + privacy.Ed25519KeySize*uint64(7+numOut) + 1 + uint64(2*ipProofLRLen+3)*privacy.Ed25519KeySize
	// add 10 for rounding
	result := uint64(1) + (coinSizeBound+1)*uint64(numIn+numOut) + 2 + aggProofSizeBound + 10
	return toB64Len(result)
}

func estimateTxSizeAsBytes(estimateTxSizeParam *EstimateTxSizeParam) uint64 {
	// jsb, _ := json.Marshal(estimateTxSizeParam)
	// println("PARAMS", string(jsb))
	jsonKeysSizeBound := uint64(20*10 + 2)
	sizeVersion := uint64(1)      // int8
	sizeType := uint64(5)         // string, max : 5
	sizeLockTime := uint64(8) * 3 // int64
	sizeFee := uint64(8) * 3      // uint64
	sizeInfo := toB64Len(uint64(512))

	numIn := uint64(estimateTxSizeParam.NumInputCoins)
	numOut := uint64(estimateTxSizeParam.NumPayments)

	sizeSigPubKey := uint64(numIn)*privacy.RingSize*9 + 2
	sizeSigPubKey = toB64Len(sizeSigPubKey)
	sizeSig := uint64(1) + numIn + (numIn+2)*privacy.RingSize
	sizeSig = sizeSig*33 + 3

	sizeProof := EstimateProofSize(numIn, numOut)

	sizePubKeyLastByte := uint64(1) * 3
	sizeMetadata := uint64(0)
	if estimateTxSizeParam.Metadata != nil {
		sizeMetadata += metadataCommon.CalculateSize(estimateTxSizeParam.Metadata)
	}

	sizeTx := jsonKeysSizeBound + sizeVersion + sizeType + sizeLockTime + sizeFee + sizeInfo + sizeSigPubKey + sizeSig + sizeProof + sizePubKeyLastByte + sizeMetadata
	// println("PRV size", sizeTx)
	if estimateTxSizeParam.PrivacyCustomTokenParams != nil {
		tokenKeysSizeBound := uint64(20*8 + 2)
		tokenSize := toB64Len(uint64(len(estimateTxSizeParam.PrivacyCustomTokenParams.TokenID)))
		tokenSize += uint64(len(estimateTxSizeParam.PrivacyCustomTokenParams.TokenSymbol))
		tokenSize += uint64(len(estimateTxSizeParam.PrivacyCustomTokenParams.TokenName))
		tokenSize += 2
		numIn = uint64(len(estimateTxSizeParam.PrivacyCustomTokenParams.TokenInput))
		numOut = uint64(len(estimateTxSizeParam.PrivacyCustomTokenParams.TokenPaymentInfo))

		// shadow variable names
		sizeSigPubKey := uint64(numIn)*privacy.RingSize*9 + 2
		sizeSigPubKey = toB64Len(sizeSigPubKey)
		sizeSig := uint64(1) + numIn + (numIn+2)*privacy.RingSize
		sizeSig = sizeSig*33 + 3

		sizeProof := EstimateProofSize(numIn, numOut)
		tokenSize += tokenKeysSizeBound + sizeSigPubKey + sizeSig + sizeProof
		// println("Token size", tokenSize)
		sizeTx += tokenSize
	}
	return sizeTx
}
