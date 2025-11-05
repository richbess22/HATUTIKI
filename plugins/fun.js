const axios = require('axios');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        // Pies commands
        const piesCommands = {
            'pies': 'random',
            'china': 'china',
            'indonesia': 'indonesia', 
            'japan': 'japan',
            'korea': 'korea',
            'hijab': 'hijab'
        };

        if (piesCommands[command]) {
            const country = piesCommands[command];
            
            try {
                const apiUrl = `https://shizoapi.onrender.com/api/pies/${country}?apikey=shizo`;
                const response = await axios.get(apiUrl);
                
                if (response.data && response.data.url) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        image: { url: response.data.url },
                        caption: `╔═══════════════════════╗
║   🥧 ${country.toUpperCase()} 𝙿𝙸𝙴𝚂   ║
╚═══════════════════════╝

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                } else {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ No pies image found for ${country}`,
                        contextInfo: silaContext
                    });
                }
            } catch (error) {
                console.error('Pies API error:', error);
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `❌ Error fetching pies image: ${error.message}`,
                    contextInfo: silaContext
                });
            }
            return true;
        }

        // Anime commands
        const animeCommands = {
            'neko': 'https://api.waifu.pics/sfw/neko',
            'waifu': 'https://api.waifu.pics/sfw/waifu', 
            'loli': 'https://api.waifu.pics/sfw/waifu',
            'nom': 'https://api.waifu.pics/sfw/neko',
            'poke': 'https://api.waifu.pics/sfw/neko',
            'cry': 'https://api.waifu.pics/sfw/cry',
            'kiss': 'https://api.waifu.pics/sfw/kiss',
            'pat': 'https://api.waifu.pics/sfw/pat',
            'hug': 'https://api.waifu.pics/sfw/hug',
            'wink': 'https://api.waifu.pics/sfw/wink',
            'facepalm': 'https://api.waifu.pics/sfw/facepalm'
        };

        if (animeCommands[command]) {
            try {
                const response = await axios.get(animeCommands[command]);
                const imageUrl = response.data.url;

                const captions = {
                    'neko': '🐱 𝙽𝚎𝚔𝚘 𝙶𝚒𝚛𝚕',
                    'waifu': '👩 𝚆𝚊𝚒𝚏𝚞',
                    'loli': '👧 𝙻𝚘𝚕𝚒',
                    'nom': '😋 𝙽𝚘𝚖 𝙽𝚘𝚖',
                    'poke': '👉 𝙿𝚘𝚔𝚎',
                    'cry': '😢 𝙲𝚛𝚢𝚒𝚗𝚐',
                    'kiss': '💋 𝙺𝚒𝚜𝚜',
                    'pat': '👋 𝙿𝚊𝚝',
                    'hug': '🤗 𝙷𝚞𝚐', 
                    'wink': '😉 𝚆𝚒𝚗𝚔',
                    'facepalm': '🤦 𝙵𝚊𝚌𝚎𝚙𝚊𝚕𝚖'
                };

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: imageUrl },
                    caption: `╔═══════════════════════╗
║   ${captions[command]}   ║
╚═══════════════════════╝

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                    contextInfo: silaContext
                });

            } catch (error) {
                console.error('Anime API error:', error);
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `❌ Error fetching ${command} image`,
                    contextInfo: silaContext
                });
            }
            return true;
        }

        // Tiktok Girl command
        if (command === 'tiktokgirl') {
            const tiktokGirls = [
                {"url": "https://telegra.ph/file/09e2f3d9c01b2305784fa.mp4"},
                {"url": "https://l.top4top.io/m_196632pm21.mp4"},
                {"url": "https://telegra.ph/file/1a5a5b5b5b5b5b5b5b5b5.mp4"},
                {"url": "https://l.top4top.io/m_2890asd921.mp4"},
                {"url": "https://telegra.ph/file/3c3c3c3c3c3c3c3c3c3c.mp4"}
            ];

            try {
                const randomGirl = tiktokGirls[Math.floor(Math.random() * tiktokGirls.length)];
                
                await socket.sendMessage(msg.key.remoteJid, {
                    video: { url: randomGirl.url },
                    caption: `╔═══════════════════════╗
║   💃 𝚃𝙸𝙺𝚃𝙾𝙺 𝙶𝙸𝚁𝙻   ║
╚═══════════════════════╝

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                    contextInfo: silaContext
                });

            } catch (error) {
                console.error('Tiktok Girl error:', error);
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `❌ Error fetching tiktok girl video`,
                    contextInfo: silaContext
                });
            }
            return true;
        }

        return false;
    }
};
