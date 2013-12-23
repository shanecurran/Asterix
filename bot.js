/**
 * Asterix Barebones IRC Bot
 * @author  Shane Curran
 */

// Include plugins and modules
var irc        = require("irc"),
    mysql      = require("mysql"),
    colors     = require("colors"),
    f          = require("./inc/functions.js"),
    express    = require("express"),
    app        = express();

// Create the MySQL connection
var connection = mysql.createConnection({
      host     : "localhost",
      user     : "root",
      password : "", // Make sure you always set a password, kids ;)
      database : "irc" // Database scheme is included in 'db.sql'
});

// IRC server configuration
var server        = "irc.freenode.net",
    port          = 6667,
    webapp        = 1,
    webapp_port   = 80,
    nick          = "Asterix" + Math.floor((Math.random() * 1000) + 1), // Random nickname so there aren't any nick conflicts
    userName      = "asterix",
    realName      = "Asterix IRC Bot - Find me on GitHub"
    authed_admins = [],
    logging       = 1; // Change this to 0 to stop logging all messages to the MySQL database

/**
 * IRC Logs Web Service
 */
if (webapp == 1) {
  app.set("views", __dirname + "/web");
  app.engine("html", require("ejs").renderFile);
  app.use("/css", express.static(__dirname + "/web/css"));
  app.use("/js", express.static(__dirname + "/web/js"));

  app.get("/", function (req, res) {
    res.render("logs.html");
  });

  app.get("/logs/:channel", function (req, res) {
    connection.query("SELECT * FROM `logs` WHERE `channel` = " + connection.escape("#" + req.params.channel), function (err, rows, fields) {
      res.send(JSON.stringify(rows));
    });
  });

  app.get("/channels", function (req, res) {
    connection.query("SELECT DISTINCT `channel` FROM `logs` WHERE LEFT(channel, 1) = '#'", function (err, rows, fields) {
      var results = [];

      for (var i = 0; i < rows.length; i++) {
          results.push(rows[i].channel);
      }

      res.send(JSON.stringify(results));
    });
  });

  app.listen(webapp_port);
  console.log("[Notification] ".green + " Web server started on port " + String(webapp_port).bold);
}

// Fetch all the channels to join
connection.query("SELECT * FROM `channels` WHERE `active` = 1", function (err, rows, fields) {
  if (err) throw err;

  var channels = [];

  for (var i = 0; i < rows.length; i++) {
      channels[i] = rows[i].channel;
  }

  // Start the IRC connection
  client = new irc.Client(server, nick, {
      channels: channels,
      userName: userName,
      realName: realName,
      port    : port
  });

  console.log("[Connected]".green + " IRC Bot Running");

    /**
     * Listener for all public messages
     */
    client.addListener("message", function (from, to, message) {
        console.log(from + " => " + to + ": " + message); // Log all messages to the console. If you don't want this, just comment out this line

        // If logging is enabled, log all messages to the database
        if (logging == 1) {
          connection.query("INSERT INTO `logs` SET ?", {
            network: server,
            channel: to,
            user: from,
            data: message,
            time: Math.round(+new Date() / 1000)
          }, function(err, result) {});
        }
    });

  /**
   * Admin Only Functions
   */
  client.addListener("pm", function (from, message) {
    if (message.substring(0, 5) == "auth ") {
        console.log("Authenticating " + from);
        var password = message.split(" ")[1];

        // Check if this admin is in the database
        connection.query("SELECT * FROM `admins` WHERE `nick` = " + connection.escape(from) + " AND `password` = " + connection.escape(f.sha1(password)), function (err, rows, fields) {
          if (rows.length > 0) {
            // The admin is authenticated
            authed_admins.push(from);
            client.say(from, "Welcome back, " + from + ". Thanks for authenticating");
          } else {
            // There was an error authenticating
            client.say(from, "There was an error authenticating you, please try again.");
          }
        });
    }

    /**
     * Join a channel
     */
    if (f.inArray(from, authed_admins)) {
      if (message.substring(0, 5) == "join ") {
        var channel = message.split(" ")[1];

        client.join(channel);

        connection.query("INSERT INTO `channels` SET `server` = " + connection.escape(server) + ", `channel` = " + connection.escape(channel) + ", `active` = 1", function (err, fields, rows) {
          if (err) throw err;

          client.say(from, "Joining " + channel);
        });
      }

      /**
       * Leave a channel
       */
      if (message.substring(0, 6) == "leave ") {
        var channel = message.split(" ")[1];

        client.part(channel);

        connection.query("UPDATE `channels` SET `active` = 0 WHERE `channel` = " + connection.escape(channel), function (err, fields, rows) {
          if (err) throw err;

          client.say(from, "Leaving " + channel);
        });
      }

      /**
       * Add another admin
       */
      if (message.substring(0, 10) == "admin add ") {
        if (message.length > 12) {
          var nick = message.split(" ")[2];
          var password = f.sha1(message.split(" ")[3]);

          connection.query("INSERT INTO `admins` SET `nick` = " + connection.escape(nick) + ", `password` = " + connection.escape(password),
          function(err, result) {
            if (err) throw err;

            client.say(from, nick + " was successfully added as an admin");
          });
        }
      }

      /**
       * Disconnect from the server and kill the script
       */
      if (message.substring(0, 4) == "stop") {
          client.disconnect();
      }

      /**
       * Say a message via the bot in a certain channel
       */
      if (message.substring(0, 4) == "say ") {
        if (message.length > 6) {
          var text = message.split(" ");
          var channel = text[1];

          delete text[0];
          delete text[1];

          var text = text.join(" ").substr(2);

          client.say(channel, text);
        }
      }
    }
  });
});