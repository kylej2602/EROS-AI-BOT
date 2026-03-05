require('dotenv').config();
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

// ---------------- MEMORY SYSTEM ----------------
const MEMORY_FILE = __dirname + "/memory.json";

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

// ---------------- BOT READY ----------------
client.once('ready', () => {
  console.log(`🤖 Bot online as ${client.user.tag}`);
});

// ---------------- MESSAGE HANDLER ----------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content;

  // ---------------- AI CHAT ----------------
  if (content.startsWith("!ai")) {
    const userId = message.author.id;
    const prompt = content.replace("!ai", "").trim();

    if (!memory[userId]) memory[userId] = [];

    // Save user facts
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
        await message.reply(reply.substring(0, 1999));
      } else {
        await message.reply(reply);
      }

    } catch (error) {
      console.error("AI ERROR:", error);
      message.reply("❌ AI error occurred.");
    }
  }

  // ---------------- IMAGE GENERATION ----------------
  if (content.startsWith("!image")) {
    const prompt = content.replace("!image", "").trim();
    if (!prompt) return message.reply("Please provide an image description.");

    try {
      // Step 1: Send "Generating..." message
      const waitMsg = await message.reply("🎨 Generating image...");

      // Step 2: Generate image
      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        size: "1024x1024"
      });

      // Step 3: Validate response
      if (!result.data || !result.data[0] || !result.data[0].b64_json) {
        throw new Error("No image returned from OpenAI");
      }

      // Step 4: Convert Base64 to buffer
      const imageBuffer = Buffer.from(result.data[0].b64_json, "base64");

      // Step 5: Send image safely
      await message.channel.send({
        files: [{ attachment: imageBuffer, name: "image.png" }]
      });

      // Step 6: Delete the "Generating..." message AFTER sending
      await waitMsg.delete();

    } catch (error) {
      console.error("IMAGE ERROR:", error);
      message.reply("❌ Image generation failed. Try again later.");
    }
  }
});

// ---------------- LOGIN ----------------
client.login(process.env.DISCORD_TOKEN);