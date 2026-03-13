// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const Replicate = require('replicate');
const OpenAI = require('openai');

// Initialize Discord bot
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Initialize OpenAI and Replicate
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Simple queue for video generation to avoid rate-limit crashes
const videoQueue = [];
let videoProcessing = false;

async function processVideoQueue() {
    if (videoProcessing || videoQueue.length === 0) return;
    videoProcessing = true;

    const { prompt, message } = videoQueue.shift();

    try {
        let attempt = 0;
        let output;

        while (attempt < 5) { // retry max 5 times
            try {
                output = await replicate.run("xai/grok-imagine-video", {
                    input: { prompt }
                });
                break; // success
            } catch (err) {
                if (err.status === 429 && err.response?.headers?.get('retry-after')) {
                    const wait = parseInt(err.response.headers.get('retry-after')) * 1000;
                    console.log(`Rate limited. Retrying after ${wait}ms`);
                    await new Promise(res => setTimeout(res, wait));
                    attempt++;
                } else {
                    throw err;
                }
            }
        }

        if (!output) throw new Error("Failed video generation after retries.");

        // Send video URL to Discord
        await message.reply(`🎬 Your video is ready: ${output[0].url}`);
    } catch (error) {
        console.error("VIDEO ERROR:", error);
        await message.reply(`❌ Video generation failed: ${error.message}`);
    } finally {
        videoProcessing = false;
        // Process next in queue
        if (videoQueue.length > 0) processVideoQueue();
    }
}

// Discord ready
client.once(Events.ClientReady, () => {
    console.log(`🤖 Bot online as ${client.user.tag}`);
});

// Message handler
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // Video command
    if (content.startsWith("!video ")) {
        const prompt = content.replace("!video ", "").trim();
        videoQueue.push({ prompt, message });
        processVideoQueue();
        return message.reply("⏳ Your video request is queued...");
    }

    // Image generation command
    if (content.startsWith("!image ")) {
        const prompt = content.replace("!image ", "").trim();
        try {
            const result = await replicate.run("xai/grok-imagine", { input: { prompt } });
            return message.reply(`🖼️ Your image is ready: ${result[0].url}`);
        } catch (error) {
            console.error("IMAGE ERROR:", error);
            return message.reply(`❌ Image generation failed: ${error.message}`);
        }
    }

    // Chat command
    if (content.startsWith("!chat ")) {
        const prompt = content.replace("!chat ", "").trim();
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }]
            });
            return message.reply(response.choices[0].message.content);
        } catch (error) {
            console.error("CHAT ERROR:", error);
            return message.reply(`❌ Chat failed: ${error.message}`);
        }
    }
});

// Login
client.login(process.env.DISCORD_TOKEN);