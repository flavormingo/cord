const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const slackService = require('../services/slack');
const discordService = require('../services/discord');

const router = express.Router();

router.get('/slack', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const state = `${req.session.userId}:${uuidv4()}`;
  req.session.slackOAuthState = state;
  res.redirect(slackService.getOAuthUrl(state));
});

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

    const result = await slackService.exchangeCode(code);

    if (!result.ok) {
      console.error('slack token exchange failed:', result);
      return res.redirect('/?error=slack_token_failed');
    }

    const workspaceId = uuidv4();
    db.slackWorkspaces.create(
      workspaceId,
      userId,
      result.team.id,
      result.team.name,
      result.access_token,
      result.bot_user_id
    );

    const workspace = db.slackWorkspaces.getByTeam(result.team.id);
    if (workspace) {
      db.slackWorkspaces.updateMappingsUser(userId, workspace.id);
    }

    res.redirect('/?slack=connected');
  } catch (err) {
    console.error('slack callback error:', err);
    res.redirect('/?error=slack_callback_failed');
  }
});

router.get('/discord', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const state = `${req.session.userId}:${uuidv4()}`;
  req.session.discordOAuthState = state;
  res.redirect(discordService.getOAuthUrl(state));
});

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

    const guild = await discordService.getGuild(guild_id);
    if (!guild) {
      return res.redirect('/?error=guild_not_found');
    }

    const guildDbId = uuidv4();
    db.discordGuilds.create(
      guildDbId,
      userId,
      guild.id,
      guild.name
    );

    const savedGuild = db.discordGuilds.getByGuildId(guild.id);
    if (savedGuild) {
      db.discordGuilds.updateMappingsUser(userId, savedGuild.id);
    }

    res.redirect('/?discord=connected');
  } catch (err) {
    console.error('discord callback error:', err);
    res.redirect('/?error=discord_callback_failed');
  }
});

module.exports = router;
