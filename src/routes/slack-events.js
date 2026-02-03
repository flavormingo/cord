const express = require('express');
const slackService = require('../services/slack');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body.toString();

    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'missing signature' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return res.status(401).json({ error: 'timestamp too old' });
    }

    if (!slackService.verifySignature(signature, timestamp, rawBody)) {
      return res.status(401).json({ error: 'invalid signature' });
    }

    const body = JSON.parse(rawBody);

    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    if (body.type === 'event_callback') {
      res.status(200).send();

      const event = body.event;
      const teamId = body.team_id;

      await slackService.handleEvent(event, teamId);
    } else {
      res.status(200).send();
    }
  } catch (err) {
    console.error('slack events error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
