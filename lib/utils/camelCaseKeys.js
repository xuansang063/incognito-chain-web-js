import camelCase from "lodash/camelCase";

export const camelCaseKeys = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map((v) => camelCaseKeys(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce(
      (result, key) => ({
        ...result,
        [camelCase(key)]: camelCaseKeys(obj[key]),
      }),
      {}
    );
  }
  return obj;
};
