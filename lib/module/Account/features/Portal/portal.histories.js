import { isJsonString } from "@lib/utils/json";
import Validator from "@lib/utils/validator";
import ACCOUNT_CONSTANTS from "@lib/module/Account/account.constants";
import { 
	PortalV4ShieldingResponseMeta, 
	PortalV4UnshieldRequestMeta, 
	PortalV4UnshieldingResponseMeta 
} from "@lib/core/constants.js";

const { 
	TX_TYPE, 
	TX_TYPE_STR, 
	STATUS_CODE_UNSHIELD_PORTAL,
	STATUS_STR_SHIELD_PORTAL,
	STATUS_STR_UNSHIELD_PORTAL,
} = ACCOUNT_CONSTANTS;

async function updateStatusPortalTxs( newPortalShieldTxs, newPortalUnShieldTxs ){
	const shieldTasks = newPortalShieldTxs.map(async (shieldTx) => {
		const newShieldTx = {...shieldTx};
		const shieldStatus = await this.handleGetPortalShieldStatusByTxID({ txID: newShieldTx.reqTxID });
		const { ExternalTxID, Status } = shieldStatus;
		newShieldTx.externalTxID = ExternalTxID;
		newShieldTx.status = Status;
		newShieldTx.statusStr = STATUS_STR_SHIELD_PORTAL[Status];
		return newShieldTx;
	});

	const unshieldTasks = newPortalUnShieldTxs.map(async (unshieldTx) => {
		const newUnShieldTx = {...unshieldTx};
		const unshieldStatus = await this.handleGetPortalUnShieldStatusByTxID({ txID: newUnShieldTx.txId });
		const { ExternalTxID, Status, ExternalFee, RemoteAddress, UnshieldAmount } = unshieldStatus;
		newUnShieldTx.externalTxID = ExternalTxID;
		newUnShieldTx.status = Status;
		newUnShieldTx.statusStr = STATUS_STR_UNSHIELD_PORTAL[Status];
		newUnShieldTx.externalFee = ExternalFee;
		newUnShieldTx.externalAddress = RemoteAddress;
		newUnShieldTx.amount = UnshieldAmount;
		return newUnShieldTx;
	});

	return Promise.all([...shieldTasks, ...unshieldTasks]);
}

async function getTxsPortal(params, txsReceiver, txsTransactor) {
  	try {
		const { tokenID } = params;
		new Validator("getTxsPortal-tokenID", tokenID).required().string(); 

		// get old portal txs from local storage
		const oldDetailPortalTxs = await this.getTxsPortalStorage(params); 
			
		// filter all portal txs from txsReceiver and txsTransactor
		const {
			txsReceiver: newTxsReceiver,
			txsTransactor: newTxsTransactor,
			txsPortalShield,
			txsPortalUnShield,
		} = await this.handleFilterTxsPortal({ txsReceiver, txsTransactor });
			if (txsPortalShield.length === 0 && txsPortalUnShield.length === 0) {
				return oldDetailPortalTxs;
		}

		// filter shield portal txs that don't have detail infos before
		const finishedShieldTxs = oldDetailPortalTxs.filter(
			(tx) => tx.txType === TX_TYPE.SHIELDPORTAL
		);
		const finishedShieldTxIDs = finishedShieldTxs.map((tx) => tx.txId);
		let newPortalShieldTxs = txsPortalShield.filter((tx) => {
			return !finishedShieldTxIDs.includes(tx.txId);
		});

		// filter unshield portal txs that don't have detail infos before
		const finishedUnshieldTxs = oldDetailPortalTxs.filter(
			(tx) => tx.txType === TX_TYPE.UNSHIELDPORTAL && 
			(tx.status === STATUS_CODE_UNSHIELD_PORTAL.COMPLETE || tx.status === STATUS_CODE_UNSHIELD_PORTAL.REFUND)
		);
		const finishedUnshieldTxIDs = finishedUnshieldTxs.map((tx) => tx.txId);
		let newPortalUnShieldTxs = txsPortalUnShield.filter((tx) => {
			return !finishedUnshieldTxIDs.includes(tx.txId);
		});

		// update status of portal txs
		let newPortalTxs = await this.updateStatusPortalTxs(newPortalShieldTxs, newPortalUnShieldTxs);

		// merge new portal txs and old portal txs from storage
		const allPortalTxs = [ ...newPortalTxs, ...oldDetailPortalTxs ];
		const portalTxs = allPortalTxs.filter((tx, index) => {
			return allPortalTxs.findIndex((currentTx) => tx.txId === currentTx.txId) === index
		}); 

		// store updated portal txs into storage
		await this.setTxsPortalStorage(params, portalTxs);
		return {
			txsPortal: portalTxs,
			txsReceiver: newTxsReceiver,
			txsTransactor: newTxsTransactor,
		};
	} catch (error) {
		console.log("GET TXS PORTAL FAILED", error);
		return {
			txsPortal: [],
			txsReceiver,
			txsTransactor,
		};
	}
} //

function handleFilterTxsPortal({ txsReceiver, txsTransactor }) {
	let txsPortalShield = [];   // list of shield response txs
	let txsPortalUnShield = []; // list of unshield request txs
	try {
		new Validator("txsReceiver", txsReceiver).required().array();
		let _txsReceiver = [...txsReceiver];
		let _txsTransactor = [...txsTransactor];
	
		_txsReceiver = _txsReceiver.filter((txr) => {
			const { metaData } = txr;
			if (isJsonString(metaData)) {
				const parse = JSON.parse(metaData);
				const type = parse?.Type;
				switch (type) {
					case PortalV4ShieldingResponseMeta:  	// filter shield txs
					{
						txr.txType = TX_TYPE.SHIELDPORTAL;
						txr.txTypeStr = TX_TYPE_STR[TX_TYPE.SHIELDPORTAL];
						const requestTxId = parse?.ReqTxID;
						txr.reqTxID = requestTxId;   // assign tx request id
						txr.incognitoAddress = this.getPaymentAddress();
						txsPortalShield.push(txr);
						const foundIndex = _txsTransactor.findIndex(
							(txp) => txp.txId === requestTxId
						);
						if (foundIndex > -1)  {
							_txsTransactor.splice(foundIndex, 1); 
						}
						return false;
					}
					case PortalV4UnshieldingResponseMeta:  	// filter unshield txs (refunded)
					{
						const requestTxId = parse?.ReqTxID;
						const foundIndex = _txsTransactor.findIndex(
							(txp) => txp.txId === requestTxId
						);
						if (foundIndex > -1)  {
							let unshieldReqTx = _txsTransactor[foundIndex];
							unshieldReqTx.txType = TX_TYPE.UNSHIELDPORTAL;
							unshieldReqTx.txTypeStr = TX_TYPE_STR[TX_TYPE.UNSHIELDPORTAL];
							unshieldReqTx.incognitoAddress = this.getPaymentAddress();
							txsPortalUnShield.push(unshieldReqTx);
							_txsTransactor.splice(foundIndex, 1); 
							return false;
						}
					}
					default:
						break;
				}
			}
			return true;
		});

		_txsTransactor = _txsTransactor.filter((txr) => {
			const { metaData } = txr;
			if (isJsonString(metaData)) {
				const parse = JSON.parse(metaData);
				const type = parse?.Type;
				switch (type) {
					case PortalV4UnshieldRequestMeta:  	// filter unshield txs (success)
					{
						txr.txType = TX_TYPE.UNSHIELDPORTAL;
						txr.txTypeStr = TX_TYPE_STR[TX_TYPE.UNSHIELDPORTAL];
						txr.incognitoAddress = this.getPaymentAddress();
						txsPortalUnShield.push(txr);
						return false;
					}
					default:
						break;
				}
			}
			return true;
		});
		return {
			txsReceiver: _txsReceiver,
			txsTransactor: _txsTransactor,
			txsPortalShield,
			txsPortalUnShield,
		}
	} catch (error) {
		console.log("FILTER TXS PORTAL FROM TXS RECEIVER AND TXS TRANSACTOR FAILED", error);
	}
	return {
		txsReceiver,
		txsTransactor,
		txsPortalShield,
		txsPortalUnShield,
	};
}

export default {
	handleFilterTxsPortal,
	getTxsPortal,
	updateStatusPortalTxs
}