const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'cord.db'));

// enable foreign keys
db.pragma('foreign_keys = ON');

// create tables
db.exec(`
  -- users table for session management
  create table if not exists users (
    id text primary key,
    created_at datetime default current_timestamp
  );

  -- slack workspaces
  create table if not exists slack_workspaces (
    id text primary key,
    user_id text not null,
    team_id text not null unique,
    team_name text not null,
    access_token text not null,
    bot_user_id text not null,
    created_at datetime default current_timestamp,
    foreign key (user_id) references users(id) on delete cascade
  );

  -- discord guilds (servers)
  create table if not exists discord_guilds (
    id text primary key,
    user_id text not null,
    guild_id text not null unique,
    guild_name text not null,
    created_at datetime default current_timestamp,
    foreign key (user_id) references users(id) on delete cascade
  );

  -- channel mappings
  create table if not exists channel_mappings (
    id text primary key,
    user_id text not null,
    slack_workspace_id text not null,
    slack_channel_id text not null,
    slack_channel_name text not null,
    discord_guild_id text not null,
    discord_channel_id text not null,
    discord_channel_name text not null,
    active integer default 1,
    created_at datetime default current_timestamp,
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (slack_workspace_id) references slack_workspaces(id) on delete cascade,
    foreign key (discord_guild_id) references discord_guilds(id) on delete cascade,
    unique(slack_channel_id, discord_channel_id)
  );

  -- processed messages to prevent loops
  create table if not exists processed_messages (
    id text primary key,
    source text not null,
    source_message_id text not null,
    target_message_id text not null,
    mapping_id text not null,
    created_at datetime default current_timestamp,
    foreign key (mapping_id) references channel_mappings(id) on delete cascade
  );

  -- create indexes
  create index if not exists idx_slack_workspaces_user on slack_workspaces(user_id);
  create index if not exists idx_slack_workspaces_team on slack_workspaces(team_id);
  create index if not exists idx_discord_guilds_user on discord_guilds(user_id);
  create index if not exists idx_discord_guilds_guild on discord_guilds(guild_id);
  create index if not exists idx_channel_mappings_user on channel_mappings(user_id);
  create index if not exists idx_channel_mappings_slack on channel_mappings(slack_channel_id);
  create index if not exists idx_channel_mappings_discord on channel_mappings(discord_channel_id);
  create index if not exists idx_processed_messages_source on processed_messages(source, source_message_id);
  create index if not exists idx_processed_messages_target on processed_messages(target_message_id);
`);

// user operations
const createUser = db.prepare('insert into users (id) values (?)');
const getUser = db.prepare('select * from users where id = ?');

// slack workspace operations
const createSlackWorkspace = db.prepare(`
  insert into slack_workspaces (id, user_id, team_id, team_name, access_token, bot_user_id)
  values (?, ?, ?, ?, ?, ?)
  on conflict(team_id) do update set
    access_token = excluded.access_token,
    team_name = excluded.team_name,
    bot_user_id = excluded.bot_user_id
`);
const getSlackWorkspace = db.prepare('select * from slack_workspaces where id = ?');
const getSlackWorkspaceByTeam = db.prepare('select * from slack_workspaces where team_id = ?');
const getSlackWorkspacesByUser = db.prepare('select * from slack_workspaces where user_id = ?');
const deleteSlackWorkspace = db.prepare('delete from slack_workspaces where id = ?');

// discord guild operations
const createDiscordGuild = db.prepare(`
  insert into discord_guilds (id, user_id, guild_id, guild_name)
  values (?, ?, ?, ?)
  on conflict(guild_id) do update set
    guild_name = excluded.guild_name
`);
const getDiscordGuild = db.prepare('select * from discord_guilds where id = ?');
const getDiscordGuildByGuildId = db.prepare('select * from discord_guilds where guild_id = ?');
const getDiscordGuildsByUser = db.prepare('select * from discord_guilds where user_id = ?');
const deleteDiscordGuild = db.prepare('delete from discord_guilds where id = ?');

// channel mapping operations
const createChannelMapping = db.prepare(`
  insert into channel_mappings (id, user_id, slack_workspace_id, slack_channel_id, slack_channel_name, discord_guild_id, discord_channel_id, discord_channel_name)
  values (?, ?, ?, ?, ?, ?, ?, ?)
`);
const getChannelMapping = db.prepare('select * from channel_mappings where id = ?');
const getChannelMappingsByUser = db.prepare('select * from channel_mappings where user_id = ?');
const getChannelMappingsBySlackChannel = db.prepare('select * from channel_mappings where slack_channel_id = ? and active = 1');
const getChannelMappingsByDiscordChannel = db.prepare('select * from channel_mappings where discord_channel_id = ? and active = 1');
const getAllActiveChannelMappings = db.prepare('select * from channel_mappings where active = 1');
const deleteChannelMapping = db.prepare('delete from channel_mappings where id = ?');
const toggleChannelMapping = db.prepare('update channel_mappings set active = ? where id = ?');

// processed message operations
const createProcessedMessage = db.prepare(`
  insert into processed_messages (id, source, source_message_id, target_message_id, mapping_id)
  values (?, ?, ?, ?, ?)
`);
const getProcessedMessageBySource = db.prepare('select * from processed_messages where source = ? and source_message_id = ?');
const getProcessedMessageByTarget = db.prepare('select * from processed_messages where target_message_id = ?');

// cleanup old processed messages (keep last 24 hours)
const cleanupOldMessages = db.prepare(`
  delete from processed_messages where created_at < datetime('now', '-24 hours')
`);

module.exports = {
  db,
  users: {
    create: (id) => createUser.run(id),
    get: (id) => getUser.get(id),
  },
  slackWorkspaces: {
    create: (id, userId, teamId, teamName, accessToken, botUserId) =>
      createSlackWorkspace.run(id, userId, teamId, teamName, accessToken, botUserId),
    get: (id) => getSlackWorkspace.get(id),
    getByTeam: (teamId) => getSlackWorkspaceByTeam.get(teamId),
    getByUser: (userId) => getSlackWorkspacesByUser.all(userId),
    delete: (id) => deleteSlackWorkspace.run(id),
  },
  discordGuilds: {
    create: (id, userId, guildId, guildName) =>
      createDiscordGuild.run(id, userId, guildId, guildName),
    get: (id) => getDiscordGuild.get(id),
    getByGuildId: (guildId) => getDiscordGuildByGuildId.get(guildId),
    getByUser: (userId) => getDiscordGuildsByUser.all(userId),
    delete: (id) => deleteDiscordGuild.run(id),
  },
  channelMappings: {
    create: (id, userId, slackWorkspaceId, slackChannelId, slackChannelName, discordGuildId, discordChannelId, discordChannelName) =>
      createChannelMapping.run(id, userId, slackWorkspaceId, slackChannelId, slackChannelName, discordGuildId, discordChannelId, discordChannelName),
    get: (id) => getChannelMapping.get(id),
    getByUser: (userId) => getChannelMappingsByUser.all(userId),
    getBySlackChannel: (channelId) => getChannelMappingsBySlackChannel.all(channelId),
    getByDiscordChannel: (channelId) => getChannelMappingsByDiscordChannel.all(channelId),
    getAllActive: () => getAllActiveChannelMappings.all(),
    delete: (id) => deleteChannelMapping.run(id),
    toggle: (id, active) => toggleChannelMapping.run(active ? 1 : 0, id),
  },
  processedMessages: {
    create: (id, source, sourceMessageId, targetMessageId, mappingId) =>
      createProcessedMessage.run(id, source, sourceMessageId, targetMessageId, mappingId),
    getBySource: (source, messageId) => getProcessedMessageBySource.get(source, messageId),
    getByTarget: (messageId) => getProcessedMessageByTarget.get(messageId),
    cleanup: () => cleanupOldMessages.run(),
  },
};
