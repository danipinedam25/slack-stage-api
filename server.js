require('dotenv').config();
const express = require('express');
const { WebClient } = require('@slack/web-api');
const { stageToUserIds } = require('./utils/stageMap');

const app = express();
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

app.use(express.json());

// Oportunidades mapeadas a IDs de canal (puede venir de BD en el futuro)
const opportunityToChannel = {
  "opp-123": "C01XXXXXXX1",
  "opp-456": "C01XXXXXXX2"
};

app.post('/api/update-opportunity', async (req, res) => {
  const { opportunityId, stage } = req.body;

  if (!opportunityId || !stage) {
    return res.status(400).json({ error: "Missing opportunityId or stage" });
  }

  const channelId = opportunityToChannel[opportunityId];
  const userIds = stageToUserIds[stage];

  if (!channelId || !userIds) {
    return res.status(404).json({ error: "Channel or stage not found" });
  }

  try {
    const members = await slackClient.conversations.members({ channel: channelId });
    const currentMembers = members.members;

    const usersToAdd = userIds.filter(u => !currentMembers.includes(u));
    const usersToRemove = currentMembers.filter(u => !userIds.includes(u) && u !== 'USLACKBOT');

    for (const userId of usersToAdd) {
      await slackClient.conversations.invite({ channel: channelId, users: userId });
    }

    for (const userId of usersToRemove) {
      try {
        await slackClient.conversations.kick({ channel: channelId, user: userId });
      } catch (error) {
        console.warn( `No se pudo remover a ${userId}: ${error.message} `);
      }
    }

    res.json({ success: true, message: "Canal actualizado con nuevos miembros." });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al comunicarse con Slack API." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
})