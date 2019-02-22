import * as constants from "privacy-js-lib/lib/constants"

/**
 * @return {number}
 */
function getShardIDFromLastByte(lastByte) {
  return lastByte % constants.SHARD_NUMBER
}

export {getShardIDFromLastByte};