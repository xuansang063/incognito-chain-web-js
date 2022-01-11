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
	STATUS_CODE_SHIELD_PORTAL,
	STATUS_CODE_UNSHIELD_PORTAL,
	STATUS_STR_SHIELD_PORTAL,
	STATUS_STR_UNSHIELD_PORTAL,
} = ACCOUNT_CONSTANTS;

import { BTC_MIN_CONFIRMATION } from "./portal.constants";

async function updateStatusFinishedShieldPortalTx(shieldTx) {
	const newShieldTx = {...shieldTx};
	let shieldStatus;
	try {
		shieldStatus = await this.handleGetPortalShieldStatusByTxID({ txID: newShieldTx.reqTxID });
	} catch(e){
		console.log("GET TX PORTAL SHIELD FAILED txID: ", newShieldTx.reqTxID, " - Error: ", e);
		return shieldTx;
	}
	const { ExternalTxID, Status } = shieldStatus;
	newShieldTx.externalTxID = ExternalTxID;
	newShieldTx.status = Status;
	newShieldTx.statusStr = STATUS_STR_SHIELD_PORTAL[Status];
	return newShieldTx;
}

async function updateStatusShieldPortalTx(shieldTx, tokenID) {
	const newShieldTx = {...shieldTx};
	let shieldStatus;
	try {
		if (newShieldTx.reqTxID) {
			shieldStatus = await this.handleGetPortalShieldStatusByTxID({ txID: newShieldTx.reqTxID });
			const { ExternalTxID, Status } = shieldStatus;
			newShieldTx.externalTxID = ExternalTxID;
			newShieldTx.status = Status;
			newShieldTx.statusStr = STATUS_STR_SHIELD_PORTAL[Status];
		} else {
			shieldStatus = await this.handleGetPortalShieldStatusByExternalTxID({ externalTxID: newShieldTx.externalTxID, tokenID });
			const { externalTxID, status, confirmations } = shieldStatus;
			newShieldTx.externalTxID = externalTxID;
			newShieldTx.status = status;
			newShieldTx.statusStr = STATUS_STR_SHIELD_PORTAL[status];
			newShieldTx.confirmations = confirmations;
		}
	} catch(e){
		console.log("GET TX PORTAL SHIELD FAILED txID: ", newShieldTx.reqTxID, " - External TxID ", newShieldTx.externalTxID, " - Error: ", e);
		return shieldTx;
	}
	
	return newShieldTx;
}

async function updateStatusUnShieldPortalTx(unshieldTx) {
	const newUnShieldTx = {...unshieldTx};
	let unshieldStatus;
	try {
		unshieldStatus = await this.handleGetPortalUnShieldStatusByTxID({ txID: newUnShieldTx.txId });
	} catch(e){
		console.log("GET TX PORTAL UNSHIELD FAILED txID: ", newUnShieldTx.txId, " - Error: ", e);
		return unshieldTx;
	}
	const { ExternalTxID, Status, ExternalFee, RemoteAddress, UnshieldAmount } = unshieldStatus;
	newUnShieldTx.externalTxID = ExternalTxID;
	newUnShieldTx.status = Status;
	newUnShieldTx.statusStr = STATUS_STR_UNSHIELD_PORTAL[Status];
	newUnShieldTx.externalFee = ExternalFee;
	newUnShieldTx.externalAddress = RemoteAddress;
	newUnShieldTx.amount = UnshieldAmount;
	return newUnShieldTx;
}

async function updateStatusPortalShieldTxs( newPortalShieldTxs ){
	const shieldTasks = newPortalShieldTxs.map((shieldTx) => {
		return this.updateStatusFinishedShieldPortalTx(shieldTx);
	});
	return Promise.all(shieldTasks);
}

async function updateStatusPortalUnshieldTxs(newPortalUnShieldTxs ){
	const unshieldTasks = newPortalUnShieldTxs.map((unshieldTx) => {
		return this.updateStatusUnShieldPortalTx(unshieldTx);
	});

	return Promise.all(unshieldTasks);
}

async function getPortalShieldTxs(localPortalTxs, shieldTxFromTxReceivers, incAddress, tokenID) {
	// filter finished shield txs - that have status is FAILED: 0 or SUCCESS: 1
	// filter finished shield txs that don't have detail infos before
	let finishedShieldTxs = localPortalTxs.filter(
		(tx) => tx.txType === TX_TYPE.SHIELDPORTAL && 
		(tx.status === STATUS_CODE_SHIELD_PORTAL.SUCCESS || tx.status === STATUS_CODE_SHIELD_PORTAL.FAILED)
	);
	const finishedShieldTxIDs = finishedShieldTxs.map((tx) => tx.txId);
	let newPortalShieldTxs = shieldTxFromTxReceivers.filter((tx) => {
		return !finishedShieldTxIDs.includes(tx.txId);
	});

	// update status (get detail info from fullnode) of newPortalShieldTxs
	newPortalShieldTxs = await this.updateStatusPortalShieldTxs(newPortalShieldTxs);

	// call api to get shield txs from portal backend
	const shieldTxsFromBE = await this.handleGetPortalShieldingHistory({ incAddress, tokenID });
	let shieldTxsFromBEMap = {};
	shieldTxsFromBE.forEach(item => {
		if (item && item.externalTxID) {
			shieldTxsFromBEMap[item.externalTxID] = item;
		};
	});

	// update Time in newPortalShieldTxs is Time from BE (time of creating external transaction - make sure they are consistent)
	newPortalShieldTxs.forEach((item, index, array) => {
		if (item.externalTxID && shieldTxsFromBEMap[item.externalTxID]) {
			array[index].time = shieldTxsFromBEMap[item.externalTxID].time;
		};
	});

	// all finished shield txs
	finishedShieldTxs = [...finishedShieldTxs, ...newPortalShieldTxs];
	const externalTxIDsFinishedShield = finishedShieldTxs.map((tx) => tx.externalTxID);

	// filter not finished shield txs - that have status is PENDING: 2, PROCESSING: 3
	let notFinishedShieldTxs = shieldTxsFromBE.filter((tx) => {
		return !externalTxIDsFinishedShield.includes(tx.externalTxID);
	});

	// filter new failed shielding requests
	const minShieldAmount = await this.handleGetPortalMinShieldAmount({ tokenID });
	let newFailedShieldTxs = [];
	notFinishedShieldTxs.forEach((item, index, arr) => {
		item.txType = TX_TYPE.SHIELDPORTAL;
		item.txTypeStr = TX_TYPE_STR[TX_TYPE.SHIELDPORTAL];
		if ( item.confirmations >= BTC_MIN_CONFIRMATION && item.amount < minShieldAmount ){
			item.status = STATUS_CODE_SHIELD_PORTAL.FAILED;
			item.statusStr = STATUS_STR_SHIELD_PORTAL[item.status];
			newFailedShieldTxs = [...newFailedShieldTxs, item];
			arr.splice(index, 1);
		} else {
			item.statusStr = STATUS_STR_SHIELD_PORTAL[item.status];
			arr[index] = item;
		}
	});
	finishedShieldTxs = [...finishedShieldTxs, ...newFailedShieldTxs];

	return {
		finishedShieldTxs,
		allShieldTxs: [...finishedShieldTxs, ...notFinishedShieldTxs],
	};
}

async function getPortalUnshieldTxs(localPortalTxs, unshieldTxFromTxTransactors) {
	// filter finished unshield txs - that have status is COMPLETE: 2, REFUND: 3
	// filter new unshield txs that don't have detail infos before
	const finishedUnshieldTxs = localPortalTxs.filter(
		(tx) => tx.txType === TX_TYPE.UNSHIELDPORTAL && 
		(tx.statusStr === STATUS_STR_UNSHIELD_PORTAL[STATUS_CODE_UNSHIELD_PORTAL.COMPLETE] || tx.statusStr === STATUS_STR_UNSHIELD_PORTAL[STATUS_CODE_UNSHIELD_PORTAL.REFUND])
	);
	const finishedUnshieldTxIDs = finishedUnshieldTxs.map((tx) => tx.txId);
	let newPortalUnShieldTxs = unshieldTxFromTxTransactors.filter((tx) => {
		return !finishedUnshieldTxIDs.includes(tx.txId);
	});

	// update status (get detail info from fullnode) of newPortalUnShieldTxs
	newPortalUnShieldTxs = await this.updateStatusPortalUnshieldTxs(newPortalUnShieldTxs);

	return {
		allUnshieldTxs: [...finishedUnshieldTxs, ...newPortalUnShieldTxs],
	};
}
async function getTxsPortal(params, txsReceiver, txsTransactor) {
  	try {
		const { tokenID } = params;
		new Validator("getTxsPortal-tokenID", tokenID).required().string(); 
		
		const incAddress = this.getPaymentAddress();

		// get old portal txs from local storage
		// include finished shielding txs and all unshielding txs
		const oldDetailPortalTxs = await this.getTxsPortalStorage(params); 
			
		// filter all portal txs from txsReceiver and txsTransactor
		const {
			txsReceiver: newTxsReceiver,
			txsTransactor: newTxsTransactor,
			txsPortalShield,
			txsPortalUnShield,
		} = await this.handleFilterTxsPortal({ txsReceiver, txsTransactor });
	
		const { finishedShieldTxs, allShieldTxs } = await this.getPortalShieldTxs(oldDetailPortalTxs, txsPortalShield, incAddress, tokenID);
		const { allUnshieldTxs } = await this.getPortalUnshieldTxs(oldDetailPortalTxs, txsPortalUnShield);

		// store updated portal txs into storage
		const storedPortalTxs = [...finishedShieldTxs, ...allUnshieldTxs];
		await this.setTxsPortalStorage(params, storedPortalTxs);
		return {
			txsPortal: [...allShieldTxs, ...allUnshieldTxs],
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
	updateStatusFinishedShieldPortalTx,
	updateStatusShieldPortalTx,
	updateStatusUnShieldPortalTx,
	getPortalShieldTxs,
	getPortalUnshieldTxs,
	updateStatusPortalShieldTxs,
	updateStatusPortalUnshieldTxs,
	
}