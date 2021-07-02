//shield decentralized
export const STATUS_CODE_SHIELD_DECENTRALIZED = {
  PENDING: 0,
  PROCESSING: [1, 2, 3, 4, 5],
  COMPLETE: [7, 12],
  TIMED_OUT: 14,
  RETRYING: 6,
};
//shield centralized
export const STATUS_CODE_SHIELD_CENTRALIZED = {
  PENDING: 0,
  PROCESSING: [1, 2, 14],
  COMPLETE: [3, 5],
  TIMED_OUT: [16],
};
//unshield decentralized
export const STATUS_CODE_UNSHIELD_DECENTRALIZED = {
  PROCESSING: [8, 11],
  FAILED: [9, 15],
  COMPLETE: 12,
  RETRYING: [10, 13],
  TIMED_OUT: 14,
};
//unshield centralized
export const STATUS_CODE_UNSHIELD_CENTRALIZED = {
  PENDING: 0,
  PROCESSING: [6, 7, 8, 9],
  COMPLETE: 10,
  RETRYING: 15,
  TIMED_OUT: 16,
};

export const ADDRESS_TYPE = {
  SHIELD: 1,
  UNSHIELD: 2,
};
