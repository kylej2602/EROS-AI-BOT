require('dotenv').config({ quiet: true });

const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs');

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

const MEMORY_FILE = "./memory.json";

function loadMemory() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE));
  } catch {
    return {};
  }
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

let memory = loadMemory();

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {

  if (message.author.bot) return;

  const content = message.content;

  // AI Chat
  if (content.startsWith("!ai")) {

    const userId = message.author.id;
    const prompt = content.replace("!ai", "").trim();

    if (!memory[userId]) memory[userId] = [];

    if (prompt.toLowerCase().startsWith("my name is")) {
      memory[userId].push(prompt);
      saveMemory(memory);
    }

    try {

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI in a Discord server.

Known facts about the user:
${memory[userId].join("\n")}

Use these facts when answering.`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const reply = response.choices[0].message.content;

      if (reply.length > 2000) {
        message.reply(reply.substring(0, 1999));
      } else {
        message.reply(reply);
      }

    } catch (error) {
      console.error(error);
      message.reply("AI error occurred.");
    }
  }

  // IMAGE GENERATION
  if (content.startsWith("!image")) {

    const prompt = content.replace("!image", "").trim();

    try {

      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        size: "1024x1024"
      });

      const imageBase64 = result.data[0].b64_json;

      const imageBuffer = Buffer.from(imageBase64, "base64");

      message.channel.send({
        files: [{ attachment: imageBuffer, name: "image.png" }]
      });

    } catch (error) {
      console.error(error);
      message.reply("Image generation failed.");
    }
  }

});

client.login(process.env.DISCORD_TOKEN);