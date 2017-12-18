import glob from 'glob';
import path from 'path';
import yml from 'js-yaml';
import fs from 'fs';


export default (() => {
    let defFiles = glob.sync(
        '**/+(config|defaults|default).+(js|json|yml)',
        {
            realpath: true
        }
    );
    let defFile = defFiles[0];
    let defaults = {};
    if (path.extname(defFile) === '.yml') {
        try {
            defaults = yml.safeLoad(fs.readFileSync(defFile, 'utf-8'));
        }
        catch (err) {
            console.error(err);
        }
    }
    else if (path.extname(defFile) === '.json') {
        try {
            defaults = JSON.parse(fs.readFileSync(defFile, 'utf-8'));
        }
        catch (err) {
            console.error(err);
        }
    }
    else if (path.extname(defFile) === '.js') {
        defaults = require(defFile);
    }


    if (defaults) {
        defaults = Object.assign({}, defaults);
        let proxy = (require('./proxy.json')),
            docker = (require('./docker.json')),
            messageBus = (require('./messageBus.json')),
            session = (require('./session.json')),
            service = (require('./service.json')),
            db = (require('./db.json')),
            logging = (require('./logging.json'))
        ;


        db = Object.assign({}, db, logging);
        messageBus = Object.assign({}, messageBus);

        session = Object.assign({}, session);

        proxy = Object.assign({}, proxy);

        service = Object.assign({}, service);

        defaults = Object.assign({}, docker, db, session, messageBus, proxy, service, defaults);

    }

    return defaults;
})();