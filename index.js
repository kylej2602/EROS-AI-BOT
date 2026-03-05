require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const OpenAI = require("openai");

/* ---------------- CONFIG ---------------- */

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const MEMORY_FILE = "./memory.json";

/* ---------------- OPENAI ---------------- */

const openai = new OpenAI({
  apiKey: OPENAI_KEY
});

/* ---------------- DISCORD ---------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ---------------- MEMORY ---------------- */

if (!fs.existsSync(MEMORY_FILE)) {
  fs.writeFileSync(MEMORY_FILE, "{}");
}

function getMemory() {
  return JSON.parse(fs.readFileSync(MEMORY_FILE));
}

function saveMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

/* ---------------- SLASH COMMANDS ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask the AI something")
    .addStringOption(o =>
      o.setName("prompt")
        .setDescription("Your question")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("imagine")
    .setDescription("Generate an AI image")
    .addStringOption(o =>
      o.setName("prompt")
        .setDescription("Image description")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function registerCommands() {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  console.log("Slash commands registered");
}

/* ---------------- BOT READY ---------------- */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ---------------- INTERACTION HANDLER ---------------- */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const memory = getMemory();
  const user = interaction.user.id;

  if (!memory[user]) memory[user] = [];

  try {

    /* ---------- ASK ---------- */

    if (interaction.commandName === "ask") {

      await interaction.deferReply();

      const prompt = interaction.options.getString("prompt");

      memory[user].push({
        role: "user",
        content: prompt
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: memory[user]
      });

      const reply = response.choices[0].message.content;

      memory[user].push({
        role: "assistant",
        content: reply
      });

      saveMemory(memory);

      await interaction.editReply(reply);
    }

    /* ---------- IMAGE ---------- */

    if (interaction.commandName === "imagine") {

      await interaction.deferReply();

      const prompt = interaction.options.getString("prompt");

      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt
      });

      const imageBase64 = result.data[0].b64_json;

      const buffer = Buffer.from(imageBase64, "base64");

      fs.writeFileSync("image.png", buffer);

      await interaction.editReply({
        content: `Prompt: ${prompt}`,
        files: ["image.png"]
      });

    }

  } catch (err) {

    console.error("ERROR:", err);

    await interaction.editReply("Something broke. Check console.");

  }

});

/* ---------------- START ---------------- */

registerCommands();
client.login(DISCORD_TOKEN);