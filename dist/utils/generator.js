"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireWildcard(require("path"));

var _ejs = _interopRequireDefault(require("ejs"));

var _fs = _interopRequireWildcard(require("fs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

var _default = (configs, defaults) => {
  let compose = {
    version: "2.1",
    services: []
  };
  configs.forEach(config => {
    // if (!('ports' in config) && 'port' in config) {     config.ports =
    // [`${config.port}:${config.port}`]; }
    if (typeof config.cmd === "string") {
      config.command = config.cmd;
      config.cmd = config.cmd.split(/\s+/).map(c => `"${c}"`).join(",");
    }

    let labels = [];

    if (config.kind === "service") {
      if (!("buildPath" in config)) {
        config.buildPath = config.root; //realpathSync(config.root).replace(/\\/g, '/');
      }

      if ("copy" in config) {
        let paths = config.copy.map(p => {
          return {
            resolvedPath: (0, _path.resolve)(config.root, _path.default.dirname(p)),
            original: _path.default.dirname(p)
          };
        }).concat({
          resolvedPath: (0, _path.resolve)(config.root, "./app.config.js"),
          original: "./app.config.js"
        }, {
          resolvedPath: (0, _path.resolve)(config.root, "./.babelrc"),
          original: "./.babelrc"
        }, {
          resolvedPath: (0, _path.resolve)(config.root, "./app.js"),
          original: "./app.js"
        }, {
          resolvedPath: (0, _path.resolve)(config.root, "./package.json"),
          original: "./package.json"
        }, {
          resolvedPath: (0, _path.resolve)(config.root, "./package-lock.json"),
          original: "./package-lock.json"
        }, {
          resolvedPath: (0, _path.resolve)(config.root, "./run.config.json"),
          original: "./run.config.json"
        }, {
          resolvedPath: (0, _path.resolve)(config.root, "./node_modules"),
          original: "./node_modules"
        });
        if (!("volumes" in config) || typeof config.volumes === 'undefined') config.volumes = [];
        const realRoot = (0, _fs.realpathSync)(config.root);
        config.volumes = config.volumes.concat(paths.map(p => {
          return `./${_path.default.join('./', config.root, p.original).replace(/\\/g, '/')}:${p.original.replace("./", "/usr/src/app/").replace(config.root, "/usr/src/app/").replace(realRoot, "/usr/src/app/").replace(/\.\.\//g, "")}`;
        })); //config.volumes = [`./${config.root}:/usr/src/app`].concat(config.volumes);

        config.copy = paths.map(p => {
          return p.original.replace(/\\/g, "/");
        });
      }

      labels = [`${defaults.proxyService.name}.port=${config.port}`, `${defaults.proxyService.name}.backend=${config.name}`, `${defaults.proxyService.name}.frontend.rule=PathPrefix:/api/${config.name}`, `${defaults.proxyService.name}.frontend.priority=100`, `${defaults.proxyService.name}.frontend.entryPoints=http,https`];
      console.log("writing config file " + (0, _path.resolve)(config.buildPath, "run.config.json")); //generate run config

      (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, "run.config.json"), JSON.stringify(config, null, 4)); //generate Dockerfile

      (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, "Dockerfile"), _ejs.default.render((0, _fs.readFileSync)(__dirname + "/../templates/_dockerfile.ejs").toString(), config));

      if (!_fs.default.existsSync(`${config.buildPath}/package.json`)) {
        let pkg = _ejs.default.render((0, _fs.readFileSync)(__dirname + "/../templates/_package.json.ejs").toString(), config);

        let cfg = _ejs.default.render((0, _fs.readFileSync)(__dirname + "/../templates/_app.config.ejs").toString(), config);

        (0, _fs.writeFileSync)(`${config.buildPath}/package.json`, pkg);
        (0, _fs.writeFileSync)(`${config.buildPath}/app/src/handler.js`, (0, _fs.readFileSync)(__dirname + "/../templates/_handler.ejs").toString());
        (0, _fs.writeFileSync)(`${config.buildPath}/app.config.js`, cfg);
        (0, _fs.writeFileSync)(`${config.buildPath}/app.js`, (0, _fs.readFileSync)(__dirname + "/../templates/app.js.ejs").toString());
        (0, _fs.writeFileSync)(`${config.buildPath}/.babelrc`, (0, _fs.readFileSync)(__dirname + "/../templates/babelrc.ejs").toString());
        (0, _fs.writeFileSync)(`${config.buildPath}/.dockerignore`, (0, _fs.readFileSync)(__dirname + "/../templates/_dockerignore.ejs").toString());
      }

      if (!_fs.default.existsSync(`${config.buildPath}/app.test.js`)) {
        (0, _fs.writeFileSync)(`${config.buildPath}/app.test.js`, (0, _fs.readFileSync)(__dirname + "/../templates/app.test.js.ejs").toString());
      }
    }

    if (!("labels" in config) && labels.length > 0) {
      config.labels = labels;
    }

    config.volumes = config.volumes || [];
    config.copy = config.copy || [];
    config.container_name = config.host || config.name || config.container_name; //generate run config

    config.generated = true;
    compose.services.push(config);
  });
  (0, _fs.writeFileSync)((0, _path.resolve)(process.cwd(), "docker-compose.yml"), _ejs.default.render((0, _fs.readFileSync)(__dirname + "/../templates/_docker_compose.ejs").toString(), compose));
  (0, _fs.writeFileSync)((0, _path.resolve)(process.cwd(), "docker-compose.yml"), (0, _fs.readFileSync)((0, _path.resolve)(process.cwd(), "docker-compose.yml")).toString().replace(/^\s*[\r\n]/gm, ""));
  console.log("docker-compose.yml generated");
};

exports.default = _default;
//# sourceMappingURL=generator.js.map