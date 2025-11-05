const axios = require('axios');
const fs = require('fs');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        // Text maker effects
        const textEffects = {
            metallic: text => `✨ ${text} ✨`,
            ice: text => `❄️ ${text} ❄️`,
            snow: text => `🌨️ ${text} 🌨️`,
            impressive: text => `🎨 ${text} 🎨`,
            matrix: text => `💚 ${text} 💚`,
            light: text => `💡 ${text} 💡`,
            neon: text => `🌈 ${text} 🌈`,
            devil: text => `😈 ${text} 😈`,
            purple: text => `💜 ${text} 💜`,
            thunder: text => `⚡ ${text} ⚡`,
            leaves: text => `🍃 ${text} 🍃`,
            '1917': text => `🎭 ${text} 🎭`,
            arena: text => `⚔️ ${text} ⚔️`,
            hacker: text => `👨‍💻 ${text} 👨‍💻`,
            sand: text => `🏖️ ${text} 🏖️`,
            blackpink: text => `🖤💖 ${text} 💖🖤`,
            glitch: text => `📟 ${text} 📟`,
            fire: text => `🔥 ${text} 🔥`
        };

        // Text maker commands
        if (textEffects[command]) {
            if (args.length === 0) {
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `✨ *Usage:* ${config.PREFIX}${command} <text>\n\nExample: ${config.PREFIX}${command} SILA MD`,
                    contextInfo: silaContext
                });
                return true;
            }

            const text = args.join(' ');
            const result = textEffects[command](text);
            
            await socket.sendMessage(msg.key.remoteJid, {
                text: `╔═══════════════════════╗
║   ✨ 𝚃𝙴𝚇𝚃 𝙴𝙵𝙵𝙴𝙲𝚃   ║
╚═══════════════════════╝

*Type:* ${command}
*Result:* ${result}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                contextInfo: silaContext
            });
            return true;
        }

        switch (command) {
            case 'removebg':
            case 'nobg':
            case 'rmbg': {
                if (!args[0] && !msg.message?.imageMessage) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `🖼️ *Please reply to an image* or send an image with the command.\nExample: ${config.PREFIX}removebg`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const apiKey = 'ymx66uG6cizvJMvPpkjVC4Q3';

                try {
                    let imageBuffer;

                    // Check if the user replied to an image
                    if (msg.message?.imageMessage) {
                        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                        const media = await downloadMediaMessage(msg, 'buffer', {}, { 
                            reuploadRequest: socket.updateMediaMessage 
                        });
                        imageBuffer = media;
                    } else if (args[0]) {
                        // or use a direct image URL
                        const url = args[0];
                        const response = await axios.get(url, { responseType: 'arraybuffer' });
                        imageBuffer = response.data;
                    }

                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `🪄 Removing background... Please wait a moment.`,
                        contextInfo: silaContext
                    });

                    const result = await axios({
                        method: 'post',
                        url: 'https://api.remove.bg/v1.0/removebg',
                        data: {
                            image_file_b64: imageBuffer.toString('base64'),
                            size: 'auto'
                        },
                        headers: {
                            'X-Api-Key': apiKey
                        },
                        responseType: 'arraybuffer'
                    });

                    const outputPath = './temp/removed-bg.png';
                    if (!fs.existsSync('./temp')) {
                        fs.mkdirSync('./temp', { recursive: true });
                    }
                    fs.writeFileSync(outputPath, result.data);

                    await socket.sendMessage(msg.key.remoteJid, {
                        image: fs.readFileSync(outputPath),
                        caption: `✅ *Background removed successfully!*\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });

                    fs.unlinkSync(outputPath);

                } catch (error) {
                    console.error('RemoveBG Error:', error);
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Failed to remove background.\nReason: ${error.response?.data?.errors?.[0]?.title || error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'vv': {
                try {
                    if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            text: `📸 Reply to a *view-once* image, video, or file with *vv* to unlock it.`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const quoted = msg.message.extendedTextMessage.contextInfo;
                    const quotedMsg = quoted.quotedMessage;

                    let mediaType = '';
                    let mediaData = null;

                    if (quotedMsg.viewOnceMessageV2) {
                        const message = quotedMsg.viewOnceMessageV2.message;
                        if (message.imageMessage) {
                            mediaType = 'image';
                            mediaData = message.imageMessage;
                        } else if (message.videoMessage) {
                            mediaType = 'video';
                            mediaData = message.videoMessage;
                        }
                    } else if (quotedMsg.viewOnceMessage) {
                        const message = quotedMsg.viewOnceMessage.message;
                        if (message.imageMessage) {
                            mediaType = 'image';
                            mediaData = message.imageMessage;
                        } else if (message.videoMessage) {
                            mediaType = 'video';
                            mediaData = message.videoMessage;
                        }
                    }

                    if (!mediaType) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            text: `⚠️ The replied message is *not a view-once* file!`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    // Download the media
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const buffer = await downloadMediaMessage(
                        {
                            key: { remoteJid: msg.key.remoteJid, id: quoted.stanzaId },
                            message: { [mediaType + 'Message']: mediaData }
                        },
                        'buffer',
                        {},
                        { reuploadRequest: socket.updateMediaMessage }
                    );

                    // Send back as normal media
                    await socket.sendMessage(msg.key.remoteJid, {
                        [mediaType]: buffer,
                        caption: `👁️ *View Once Unlocked!*\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });

                } catch (err) {
                    console.error('VV Error:', err);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Failed to unlock the view-once file.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'vv2':
            case 'vvv':
            case 'vvtoyu': {
                try {
                    if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            text: `📸 Reply to a *view-once* image, video, or file with *${command}* to send it privately to the owner.`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const quoted = msg.message.extendedTextMessage.contextInfo;
                    const quotedMsg = quoted.quotedMessage;

                    let mediaType = '';
                    let mediaData = null;

                    if (quotedMsg.viewOnceMessageV2) {
                        const message = quotedMsg.viewOnceMessageV2.message;
                        if (message.imageMessage) {
                            mediaType = 'image';
                            mediaData = message.imageMessage;
                        } else if (message.videoMessage) {
                            mediaType = 'video';
                            mediaData = message.videoMessage;
                        }
                    } else if (quotedMsg.viewOnceMessage) {
                        const message = quotedMsg.viewOnceMessage.message;
                        if (message.imageMessage) {
                            mediaType = 'image';
                            mediaData = message.imageMessage;
                        } else if (message.videoMessage) {
                            mediaType = 'video';
                            mediaData = message.videoMessage;
                        }
                    }

                    if (!mediaType) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            text: `⚠️ The replied message is *not a view-once* file!`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    // Download the media
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const buffer = await downloadMediaMessage(
                        {
                            key: { remoteJid: msg.key.remoteJid, id: quoted.stanzaId },
                            message: { [mediaType + 'Message']: mediaData }
                        },
                        'buffer',
                        {},
                        { reuploadRequest: socket.updateMediaMessage }
                    );

                    // Send to owner privately
                    const ownerJid = `${number}@s.whatsapp.net`;
                    await socket.sendMessage(ownerJid, {
                        [mediaType]: buffer,
                        caption: `🕵️‍♂️ *Secret View - ${command}*\n\n👁️ A view-once file was unlocked from chat:\n> ${msg.key.remoteJid}\n\n✅ Sent privately to bot owner.`,
                        contextInfo: silaContext
                    });

                    // Notify user
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `✅ View-once file has been sent privately to the bot owner.`,
                        contextInfo: silaContext
                    });

                } catch (err) {
                    console.error('VV2 Error:', err);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Failed to secretly unlock the view-once file.\n\n💬 Error: ${err.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'idch': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `⚠️ Please provide a *WhatsApp Channel* link.\n\nExample:\n${config.PREFIX}idch https://whatsapp.com/channel/0029VaA2KzF3eHuyE3Jw1R3`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                try {
                    const chLink = args[0];

                    // Detect if link is not a channel
                    if (chLink.includes('/invite/') || chLink.includes('/chat/')) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            text: `❌ That looks like a *group or chat link*, not a channel link.\n\nPlease send a *WhatsApp Channel* link.`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    // Extract invite code from channel link
                    const match = chLink.match(/channel\/([\w\d]+)/);
                    if (!match) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ Invalid WhatsApp Channel link. Please check and try again.`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const inviteCode = match[1];
                    const newsletterJid = `${inviteCode}@newsletter`;

                    // Fetch channel info
                    const channelInfo = await socket.newsletterMetadata(newsletterJid);
                    if (!channelInfo) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `⚠️ Unable to fetch details for that channel. It may be private or unavailable.`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const { name, id, subscribers, creation, description } = channelInfo;

                    const caption = `╔═══════════════════════╗
║   ℹ️ 𝙲𝙷𝙰𝙽𝙽𝙴𝙻 𝙸𝙽𝙵𝙾   ║
╚═══════════════════════╝

🏷️ *Name:* ${name || "N/A"}
🆔 *JID:* ${id || newsletterJid}
👥 *Followers:* ${subscribers || "Unknown"}
🗓️ *Created:* ${creation ? new Date(creation * 1000).toLocaleString() : "N/A"}
📝 *Description:* ${description || "No description"}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: caption,
                        contextInfo: silaContext
                    });

                } catch (error) {
                    console.error("Channel Info Error:", error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: "❌ Failed to get channel info. Make sure the link is valid and public.",
                        contextInfo: silaContext
                    });
                }
                return true;
            }
        }

        return false;
    }
};
