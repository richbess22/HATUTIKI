const fs = require('fs');
const os = require('os');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        switch (command) {
            case 'alive': {
                const startTime = require('../pair.js').socketCreationTime.get(number) || Date.now();
                const uptime = Math.floor((Date.now() - startTime) / 1000);
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                const activeSockets = require('../pair.js').activeSockets;

                const caption = `╔═══════════════════════╗
║   🤖 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸   ║
╚═══════════════════════╝

💚 𝚂𝚝𝚊𝚝𝚞𝚜: 𝙾𝙽𝙻𝙸𝙽𝙴
⏱️ 𝚄𝚙𝚝𝚒𝚖𝚎: ${hours}𝚑 ${minutes}𝚖 ${seconds}𝚜
📱 𝚄𝚜𝚎𝚛: ${number}
👥 𝙰𝚌𝚝𝚒𝚟𝚎: ${activeSockets.size} 𝚋𝚘𝚝𝚜
🔖 𝚅𝚎𝚛𝚜𝚒𝚘𝚗: 𝚟3.0.0

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://files.catbox.moe/4gca2n.png' },
                    caption: caption.trim(),
                    contextInfo: silaContext
                });
                return true;
            }

            case 'menu':
            case 'help':
            case 'allmenu': {
                const startTime = require('../pair.js').socketCreationTime.get(number) || Date.now();
                const uptime = Math.floor((Date.now() - startTime) / 1000);
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);

                const menuCaption = `╔══════════════════════════════════════╗
║              📜 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙴𝙽𝚄              ║
╠══════════════════════════════════════╣
║ ⏱️ 𝚄𝚙𝚝𝚒𝚖𝚎: ${hours}𝚑 ${minutes}𝚖 ${seconds}𝚜
║ 📱 𝚄𝚜𝚎𝚛: ${number}
╠══════════════════════════════════════╣
║           🤖 𝙲𝙾𝚁𝙴 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂           ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}alive    - 𝙱𝚘𝚝 𝚜𝚝𝚊𝚝𝚞𝚜
║ ${config.PREFIX}menu     - 𝚂𝚑𝚘𝚠 𝚝𝚑𝚒𝚜 𝚖𝚎𝚗𝚞
║ ${config.PREFIX}ping     - 𝙲𝚑𝚎𝚌𝚔 𝚕𝚊𝚝𝚎𝚗𝚌𝚢
║ ${config.PREFIX}uptime   - 𝙱𝚘𝚝 𝚞𝚙𝚝𝚒𝚖𝚎
║ ${config.PREFIX}owner    - 𝙱𝚘𝚝 𝚘𝚠𝚗𝚎𝚛
║ ${config.PREFIX}freebot  - 𝙶𝚎𝚝 𝚏𝚛𝚎𝚎 𝚋𝚘𝚝
║ ${config.PREFIX}pair     - 𝙿𝚊𝚒𝚛 𝚗𝚎𝚠 𝚋𝚘𝚝
╠══════════════════════════════════════╣
║           ⚡ 𝙰𝚄𝚃𝙾 𝙵𝙴𝙰𝚃𝚄𝚁𝙴𝚂           ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}autostatus on/off
║ ${config.PREFIX}autolike on/off
║ ${config.PREFIX}autorecord on/off
║ ${config.PREFIX}autobio on/off
║ ${config.PREFIX}mode on/off
╠══════════════════════════════════════╣
║         🎬 𝙼𝙴𝙳𝙸𝙰 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}fb <url>    - 𝙵𝚊𝚌𝚎𝚋𝚘𝚘𝚔
║ ${config.PREFIX}ig <url>    - 𝙸𝚗𝚜𝚝𝚊𝚐𝚛𝚊𝚖
║ ${config.PREFIX}tiktok <url>
║ ${config.PREFIX}ytmp4 <url>
║ ${config.PREFIX}song <query>
╠══════════════════════════════════════╣
║         ✨ 𝚃𝙴𝚇𝚃 𝙼𝙰𝙺𝙴𝚁         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}metallic <text>
║ ${config.PREFIX}ice <text>
║ ${config.PREFIX}snow <text>
║ ${config.PREFIX}neon <text>
║ ${config.PREFIX}fire <text>
╠══════════════════════════════════════╣
║         👑 𝙰𝙳𝙼𝙸𝙽 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}ban @user
║ ${config.PREFIX}promote @user
║ ${config.PREFIX}demote @user
║ ${config.PREFIX}kick @user
║ ${config.PREFIX}mute <minutes>
╠══════════════════════════════════════╣
║         🎮 𝙵𝚄𝙽 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}pies <country>
║ ${config.PREFIX}neko
║ ${config.PREFIX}waifu
║ ${config.PREFIX}tiktokgirl
╠══════════════════════════════════════╣
║         🤖 𝙰𝙸 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}sora <prompt>
║ ${config.PREFIX}flux <prompt>
╠══════════════════════════════════════╣
║         🔧 𝚄𝚃𝙸𝙻𝙸𝚃𝙸𝙴𝚂         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}vv       - 𝚄𝚗𝚕𝚘𝚌𝚔 𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎
║ ${config.PREFIX}removebg - 𝚁𝚎𝚖𝚘𝚟𝚎 𝚋𝚊𝚌𝚔𝚐𝚛𝚘𝚞𝚗𝚍
║ ${config.PREFIX}idch     - 𝙲𝚑𝚊𝚗𝚗𝚎𝚕 𝚒𝚗𝚏𝚘
╚══════════════════════════════════════╝
╔══════════════════════════════════════╗
║         𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳         ║
╚══════════════════════════════════════╝`;

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://files.catbox.moe/90i7j4.png' },
                    caption: menuCaption.trim(),
                    contextInfo: silaContext
                });
                return true;
            }

            case 'ping': {
                const start = Date.now();
                const latency = Date.now() - start;
                await socket.sendMessage(msg.key.remoteJid, { 
                    text: `╔═══════════════════════╗
║   🏓 𝙿𝙸𝙽𝙶   ║
╚═══════════════════════╝

⚡ 𝙻𝚊𝚝𝚎𝚗𝚌𝚢: ${latency}𝚖𝚜
📶 𝙲𝚘𝚗𝚗𝚎𝚌𝚝𝚒𝚘𝚗: ${latency < 500 ? 'Excellent' : latency < 1000 ? 'Good' : 'Poor'}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                    contextInfo: silaContext
                });
                return true;
            }

            case 'uptime': {
                const startTime = require('../pair.js').socketCreationTime.get(number) || Date.now();
                const uptime = Math.floor((Date.now() - startTime) / 1000);
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                const activeSockets = require('../pair.js').activeSockets;

                await socket.sendMessage(msg.key.remoteJid, {
                    text: `╔═══════════════════════╗
║   ⏰ 𝚄𝙿𝚃𝙸𝙼𝙴   ║
╚═══════════════════════╝

⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s
👥 *Active Bots:* ${activeSockets.size}
📱 *Your Number:* ${number}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                    contextInfo: silaContext
                });
                return true;
            }

            case 'owner':
            case 'sc':
            case 'script':
            case 'repo': {
                const ownerInfo = `╔═══════════════════════╗
║   👑 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙾𝚆𝙽𝙴𝚁   ║
╚═══════════════════════╝

📱 *Owner:* 𝚂𝙸𝙻𝙰 𝙼𝙳
🔢 *Number:* +255612491554
🔗 *Bot Link:* https://sila-md-mini-bot.onrender.com

💬 *Support Group:*
https://chat.whatsapp.com/C03aOCLQeRUH821jWqRPC6

📢 *Channel:*
https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28

🎁 *Get Free Bot:*
Use ${config.PREFIX}freebot

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://files.catbox.moe/4gca2n.png' },
                    caption: ownerInfo,
                    contextInfo: silaContext
                });
                return true;
            }

            case 'freebot': {
                const freebotInfo = `╔═══════════════════════╗
║   🎁 𝙵𝚁𝙴𝙴 𝙱𝙾𝚃 𝙻𝙸𝙽𝙺   ║
╚═══════════════════════╝

🔗 *Bot Link:* https://sila-md-mini-bot.onrender.com

📋 *How to Get Your Free Bot:*

1. 👉 Visit: https://sila-md-mini-bot.onrender.com
2. 📱 Enter your WhatsApp number
3. 🔐 Get pairing code
4. 📲 Use code in WhatsApp
5. ✅ Your bot is ready!

🌟 *Features Included:*
• Media Downloader
• Auto Status Viewer
• Text Maker
• AI Tools
• Admin Commands
• And much more!

💬 *Support Group:* https://chat.whatsapp.com/C03aOCLQeRUH821jWqRPC6
📢 *Channel:* https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://files.catbox.moe/90i7j4.png' },
                    caption: freebotInfo,
                    contextInfo: silaContext
                });
                return true;
            }

            case 'pair': {
                const phoneNumber = args[0];
                if (!phoneNumber) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `╔═══════════════════════╗
║   🔗 𝙿𝙰𝙸𝚁 𝙱𝙾𝚃   ║
╚═══════════════════════╝

*Usage:* ${config.PREFIX}pair <number>

*Example:*
${config.PREFIX}pair 255612491554

*Instructions:*
1. Visit: https://sila-md-mini-bot.onrender.com
2. Enter your number
3. Get pairing code
4. Use code in WhatsApp

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                try {
                    const axios = require('axios');
                    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                    
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: '🔄 Please wait... pairing in progress.',
                        contextInfo: silaContext
                    });

                    const response = await axios.get(`https://sila-md-mini-bot.onrender.com/code?number=${cleanNumber}`);
                    const pairCode = response.data.code;

                    if (!pairCode) {
                        throw new Error('No pairing code received from server.');
                    }

                    await socket.sendMessage(msg.key.remoteJid, {
                        image: { url: 'https://files.catbox.moe/90i7j4.png' },
                        caption: `╔═══════════════════════╗
║   ✅ 𝙿𝙰𝙸𝚁𝙸𝙽𝙶 𝙲𝙾𝙼𝙿𝙻𝙴𝚃𝙴!   ║
╚═══════════════════════╝

📱 *Number:* +${cleanNumber}
🔐 *Pairing Code:* ${pairCode}

*How to Use:*
1. Open WhatsApp
2. Go to Linked Devices
3. Enter this code: ${pairCode}
4. Your bot will be ready!

*Bot Link:* https://sila-md-mini-bot.onrender.com

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`
                    });

                    // Send code separately for easy copying
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `📋 *Copy this code:*\n${pairCode}`
                    });

                } catch (error) {
                    console.error('Error in pair command:', error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `╔═══════════════════════╗
║   ❌ 𝙿𝙰𝙸𝚁𝙸𝙽𝙶 𝙵𝙰𝙸𝙻𝙴𝙳   ║
╚═══════════════════════╝

Failed to generate pairing code.

*Error:* ${error.message}

*Alternative Method:*
1. Go to: https://sila-md-mini-bot.onrender.com
2. Enter your number directly
3. Get pairing code from website

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'settings':
            case 'setting':
            case 'set':
            case 'config': {
                const viewStatus = userConfig.AUTO_VIEW_STATUS === 'true' ? 'on' : 'off';
                const likeStatus = userConfig.AUTO_LIKE_STATUS === 'true' ? 'on' : 'off';
                const records = userConfig.AUTO_RECORDING === 'true' ? 'on' : 'off';
                const bioStatus = userConfig.AUTO_BIO === 'true' ? 'on' : 'off';
                const modeStatus = userConfig.BOT_MODE === true ? 'on' : 'off';

                const configCaption = `╔═══════════════════════╗
║   ⚙️ 𝙱𝙾𝚃 𝚂𝙴𝚃𝚃𝙸𝙽𝙶𝚂   ║
╚═══════════════════════╝

💬 *Prefix:* ${config.PREFIX}
👁 *Auto View Status:* ${viewStatus}
❤️ *Auto Like:* ${likeStatus}
🎙 *Auto Record:* ${records}
📝 *Auto Bio:* ${bioStatus}
🔒 *Private Mode:* ${modeStatus}

Use the commands below to toggle features:

${config.PREFIX}autostatus on/off
${config.PREFIX}autolike on/off
${config.PREFIX}autorecord on/off
${config.PREFIX}autobio on/off
${config.PREFIX}mode on/off

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://files.catbox.moe/90i7j4.png' },
                    caption: configCaption.trim(),
                    contextInfo: silaContext
                });
                return true;
            }

            case 'autostatus': {
                const input = args[0]?.toLowerCase();
                if (!input || !['on', 'off'].includes(input)) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `⚙️ Usage: *autostatus on* or *autostatus off*`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (input === 'on') {
                    userConfig.AUTO_VIEW_STATUS = 'true';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `✅✔️ Auto Status turned *ON!*\n> Now bot will begin to view statuses 👀`,
                        contextInfo: silaContext
                    });
                } else {
                    userConfig.AUTO_VIEW_STATUS = 'false';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Auto Status turned *OFF!*\n> Bot will stop viewing statuses.`,
                        contextInfo: silaContext
                    });
                }
                
                // Update config
                const { updateUserConfig } = require('../pair.js');
                await updateUserConfig(number, userConfig);
                return true;
            }

            case 'autolike': {
                const input = args[0]?.toLowerCase();
                if (!input || !['on', 'off'].includes(input)) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `⚙️ Usage: *autolike on* or *autolike off*`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (input === 'on') {
                    userConfig.AUTO_LIKE_STATUS = 'true';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `✅✔️ Auto Like turned *ON!*\n> Bot will begin to like statuses ❤️`,
                        contextInfo: silaContext
                    });
                } else {
                    userConfig.AUTO_LIKE_STATUS = 'false';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Auto Like turned *OFF!*\n> Bot will stop liking statuses.`,
                        contextInfo: silaContext
                    });
                }
                
                const { updateUserConfig } = require('../pair.js');
                await updateUserConfig(number, userConfig);
                return true;
            }

            case 'autorecord': {
                const input = args[0]?.toLowerCase();
                if (!input || !['on', 'off'].includes(input)) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `⚙️ Usage: *autorecord on* or *autorecord off*`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (input === 'on') {
                    userConfig.AUTO_RECORDING = 'true';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `✅✔️ Auto Recording turned *ON!*\n> Bot will now start auto recording simulation 🎙️`,
                        contextInfo: silaContext
                    });
                } else {
                    userConfig.AUTO_RECORDING = 'false';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Auto Recording turned *OFF!*\n> Bot will stop simulating voice recording.`,
                        contextInfo: silaContext
                    });
                }
                
                const { updateUserConfig } = require('../pair.js');
                await updateUserConfig(number, userConfig);
                return true;
            }

            case 'autobio': {
                const input = args[0]?.toLowerCase();
                if (!input || !['on', 'off'].includes(input)) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `⚙️ Usage: *autobio on* or *autobio off*`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (input === 'on') {
                    userConfig.AUTO_BIO = 'true';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `✅✔️ Auto Bio turned *ON!*\n> Bot will now automatically update bio 📝`,
                        contextInfo: silaContext
                    });
                } else {
                    userConfig.AUTO_BIO = 'false';
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Auto Bio turned *OFF!*\n> Bot will stop auto updating bio.`,
                        contextInfo: silaContext
                    });
                }
                
                const { updateUserConfig } = require('../pair.js');
                await updateUserConfig(number, userConfig);
                return true;
            }

            case 'mode': {
                const input = args[0]?.toLowerCase();
                if (!input || !['on', 'off'].includes(input)) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `⚙️ Usage: *mode on* or *mode off*\n\nWhen ON, only the bot owner can use commands.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (input === 'on') {
                    userConfig.BOT_MODE = true;
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: '✅ *Private Mode Activated!* Only you can use the bot now.',
                        contextInfo: silaContext
                    });
                } else {
                    userConfig.BOT_MODE = false;
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: '🔓 *Private Mode Disabled!* Everyone can use the bot now.\nNow other people can use your bot.',
                        contextInfo: silaContext
                    });
                }
                
                const { updateUserConfig } = require('../pair.js');
                await updateUserConfig(number, userConfig);
                return true;
            }
        }

        return false;
    }
};
