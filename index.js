require('dotenv').config({ quiet: true });

const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!ai")) return;

  const prompt = message.content.replace("!ai", "").trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const reply = response.choices[0].message.content;

    if (reply.length > 2000) {
      message.reply(reply.substring(0, 1999));
    } else {
      message.reply(reply);
    }

  } catch (error) {
    console.error(error);
    message.reply("There was an error talking to the AI.");
  }
});

client.login(process.env.DISCORD_TOKEN);
