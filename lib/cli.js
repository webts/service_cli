#! /usr/bin/env node

import args from 'commander';
import getConfigs, {build, cloneDB, composeStart, composeStop, composeUp, generateFiles} from './utils/index';
//import {buildService} from './utils/factory';
import fs from 'fs';
import ejs from 'ejs';
import yaml from 'js-yaml';
import path from 'path';

args
    .version('0.1.0')
    .name('service_cli')
    .description('Micro-webservice CLI');

args.command('init')
    .description('initiate default configuration')
    .action(function () {
        const defaults = require('./config/Defaults').default;

        fs.writeFileSync(
            path.resolve(process.cwd(), 'defaults.yml'),
            yaml.safeDump(defaults, {
                indent: 4
            })
        );
        console.log('defaults.yml created');

    });

args.command("build")
    .description('generate docker files and docker compose')
    .action(async function () {
        console.log('building...');
        let configs = getConfigs();

        generateFiles(configs);
        await composeUp();
        console.log('build done');
    });

args.command('run <configFile>')
    .description('run the service with configuration')
    .action(function (configFile) {
        if (typeof configFile === 'undefined') configFile = './run.config.json';
        if (!configFile.endsWith('.json')) throw new Error('Invalid configuration file');
        if (configFile === './') configFile = './run.config.json';

        if (fs.existsSync(configFile)) {
            try {
                const cf = JSON.parse(fs.readFileSync(configFile).toString());
                cf.root = './build/';
                build(cf).then(() => {
                    const service = buildService(cf);
                    if (service !== null)
                        service.start();
                });

            } catch (err) {
                console.error(err);
            }
        }
        else {
            console.log('Configuration file not exists');
        }
    });

args.command('stop')
    .description('stop all docker services')
    .action(function () {
        composeStop().then(() => console.log('all stopped'));
    });

args.command('start')
    .description('start all docker services')
    .action(function () {
        composeStart().then(() => console.log('all started'));
    });

args.command('clone db media')
    .description('clone db with media')
    .action(function (db, media) {
        cloneDB(db, media);
    });

args.command('create <serviceName> [startDir]')
    .description('create a service folder. must be run from parent project root')
    .action(function (serviceName, startDir) {
        startDir = startDir || path.resolve(process.cwd(), 'services/');

        if(!fs.existsSync(startDir))
            fs.mkdirSync(startDir);

        if (fs.existsSync(path.resolve(startDir, serviceName))) {
            console.log('service already exists');
        }
        else {
            const servicePath = path.resolve(startDir, serviceName);
            const kind = serviceName === 'proxy' ? 'proxy' : 'service';
            let config ={
                kind,
                name: serviceName,
                src: ['./app/src/*.js'],
                npm:[]
            };

            fs.mkdirSync(`${servicePath}`);
            fs.mkdirSync(`${servicePath}/app/`);
            fs.mkdirSync(`${servicePath}/app/src`);

            let pkg = ejs.render(fs.readFileSync(__dirname + '/templates/_package.json.ejs').toString(), config);
            let cfg = ejs.render(fs.readFileSync(__dirname + '/templates/_app.config.ejs').toString(), config);
            fs.writeFileSync(`${servicePath}/package.json`, pkg);
            fs.writeFileSync(`${servicePath}/app.config.js`, cfg);
            fs.writeFileSync(`${servicePath}/app.js`, fs.readFileSync(__dirname + '/templates/app.js.ejs').toString());
            fs.writeFileSync(`${servicePath}/app/src/handler.js`, fs.readFileSync(__dirname + '/templates/_handler.ejs').toString());
            fs.writeFileSync(`${servicePath}/.babelrc`, fs.readFileSync(__dirname + '/templates/babelrc.ejs').toString());

            fs.writeFileSync(`${servicePath}/service.config.yml`,
                yaml.safeDump(config, {indent: 4})
            );

            console.log('You can use git submodule to init git for ' + serviceName + '/');
        }

    });

args.parse(process.argv);

