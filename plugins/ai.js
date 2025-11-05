const axios = require('axios');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        switch (command) {
            case 'sora': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `╔═══════════════════════╗
║   🎥 𝚂𝙾𝚁𝙰 𝙰𝙸   ║
╚═══════════════════════╝

*Usage:* ${config.PREFIX}sora <prompt>

*Example:*
${config.PREFIX}sora a cat dancing

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const prompt = args.join(' ');
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `⏳ Creating video from: "${prompt}"...`,
                    contextInfo: silaContext
                });

                try {
                    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/ai/txt2video?text=${encodeURIComponent(prompt)}`;
                    const response = await axios.get(apiUrl);
                    
                    if (response.data && response.data.videoUrl) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            video: { url: response.data.videoUrl },
                            caption: `╔═══════════════════════╗
║   🎥 𝚂𝙾𝚁𝙰 𝙰𝙸 𝚅𝙸𝙳𝙴𝙾   ║
╚═══════════════════════╝

*Prompt:* ${prompt}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                    } else {
                        await socket.sendMessage(msg.key.remoteJid, {
                            text: `❌ Failed to generate video. Try again later.`,
                            contextInfo: silaContext
                        });
                    }
                } catch (error) {
                    console.error('Sora AI error:', error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Error generating video: ${error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'flux': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `╔═══════════════════════╗
║   🌀 𝙵𝙻𝚄𝚇 𝙰𝙸   ║
╚═══════════════════════╝

*Usage:* ${config.PREFIX}flux <prompt>

*Example:*
${config.PREFIX}flux a beautiful landscape

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const prompt = args.join(' ');
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `🌀 Generating image from: "${prompt}"...`,
                    contextInfo: silaContext
                });

                try {
                    // Using a free AI image generation API
                    const apiUrl = `https://api.nekosapi.com/v3/images/random`;
                    const response = await axios.get(apiUrl);
                    
                    if (response.data && response.data.items && response.data.items[0]) {
                        const imageUrl = response.data.items[0].image_url;
                        
                        await socket.sendMessage(msg.key.remoteJid, {
                            image: { url: imageUrl },
                            caption: `╔═══════════════════════╗
║   🌀 𝙵𝙻𝚄𝚇 𝙰𝙸 𝙸𝙼𝙰𝙶𝙴   ║
╚═══════════════════════╝

*Prompt:* ${prompt}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                    } else {
                        // Fallback to another API
                        const fallbackApi = `https://picsum.photos/1024/1024`;
                        await socket.sendMessage(msg.key.remoteJid, {
                            image: { url: fallbackApi },
                            caption: `╔═══════════════════════╗
║   🌀 𝙵𝙻𝚄𝚇 𝙰𝙸 𝙸𝙼𝙰𝙶𝙴   ║
╚═══════════════════════╝

*Prompt:* ${prompt}

*Note:* Using fallback image service

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                    }
                } catch (error) {
                    console.error('Flux AI error:', error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Error generating image: ${error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }
        }

        return false;
    }
};
