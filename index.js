// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder } = require('discord.js');
const Replicate = require('replicate');
const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch'); // required for downloading video from URL

// Initialize Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

// Initialize Replicate client with your token
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Queue system for video generation
let isGenerating = false;

// Generate video function
async function generateVideo(prompt) {
    const tempFile = path.join(__dirname, `video_${Date.now()}.mp4`);

    const output = await replicate.run("xai/grok-imagine-video", {
        input: { prompt, aspect_ratio: "16:9" }
    });

    if (!output?.url) throw new Error("No video URL returned from Replicate.");

    // Download the video
    const response = await fetch(output.url);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tempFile, buffer);

    return tempFile;
}

// Listen to messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Command: !video <prompt>
    if (message.content.startsWith('!video ')) {
        const prompt = message.content.slice(7).trim();
        if (!prompt) return message.channel.send("❌ Please provide a prompt.");

        if (isGenerating) return message.channel.send("⏳ A video is already being generated, please wait.");

        isGenerating = true;
        const statusMessage = await message.channel.send(`⏳ Generating video for: "${prompt}"`);

        try {
            const videoFile = await generateVideo(prompt);
            await message.channel.send({ files: [new AttachmentBuilder(videoFile)] });
            await fs.remove(videoFile); // cleanup temp file
            await statusMessage.delete();
        } catch (err) {
            console.error(err);
            await statusMessage.edit(`❌ Video generation failed: ${err.message}`);
        } finally {
            isGenerating = false;
        }
    }
});

// Bot ready
client.once('ready', () => {
    console.log(`🤖 Bot online as ${client.user.tag}`);
});

// Login
client.login(process.env.DISCORD_TOKEN);