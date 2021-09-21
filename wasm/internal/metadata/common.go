package metadata

import (
	"encoding/json"
	"strconv"

	"github.com/pkg/errors"
)

func CalculateSize(meta Metadata) uint64 {
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return 0
	}
	return uint64(len(metaBytes))
}

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
	case BurningRequestMeta, BurningRequestMetaV2,
		BurningForDepositToSCRequestMeta, BurningForDepositToSCRequestMetaV2,
		BurningPBSCRequestMeta, BurningPRVERC20RequestMeta, BurningPRVBEP20RequestMeta:
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
	case UnStakingMeta:
		md = &UnStakingMetadata{}
	case IssuingBSCRequestMeta:
		md = &IssuingEVMRequest{}
	case IssuingBSCResponseMeta:
		md = &IssuingEVMResponse{}
	case PortalV4UnshieldRequestMeta:
		md = &PortalUnshieldRequest{}
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

var bridgeMetas = []string{
	strconv.Itoa(BeaconSwapConfirmMeta),
	strconv.Itoa(BridgeSwapConfirmMeta),
	strconv.Itoa(BurningConfirmMeta),
	strconv.Itoa(BurningConfirmForDepositToSCMeta),
	strconv.Itoa(BurningConfirmMetaV2),
	strconv.Itoa(BurningConfirmForDepositToSCMetaV2),
	strconv.Itoa(BurningBSCConfirmMeta),
}

func HasBridgeInstructions(instructions [][]string) bool {
	for _, inst := range instructions {
		for _, meta := range bridgeMetas {
			if len(inst) > 0 && inst[0] == meta {
				return true
			}
		}
	}
	return false
}

type uintMaybeString uint64

func (u uintMaybeString) MarshalJSON() ([]byte, error) {
	return json.Marshal(u)
}
func (u *uintMaybeString) UnmarshalJSON(raw []byte) error {
	var theNum uint64
	err := json.Unmarshal(raw, &theNum)
	if err != nil {
		var theStr string
		json.Unmarshal(raw, &theStr)
		temp, err := strconv.ParseUint(theStr, 10, 64)
		*u = uintMaybeString(temp)
		return err
	}
	*u = uintMaybeString(theNum)
	return err
}
