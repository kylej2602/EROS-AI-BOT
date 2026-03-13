require("dotenv").config();

const { Client, GatewayIntentBits, Events } = require("discord.js");
const Replicate = require("replicate");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let videoQueue = [];
let processingVideo = false;

/* ---------- VIDEO GENERATION WITH RATE LIMIT RETRY ---------- */

async function createPredictionWithRetry(prompt) {

  while (true) {

    try {

      const prediction = await replicate.predictions.create({
        model: "xai/grok-imagine-video",
        input: {
          prompt: prompt,
          aspect_ratio: "16:9"
        }
      });

      return prediction;

    } catch (err) {

      if (err.response && err.response.headers.get("retry-after")) {

        const wait = parseInt(err.response.headers.get("retry-after")) * 1000;

        console.log(`⏳ Rate limited. Waiting ${wait / 1000}s then retrying...`);

        await new Promise(r => setTimeout(r, wait));

      } else {

        throw err;

      }

    }

  }

}

/* ---------- PROCESS VIDEO QUEUE ---------- */

async function processVideoQueue() {

  if (processingVideo) return;
  if (videoQueue.length === 0) return;

  processingVideo = true;

  const { prompt, message } = videoQueue.shift();

  try {

    await message.reply("🎬 Generating video... this may take 30-90 seconds.");

    const prediction = await createPredictionWithRetry(prompt);

    let result = prediction;

    while (result.status !== "succeeded" && result.status !== "failed") {

      await new Promise(resolve => setTimeout(resolve, 5000));

      result = await replicate.predictions.get(result.id);

    }

    if (result.status === "succeeded") {

      let videoURL;

      if (Array.isArray(result.output)) {
        videoURL = result.output[0];
      } else {
        videoURL = result.output;
      }

      if (!videoURL) {

        await message.reply("❌ Video finished but no URL returned.");

      } else {

        await message.reply(videoURL);

      }

    } else {

      await message.reply("❌ Video generation failed.");

    }

  } catch (error) {

    console.error("VIDEO ERROR:", error);

    await message.reply("❌ Video generation error.");

  }

  processingVideo = false;

  if (videoQueue.length > 0) processVideoQueue();

}

/* ---------- DISCORD READY ---------- */

client.once(Events.ClientReady, () => {

  console.log(`🤖 Bot online as ${client.user.tag}`);

});

/* ---------- MESSAGE HANDLER ---------- */

client.on(Events.MessageCreate, async (message) => {

  if (message.author.bot) return;

  const content = message.content.trim();

  /* VIDEO COMMAND */

  if (content.startsWith("!video ")) {

    const prompt = content.replace("!video ", "").trim();

    videoQueue.push({ prompt, message });

    await message.reply("⏳ Video request added to queue.");

    processVideoQueue();

  }

  /* IMAGE COMMAND */

  else if (content.startsWith("!image ")) {

    const prompt = content.replace("!image ", "").trim();

    try {

      const result = await replicate.run(
        "xai/grok-imagine",
        { input: { prompt } }
      );

      let imageURL;

      if (Array.isArray(result)) {
        imageURL = result[0];
      } else {
        imageURL = result;
      }

      await message.reply(imageURL);

    } catch (error) {

      console.error("IMAGE ERROR:", error);

      await message.reply("❌ Image generation failed.");

    }

  }

  /* CHAT COMMAND */

  else if (content.startsWith("!chat ")) {

    const prompt = content.replace("!chat ", "").trim();

    try {

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "user", content: prompt }
        ]
      });

      await message.reply(response.choices[0].message.content);

    } catch (error) {

      console.error("CHAT ERROR:", error);

      await message.reply("❌ Chat request failed.");

    }

  }

});

/* ---------- START BOT ---------- */

client.login(process.env.DISCORD_TOKEN);