"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _glob = _interopRequireDefault(require("glob"));

var _path = _interopRequireDefault(require("path"));

var _jsYaml = _interopRequireDefault(require("js-yaml"));

var _fs = _interopRequireDefault(require("fs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

var _default = (() => {
  let defFiles = _glob.default.sync('**/+(config|defaults|default).+(js|json|yml)', {
    realpath: true
  });

  let defFile = defFiles[0];
  let defaults = {};

  if (_path.default.extname(defFile) === '.yml') {
    try {
      defaults = _jsYaml.default.safeLoad(_fs.default.readFileSync(defFile, 'utf-8'));
    } catch (err) {
      console.error(err);
    }
  } else if (_path.default.extname(defFile) === '.json') {
    try {
      defaults = JSON.parse(_fs.default.readFileSync(defFile, 'utf-8'));
    } catch (err) {
      console.error(err);
    }
  } else if (_path.default.extname(defFile) === '.js') {
    defaults = require(defFile);
  }

  if (defaults) {
    defaults = _extends({}, defaults);

    let proxy = require('./proxy.json'),
        docker = require('./docker.json'),
        messageBus = require('./messageBus.json'),
        session = require('./session.json'),
        service = require('./service.json'),
        db = require('./db.json'),
        logging = require('./logging.json');

    db = _extends({}, db, logging);
    messageBus = _extends({}, messageBus);
    session = _extends({}, session);
    proxy = _extends({}, proxy);
    service = _extends({}, service);
    defaults = _extends({}, docker, db, session, messageBus, proxy, service, defaults);
  }

  return defaults;
})();

exports.default = _default;
//# sourceMappingURL=Defaults.js.map