const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { discordToSlack } = require('../utils/format');
const { v4: uuidv4 } = require('uuid');

let slackService = null;

// create discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// set slack service reference (to avoid circular dependency)
function setSlackService(service) {
  slackService = service;
}

// initialize discord bot
async function init() {
  return new Promise((resolve, reject) => {
    client.once('ready', () => {
      console.log(`discord bot logged in as ${client.user.tag}`);
      resolve();
    });

    client.on('error', (error) => {
      console.error('discord client error:', error);
    });

    client.login(process.env.DISCORD_TOKEN).catch(reject);
  });
}

// handle incoming discord messages
client.on('messageCreate', async (message) => {
  try {
    // ignore bot messages
    if (message.author.bot) return;

    // ignore non-text channels
    if (message.channel.type !== ChannelType.GuildText) return;

    // check if this message was already processed (relayed from slack)
    const processed = db.processedMessages.getByTarget(message.id);
    if (processed) return;

    // find mappings for this channel
    const mappings = db.channelMappings.getByDiscordChannel(message.channel.id);
    if (!mappings || mappings.length === 0) return;

    // build user map for formatting
    const discordUsers = {};
    message.mentions.users.forEach((user) => {
      discordUsers[user.id] = user.username;
    });

    // convert message content
    const content = discordToSlack(message.content, discordUsers);

    // get author info
    const author = message.member?.displayName || message.author.username;
    const avatarUrl = message.author.displayAvatarURL({ format: 'png', size: 64 });

    // relay to each mapped slack channel
    for (const mapping of mappings) {
      const workspace = db.slackWorkspaces.get(mapping.slack_workspace_id);
      if (!workspace) continue;

      try {
        // build slack message
        const slackMessage = {
          channel: mapping.slack_channel_id,
          username: `${author} (discord)`,
          icon_url: avatarUrl,
          text: content || ' ',
          unfurl_links: true,
          unfurl_media: true,
        };

        // handle attachments
        const attachments = [];
        for (const attachment of message.attachments.values()) {
          attachments.push({
            title: attachment.name,
            title_link: attachment.url,
            image_url: attachment.contentType?.startsWith('image/') ? attachment.url : undefined,
            text: attachment.contentType?.startsWith('image/') ? undefined : attachment.url,
          });
        }

        if (attachments.length > 0) {
          slackMessage.attachments = attachments;
        }

        // handle embeds (links, etc)
        for (const embed of message.embeds) {
          if (embed.url) {
            attachments.push({
              title: embed.title || embed.url,
              title_link: embed.url,
              text: embed.description,
              image_url: embed.image?.url || embed.thumbnail?.url,
            });
          }
        }

        // send to slack
        if (slackService) {
          const result = await slackService.sendMessage(workspace.access_token, slackMessage);

          // record processed message
          if (result && result.ts) {
            db.processedMessages.create(
              uuidv4(),
              'discord',
              message.id,
              result.ts,
              mapping.id
            );
          }
        }
      } catch (err) {
        console.error(`error relaying discord message to slack:`, err);
      }
    }
  } catch (err) {
    console.error('error handling discord message:', err);
  }
});

// send message to discord channel
async function sendMessage(channelId, options) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error('invalid channel');
    }

    const message = await channel.send(options);
    return message;
  } catch (err) {
    console.error('error sending discord message:', err);
    throw err;
  }
}

// get guild info
async function getGuild(guildId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    return {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
    };
  } catch (err) {
    return null;
  }
}

// get text channels for a guild
async function getTextChannels(guildId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();

    return channels
      .filter((channel) => channel.type === ChannelType.GuildText)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('error fetching discord channels:', err);
    return [];
  }
}

// check if bot is in guild
async function isInGuild(guildId) {
  try {
    await client.guilds.fetch(guildId);
    return true;
  } catch (err) {
    return false;
  }
}

// get bot invite url
function getBotInviteUrl() {
  const permissions = '68608'; // read messages, send messages, embed links, attach files
  return `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${permissions}&scope=bot`;
}

// get oauth url for adding bot to server
function getOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: `${process.env.BASE_URL}/auth/discord/callback`,
    response_type: 'code',
    scope: 'bot guilds',
    permissions: '68608',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

module.exports = {
  client,
  init,
  setSlackService,
  sendMessage,
  getGuild,
  getTextChannels,
  isInGuild,
  getBotInviteUrl,
  getOAuthUrl,
};
