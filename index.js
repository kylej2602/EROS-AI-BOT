require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder } = require('discord.js');
const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Load env variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!DISCORD_TOKEN || !REPLICATE_API_TOKEN) {
    console.error("❌ Missing required environment variables");
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

client.once('ready', () => {
    console.log(`🤖 Bot online as ${client.user.tag}`);
});

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!video ')) {
        const prompt = message.content.replace('!video ', '').trim();
        if (!prompt) return message.channel.send("❌ Provide a prompt for video.");

        message.channel.send(`⏳ Generating video: "${prompt}" ...`);

        try {
            const output = await replicate.run("xai/grok-imagine-video", { input: { prompt, aspect_ratio: "16:9" } });
            const videoUrl = Array.isArray(output) ? output[0]?.url : output?.url;

            if (!videoUrl) throw new Error("No video URL returned.");

            const res = await fetch(videoUrl);
            const buffer = Buffer.from(await res.arrayBuffer());
            const fileName = `video-${Date.now()}.mp4`;
            fs.writeFileSync(fileName, buffer);

            const attachment = new AttachmentBuilder(fileName);
            await message.channel.send({ files: [attachment] });

            fs.unlinkSync(fileName);
        } catch (err) {
            console.error("VIDEO ERROR:", err);
            message.channel.send(`❌ Video generation failed: ${err.message}`);
        }
    }

    if (message.content.startsWith('!say ')) {
        const text = message.content.replace('!say ', '');
        message.channel.send(text);
    }
});

client.login(DISCORD_TOKEN);