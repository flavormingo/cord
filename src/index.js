require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const discordService = require('./services/discord');
const slackService = require('./services/slack');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const slackEventsRoutes = require('./routes/slack-events');

// set service references to avoid circular dependency
discordService.setSlackService(slackService);
slackService.setDiscordService(discordService);

const app = express();

// trust proxy for https behind reverse proxy
app.set('trust proxy', 1);

// session middleware
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// create user session if not exists
app.use((req, res, next) => {
  if (!req.session.userId) {
    const userId = uuidv4();
    req.session.userId = userId;
    db.users.create(userId);
  }
  next();
});

// slack events needs raw body, mount before json middleware
app.use('/slack/events', slackEventsRoutes);

// json body parser for other routes
app.use(express.json());

// static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// serve index for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// cleanup old processed messages every hour
setInterval(() => {
  try {
    db.processedMessages.cleanup();
  } catch (err) {
    console.error('cleanup error:', err);
  }
}, 60 * 60 * 1000);

// start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // initialize discord bot
    await discordService.init();
    console.log('discord bot initialized');

    // start express server
    app.listen(PORT, () => {
      console.log(`cord running on port ${PORT}`);
    });
  } catch (err) {
    console.error('failed to start:', err);
    process.exit(1);
  }
}

start();
