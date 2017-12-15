"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = {
    occupiedIps: [],
    ip: 3000,
    start: ip => {
        undefined.ip = ip;
    },
    next: () => {
        //TODO: check for ip conflicts
        undefined.ip++;
        undefined.occupiedIps.push(undefined.ip);

        return undefined.ip;
    }
};