package common

import (
	"errors"
	"strconv"

	"incognito-chain/common"
	"incognito-chain/privacy"
)

type MetadataBase struct {
	Type int
}

func (mb *MetadataBase) Sign(privateKey *privacy.PrivateKey, tx MDContainer) error {
	return nil
}

type MetadataBaseWithSignature struct {
	MetadataBase
	Sig []byte 		`json:"Sig,omitempty"`
}

func NewMetadataBaseWithSignature(thisType int) *MetadataBaseWithSignature {
	return &MetadataBaseWithSignature{MetadataBase: MetadataBase{Type: thisType}, Sig: []byte{}}
}

func (mbs *MetadataBaseWithSignature) Sign(privateKey *privacy.PrivateKey, tx MDContainer) error {
	hashForMd := tx.HashWithoutMetadataSig()
	if hashForMd == nil {
		// the metadata type does not need signing
		return nil
	}
	if len(mbs.Sig) > 0 {
		return errors.New("Cannot overwrite metadata signature")
	}

	/****** using Schnorr signature *******/
	sk := new(privacy.Scalar).FromBytesS(*privateKey)
	r := new(privacy.Scalar).FromUint64(0)
	sigKey := new(privacy.SchnorrPrivateKey)
	sigKey.Set(sk, r)

	// signing
	signature, err := sigKey.Sign(hashForMd[:])
	if err != nil {
		return err
	}

	// convert signature to byte array
	mbs.Sig = signature.Bytes()
	return nil
}

func NewMetadataBase(thisType int) *MetadataBase {
	return &MetadataBase{Type: thisType}
}

func (mb MetadataBase) IsMinerCreatedMetaType() bool {
	metaType := mb.GetType()
	for _, mType := range minerCreatedMetaTypes {
		if metaType == mType {
			return true
		}
	}
	return false
}

func (mb *MetadataBase) Process() error {
	return nil
}

func (mb MetadataBase) GetType() int {
	return mb.Type
}

func (mb MetadataBase) Hash() *common.Hash {
	record := strconv.Itoa(mb.Type)
	data := []byte(record)
	hash := common.HashH(data)
	return &hash
}

func (mb MetadataBase) HashWithoutSig() *common.Hash {
	return mb.Hash()
}
