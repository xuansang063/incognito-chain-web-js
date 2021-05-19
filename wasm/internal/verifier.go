package gomobile

import (
    "encoding/json"

    "github.com/pkg/errors"
    "incognito-chain/privacy"
    "incognito-chain/common"
)

// DeserializeTransactionJSON parses a transaction from raw JSON into a TxChoice object.
// It covers all transaction types.
func extractTxProof(data json.RawMessage) (privacy.ProofV2, error) {
    var holder struct{
        Proof json.RawMessage `json:"Proof,omitempty"`
        TxTokenData *struct {
            Proof json.RawMessage `json:"Proof,omitempty"`
        } `json:"TxTokenPrivacyData,omitempty"`
    }
    err := json.Unmarshal(data, &holder)
    if err!=nil{
        return privacy.ProofV2{}, err
    }
    if holder.Proof != nil {
        // tx ver 2
        var result privacy.ProofV2
        err := json.Unmarshal(holder.Proof, &result)
        return result, err
    } else if holder.TxTokenData != nil && holder.TxTokenData.Proof != nil {
        // tx token ver 2
        var result privacy.ProofV2
        err := json.Unmarshal(holder.TxTokenData.Proof, &result)
        return result, err
    }
    return privacy.ProofV2{}, errors.New("Cannot extract proof : unrecognized transaction format")
}


func getSentCoinIndex(proof privacy.ProofV2, seal privacy.SenderSeal, paymentAddress privacy.PaymentAddress) (int64, error) {
    publicOTA := paymentAddress.GetOTAPublicKey()
    publicSpend := paymentAddress.GetPublicSpend()
    rK := (&privacy.Point{}).ScalarMult(publicOTA, seal.GetR())
    hash := privacy.HashToScalar(append(rK.ToBytesS(), common.Uint32ToBytes(seal.GetIndex())...))
    HrKG := (&privacy.Point{}).ScalarMultBase(hash)
    recomputedPublicKey := (&privacy.Point{}).Add(HrKG, publicSpend)
    for currentCoinIndex, c := range proof.GetOutputCoins() {
        theCoin, ok := c.(*privacy.CoinV2)
        if !ok {
            continue
        }
        if privacy.IsPointEqual(theCoin.GetPublicKey(), recomputedPublicKey) {
            return int64(currentCoinIndex), nil
        }
    }
    return -1, nil
}
