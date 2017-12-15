'use strict';

module.exports = function (req, res, next) {
    var app = this.app;
    var db = app.getDb();
    var session = app.session();
    var domain = req.hostname.split('.').length > 1 ? req.hostname.split('.')[0] : '';

    //TODO: handler logic here
    //OR
    //next();
};

module.exports.attributes = {
    nowrap: true,
    uri: "action/:param1/:param2",
    method: "POST"
};