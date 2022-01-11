import transactorPrototype from "./orderLimit.transactor";
import historyProtoype from "./orderLimit.history";
import withdrawProtoype from "./orderLimit.withdraw";

export default {
  ...withdrawProtoype,
  ...transactorPrototype,
  ...historyProtoype,
};
