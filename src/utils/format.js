function slackToDiscord(text, slackUsers = {}) {
  if (!text) return '';

  let result = text;

  result = result.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
    const user = slackUsers[userId];
    return user ? `**@${user}**` : `**@unknown**`;
  });

  result = result.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '**#$1**');

  result = result.replace(/<#([A-Z0-9]+)>/g, '**#channel**');

  result = result.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');

  result = result.replace(/<(https?:\/\/[^>]+)>/g, '$1');

  result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '**$1**');

  result = result.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '*$1*');

  result = result.replace(/(?<!~)~([^~\n]+)~(?!~)/g, '~~$1~~');

  return result;
}

function discordToSlack(text, discordUsers = {}) {
  if (!text) return '';

  let result = text;

  result = result.replace(/<@!?(\d+)>/g, (match, userId) => {
    const user = discordUsers[userId];
    return user ? `*@${user}*` : '*@unknown*';
  });

  result = result.replace(/<@&(\d+)>/g, '*@role*');

  result = result.replace(/<#(\d+)>/g, (match, channelId) => {
    return '*#channel*';
  });

  result = result.replace(/<a?:([^:]+):\d+>/g, ':$1:');

  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '_$1_');

  result = result.replace(/~~([^~]+)~~/g, '~$1~');

  result = result.replace(/__([^_]+)__/g, '_$1_');

  result = result.replace(/\|\|([^|]+)\|\|/g, '[spoiler: $1]');

  return result;
}

function escapeDiscord(text) {
  if (!text) return '';
  return text.replace(/([*_~`|\\])/g, '\\$1');
}

function escapeSlack(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  slackToDiscord,
  discordToSlack,
  escapeDiscord,
  escapeSlack,
};
