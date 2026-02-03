const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');
const db = require('../db');
const { slackToDiscord } = require('../utils/format');
const { v4: uuidv4 } = require('uuid');

let discordService = null;

const clientCache = new Map();

function setDiscordService(service) {
  discordService = service;
}

function getClient(token) {
  if (!clientCache.has(token)) {
    clientCache.set(token, new WebClient(token));
  }
  return clientCache.get(token);
}

function verifySignature(signature, timestamp, body) {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

function getOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    redirect_uri: `${process.env.BASE_URL}/auth/slack/callback`,
    scope: 'channels:history,channels:read,chat:write,chat:write.customize,files:read,files:write,users:read,groups:history,groups:read',
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

async function exchangeCode(code) {
  const client = new WebClient();
  const result = await client.oauth.v2.access({
    client_id: process.env.SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: `${process.env.BASE_URL}/auth/slack/callback`,
  });
  return result;
}

async function sendMessage(token, options) {
  const client = getClient(token);
  const result = await client.chat.postMessage(options);
  return result;
}

async function getChannels(token) {
  const client = getClient(token);
  const result = await client.conversations.list({
    types: 'public_channel,private_channel',
    exclude_archived: true,
    limit: 1000,
  });

  return (result.channels || [])
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      is_private: channel.is_private,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getUser(token, userId) {
  const client = getClient(token);
  try {
    const result = await client.users.info({ user: userId });
    return result.user;
  } catch (err) {
    return null;
  }
}

async function getPublicFileUrl(token, fileId) {
  const client = getClient(token);
  try {
    const result = await client.files.sharedPublicURL({ file: fileId });
    if (result.file && result.file.permalink_public) {
      const match = result.file.permalink_public.match(/pub_secret=([^&]+)/);
      if (match && result.file.url_private) {
        return `${result.file.url_private}?pub_secret=${match[1]}`;
      }
      return result.file.permalink_public;
    }
    return null;
  } catch (err) {
    if (err.data?.error === 'already_public') {
      const fileInfo = await client.files.info({ file: fileId });
      if (fileInfo.file?.permalink_public) {
        const match = fileInfo.file.permalink_public.match(/pub_secret=([^&]+)/);
        if (match && fileInfo.file.url_private) {
          return `${fileInfo.file.url_private}?pub_secret=${match[1]}`;
        }
        return fileInfo.file.permalink_public;
      }
    }
    console.error('error making file public:', err);
    return null;
  }
}

async function handleEvent(event, teamId) {
  try {
    if (event.type !== 'message') return;

    if (event.subtype && event.subtype !== 'file_share') return;
    if (event.bot_id) return;

    const workspace = db.slackWorkspaces.getByTeam(teamId);
    if (!workspace) return;

    if (event.user === workspace.bot_user_id) return;

    const processed = db.processedMessages.getByTarget(event.ts);
    if (processed) return;

    const mappings = db.channelMappings.getBySlackChannel(event.channel);
    if (!mappings || mappings.length === 0) return;

    const user = await getUser(workspace.access_token, event.user);
    const username = user?.real_name || user?.name || 'unknown';
    const avatarUrl = user?.profile?.image_72;

    const slackUsers = {};
    const mentionMatches = event.text?.match(/<@([A-Z0-9]+)>/g) || [];
    for (const match of mentionMatches) {
      const userId = match.slice(2, -1);
      const mentionedUser = await getUser(workspace.access_token, userId);
      if (mentionedUser) {
        slackUsers[userId] = mentionedUser.real_name || mentionedUser.name;
      }
    }

    const content = slackToDiscord(event.text, slackUsers);

    for (const mapping of mappings) {
      try {
        const discordMessage = {
          content: content || undefined,
          embeds: [],
        };

        if (event.files && event.files.length > 0) {
          const fileUrls = [];
          for (const file of event.files) {
            let url = await getPublicFileUrl(workspace.access_token, file.id);
            if (!url) {
              url = file.url_private;
            }

            if (file.mimetype?.startsWith('image/')) {
              discordMessage.embeds.push({
                title: file.name,
                url: url,
                image: { url },
              });
            } else {
              fileUrls.push(`[${file.name}](${url})`);
            }
          }
          if (fileUrls.length > 0) {
            discordMessage.content = (discordMessage.content || '') + '\n' + fileUrls.join('\n');
          }
        }

        const formattedContent = `**${username}** (slack):\n${discordMessage.content || ''}`;
        discordMessage.content = formattedContent.trim() || ' ';

        if (discordService) {
          const result = await discordService.sendMessage(mapping.discord_channel_id, discordMessage);

          if (result) {
            db.processedMessages.create(
              uuidv4(),
              'slack',
              event.ts,
              result.id,
              mapping.id
            );
          }
        }
      } catch (err) {
        console.error('error relaying slack message to discord:', err);
      }
    }
  } catch (err) {
    console.error('error handling slack event:', err);
  }
}

module.exports = {
  setDiscordService,
  verifySignature,
  getOAuthUrl,
  exchangeCode,
  sendMessage,
  getChannels,
  getUser,
  getPublicFileUrl,
  handleEvent,
};
