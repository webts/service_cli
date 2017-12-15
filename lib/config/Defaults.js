import glob from 'glob';
import path from 'path';
import yml from 'js-yaml';
import fs from 'fs';
import {Map, fromJS} from 'immutable';


export default (() => {
    let defFiles = glob.sync(
        '**/+(config|defaults|default).+(js|json|yml)',
        {
            realpath: true
        }
    );
    let defFile = defFiles[0];
    let defaults = {};
    if(path.extname(defFile) === 'yml'){
        try {
            defaults = yml.safeLoad(fs.readFileSync(defFile, 'utf-8'));
        }
        catch(err){
            console.error(err);
        }
    }
    else if(path.extname(defFile) === 'json'){
        try{
            defaults = JSON.parse(fs.readFileSync(defFile, 'utf-8'));
        }
        catch(err){
            console.error(err);
        }
    }
    else if(path.extname(defFile) === 'js'){
        defaults = require(defFile);
    }

    if(defaults){
        defaults = fromJS(defaults);
        let  proxy = fromJS(require('./proxy.json')),
            docker = fromJS(require('./docker.json')),
            messageBus = fromJS(require('./messageBus.json')),
            session = fromJS(require('./session.json')),
            service = fromJS(require('./service.json')),
            db = fromJS(require('./db.json')),
            logging = fromJS(require('./logging.json'))
        ;

        proxy = Object.assign(proxy, logging);
        messageBus = Object.assign(messageBus, logging);
        session = Object.assign(session, logging);
        service = Object.assign(service, logging);
        db = Object.assign(db, logging);

        defaults = Object.assign({},proxy, db, session, messageBus, docker, service, defaults);
    }

    return defaults;
})();