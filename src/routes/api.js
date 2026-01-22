const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const slackService = require('../services/slack');
const discordService = require('../services/discord');

const router = express.Router();

// middleware to require auth
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// get connected workspaces
router.get('/workspaces', requireAuth, (req, res) => {
  const slackWorkspaces = db.slackWorkspaces.getByUser(req.session.userId);
  const discordGuilds = db.discordGuilds.getByUser(req.session.userId);

  res.json({
    slack: slackWorkspaces.map((w) => ({
      id: w.id,
      team_id: w.team_id,
      name: w.team_name,
    })),
    discord: discordGuilds.map((g) => ({
      id: g.id,
      guild_id: g.guild_id,
      name: g.guild_name,
    })),
  });
});

// get slack channels
router.get('/slack/:workspaceId/channels', requireAuth, async (req, res) => {
  try {
    const workspace = db.slackWorkspaces.get(req.params.workspaceId);
    if (!workspace || workspace.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'workspace not found' });
    }

    const channels = await slackService.getChannels(workspace.access_token);
    res.json(channels);
  } catch (err) {
    console.error('error fetching slack channels:', err);
    res.status(500).json({ error: 'failed to fetch channels' });
  }
});

// get discord channels
router.get('/discord/:guildId/channels', requireAuth, async (req, res) => {
  try {
    const guild = db.discordGuilds.get(req.params.guildId);
    if (!guild || guild.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'guild not found' });
    }

    const channels = await discordService.getTextChannels(guild.guild_id);
    res.json(channels);
  } catch (err) {
    console.error('error fetching discord channels:', err);
    res.status(500).json({ error: 'failed to fetch channels' });
  }
});

// get channel mappings
router.get('/mappings', requireAuth, (req, res) => {
  const mappings = db.channelMappings.getByUser(req.session.userId);
  res.json(mappings);
});

// create channel mapping
router.post('/mappings', requireAuth, (req, res) => {
  try {
    const {
      slackWorkspaceId,
      slackChannelId,
      slackChannelName,
      discordGuildId,
      discordChannelId,
      discordChannelName,
    } = req.body;

    // validate workspace ownership
    const workspace = db.slackWorkspaces.get(slackWorkspaceId);
    if (!workspace || workspace.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'workspace not found' });
    }

    // validate guild ownership
    const guild = db.discordGuilds.get(discordGuildId);
    if (!guild || guild.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'guild not found' });
    }

    // create mapping
    const id = uuidv4();
    db.channelMappings.create(
      id,
      req.session.userId,
      slackWorkspaceId,
      slackChannelId,
      slackChannelName,
      discordGuildId,
      discordChannelId,
      discordChannelName
    );

    res.json({
      id,
      slack_workspace_id: slackWorkspaceId,
      slack_channel_id: slackChannelId,
      slack_channel_name: slackChannelName,
      discord_guild_id: discordGuildId,
      discord_channel_id: discordChannelId,
      discord_channel_name: discordChannelName,
      active: 1,
    });
  } catch (err) {
    console.error('error creating mapping:', err);
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'mapping already exists' });
    }
    res.status(500).json({ error: 'failed to create mapping' });
  }
});

// delete channel mapping
router.delete('/mappings/:id', requireAuth, (req, res) => {
  try {
    const mapping = db.channelMappings.get(req.params.id);
    if (!mapping || mapping.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'mapping not found' });
    }

    db.channelMappings.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('error deleting mapping:', err);
    res.status(500).json({ error: 'failed to delete mapping' });
  }
});

// toggle channel mapping
router.patch('/mappings/:id', requireAuth, (req, res) => {
  try {
    const mapping = db.channelMappings.get(req.params.id);
    if (!mapping || mapping.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'mapping not found' });
    }

    const { active } = req.body;
    db.channelMappings.toggle(req.params.id, active);
    res.json({ success: true, active });
  } catch (err) {
    console.error('error toggling mapping:', err);
    res.status(500).json({ error: 'failed to toggle mapping' });
  }
});

// disconnect slack workspace
router.delete('/slack/:workspaceId', requireAuth, (req, res) => {
  try {
    const workspace = db.slackWorkspaces.get(req.params.workspaceId);
    if (!workspace || workspace.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'workspace not found' });
    }

    db.slackWorkspaces.delete(req.params.workspaceId);
    res.json({ success: true });
  } catch (err) {
    console.error('error disconnecting workspace:', err);
    res.status(500).json({ error: 'failed to disconnect' });
  }
});

// disconnect discord guild
router.delete('/discord/:guildId', requireAuth, (req, res) => {
  try {
    const guild = db.discordGuilds.get(req.params.guildId);
    if (!guild || guild.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'guild not found' });
    }

    db.discordGuilds.delete(req.params.guildId);
    res.json({ success: true });
  } catch (err) {
    console.error('error disconnecting guild:', err);
    res.status(500).json({ error: 'failed to disconnect' });
  }
});

module.exports = router;
