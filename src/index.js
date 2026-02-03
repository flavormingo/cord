require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const cookieParser = require('cookie-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const discordService = require('./services/discord');
const slackService = require('./services/slack');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const slackEventsRoutes = require('./routes/slack-events');

discordService.setSlackService(slackService);
slackService.setDiscordService(discordService);

const app = express();

app.set('trust proxy', 1);

app.use(cookieParser());
app.use(session({
  store: new SqliteStore({
    client: db.db,
    expired: {
      clear: true,
      intervalMs: 900000,
    },
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

app.use((req, res, next) => {
  if (!req.session.userId) {
    const userId = uuidv4();
    req.session.userId = userId;
    db.users.create(userId);
  }
  next();
});

app.use('/slack/events', slackEventsRoutes);

app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

setInterval(() => {
  try {
    db.processedMessages.cleanup();
  } catch (err) {
    console.error('cleanup error:', err);
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await discordService.init();
    console.log('discord bot initialized');

    app.listen(PORT, () => {
      console.log(`cord running on port ${PORT}`);
    });
  } catch (err) {
    console.error('failed to start:', err);
    process.exit(1);
  }
}

start();
