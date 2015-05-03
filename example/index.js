var express = require('express');
var session = require('express-session');
var sql = require('mssql');
var MssqlStore = require('./lib')(session);

var dbConfig = {
  server: "localhost\\sqlexpress",
  database: "sessiontest",
  user: "sa",
  password: "*****"
};

sql.connect(dbConfig, function(err) {
  if (err) return console.log(err);
  process.exit(-1);
  return;

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

  var server = app.listen(3000, function () {
    console.log('server is listening on port 3000');
  });
});