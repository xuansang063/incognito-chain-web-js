package internal

import (
	"crypto/rand"
	"math"
	"math/big"
	// "encoding/hex"
	// "errors"

	// "golang.org/x/crypto/sha3"
	"incognito-chain/common"
	"incognito-chain/metadata"
	"incognito-chain/privacy"
)

const(
	HashSize = 32
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
var(
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
	numInputCoins            int 				`json:"NumInputs"`
	numPayments              int 				`json:"NumPayments"`
	metadata                 metadata.Metadata 	`json:"Metadata"`
	privacyCustomTokenParams *TokenParam 		`json:"TokenParams"`
}

func toB64Len(numOfBytes uint64) uint64{
	l := (numOfBytes * 4 + 2) / 3
	l = ((l + 3) / 4) * 4
	return l
}

func EstimateProofSize(numIn, numOut uint64) uint64{
	coinSizeBound := uint64(257) + (privacy.Ed25519KeySize + 1) * 7 + privacy.TxRandomGroupSize + 1
	ipProofLRLen := uint64(math.Log2(float64(numOut))) + 1
	aggProofSizeBound := uint64(4) + 1 + privacy.Ed25519KeySize * uint64(7 + numOut) + 1 + uint64(2 * ipProofLRLen + 3) * privacy.Ed25519KeySize
	// add 10 for rounding
	result := uint64(1) + (coinSizeBound + 1) * uint64(numIn + numOut) + 2 + aggProofSizeBound + 10
	return toB64Len(result)
}

func EstimateTxSize(estimateTxSizeParam *EstimateTxSizeParam) uint64{
	jsonKeysSizeBound := uint64(20 * 10 + 2)
	sizeVersion := uint64(1)  // int8
	sizeType := uint64(5)     // string, max : 5
	sizeLockTime := uint64(8) * 3 // int64
	sizeFee := uint64(8) * 3      // uint64
	sizeInfo := toB64Len(uint64(512))

	numIn := uint64(estimateTxSizeParam.numInputCoins)
	numOut := uint64(estimateTxSizeParam.numPayments)

	sizeSigPubKey := uint64(numIn) * privacy.RingSize * 9 + 2
	sizeSigPubKey = toB64Len(sizeSigPubKey)
	sizeSig := uint64(1) + numIn + (numIn + 2) * privacy.RingSize 
	sizeSig = sizeSig * 33 + 3

	sizeProof := EstimateProofSize(numIn, numOut)

	sizePubKeyLastByte := uint64(1) * 3
	sizeMetadata := uint64(0)
	if estimateTxSizeParam.metadata != nil {
		sizeMetadata += metadata.CalculateSize(estimateTxSizeParam.metadata)
	}

	sizeTx := jsonKeysSizeBound + sizeVersion + sizeType + sizeLockTime + sizeFee + sizeInfo + sizeSigPubKey + sizeSig + sizeProof + sizePubKeyLastByte + sizeMetadata
	if estimateTxSizeParam.privacyCustomTokenParams != nil {
		tokenKeysSizeBound := uint64(20 * 8 + 2)
		tokenSize := toB64Len(uint64(len(estimateTxSizeParam.privacyCustomTokenParams.PropertyID)))
		tokenSize += uint64(len(estimateTxSizeParam.privacyCustomTokenParams.PropertySymbol))
		tokenSize += uint64(len(estimateTxSizeParam.privacyCustomTokenParams.PropertyName))
		tokenSize += 2
		numIn = uint64(len(estimateTxSizeParam.privacyCustomTokenParams.TokenInput))
		numOut = uint64(len(estimateTxSizeParam.privacyCustomTokenParams.Receiver))

		// shadow variable names
		sizeSigPubKey := uint64(numIn) * privacy.RingSize * 9 + 2
		sizeSigPubKey = toB64Len(sizeSigPubKey)
		sizeSig := uint64(1) + numIn + (numIn + 2) * privacy.RingSize 
		sizeSig = sizeSig * 33 + 3

		sizeProof := EstimateProofSize(numIn, numOut)
		tokenSize += tokenKeysSizeBound + sizeSigPubKey + sizeSig + sizeProof
		sizeTx += tokenSize
	}
	return sizeTx
}

