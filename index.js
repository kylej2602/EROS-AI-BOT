// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder } = require('discord.js');
const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!DISCORD_TOKEN || !REPLICATE_API_TOKEN) {
    console.error("❌ Missing required environment variables in .env");
    process.exit(1);
}

// Discord client setup
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

client.once('ready', () => {
    console.log(`🤖 Bot online as ${client.user.tag}`);
});

// Replicate client
const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

// Message handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Video generation command
    if (message.content.startsWith('!video ')) {
        const prompt = message.content.replace('!video ', '').trim();
        if (!prompt) return message.channel.send("❌ Please provide a prompt for video generation.");

        message.channel.send(`⏳ Generating video for: "${prompt}" ...`);

        try {
            const output = await replicate.run("xai/grok-imagine-video", {
                input: { prompt, aspect_ratio: "16:9" }
            });

            // Replicate returns an array or single object
            const videoUrl = output[0]?.url || output.url;
            if (!videoUrl) throw new Error("No video URL returned.");

            const res = await fetch(videoUrl);
            const buffer = Buffer.from(await res.arrayBuffer());
            const fileName = `video-${Date.now()}.mp4`;
            const filePath = path.join('./', fileName);
            fs.writeFileSync(filePath, buffer);

            const attachment = new AttachmentBuilder(filePath);
            await message.channel.send({ files: [attachment] });

            fs.unlinkSync(filePath);

        } catch (err) {
            console.error("VIDEO ERROR:", err);
            message.channel.send(`❌ Video generation failed: ${err.message}`);
        }
    }

    // Example text/image command if you have it
    if (message.content.startsWith('!say ')) {
        const text = message.content.replace('!say ', '');
        message.channel.send(text);
    }
});

client.login(DISCORD_TOKEN);