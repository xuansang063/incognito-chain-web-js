package metadata

import (
	"encoding/json"

	"github.com/pkg/errors"
	metadataCommon "incognito-chain/metadata/common"
	metadataPdexv3 "incognito-chain/metadata/pdexv3"
)

func ParseMetadata(raw json.RawMessage) (Metadata, error) {
	var err error
	if raw == nil || string(raw) == "null" {
		return nil, nil
	}

	mtTemp := map[string]interface{}{}
	err = json.Unmarshal(raw, &mtTemp)
	if err != nil {
		return nil, err
	}
	var md Metadata
	typeFloat, ok := mtTemp["Type"].(float64)
	if !ok {
		return nil, errors.Errorf("Could not parse metadata with type: %v", mtTemp["Type"])
	}
	theType := int(typeFloat)
	switch theType {
	case InitTokenRequestMeta:
		md = &InitTokenRequest{}
	case IssuingRequestMeta:
		md = &IssuingRequest{}
	case IssuingResponseMeta:
		md = &IssuingResponse{}
	case ContractingRequestMeta:
		md = &ContractingRequest{}
	case BeaconSalaryResponseMeta:
		md = &BeaconBlockSalaryRes{}
	case BurningRequestMeta:
		md = &BurningRequest{}
	case BurningRequestMetaV2:
		md = &BurningRequest{}
	case ShardStakingMeta:
		md = &StakingMetadata{}
	case BeaconStakingMeta:
		md = &StakingMetadata{}
	case ReturnStakingMeta:
		md = &ReturnStakingMetadata{}
	case WithDrawRewardRequestMeta:
		md = &WithDrawRewardRequest{}
	case WithDrawRewardResponseMeta:
		md = &WithDrawRewardResponse{}
	case StopAutoStakingMeta:
		md = &StopAutoStakingMetadata{}
	case PDEContributionMeta:
		md = &PDEContribution{}
	case PDEPRVRequiredContributionRequestMeta:
		md = &PDEContribution{}
	case PDETradeRequestMeta:
		md = &PDETradeRequest{}
	case PDETradeResponseMeta:
		md = &PDETradeResponse{}
	case PDECrossPoolTradeRequestMeta:
		md = &PDECrossPoolTradeRequest{}
	case PDECrossPoolTradeResponseMeta:
		md = &PDECrossPoolTradeResponse{}
	case PDEWithdrawalRequestMeta:
		md = &PDEWithdrawalRequest{}
	case PDEWithdrawalResponseMeta:
		md = &PDEWithdrawalResponse{}
	case PDEFeeWithdrawalRequestMeta:
		md = &PDEFeeWithdrawalRequest{}
	case PDEFeeWithdrawalResponseMeta:
		md = &PDEFeeWithdrawalResponse{}
	case PDEContributionResponseMeta:
		md = &PDEContributionResponse{}
	case RelayingBNBHeaderMeta:
		md = &RelayingHeader{}
	case RelayingBTCHeaderMeta:
		md = &RelayingHeader{}
	case BurningForDepositToSCRequestMeta:
		md = &BurningRequest{}
	case BurningForDepositToSCRequestMetaV2:
		md = &BurningRequest{}
	case UnStakingMeta:
		md = &UnStakingMetadata{}
	case IssuingBSCRequestMeta:
		md = &IssuingEVMRequest{}
	case IssuingBSCResponseMeta:
		md = &IssuingEVMResponse{}
	case BurningPBSCRequestMeta:
		md = &BurningRequest{}
	case PortalV4UnshieldRequestMeta:
		md = &PortalUnshieldRequest{}
	case metadataCommon.Pdexv3ModifyParamsMeta:
		md = &metadataPdexv3.ParamsModifyingRequest{}
	case metadataCommon.Pdexv3AddLiquidityRequestMeta:
		md = &metadataPdexv3.AddLiquidityRequest{}
	case metadataCommon.Pdexv3AddLiquidityResponseMeta:
		md = &metadataPdexv3.AddLiquidityResponse{}
	case metadataCommon.Pdexv3WithdrawLiquidityRequestMeta:
		md = &metadataPdexv3.WithdrawLiquidityRequest{}
	case metadataCommon.Pdexv3WithdrawLiquidityResponseMeta:
		md = &metadataPdexv3.WithdrawLiquidityResponse{}
	case metadataCommon.Pdexv3TradeRequestMeta:
		md = &metadataPdexv3.TradeRequest{}
	case metadataCommon.Pdexv3TradeResponseMeta:
		md = &metadataPdexv3.TradeResponse{}
	case metadataCommon.Pdexv3AddOrderRequestMeta:
		md = &metadataPdexv3.AddOrderRequest{}
	case metadataCommon.Pdexv3AddOrderResponseMeta:
		md = &metadataPdexv3.AddOrderResponse{}
	case metadataCommon.Pdexv3WithdrawOrderRequestMeta:
		md = &metadataPdexv3.WithdrawOrderRequest{}
	case metadataCommon.Pdexv3WithdrawOrderResponseMeta:
		md = &metadataPdexv3.WithdrawOrderResponse{}
	case metadataCommon.Pdexv3MintNft:
		md = &metadataPdexv3.MintNft{}
	default:
		return nil, errors.Errorf("Could not parse metadata with type: %d", theType)
	}

	err = json.Unmarshal(raw, &md)
	if err != nil {
		println(err.Error())
		return nil, err
	}
	return md, nil
}
