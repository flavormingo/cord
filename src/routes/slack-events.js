const express = require('express');
const slackService = require('../services/slack');

const router = express.Router();

// slack events endpoint
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // get raw body for signature verification
    const rawBody = req.body.toString();

    // verify slack signature
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'missing signature' });
    }

    // check timestamp is not too old (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return res.status(401).json({ error: 'timestamp too old' });
    }

    // verify signature
    if (!slackService.verifySignature(signature, timestamp, rawBody)) {
      return res.status(401).json({ error: 'invalid signature' });
    }

    // parse body
    const body = JSON.parse(rawBody);

    // handle url verification challenge
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // handle events
    if (body.type === 'event_callback') {
      // respond immediately to slack
      res.status(200).send();

      // process event asynchronously
      const event = body.event;
      const teamId = body.team_id;

      // handle the event
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
