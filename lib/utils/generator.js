import path, { resolve } from "path";
import ejs from "ejs";
import { readFileSync, realpathSync, writeFileSync } from "fs";

export default (configs, defaults) => {
  let compose = {
    version: "2.1",
    services: []
  };
  configs.forEach(config => {
    // if (!('ports' in config) && 'port' in config) {
    //     config.ports = [`${config.port}:${config.port}`];
    // }

    if (typeof config.cmd === "string") {
      config.command = config.cmd;
      config.cmd = config.cmd
        .split(/\s+/)
        .map(c => `"${c}"`)
        .join(",");
    }

    let labels = [];

    if (config.kind === "service") {
      if (!("buildPath" in config)) {
        config.buildPath = config.root; //realpathSync(config.root).replace(/\\/g, '/');
      }

      if ("copy" in config) {
        let paths = config.copy
          .map(p => {
            return {
              resolvedPath: resolve(config.root, path.dirname(p)),
              original: path.dirname(p)
            };
          })
          .concat(
            {
              resolvedPath: resolve(config.root, "./app.config.js"),
              original: "./app.config.js"
            },
            {
              resolvedPath: resolve(config.root, "./.babelrc"),
              original: "./.babelrc"
            },
            {
              resolvedPath: resolve(config.root, "./app.js"),
              original: "./app.js"
            },
            {
              resolvedPath: resolve(config.root, "./package.json"),
              original: "./package.json"
            },
            {
              resolvedPath: resolve(config.root, "./run.config.json"),
              original: "./run.config.json"
            }
          );
        if (!("volumes" in config) || typeof config.volumes === 'undefined') config.volumes = [];

        const realRoot = realpathSync(config.root);
        config.volumes = config.volumes.concat(
          paths.map(p => {
            return `./${path.join('./',config.root, p.original).replace(/\\/g,'/')}:${p.original.replace(
                "./",
                "/usr/src/app/"
            ).replace(
                config.root,
                "/usr/src/app/"  
            ).replace(
                realRoot,
                "/usr/src/app/"  
            ).replace(
                /\.\.\//g,
                ""
            )}`;
          })
        );

        config.volumes = [`./${config.root}:/usr/src/app`].concat(config.volumes);

        config.copy = paths.map(p => {
          return p.original.replace(/\\/g, "/");
        });
      }
      labels = [
        `${defaults.proxyService.name}.port=${config.port}`,
        `${defaults.proxyService.name}.backend=${config.name}`,
        `${defaults.proxyService.name}.frontend.rule=PathPrefix:/api/${config.name};PathStrip:/api`,
        `${defaults.proxyService.name}.frontend.priority=100`,
        `${defaults.proxyService.name}.frontend.passHostHeader=true`,
        `${defaults.proxyService.name}.protocol=http,https`
      ];

      console.log(
        "writing config file " + resolve(config.buildPath, "run.config.json")
      );
      //generate run config
      writeFileSync(
        resolve(config.buildPath, "run.config.json"),
        JSON.stringify(config, null, 4)
      );
      //generate Dockerfile
      writeFileSync(
        resolve(config.buildPath, "Dockerfile"),
        ejs.render(
          readFileSync(__dirname + "/../templates/_dockerfile.ejs").toString(),
          config
        )
      );

      let pkg = ejs.render(
        readFileSync(__dirname + "/../templates/_package.json.ejs").toString(),
        config
      );
      let cfg = ejs.render(
        readFileSync(__dirname + "/../templates/_app.config.ejs").toString(),
        config
      );
      writeFileSync(`${config.buildPath}/package.json`, pkg);
      writeFileSync(`${config.buildPath}/app.config.js`, cfg);
      writeFileSync(
        `${config.buildPath}/app.js`,
        readFileSync(__dirname + "/../templates/app.js.ejs").toString()
      );
      writeFileSync(
        `${config.buildPath}/app/src/handler.js`,
        readFileSync(__dirname + "/../templates/_handler.ejs").toString()
      );
      writeFileSync(
        `${config.buildPath}/.babelrc`,
        readFileSync(__dirname + "/../templates/babelrc.ejs").toString()
      );
    }

    if (!("labels" in config) && labels.length > 0) {
      config.labels = labels;
    }

    config.volumes = config.volumes || [];
    config.copy = config.copy || [];

    config.container_name = config.host || config.name || config.container_name;

    //generate run config
    config.generated = true;
    compose.services.push(config);
  });

  writeFileSync(
    resolve(process.cwd(), "docker-compose.yml"),
    ejs.render(
      readFileSync(__dirname + "/../templates/_docker_compose.ejs").toString(),
      compose
    )
  );

  writeFileSync(
    resolve(process.cwd(), "docker-compose.yml"),
    readFileSync(resolve(process.cwd(), "docker-compose.yml"))
      .toString()
      .replace(/^\s*[\r\n]/gm, "")
  );

  console.log("docker-compose.yml generated");
};
