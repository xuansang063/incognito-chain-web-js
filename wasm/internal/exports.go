package internal

import (
	// "syscall/js"
	"encoding/hex"
	"encoding/json"
	"strconv"

	"incognito-chain/common"
	"incognito-chain/privacy/blsmultisig"
	"incognito-chain/key/incognitokey"
	"incognito-chain/privacy"
	"incognito-chain/privacy/privacy_v1/hybridencryption"
	"incognito-chain/key/wallet"

	// "incognito-chain/metadata"
	"github.com/pkg/errors"
	// "math/big"
)

type TxResult struct{
	B58EncodedTx string `json:"b58EncodedTx"`
	Hash string `json:"hash"`
}

func CreateTransaction(args string, num int64) (interface{}, error){
	var theirTime int64 = num
	params := &InitParamsAsm{}
	// println("Before parse - TX parameters")
	// println(args)
	err := json.Unmarshal([]byte(args), params)
	if err!=nil{
		println(err.Error())
		return "", err
	}
	// println("After parse - TX parameters")
	// thoseBytesAgain, _ := json.Marshal(params)
	// println(string(thoseBytesAgain))

	var txJson []byte
	var hash *common.Hash
	if params.TokenParams==nil{			
		tx := &Tx{}
		err = tx.InitASM(params, theirTime)

		if err != nil {
			println("Can not create tx: ", err.Error())
			return "", err
		}

		// serialize tx json
		txJson, err = json.Marshal(tx)
		if err != nil {
			println("Can not marshal tx: ", err)
			return "", err
		}
		hash = tx.Hash()
	}else{
		tx := &TxToken{}
		err = tx.InitASM(params, theirTime)

		if err != nil {
			println("Can not create tx: ", err.Error())
			return "", err
		}

		// serialize tx json
		txJson, err = json.Marshal(tx)
		if err != nil {
			println("Error marshalling tx: ", err)
			return "", err
		}
		hash = tx.Hash()
	}
	encodedTx := b58.Encode(txJson, common.ZeroByte)
	txResult := TxResult{B58EncodedTx: encodedTx, Hash: hash.String()}
	jsonResult, _ := json.Marshal(txResult)

	return string(jsonResult), nil
}

func CreateConvertTx(args string, num int64) (interface{}, error){
	var theirTime int64 = num

	params := &InitParamsAsm{}
	// println("Before parse - TX parameters")
	// println(args)
	err := json.Unmarshal([]byte(args), params)
	if err!=nil{
		println(err.Error())
		return "", err
	}
	// println("After parse - TX parameters")
	// thoseBytesAgain, _ := json.Marshal(params)
	// println(string(thoseBytesAgain))

	var txJson []byte
	var hash *common.Hash
	if params.TokenParams==nil{			
		tx := &Tx{}
		err = InitConversionASM(tx, params, theirTime)

		if err != nil {
			println("Can not create tx: ", err.Error())
			return "", err
		}

		// serialize tx json
		txJson, err = json.Marshal(tx)
		if err != nil {
			println("Can not marshal tx: ", err)
			return "", err
		}
		hash = tx.Hash()
	}else{
		tx := &TxToken{}
		err = InitTokenConversionASM(tx, params, theirTime)

		if err != nil {
			println("Can not create tx: ", err.Error())
			return "", err
		}

		// serialize tx json
		txJson, err = json.Marshal(tx)
		if err != nil {
			println("Error marshalling tx: ", err)
			return "", err
		}
		hash = tx.Hash()
	}
	encodedTx := b58.Encode(txJson, common.ZeroByte)
	txResult := TxResult{B58EncodedTx: encodedTx, Hash: hash.String()}
	jsonResult, _ := json.Marshal(txResult)

	return string(jsonResult), nil
}

func NewKeySetFromPrivate(skStr string, _ int64) (interface{}, error){
	var err error
	skHolder := struct{
		PrivateKey []byte `json:"PrivateKey"`
	}{}
	err = json.Unmarshal([]byte(skStr), &skHolder)
	if err!=nil{
		println(err.Error())
		return "", err
	}
	ks := &incognitokey.KeySet{}
	err = ks.InitFromPrivateKeyByte(skHolder.PrivateKey)
	if err!=nil{
		println(err.Error())
		return "", err
	}
	txJson, err := json.Marshal(ks)
	if err != nil {
		println("Error marshalling ket set: ", err)
		return "", err
	}

	return string(txJson), nil
}

func DecryptCoin(paramStr string, _ int64) (interface{}, error){
	var err error
	temp := &struct{
		Coin 	CoinInter
		KeySet 	string
	}{}
	err = json.Unmarshal([]byte(paramStr), temp)
	if err!=nil{
		return "", err
	}
	tempKw, err := wallet.Base58CheckDeserialize(temp.KeySet)
	if err!=nil{
		return "", err
	}
	ks := tempKw.KeySet
	var res CoinInter
	if temp.Coin.Version==2{
		c, _, err := temp.Coin.ToCoin()
		if err!=nil{
			return "", err
		}
		
		_, err = c.Decrypt(&ks)
		if err!=nil{
			println(err.Error())
			return "", err
		}
		res = GetCoinInter(c)
	}else if temp.Coin.Version==1{
		c, _, err := temp.Coin.ToCoinV1()
		if err!=nil{
			return "", err
		}
		
		pc, err := c.Decrypt(&ks)
		if err!=nil{
			println(err.Error())
			return "", err
		}
		res = GetCoinInter(pc)
	}
	
	res.Index = temp.Coin.Index
	resJson, err := json.Marshal(res)
	if err != nil {
		println("Error marshalling ket set: ", err)
		return "", err
	}
	return string(resJson), nil
}

func CreateCoin(paramStr string, _ int64) (interface{}, error){
	var err error
	temp := &struct{
		PaymentInfo 	printedPaymentInfo
		TokenID			string
	}{}
	err = json.Unmarshal([]byte(paramStr), temp)
	if err!=nil{
		return "", err
	}
	pInf, err := temp.PaymentInfo.To()
	if err!=nil{
		return "", err
	}
	var c *privacy.CoinV2
	if len(temp.TokenID)==0{
		c, err = privacy.NewCoinFromPaymentInfo(pInf)
		if err!=nil{
			println(err.Error())
			return "", err
		}
	}else{
		var tokenID common.Hash
		tokenID, _ = getTokenIDFromString(temp.TokenID)
		c, _, err = privacy.NewCoinCA(pInf, &tokenID)
		if err!=nil{
			println(err.Error())
			return "", err
		}
	}
	
	res := GetCoinInter(c)
	resJson, err := json.Marshal(res)
	if err != nil {
		println("Error marshalling ket set: ", err)
		return "", err
	}
	return string(resJson), nil
}

func GenerateBLSKeyPairFromSeed(args string, _ int64) (interface{}, error){
	seed, err := b64.DecodeString(args)
	if err != nil {
		return "", err
	}
	privateKey, publicKey := blsmultisig.KeyGen(seed)
	keyPairBytes := []byte{}
	keyPairBytes = append(keyPairBytes, common.AddPaddingBigInt(privateKey, common.BigIntSize)...)
	keyPairBytes = append(keyPairBytes, blsmultisig.CmprG2(publicKey)...)
	keyPairEncode := b64.EncodeToString(keyPairBytes)
	return keyPairEncode, nil
}

func GenerateKeyFromSeed(args string, _ int64) (interface{}, error){
	seed, err := b64.DecodeString(args)
	if err != nil {
		return "", err
	}
	key := privacy.GeneratePrivateKey(seed)
	res := b64.EncodeToString(key)
	return res, nil
}

func HybridEncrypt(args string, _ int64) (interface{}, error){	
	raw, _ := b64.DecodeString(args)
	publicKeyBytes := raw[0:privacy.Ed25519KeySize]
	publicKeyPoint, err := new(privacy.Point).FromBytesS(publicKeyBytes)
	if err != nil {
		return "", errors.Errorf("Invalid public key encryption")
	}

	msgBytes := raw[privacy.Ed25519KeySize:]
	ciphertext, err := hybridencryption.HybridEncrypt(msgBytes, publicKeyPoint)
	if err != nil{
		return "", err
	}
	return b64.EncodeToString(ciphertext.Bytes()), nil
}

func HybridDecrypt(args string, _ int64) (interface{}, error){
	raw, _ := b64.DecodeString(args)
	privateKeyBytes := raw[0:privacy.Ed25519KeySize]
	privateKeyScalar := new(privacy.Scalar).FromBytesS(privateKeyBytes)

	ciphertextBytes := raw[privacy.Ed25519KeySize:]
	ciphertext := new(hybridencryption.HybridCipherText)
	ciphertext.SetBytes(ciphertextBytes)

	plaintextBytes, err := hybridencryption.HybridDecrypt(ciphertext, privateKeyScalar)
	if err != nil{
		return "", err
	}
	return b64.EncodeToString(plaintextBytes), nil
}

func ScalarMultBase(args string, _ int64) (interface{}, error){
	scalar, err := b64.DecodeString(args)
	if err != nil {
		return "", err
	}

	point := new(privacy.Point).ScalarMultBase(new(privacy.Scalar).FromBytesS(scalar))
	res := b64.EncodeToString(point.ToBytesS())
	return res, nil
}

func RandomScalars(args string, _ int64) (interface{}, error){
	num, err := strconv.ParseUint(args, 10, 64)
	if err != nil {
		return "", nil
	}

	var scalars []byte
	for i := 0; i < int(num); i++ {
		scalars = append(scalars, privacy.RandomScalar().ToBytesS()...)
	}

	res := b64.EncodeToString(scalars)
	return res, nil
}

func GetSignPublicKey(args string, _ int64) (interface{}, error){
	raw := []byte(args)
	var holder struct{
		Data struct{
			Sk string `json:"privateKey"`
		} `json:"data"`
	}

	err := json.Unmarshal(raw, &holder)
	if err != nil {
		println("Error can not unmarshal data : %v\n", err)
		return "", err
	}
	privateKey := holder.Data.Sk
	keyWallet, err := wallet.Base58CheckDeserialize(privateKey)
	if err != nil {
		return "", errors.Errorf("Invalid private key")
	}
	senderSK := keyWallet.KeySet.PrivateKey
	sk := new(privacy.Scalar).FromBytesS(senderSK[:HashSize])
	r := new(privacy.Scalar).FromBytesS(senderSK[HashSize:])
	sigKey := new(privacy.SchnorrPrivateKey)
	sigKey.Set(sk, r)
	sigPubKey := sigKey.GetPublicKey().GetPublicKey().ToBytesS()

	return hex.EncodeToString(sigPubKey), nil
}

func SignPoolWithdraw(args string, _ int64) (interface{}, error){
	raw := []byte(args)
	var holder struct{
		Data struct{
			Sk string `json:"privateKey"`
			Amount string `json:"amount"`
			PaymentAddress string `json:"paymentAddress"`
		} `json:"data"`
	}

	err := json.Unmarshal(raw, &holder)
	if err != nil {
		println("Error can not unmarshal data : %v\n", err)
		return "", err
	}
	privateKey := holder.Data.Sk
	keyWallet, err := wallet.Base58CheckDeserialize(privateKey)
	if err != nil {
		return "", errors.Errorf("Invalid private key")
	}
	senderSK := keyWallet.KeySet.PrivateKey
	sk := new(privacy.Scalar).FromBytesS(senderSK[:HashSize])
	r := new(privacy.Scalar).FromBytesS(senderSK[HashSize:])
	sigKey := new(privacy.SchnorrPrivateKey)
	sigKey.Set(sk, r)

	message := holder.Data.PaymentAddress + holder.Data.Amount
	hashed := common.HashH([]byte(message))
	signature, err := sigKey.Sign(hashed[:])
	if err != nil {
		println(err.Error())
		return "", errors.Errorf("Sign error")
	}

	return hex.EncodeToString(signature.Bytes()), nil
}

// signEncode string, signPublicKeyEncode string, amount string, paymentAddress string
func VerifySign(args string, _ int64) (interface{}, error){
	raw := []byte(args)
	var holder struct{
		Data struct{
			Pk string `json:"publicKey"`
			Signature string `json:"signature"`
			Amount string `json:"amount"`
			PaymentAddress string `json:"paymentAddress"`
		} `json:"data"`
	}
	err := json.Unmarshal(raw, &holder)
	if err != nil {
		println("Error can not unmarshal data : %v\n", err)
		return "", err
	}
	temp, err := hex.DecodeString(holder.Data.Pk)
	if err != nil {
		return "", errors.Errorf("Can not decode sign public key")
	}
	sigPublicKey, err := new(privacy.Point).FromBytesS(temp)
	if err != nil {
		return "", errors.Errorf("Get sigPublicKey error")
	}
	verifyKey := new(privacy.SchnorrPublicKey)
	verifyKey.Set(sigPublicKey)

	temp, err = hex.DecodeString(holder.Data.Signature)
	signature := new(privacy.SchnSignature)
	err = signature.SetBytes(temp)
	if err != nil {
		return false, errors.Errorf("Sig set bytes error")
	}
	message := holder.Data.PaymentAddress + holder.Data.Amount
	hashed := common.HashH([]byte(message))
	res := verifyKey.Verify(signature, hashed[:])

	return res, nil
}

// func ComputeTransactionHash(args string, _ int64) (interface{}, error){
// 	// handle both json and b58-json encodings
// 	raw, _, err1 := b58.Decode(args)
// 	if err1!=nil{
// 		raw = []byte(args)
// 	}
// 	result := common.HashH(raw).String()
// 	return result, nil
// }