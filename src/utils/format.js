// convert slack formatting to discord formatting
function slackToDiscord(text, slackUsers = {}) {
  if (!text) return '';

  let result = text;

  // convert user mentions: <@U123456> -> @username
  result = result.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
    const user = slackUsers[userId];
    return user ? `**@${user}**` : `**@unknown**`;
  });

  // convert channel mentions: <#C123456|channel-name> -> #channel-name
  result = result.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '**#$1**');

  // convert channel mentions without name: <#C123456> -> #channel
  result = result.replace(/<#([A-Z0-9]+)>/g, '**#channel**');

  // convert links: <url|text> -> [text](url)
  result = result.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');

  // convert plain links: <url> -> url
  result = result.replace(/<(https?:\/\/[^>]+)>/g, '$1');

  // convert bold: *text* -> **text**
  // slack uses single asterisks, discord uses double
  // be careful not to convert markdown links or already-double asterisks
  result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '**$1**');

  // convert italic: _text_ -> *text*
  // slack uses underscores, discord uses single asterisks
  result = result.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '*$1*');

  // convert strikethrough: ~text~ -> ~~text~~
  result = result.replace(/(?<!~)~([^~\n]+)~(?!~)/g, '~~$1~~');

  // convert inline code: `text` stays the same
  // convert code blocks: ```text``` stays the same

  // convert blockquotes: > text stays the same (both use >)

  return result;
}

// convert discord formatting to slack formatting
function discordToSlack(text, discordUsers = {}) {
  if (!text) return '';

  let result = text;

  // convert user mentions: <@123456> -> @username
  result = result.replace(/<@!?(\d+)>/g, (match, userId) => {
    const user = discordUsers[userId];
    return user ? `*@${user}*` : '*@unknown*';
  });

  // convert role mentions: <@&123456> -> @role
  result = result.replace(/<@&(\d+)>/g, '*@role*');

  // convert channel mentions: <#123456> -> #channel
  result = result.replace(/<#(\d+)>/g, (match, channelId) => {
    return '*#channel*';
  });

  // convert custom emoji: <:name:123456> -> :name:
  result = result.replace(/<a?:([^:]+):\d+>/g, ':$1:');

  // convert bold: **text** -> *text*
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // convert italic: *text* -> _text_ (single asterisk)
  // need to be careful not to convert bold markers
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '_$1_');

  // convert strikethrough: ~~text~~ -> ~text~
  result = result.replace(/~~([^~]+)~~/g, '~$1~');

  // convert underline: __text__ -> _text_ (slack doesn't have underline, use italic)
  result = result.replace(/__([^_]+)__/g, '_$1_');

  // convert spoilers: ||text|| -> (no direct equivalent, just show text)
  result = result.replace(/\|\|([^|]+)\|\|/g, '[spoiler: $1]');

  // inline code and code blocks stay the same

  return result;
}

// escape special characters for discord
function escapeDiscord(text) {
  if (!text) return '';
  return text.replace(/([*_~`|\\])/g, '\\$1');
}

// escape special characters for slack
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
