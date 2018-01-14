"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateFiles = generateFiles;
exports.composeUp = composeUp;
exports.composeStop = composeStop;
exports.composeStart = composeStart;
exports.cloneDB = cloneDB;
exports.build = build;
exports.default = void 0;

var _glob = _interopRequireDefault(require("glob"));

var _dockerCompose = _interopRequireDefault(require("docker-compose"));

var _ejs = _interopRequireDefault(require("ejs"));

var _util = require("util");

var _fs = require("fs");

var _path = require("path");

var _jsYaml = require("js-yaml");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const start = (0, _util.promisify)(_dockerCompose.default.up);
const stop = (0, _util.promisify)(_dockerCompose.default.stop);
const exec = (0, _util.promisify)(require('child_process').exec, {
  multiArgs: true
});

let defaults = require(__dirname + '/../config/Defaults').default;

function generateFiles(configs) {
  let compose = {
    version: '2.1',
    services: []
  };
  configs.map(config => {
    // if ('port' in config) {
    //     config.expose = config.port.toString();
    // }
    if (!('ports' in config) && 'port' in config) {
      config.ports = [`${config.port}:${config.port}`];
    }

    if (typeof config.cmd === 'string') {
      //config.command = config.cmd;
      config.cmd = config.cmd.split(/\s+/).map(c => `"${c}"`).join(',');
    }

    if ('copy' in config) {
      let paths = config.copy.map(p => {
        return {
          resolvedPath: (0, _path.resolve)(config.root, (0, _path.dirname)(p)),
          original: (0, _path.dirname)(p)
        };
      }).concat({
        resolvedPath: (0, _path.resolve)(config.root, './app.js'),
        original: './app.js'
      }, {
        resolvedPath: (0, _path.resolve)(config.root, './package.json'),
        original: './package.json'
      }, {
        resolvedPath: (0, _path.resolve)(config.root, './run.config.json'),
        original: './run.config.json'
      });
      config.volumes = paths.map(p => {
        return `${(0, _fs.realpathSync)(p.resolvedPath)}:${p.original.replace('./', '/usr/src/app/')}`;
      });
      config.copy = paths.map(p => {
        return (0, _fs.realpathSync)(p.resolvedPath).replace(/\\/g, '/');
      });
    }

    let labels = [`${defaults.proxyService.name}.backend=${config.name}`, `${defaults.proxyService.name}.frontend.rule=PathPrefix:/api/${config.name};PathStrip:/api`];

    if (!('labels' in config)) {
      config.labels = labels;
    }

    config.volumes = config.volumes || [];
    config.copy = config.copy || [];
    config.container_name = config.host || config.name || config.container_name; //generate run config

    config.generated = true;
    compose.services.push(config);

    if (config.kind === 'service') {
      if (!('buildPath' in config)) {
        config.buildPath = (0, _fs.realpathSync)(config.root).replace(/\\/g, '/');
      } //generate run config


      (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, 'run.config.json'), JSON.stringify(config, null, 4)); //generate Dockerfile

      (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, 'Dockerfile'), _ejs.default.render((0, _fs.readFileSync)(__dirname + '/../templates/_dockerfile.ejs').toString(), config));
    }
  });
  (0, _fs.writeFileSync)((0, _path.resolve)(process.cwd(), 'docker-compose.yml'), _ejs.default.render((0, _fs.readFileSync)(__dirname + '/../templates/_docker_compose.ejs').toString(), compose));
  (0, _fs.writeFileSync)((0, _path.resolve)(process.cwd(), 'docker-compose.yml'), (0, _fs.readFileSync)((0, _path.resolve)(process.cwd(), 'docker-compose.yml')).toString().replace(/^\s*[\r\n]/gm, ''));
  console.log('docker-compose.yml generated');
}

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
  await exec('npm install');
  await exec('npm build');
}

var _default = () => {
  const cfs = _glob.default.sync('**/service.config.?(js|json|yml)', {
    nodir: true,
    ignore: ['**/node_modules/**', 'build/**', 'lib/**', 'src/**', 'dist/**']
  });

  return cfs.map(filePath => {
    console.log('found at ' + filePath);
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

          if ('deps' in config) {
            config.src = config.deps;
          }

          if ('src' in config) {
            if (Array.isArray(config.src)) Array.prototype.push.apply(config.copy, config.src);else config.copy.push(config.src);
          }

          if ('views' in config) {
            if (Array.isArray(config.views)) Array.prototype.push.apply(config.copy, config.views);else config.copy.push(config.views);
          }

          if ('networks' in defaults && 'internal' in defaults.networks) {
            config = _extends({
              networks: 'internal'
            }, config);
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