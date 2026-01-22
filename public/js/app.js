// state
let workspaces = { slack: [], discord: [] };
let slackChannels = [];
let discordChannels = [];
let mappings = [];

// dom elements
const slackList = document.getElementById('slack-list');
const discordList = document.getElementById('discord-list');
const slackWorkspaceSelect = document.getElementById('slack-workspace');
const slackChannelSelect = document.getElementById('slack-channel');
const discordGuildSelect = document.getElementById('discord-guild');
const discordChannelSelect = document.getElementById('discord-channel');
const addMappingBtn = document.getElementById('add-mapping');
const mappingsList = document.getElementById('mappings-list');

// fetch helper
async function api(method, path, body) {
  const options = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'request failed');
  }
  return res.json();
}

// show toast notification
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// render connected workspaces
function renderWorkspaces() {
  // slack
  if (workspaces.slack.length === 0) {
    slackList.innerHTML = `
      <a href="/auth/slack" class="connect-btn slack">
        <svg class="connection-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
        connect slack
      </a>
    `;
  } else {
    slackList.innerHTML = workspaces.slack.map(w => `
      <div class="connected-item">
        <span class="connected-name">${w.name}</span>
        <button class="disconnect-btn" data-type="slack" data-id="${w.id}">disconnect</button>
      </div>
    `).join('') + `
      <a href="/auth/slack" class="connect-btn slack" style="margin-top: 0.5rem;">
        <svg class="connection-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
        add another
      </a>
    `;
  }

  // discord
  if (workspaces.discord.length === 0) {
    discordList.innerHTML = `
      <a href="/auth/discord" class="connect-btn discord">
        <svg class="connection-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        connect discord
      </a>
    `;
  } else {
    discordList.innerHTML = workspaces.discord.map(g => `
      <div class="connected-item">
        <span class="connected-name">${g.name}</span>
        <button class="disconnect-btn" data-type="discord" data-id="${g.id}">disconnect</button>
      </div>
    `).join('') + `
      <a href="/auth/discord" class="connect-btn discord" style="margin-top: 0.5rem;">
        <svg class="connection-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        add another
      </a>
    `;
  }

  // add disconnect handlers
  document.querySelectorAll('.disconnect-btn').forEach(btn => {
    btn.addEventListener('click', handleDisconnect);
  });

  // update selects
  updateSelects();
}

// update channel mapping selects
function updateSelects() {
  // slack workspaces
  slackWorkspaceSelect.innerHTML = '<option value="">select workspace</option>' +
    workspaces.slack.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

  // discord guilds
  discordGuildSelect.innerHTML = '<option value="">select server</option>' +
    workspaces.discord.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

  // reset channel selects
  slackChannelSelect.innerHTML = '<option value="">select channel</option>';
  discordChannelSelect.innerHTML = '<option value="">select channel</option>';
  slackChannelSelect.disabled = true;
  discordChannelSelect.disabled = true;

  updateAddButton();
}

// fetch slack channels when workspace selected
async function onSlackWorkspaceChange() {
  const workspaceId = slackWorkspaceSelect.value;
  if (!workspaceId) {
    slackChannels = [];
    slackChannelSelect.innerHTML = '<option value="">select channel</option>';
    slackChannelSelect.disabled = true;
    updateAddButton();
    return;
  }

  slackChannelSelect.innerHTML = '<option value="">loading...</option>';
  slackChannelSelect.disabled = true;

  try {
    slackChannels = await api('GET', `/slack/${workspaceId}/channels`);
    slackChannelSelect.innerHTML = '<option value="">select channel</option>' +
      slackChannels.map(c => `<option value="${c.id}" data-name="${c.name}">#${c.name}</option>`).join('');
    slackChannelSelect.disabled = false;
  } catch (err) {
    showToast('failed to load channels', 'error');
    slackChannelSelect.innerHTML = '<option value="">error loading</option>';
  }
  updateAddButton();
}

// fetch discord channels when guild selected
async function onDiscordGuildChange() {
  const guildId = discordGuildSelect.value;
  if (!guildId) {
    discordChannels = [];
    discordChannelSelect.innerHTML = '<option value="">select channel</option>';
    discordChannelSelect.disabled = true;
    updateAddButton();
    return;
  }

  discordChannelSelect.innerHTML = '<option value="">loading...</option>';
  discordChannelSelect.disabled = true;

  try {
    discordChannels = await api('GET', `/discord/${guildId}/channels`);
    discordChannelSelect.innerHTML = '<option value="">select channel</option>' +
      discordChannels.map(c => `<option value="${c.id}" data-name="${c.name}">#${c.name}</option>`).join('');
    discordChannelSelect.disabled = false;
  } catch (err) {
    showToast('failed to load channels', 'error');
    discordChannelSelect.innerHTML = '<option value="">error loading</option>';
  }
  updateAddButton();
}

// update add button state
function updateAddButton() {
  const canAdd = slackWorkspaceSelect.value &&
    slackChannelSelect.value &&
    discordGuildSelect.value &&
    discordChannelSelect.value;
  addMappingBtn.disabled = !canAdd;
}

// add mapping
async function handleAddMapping() {
  const slackOption = slackChannelSelect.selectedOptions[0];
  const discordOption = discordChannelSelect.selectedOptions[0];

  try {
    const mapping = await api('POST', '/mappings', {
      slackWorkspaceId: slackWorkspaceSelect.value,
      slackChannelId: slackChannelSelect.value,
      slackChannelName: slackOption.dataset.name,
      discordGuildId: discordGuildSelect.value,
      discordChannelId: discordChannelSelect.value,
      discordChannelName: discordOption.dataset.name,
    });
    mappings.push(mapping);
    renderMappings();
    showToast('mapping created');

    // reset selects
    slackChannelSelect.value = '';
    discordChannelSelect.value = '';
    updateAddButton();
  } catch (err) {
    showToast(err.message || 'failed to create mapping', 'error');
  }
}

// render mappings
function renderMappings() {
  if (mappings.length === 0) {
    mappingsList.innerHTML = '<div class="empty-state">no channel mappings yet</div>';
    return;
  }

  mappingsList.innerHTML = mappings.map(m => `
    <div class="mapping-item" data-id="${m.id}">
      <div class="mapping-channels">
        <span class="channel-tag slack">#${m.slack_channel_name}</span>
        <span class="arrow">↔</span>
        <span class="channel-tag discord">#${m.discord_channel_name}</span>
      </div>
      <div class="mapping-actions">
        <button class="toggle-btn ${m.active ? 'active' : ''}" data-id="${m.id}">
          ${m.active ? 'active' : 'paused'}
        </button>
        <button class="delete-btn" data-id="${m.id}">delete</button>
      </div>
    </div>
  `).join('');

  // add handlers
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', handleToggle);
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', handleDelete);
  });
}

// toggle mapping
async function handleToggle(e) {
  const id = e.target.dataset.id;
  const mapping = mappings.find(m => m.id === id);
  if (!mapping) return;

  try {
    await api('PATCH', `/mappings/${id}`, { active: !mapping.active });
    mapping.active = !mapping.active;
    renderMappings();
    showToast(mapping.active ? 'mapping activated' : 'mapping paused');
  } catch (err) {
    showToast('failed to update mapping', 'error');
  }
}

// delete mapping
async function handleDelete(e) {
  const id = e.target.dataset.id;
  if (!confirm('are you sure you want to delete this mapping?')) return;

  try {
    await api('DELETE', `/mappings/${id}`);
    mappings = mappings.filter(m => m.id !== id);
    renderMappings();
    showToast('mapping deleted');
  } catch (err) {
    showToast('failed to delete mapping', 'error');
  }
}

// disconnect workspace/guild
async function handleDisconnect(e) {
  const type = e.target.dataset.type;
  const id = e.target.dataset.id;
  if (!confirm(`are you sure you want to disconnect this ${type === 'slack' ? 'workspace' : 'server'}?`)) return;

  try {
    await api('DELETE', `/${type}/${id}`);
    if (type === 'slack') {
      workspaces.slack = workspaces.slack.filter(w => w.id !== id);
    } else {
      workspaces.discord = workspaces.discord.filter(g => g.id !== id);
    }
    // remove related mappings from ui
    if (type === 'slack') {
      mappings = mappings.filter(m => m.slack_workspace_id !== id);
    } else {
      mappings = mappings.filter(m => m.discord_guild_id !== id);
    }
    renderWorkspaces();
    renderMappings();
    showToast('disconnected');
  } catch (err) {
    showToast('failed to disconnect', 'error');
  }
}

// init
async function init() {
  try {
    // load workspaces
    workspaces = await api('GET', '/workspaces');
    renderWorkspaces();

    // load mappings
    mappings = await api('GET', '/mappings');
    renderMappings();

    // add event listeners
    slackWorkspaceSelect.addEventListener('change', onSlackWorkspaceChange);
    discordGuildSelect.addEventListener('change', onDiscordGuildChange);
    slackChannelSelect.addEventListener('change', updateAddButton);
    discordChannelSelect.addEventListener('change', updateAddButton);
    addMappingBtn.addEventListener('click', handleAddMapping);

    // check for url params
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'connected') {
      showToast('slack workspace connected');
    } else if (params.get('discord') === 'connected') {
      showToast('discord server connected');
    } else if (params.get('error')) {
      showToast(params.get('error').replace(/_/g, ' '), 'error');
    }

    // clean url
    if (params.toString()) {
      window.history.replaceState({}, '', '/');
    }
  } catch (err) {
    console.error('init error:', err);
  }
}

init();
