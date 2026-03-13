// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const Replicate = require('replicate');
const { writeFile } = require('fs/promises');
const path = require('path');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

client.once('clientReady', () => {
    console.log(`🤖 Bot online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!video ')) {
        const prompt = message.content.replace('!video ', '').trim();
        if (!prompt) return message.reply('Please provide a prompt for video generation.');

        const replyMsg = await message.reply('⏳ Generating your video, please wait...');

        try {
            // Run Grok Imagine Video
            const output = await replicate.run(
                'xai/grok-imagine-video', 
                {
                    input: {
                        prompt: prompt,
                        aspect_ratio: '16:9'
                    }
                }
            );

            // output is the file URL
            const videoUrl = output[0] || output; // sometimes output is array
            if (!videoUrl) throw new Error('No video URL returned from Replicate.');

            // Download video
            const response = await fetch(videoUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            const videoPath = path.join(__dirname, 'video.mp4');
            await writeFile(videoPath, buffer);

            // Send video in Discord
            const attachment = new AttachmentBuilder(videoPath, { name: 'video.mp4' });
            await message.reply({ content: `🎬 Video for prompt: "${prompt}"`, files: [attachment] });

            await replyMsg.edit('✅ Video generation complete!');
        } catch (err) {
            console.error('VIDEO ERROR:', err);
            await replyMsg.edit(`❌ Video generation failed: ${err.message}`);
        }
    }
});

client.login(DISCORD_TOKEN);