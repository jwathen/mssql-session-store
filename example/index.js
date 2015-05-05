var express = require('express');
var session = require('express-session');
var sql = require('mssql');
var MssqlStore = require('../lib')(session);

var dbConfig = {
  server: "localhost\\sqlexpress",
  database: "sessiontest",
  user: "sa",
  password: "atonan"
};

var start = function(callback) {
  callback = callback || function() {};

  sql.connect(dbConfig, function(err) {
    if (err) return callback(err);
    var app = express();
    app.use(session({
      secret: '991E6B44882C4593A46C0DDFCA23E06A',
      resave: false,
      saveUninitialized: false,
      store: new MssqlStore({ reapInterval: 10, ttl: 10 })
    }));

    app.get('/', function (req, res) {
      req.session.visits = (req.session.visits || 0) + 1;
      res.send('You have visited ' + req.session.visits + ' times.');
    });

    var server = app.listen(3000, function (err) {
      if (err) return callback(err);
      callback();
    });
  });
};

if (require.main === module) {
  start();
}
else {
  module.exports = { start: start };
}