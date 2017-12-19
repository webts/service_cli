"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = {
  occupiedIps: [],
  ip: 3000,
  start: ip => {
    (void 0).ip = ip;
  },
  next: () => {
    //TODO: check for ip conflicts
    (void 0).ip++;
    (void 0).occupiedIps.push((void 0).ip);
    return (void 0).ip;
  }
};
exports.default = _default;