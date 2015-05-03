# mssql-session-store

Implementation of an express-session store using SQL Server.  Uses [mssql](https://github.com/patriksimek/node-mssql) to connect to the database.

## Installation

```
$ npm install mssql-session-store
```

## Important:
The store is expecting this table to exist in your database.
```
create table Session
(
  sessionId nvarchar(450) not null primary key,
  sessionData nvarchar(max) null,
  lastTouchedUtc datetime not null  
)
```

## Example
```
var session = require('express-session')
var MssqlStore = require('mssql-session-store')(session);

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  store: new MssqlStore(options) // see options below
}));
```

## Options
```
var options = {
	connection: existingConnection,
	ttl: 3600,
	reapInterval: 3600,
	reapCallback: function() { console.log('expired sessions were removed); }
};
```
### connection
Default value: `undefined`

Optional instance of a Connection from [mssql](https://github.com/patriksimek/node-mssql).  If undefined then the global connection will be used.

### ttl
Default value: `3600`

Optional time to live in seconds.  Sessions that have not been "touched" in this amount of time will be destroyed.  If reapInterval is set to -1 then this setting has no effect.

### reapInterval
Default value: `3600`

Optional interval to destroy expired sessions in seconds or -1 to never remove expired sessions.  Fires once on construction of the `MssqlStore` object (unless reapInterval is set to -1).

### reapCallback
Default value: `undefined`

Optional callback that is fired after each reaping.

## License
[http://jwathen.mit-license.org](http://jwathen.mit-license.org/)
