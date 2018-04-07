"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.composeUp = composeUp;
exports.composeStop = composeStop;
exports.composeStart = composeStart;
exports.cloneDB = cloneDB;
exports.build = build;
exports.default = void 0;

var _glob = _interopRequireDefault(require("glob"));

var _dockerCompose = _interopRequireDefault(require("docker-compose"));

var _ejs = _interopRequireDefault(require("ejs"));

var _cpy = _interopRequireDefault(require("cpy"));

var _rimraf = _interopRequireDefault(require("rimraf"));

var _util = require("util");

var _fs = _interopRequireWildcard(require("fs"));

var _path = _interopRequireWildcard(require("path"));

var _jsYaml = require("js-yaml");

var _generator = _interopRequireDefault(require("./generator"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const start = (0, _util.promisify)(_dockerCompose.default.up);
const stop = (0, _util.promisify)(_dockerCompose.default.stop);
const exec = (0, _util.promisify)(require('child_process').exec, {
  multiArgs: true
});

let defaults = require(__dirname + '/../config/Defaults').default;

module.exports.generate = _generator.default;

async function composeUp(yml) {
  try {
    await start({
      cwd: process.cwd(),
      log: true
    });
    console.log('docker containers started');
  } catch (err) {
    console.error(err);
  }
}

async function composeStop(yml) {
  try {
    await stop({
      cwd: process.cwd(),
      log: true
    });
    console.log('docker containers stopped');
  } catch (err) {
    console.error(err);
  }
}

async function composeStart(yml) {
  try {
    await exec('docker-compose start');
    console.log('docker containers stopped');
  } catch (err) {
    console.error(err);
  }
}

async function cloneDB(db, media) {
  media = media || true;

  try {
    console.log('db cloning');
    await exec(`docker-compose run --rm commander clone ${db} ${media}`);
  } catch (err) {
    console.error(err);
  }
}

async function build(config) {
  console.log(`building ${config.name}`);
  await exec('yarn install', {
    cwd: config.root
  });
  await exec('yarn build', {
    cwd: config.root
  });
}

var _default = () => {
  const cfs = _glob.default.sync('**/service.config.?(js|json|yml)', {
    nodir: true,
    ignore: ['**/node_modules/**', 'build/**', 'lib/**', 'src/**', 'dist/**']
  });

  return cfs.map(filePath => {
    let obj = {
      kind: ''
    };
    const ext = (0, _path.extname)(filePath).toLowerCase();
    const parent = (0, _path.dirname)(filePath);

    try {
      if (ext === '.json') {
        let content = (0, _fs.readFileSync)((0, _fs.realpathSync)(filePath));
        obj = JSON.parse(content);
      } else if (ext === '.yml') {
        obj = (0, _jsYaml.safeLoad)((0, _fs.readFileSync)(filePath), 'utf-8');
      } else if (ext === '.js') {
        obj = require((0, _fs.realpathSync)('./' + filePath));
      }
    } catch (err) {
      console.error(err);
    }

    console.log('found config ' + obj.name);
    obj.node_env = process.env.NODE_ENV || 'dev';
    obj.root = parent;
    return obj;
  }).map(config => {
    switch (config.kind) {
      case "service":
        {
          config = _extends({}, defaults.docker.service, defaults.service, config);
          config = _extends({
            db: _extends(defaults.db, {
              logging: defaults.logging
            }),
            session: _extends(defaults.session, {
              logging: defaults.logging
            }),
            messageBus: _extends(defaults.messageBus, {
              logging: defaults.logging
            }),
            logging: defaults.logging
          }, config);
          config.copy = [];

          if (!'src' in config) {
            if ('deps' in config) {
              config.src = config.deps;
            }
          } else if ('deps' in config) {
            let deps = [config.deps];
            if (Array.isArray(config.deps)) deps = config.deps;
            if (!_fs.default.existsSync(_path.default.join(config.root, 'app', 'lib'))) _fs.default.mkdirSync(_path.default.join(config.root, 'app', 'lib'));
            if (!_fs.default.existsSync(_path.default.join(config.root, 'app', 'lib', 'deps'))) _fs.default.mkdirSync(_path.default.join(config.root, 'app', 'lib', 'deps'));else _rimraf.default.sync(_path.default.join(config.root, 'app', 'lib', 'deps') + "/**");
            deps.forEach(dep => {
              console.log('cpy ' + dep);
              (0, _cpy.default)(dep, _path.default.join(config.root, 'app', 'lib', 'deps'), {
                cwd: process.cwd(),
                parents: false,
                nodir: true
              });
            });
            config.deps = ['./app/lib/deps/**'];
            config.copy.push('./app/lib/deps');
          }

          if ('src' in config) {
            if (Array.isArray(config.src)) Array.prototype.push.apply(config.copy, config.src);else config.copy.push(config.src);
          }

          if ('views' in config) {
            if (Array.isArray(config.views)) Array.prototype.push.apply(config.copy, config.views);else config.copy.push(config.views);
          }

          if (typeof config.copy !== 'undefined') {
            config.copy.forEach(p => {
              if (p.startsWith('./')) p = p.replace('./', config.root + '/');
            });
          }

          if ('networks' in defaults && 'internal' in defaults.networks) {
            config = _extends({
              networks: 'internal'
            }, config);
          }

          if (!('working_dir' in config)) {
            config.working_dir = '/usr/src/app';
          }

          break;
        }

      case 'proxy':
        config = _extends({}, defaults.docker.proxyService, defaults.proxyService, config);

        if ('networks' in defaults && 'proxy' in defaults.networks) {
          config = _extends({
            networks: 'proxy'
          }, config);
        }

        break;
    }

    return config;
  });
};

exports.default = _default;
//# sourceMappingURL=index.js.map