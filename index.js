require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder } = require('discord.js');
const Replicate = require('replicate');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!DISCORD_TOKEN || !REPLICATE_API_TOKEN) {
    console.error("❌ Missing required environment variables!");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

client.once('clientReady', () => {
    console.log(`🤖 Bot online as ${client.user.tag}`);
});

// Initialize Replicate
const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

// Video generation function
async function generateVideo(prompt) {
    try {
        const output = await replicate.run("xai/grok-imagine-video", {
            input: { prompt, aspect_ratio: "16:9" },
        });

        // Handle array or object response
        let videoUrl = Array.isArray(output) ? output[0]?.url : output?.url;

        if (!videoUrl) throw new Error("No video URL returned from Replicate.");

        // Download video
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);

        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = path.join(__dirname, `video-${Date.now()}.mp4`);
        fs.writeFileSync(fileName, buffer);
        return fileName;
    } catch (err) {
        console.error("VIDEO ERROR:", err);
        throw err;
    }
}

// Handle messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Video command
    if (message.content.startsWith('!video ')) {
        const prompt = message.content.slice('!video '.length).trim();
        if (!prompt) return message.channel.send("❌ Please provide a prompt.");

        const statusMessage = await message.channel.send(`⏳ Generating video for: "${prompt}"`);

        try {
            const videoFile = await generateVideo(prompt);
            await message.channel.send({ files: [new AttachmentBuilder(videoFile)] });
            fs.unlinkSync(videoFile); // Cleanup
            await statusMessage.delete();
        } catch (err) {
            await statusMessage.edit(`❌ Video generation failed: ${err.message}`);
        }
    }

    // Optional: simple text command
    if (message.content.startsWith('!say ')) {
        const text = message.content.slice('!say '.length);
        message.channel.send(text);
    }
});

client.login(DISCORD_TOKEN);