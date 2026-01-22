const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const slackService = require('../services/slack');
const discordService = require('../services/discord');

const router = express.Router();

// slack oauth start
router.get('/slack', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const state = `${req.session.userId}:${uuidv4()}`;
  req.session.slackOAuthState = state;
  res.redirect(slackService.getOAuthUrl(state));
});

// slack oauth callback
router.get('/slack/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('slack oauth error:', error);
      return res.redirect('/?error=slack_oauth_denied');
    }

    if (!state || !req.session.slackOAuthState || state !== req.session.slackOAuthState) {
      return res.redirect('/?error=invalid_state');
    }

    delete req.session.slackOAuthState;

    const userId = state.split(':')[0];
    if (userId !== req.session.userId) {
      return res.redirect('/?error=invalid_user');
    }

    // exchange code for token
    const result = await slackService.exchangeCode(code);

    if (!result.ok) {
      console.error('slack token exchange failed:', result);
      return res.redirect('/?error=slack_token_failed');
    }

    // save workspace
    const workspaceId = uuidv4();
    db.slackWorkspaces.create(
      workspaceId,
      userId,
      result.team.id,
      result.team.name,
      result.access_token,
      result.bot_user_id
    );

    res.redirect('/?slack=connected');
  } catch (err) {
    console.error('slack callback error:', err);
    res.redirect('/?error=slack_callback_failed');
  }
});

// discord oauth start
router.get('/discord', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const state = `${req.session.userId}:${uuidv4()}`;
  req.session.discordOAuthState = state;
  res.redirect(discordService.getOAuthUrl(state));
});

// discord oauth callback
router.get('/discord/callback', async (req, res) => {
  try {
    const { guild_id, state, error } = req.query;

    if (error) {
      console.error('discord oauth error:', error);
      return res.redirect('/?error=discord_oauth_denied');
    }

    if (!state || !req.session.discordOAuthState || state !== req.session.discordOAuthState) {
      return res.redirect('/?error=invalid_state');
    }

    delete req.session.discordOAuthState;

    const userId = state.split(':')[0];
    if (userId !== req.session.userId) {
      return res.redirect('/?error=invalid_user');
    }

    if (!guild_id) {
      return res.redirect('/?error=no_guild');
    }

    // get guild info from bot
    const guild = await discordService.getGuild(guild_id);
    if (!guild) {
      return res.redirect('/?error=guild_not_found');
    }

    // save guild
    const guildDbId = uuidv4();
    db.discordGuilds.create(
      guildDbId,
      userId,
      guild.id,
      guild.name
    );

    res.redirect('/?discord=connected');
  } catch (err) {
    console.error('discord callback error:', err);
    res.redirect('/?error=discord_callback_failed');
  }
});

module.exports = router;
