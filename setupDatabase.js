const db = require('./database')

db.serialize(function() {
  db.run("CREATE TABLE IF NOT EXISTS file_shas (name text NOT NULL UNIQUE, sha text NOT NULL UNIQUE, type text NOT NULL)");
});

db.close();
