Asterix
=======

A barebones Node.js-based IRC bot built on [Martyn Smith's node-irc framework](https://github.com/martynsmith/node-irc)

The bot also stores logs, channels and admin data in an SQL data. The SQL dump can be found in ```db.sql```.

Logging can be enabled and disabled by changing the 'login' variable between 1 and 0.

The bot also includes an admin system operated via PM allowing the bot to be controlled remotely.

Remember to do
```npm install```
after downloading