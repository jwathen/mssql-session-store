var _ = require('underscore');
var assert = require('assert');
var async = require('async');
var fs = require('fs');
var session = require('express-session');
var sql = require('mssql');
var superagent = require('superagent');

var MssqlStore = require('../lib/')(session);

describe('MssqlStore', function() {
  var connection = null;

  before(function(done) {
    var mssqlConfig = JSON.parse(fs.readFileSync('test/mssqlConfig.json'));
    connection = new sql.Connection(mssqlConfig, function(err) {
      assert.ifError(err);
      done();
    });
  });

  afterEach(function(done) {
    var request = new sql.Request(connection);
    request.query('delete [Session]', function(err) {
      assert.ifError(err);
      done();
    });
  });

  function options(additionalOptions) {
    return _.defaults({ connection: connection }, additionalOptions);
  };
  
  describe('constructor', function() {
    it('validates connection option is an mssql.Connection', function() {
      var options = { connection: 'invalid connection' };
      assert.throws(function() { new MssqlStore(options); }, Error, 'If defined, options.connection must be instance of mssql.Connection.');
    });

    it('validates ttl option is a number', function() {
      var options = { ttl: 'invalid ttl' };
      assert.throws(function() { new MssqlStore(options); }, Error, 'If defined, options.ttl must be an instance of Number.');
    });

    it('validates ttl option is positive', function() {
      var options = { ttl: 0 };
      assert.throws(function() { new MssqlStore(options); }, Error, 'If defined, options.ttl must be > 0.');
    });

    it('validates reapInterval option is a number', function() {
      var options = { reapInterval: 'invalid ttl' };
      assert.throws(function() { new MssqlStore(options); }, Error, 'If defined, options.reapInterval must be an instance of Number.');
    });

    it('validates reapInterval option is positive or -1', function() {
      var options = { reapInterval: 0 };
      assert.throws(function() { new MssqlStore(options); }, Error, 'If defined, options.reapInterval must a positive number or -1 to indicate no reaping.');

      options = { reapInterval: -2 };
      assert.throws(function() { new MssqlStore(options); }, Error, 'If defined, options.reapInterval must a positive number or -1 to indicate no reaping.');
    });

    it('validates reapCallback option is a function', function() {
      var options = { reapCallback: 'not a function' };
      assert.throws(function() { new MssqlStore(options); }, Error, 'If defined, options.reapCallback must be a function.');
    });

    it('schedules the reap interval', function(done) {
      var didReap = false;
      var store = new MssqlStore(options({
        reapInterval: 1,
        reapCallback: function(err) {
          didReap = !err;
        }
      }));
      setTimeout(function() {
        assert.ok(didReap, 'Reap function was not called.');
        done();
      }, 1500);
    });

    it('does not schedule the reap interval if options.reapInterval is -1', function(done) {
      var didReap = false;
      var store = new MssqlStore(options({
        reapInterval: -1,
        reapCallback: function(err) {
          didReap = !err;
        }
      }));
      setTimeout(function() {
        assert.ok(didReap === false, 'Reap function was not called.');
        done();
      }, 1500);
    });
  });

  describe('express-session methods', function() {
    it('returns undefined given unitialized session', function(done) {
      var store = new MssqlStore(options());
      store.get('does not exist', function(err, session) {
        assert.ifError(err);
        assert.ok(_.isUndefined(session));
        done();
      });
    });

    it('sets and gets session data', function(done) {
      var store = new MssqlStore(options());
      var tasks = [];
      tasks.push(function(callback) { store.set('sid', { name: 'John' }, callback); });
      tasks.push(function(callback) { store.get('sid', callback); });
      async.series(tasks, function(err, results) {
        assert.ifError(err);
        var session = results[1];
        assert.equal(session.name, 'John');
        done();
      });
    });

    it('destroys a session', function(done) {
      var store = new MssqlStore(options());
      var tasks = [];
      tasks.push(function(callback) { store.set('sid', { name: 'John' }, callback); });
      tasks.push(function(callback) { store.destroy('sid', callback); });
      tasks.push(function(callback) { store.get('sid', callback); });
      async.series(tasks, function(err, results) {
        var session = results[2];
        assert.ifError(err);
        assert.ok(_.isUndefined(session));
        done();
      });
    });

    it('updates last touched date for session', function(done) {
      var getLastTouchedUtc = function(sessionId, callback) {
        var request = new sql.Request(connection);
        request.input('sessionId', sessionId);
        request.query('select lastTouchedUtc from [Session] where sessionId = @sessionId', function(err, recordset) {
            assert.ifError(err);
            callback(null, recordset[0]['lastTouchedUtc']);
        });
      };

      var store = new MssqlStore(options());
      var tasks = [];
      tasks.push(function(callback) { store.set('sid', { name: 'John' }, callback); });
      tasks.push(function(callback) { getLastTouchedUtc('sid', callback); });
      tasks.push(function(callback) { setTimeout(callback, 250); });
      tasks.push(function(callback) { store.touch('sid', session, callback); });
      tasks.push(function(callback) { getLastTouchedUtc('sid', callback); });
      async.series(tasks, function(err, results) {
        var lastTouchedBefore = results[1];
        var lastTouchedAfter = results[4];
        assert.ok(lastTouchedAfter > lastTouchedBefore);
        done();
      });
    });

  it('gets the number of sessions', function(done) {
      var store = new MssqlStore(options());
      var tasks = [];
      tasks.push(function(callback) { store.set('session1', {}, callback); });
      tasks.push(function(callback) { store.set('session2', {}, callback); });
      tasks.push(store.length.bind(store));
      async.series(tasks, function(err, results) {
        assert.ifError(err);
        var length = results[2];
        assert.equal(length, 2);
        done();
      });
    });

  it('clears all sessions', function(done) {
      var store = new MssqlStore(options());
      var tasks = [];
      tasks.push(function(callback) { store.set('session1', {}, callback); });
      tasks.push(function(callback) { store.set('session2', {}, callback); });
      tasks.push(store.clear.bind(store));
      tasks.push(store.length.bind(store));
      async.series(tasks, function(err, results) {
        assert.ifError(err);
        var length = results[3];
        assert.strictEqual(length, 0);
        done();
      });
    });
  });

  describe('example site', function() {
    it('increments the visit count', function(done) {      
      var example = require('../example/');
      example.start(function(err) {
        assert.ifError(err);
        var agent = superagent.agent();
        var visitHomePage = function(expectedCount, callback) {
          agent
            .get('http://localhost:3000/')
            .end(function(err, res) {
              if (err) return callback(err);
              assert.equal(res.text, 'You have visited ' + expectedCount + ' times.');
              callback();
          });
        }

        async.eachSeries([1, 2, 3, 4, 5], visitHomePage, function(err) {
          assert.ifError(err);
          done();
        });
      });
    });
  });
});