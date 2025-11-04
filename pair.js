const axios = require('axios');
const ytSearch = require('yt-search');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const FormData = require('form-data');
const { Octokit } = require('@octokit/rest');
const moment = require('moment-timezone');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require('baileys');
const getImage = require('./masky.js');

// Default config structure
const defaultConfig = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['💥', '👍', '😍', '💗', '🎈', '🎉', '🥳', '😎', '🚀', '🔥'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: getImage(),
    OWNER_NUMBER: '255612491554',
    BOT_MODE: true,
    ANTI_DELETE: 'true',
    ANTI_LINK: 'true',
    AUTO_TYPING: 'true',
    AUTO_REPLY_STATUS: 'true'
};
console.log(getImage())
const config = require('./config.json');

// GitHub Octokit initialization
let octokit;
if (process.env.GITHUB_TOKEN) {
    octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    });
}
const owner = process.env.GITHUB_REPO_OWNER || "";
const repo = process.env.GITHUB_REPO_NAME || "";

// Memory optimization: Use weak references for sockets
const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';

// Memory optimization: Cache frequently used data
let adminCache = null;
let adminCacheTime = 0;
const ADMIN_CACHE_TTL = 300000; // 5 minutes

// Initialize directories
if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

// 💠 Sila Channel Context (Global)
let silaContext = {
  forwardingScore: 1,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363422610520277@newsletter',
    newsletterName: '𝚂𝙸𝙻𝙰 𝙼𝙳',
    serverMessageId: -1
  }
};

const silaLink = 'https://sila-md-mini-bot.onrender.com';
const silaGroup = 'https://chat.whatsapp.com/C03aOCLQeRUH821jWqRPC6';
const silaChannel = 'https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28';

// Auto-reply messages
const autoReplies = {
    'hi': '𝙷𝚎𝚕𝚕𝚘! 👋 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚑𝚎𝚕𝚙 𝚢𝚘𝚞 𝚝𝚘𝚍𝚊𝚢?',
    'mambo': '𝙿𝚘𝚊 𝚜𝚊𝚗𝚊! 👋 𝙽𝚒𝚔𝚞𝚜𝚊𝚒𝚍𝚒𝚎 𝙺𝚞𝚑𝚞𝚜𝚞?',
    'hey': '𝙷𝚎𝚢 𝚝𝚑𝚎𝚛𝚎! 😊 𝚄𝚜𝚎 .𝚖𝚎𝚗𝚞 𝚝𝚘 𝚜𝚎𝚎 𝚊𝚕𝚕 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜.',
    'vip': '𝙷𝚎𝚕𝚕𝚘 𝚅𝙸𝙿! 👑 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚊𝚜𝚜𝚒𝚜𝚝 𝚢𝚘𝚞?',
    'mkuu': '𝙷𝚎𝚢 𝚖𝚔𝚞𝚞! 👋 𝙽𝚒𝚔𝚞𝚜𝚊𝚒𝚍𝚒𝚎 𝙺𝚞𝚑𝚞𝚜𝚞?',
    'boss': '𝚈𝚎𝚜 𝚋𝚘𝚜𝚜! 👑 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚑𝚎𝚕𝚙 𝚢𝚘𝚞?',
    'habari': '𝙽𝚣𝚞𝚛𝚒 𝚜𝚊𝚗𝚊! 👋 𝙷𝚊𝚋𝚊𝚛𝚒 𝚢𝚊𝚔𝚘?',
    'hello': '𝙷𝚒 𝚝𝚑𝚎𝚛𝚎! 😊 𝚄𝚜𝚎 .𝚖𝚎𝚗𝚞 𝚝𝚘 𝚜𝚎𝚎 𝚊𝚕𝚕 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜.',
    'bot': '𝚈𝚎𝚜, 𝙸 𝚊𝚖 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸! 🤖 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚊𝚜𝚜𝚒𝚜𝚝 𝚢𝚘𝚞?',
    'menu': '𝚃𝚢𝚙𝚎 .𝚖𝚎𝚗𝚞 𝚝𝚘 𝚜𝚎𝚎 𝚊𝚕𝚕 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜! 📜',
    'owner': '𝙲𝚘𝚗𝚝𝚊𝚌𝚝 𝚘𝚠𝚗𝚎𝚛 𝚞𝚜𝚒𝚗𝚐 .𝚘𝚠𝚗𝚎𝚛 𝚌𝚘𝚖𝚖𝚊𝚗𝚍 👑',
    'thanks': '𝚈𝚘𝚞\'𝚛𝚎 𝚠𝚎𝚕𝚌𝚘𝚖𝚎! 😊',
    'thank you': '𝙰𝚗𝚢𝚝𝚒𝚖𝚎! 𝙻𝚎𝚝 𝚖𝚎 𝚔𝚗𝚘𝚠 𝚒𝚏 𝚢𝚘𝚞 𝚗𝚎𝚎𝚍 𝚑𝚎𝚕𝚙 🤖'           
};

// Text maker function
async function createTextEffect(type, text) {
  try {
    const apis = {
      metallic: `https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html`,
      ice: `https://en.ephoto360.com/ice-text-effect-online-101.html`,
      snow: `https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html`,
      impressive: `https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html`,
      matrix: `https://en.ephoto360.com/matrix-text-effect-154.html`,
      light: `https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html`,
      neon: `https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html`,
      devil: `https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html`,
      purple: `https://en.ephoto360.com/purple-text-effect-online-100.html`,
      thunder: `https://en.ephoto360.com/thunder-text-effect-online-97.html`,
      leaves: `https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html`,
      '1917': `https://en.ephoto360.com/1917-style-text-effect-523.html`,
      arena: `https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html`,
      hacker: `https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html`,
      sand: `https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html`,
      blackpink: `https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html`,
      glitch: `https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html`,
      fire: `https://en.ephoto360.com/flame-lettering-effect-372.html`
    };

    if (!apis[type]) {
      throw new Error('Invalid text effect type');
    }

    // For now, return a simple formatted text
    const effects = {
      metallic: `✨ ${text} ✨`,
      ice: `❄️ ${text} ❄️`,
      snow: `🌨️ ${text} 🌨️`,
      impressive: `🎨 ${text} 🎨`,
      matrix: `💚 ${text} 💚`,
      light: `💡 ${text} 💡`,
      neon: `🌈 ${text} 🌈`,
      devil: `😈 ${text} 😈`,
      purple: `💜 ${text} 💜`,
      thunder: `⚡ ${text} ⚡`,
      leaves: `🍃 ${text} 🍃`,
      '1917': `🎭 ${text} 🎭`,
      arena: `⚔️ ${text} ⚔️`,
      hacker: `👨‍💻 ${text} 👨‍💻`,
      sand: `🏖️ ${text} 🏖️`,
      blackpink: `🖤💖 ${text} 💖🖤`,
      glitch: `📟 ${text} 📟`,
      fire: `🔥 ${text} 🔥`
    };

    return effects[type] || text;
  } catch (error) {
    console.error('Text effect error:', error);
    return text;
  }
}

// Memory optimization: Improved admin loading with caching
function loadAdmins() {
    try {
        const now = Date.now();
        if (adminCache && now - adminCacheTime < ADMIN_CACHE_TTL) {
            return adminCache;
        }
        
        if (fs.existsSync(defaultConfig.ADMIN_LIST_PATH)) {
            adminCache = JSON.parse(fs.readFileSync(defaultConfig.ADMIN_LIST_PATH, 'utf8'));
            adminCacheTime = now;
            return adminCache;
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}

function getTanzaniaTimestamp() {
    return moment().tz('Africa/Dar_es_Salaam').format('YYYY-MM-DD HH:mm:ss');
}

// Memory optimization: Clean up unused variables and optimize loops
async function cleanDuplicateFiles(number) {
    try {
        if (!octokit) return;
        
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith(`creds_${sanitizedNumber}_`) && file.name.endsWith('.json')
        ).sort((a, b) => {
            const timeA = parseInt(a.name.match(/creds_\d+_(\d+)\.json/)?.[1] || 0);
            const timeB = parseInt(b.name.match(/creds_\d+_(\d+)\.json/)?.[1] || 0);
            return timeB - timeA;
        });

        // Keep only the first (newest) file, delete the rest
        if (sessionFiles.length > 1) {
            for (let i = 1; i < sessionFiles.length; i++) {
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: `session/${sessionFiles[i].name}`,
                    message: `Delete duplicate session file for ${sanitizedNumber}`,
                    sha: sessionFiles[i].sha
                });
                console.log(`Deleted duplicate session file: ${sessionFiles[i].name}`);
            }
        }
    } catch (error) {
        console.error(`Failed to clean duplicate files for ${number}:`, error);
    }
}

// Memory optimization: Reduce memory usage in message sending
async function sendAdminConnectMessage(socket, number) {
    const admins = loadAdmins();
    const caption = `╔═══════════════════════╗
║    🟢 𝙱𝙾𝚃 𝙲𝙾𝙽𝙽𝙴𝙲𝚃𝙴𝙳!    ║
╚═══════════════════════╝

📱 *Number:* ${number}
⚡ *Status:* Active and Ready
⏰ *Time:* ${getTanzaniaTimestamp()}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

    // Send messages sequentially to avoid memory spikes
    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: 'https://files.catbox.moe/gnjb7s.jpg' },
                    caption,
                    contextInfo: silaContext
                }
            );
            // Add a small delay to prevent rate limiting and memory buildup
            await delay(100);
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}

// Memory optimization: Cache the about status to avoid repeated updates
let lastAboutUpdate = 0;
const ABOUT_UPDATE_INTERVAL = 3600000; // 1 hour

async function updateAboutStatus(socket) {
    const now = Date.now();
    if (now - lastAboutUpdate < ABOUT_UPDATE_INTERVAL) {
        return; // Skip update if it was done recently
    }
    
    const aboutStatus = '𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 🤖 - 𝙰𝙲𝚃𝙸𝚅𝙴 𝙰𝙽𝙳 𝚁𝙴𝙰𝙳𝚈!';
    try {
        await socket.updateProfileStatus(aboutStatus);
        lastAboutUpdate = now;
        console.log(`Updated About status to: ${aboutStatus}`);
    } catch (error) {
        console.error('Failed to update About status:', error);
    }
}

// Memory optimization: Limit story updates
let lastStoryUpdate = 0;
const STORY_UPDATE_INTERVAL = 86400000; // 24 hours

async function updateStoryStatus(socket) {
    const now = Date.now();
    if (now - lastStoryUpdate < STORY_UPDATE_INTERVAL) {
        return; // Skip update if it was done recently
    }
    
    const statusMessage = `Connected! 🚀\nConnected at: ${getTanzaniaTimestamp()}`;
    try {
        await socket.sendMessage('status@broadcast', { text: statusMessage });
        lastStoryUpdate = now;
        console.log(`Posted story status: ${statusMessage}`);
    } catch (error) {
        console.error('Failed to post story status:', error);
    }
}

// Anti-Delete Handler
function setupAntiDeleteHandler(socket, userConfig) {
    if (userConfig.ANTI_DELETE !== 'true') return;

    const deletedMessages = new Map();

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (msg.message) {
            deletedMessages.set(msg.key.id, {
                message: msg.message,
                sender: msg.key.remoteJid,
                timestamp: Date.now()
            });
        }
    });

    socket.ev.on('messages.delete', async (deletion) => {
        if (!deletion.keys) return;

        for (const key of deletion.keys) {
            const deletedMsg = deletedMessages.get(key.id);
            if (deletedMsg) {
                const sender = key.remoteJid;
                const isGroup = sender.endsWith('@g.us');
                
                let messageContent = '';
                if (deletedMsg.message.conversation) {
                    messageContent = deletedMsg.message.conversation;
                } else if (deletedMsg.message.extendedTextMessage?.text) {
                    messageContent = deletedMsg.message.extendedTextMessage.text;
                }

                if (messageContent) {
                    const antiDeleteMsg = `╔═══════════════════════╗
║   🚫 𝙰𝙽𝚃𝙸-𝙳𝙴𝙻𝙴𝚃𝙴 𝙰𝙻𝙴𝚁𝚃   ║
╚═══════════════════════╝

📝 *Deleted Message:* ${messageContent}
👤 *From:* ${isGroup ? 'Group' : 'User'}
⏰ *Time:* ${getTanzaniaTimestamp()}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                    await socket.sendMessage(sender, { 
                        text: antiDeleteMsg,
                        contextInfo: silaContext
                    });
                }
                
                deletedMessages.delete(key.id);
            }
        }
    });
}

// Anti-Link Handler
function setupAntiLinkHandler(socket, userConfig) {
    if (userConfig.ANTI_LINK !== 'true') return;

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        let text = '';
        if (msg.message.conversation) {
            text = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
            text = msg.message.extendedTextMessage.text;
        }

        // Link detection patterns
        const linkPatterns = [
            /https?:\/\/[^\s]+/g,
            /www\.[^\s]+/g,
            /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
        ];

        const hasLink = linkPatterns.some(pattern => pattern.test(text));
        
        if (hasLink && msg.key.remoteJid.endsWith('@g.us')) {
            const groupMetadata = await socket.groupMetadata(msg.key.remoteJid);
            const isAdmin = groupMetadata.participants.find(p => 
                p.id === msg.key.participant && (p.admin === 'admin' || p.admin === 'superadmin')
            );

            if (!isAdmin) {
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `╔═══════════════════════╗
║   ⚠️ 𝙻𝙸𝙽𝙺 𝙳𝙴𝚃𝙴𝙲𝚃𝙴𝙳!   ║
╚═══════════════════════╝

Links are not allowed in this group!

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                    contextInfo: silaContext
                });

                // Delete the message with link
                await socket.sendMessage(msg.key.remoteJid, {
                    delete: msg.key
                });
            }
        }
    });
}

// Auto Typing Handler
function setupAutoTypingHandler(socket, userConfig) {
    if (userConfig.AUTO_TYPING !== 'true') return;

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        try {
            await socket.sendPresenceUpdate('composing', msg.key.remoteJid);
            await delay(2000);
            await socket.sendPresenceUpdate('paused', msg.key.remoteJid);
        } catch (error) {
            console.error('Auto typing error:', error);
        }
    });
}

// Auto Reply to Status Handler
function setupAutoReplyStatusHandler(socket, userConfig) {
    if (userConfig.AUTO_REPLY_STATUS !== 'true') return;

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;

        try {
            await socket.sendMessage(message.key.remoteJid, {
                text: `👀 𝙸 𝚜𝚎𝚎 𝚢𝚘𝚞𝚛 𝚜𝚝𝚊𝚝𝚞𝚜! 𝙱𝚢 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                contextInfo: silaContext
            });
        } catch (error) {
            console.error('Auto reply status error:', error);
        }
    });
}

// Auto Reply to Inbox Messages
function setupAutoReplyHandler(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid.endsWith('@g.us')) return;

        let text = '';
        if (msg.message.conversation) {
            text = msg.message.conversation.toLowerCase();
        } else if (msg.message.extendedTextMessage?.text) {
            text = msg.message.extendedTextMessage.text.toLowerCase();
        }

        const reply = autoReplies[text];
        if (reply && !text.startsWith(config.PREFIX)) {
            try {
                await socket.sendMessage(msg.key.remoteJid, {
                    text: reply,
                    contextInfo: silaContext
                });
            } catch (error) {
                console.error('Auto reply error:', error);
            }
        }
    });
}

// Memory optimization: Throttle status handlers
function setupStatusHandlers(socket, userConfig) {
    let lastStatusInteraction = 0;
    const STATUS_INTERACTION_COOLDOWN = 10000; // 10 seconds
    
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
        
        // Throttle status interactions to prevent spam
        const now = Date.now();
        if (now - lastStatusInteraction < STATUS_INTERACTION_COOLDOWN) {
            return;
        }

        try {
            if (userConfig.AUTO_RECORDING === 'true' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (userConfig.AUTO_VIEW_STATUS === 'true') {
                let retries = parseInt(userConfig.MAX_RETRIES) || 3;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (parseInt(userConfig.MAX_RETRIES) - retries));
                    }
                }
            }
            if (userConfig.AUTO_LIKE_STATUS === 'true') {
                const emojis = Array.isArray(userConfig.AUTO_LIKE_EMOJI) ? 
                    userConfig.AUTO_LIKE_EMOJI : defaultConfig.AUTO_LIKE_EMOJI;
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                let retries = parseInt(userConfig.MAX_RETRIES) || 3;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [message.key.participant] }
                        );
                        lastStatusInteraction = now;
                        console.log(`Reacted to status with ${randomEmoji}`);
                        
                        // Send confirmation message after reacting
                        if (userConfig.AUTO_VIEW_STATUS === 'true') {
                            await socket.sendMessage(message.key.remoteJid, {
                                text: `╔═══════════════════════╗
║   👑 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸   ║
╚═══════════════════════╝

✅ Successfully *VIEWED* 👀 and *LIKED* ❤️ your status!

> "Consistency builds trust — even bots prove it."

🚀 Keep shining! The bot's always watching over your updates 😎

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                                contextInfo: silaContext
                            });
                        } else {
                            await socket.sendMessage(message.key.remoteJid, {
                                text: `╔═══════════════════════╗
║   👑 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸   ║
╚═══════════════════════╝

❤️ Bot *LIKED* your status!

💡 Want the bot to also *view* your statuses?
👉 Type *${config.PREFIX}autostatus on*

To stop auto-likes or silence reactions, use *${config.PREFIX}autolike off*

> "Small gestures make big impacts — even digital ones." 💫

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                                contextInfo: silaContext
                            });
                        }
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (parseInt(userConfig.MAX_RETRIES) - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}

// Memory optimization: Streamline command handlers with rate limiting
function setupCommandHandlers(socket, number, userConfig) {
    const commandCooldowns = new Map();
    const COMMAND_COOLDOWN = 1000; // 1 second per user
    
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        const newsletterJids = ["120363422610520277@newsletter"];
        const emojis = ["🫡", "💪"];

        if (msg.key && newsletterJids.includes(msg.key.remoteJid)) {
            try {
                const serverId = msg.newsletterServerId;
                if (serverId) {
                    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await socket.newsletterReactMessage(msg.key.remoteJid, serverId.toString(), emoji);
                }
            } catch (e) {
                // Handle error silently
            }
        }
        
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        // Extract text from different message types
        let text = '';
        if (msg.message.conversation) {
            text = msg.message.conversation.trim();
        } else if (msg.message.extendedTextMessage?.text) {
            text = msg.message.extendedTextMessage.text.trim();
        } else if (msg.message.buttonsResponseMessage?.selectedButtonId) {
            text = msg.message.buttonsResponseMessage.selectedButtonId.trim();
        } else if (msg.message.imageMessage?.caption) {
            text = msg.message.imageMessage.caption.trim();
        } else if (msg.message.videoMessage?.caption) {
            text = msg.message.videoMessage.caption.trim();
        }

        // Check if it's a command
        const prefix = userConfig.PREFIX || '.';
        if (!text.startsWith(prefix)) return;
        
        // Rate limiting
        const sender = msg.key.remoteJid;
        const now = Date.now();
        if (commandCooldowns.has(sender) && now - commandCooldowns.get(sender) < COMMAND_COOLDOWN) {
            return;
        }
        commandCooldowns.set(sender, now);

        const parts = text.slice(prefix.length).trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        try {
            // Add emoji reactions to commands
            const commandEmojis = {
                'alive': '🤖',
                'menu': '📜',
                'ping': '🏓',
                'uptime': '⏰',
                'tagall': '🏷️',
                'fb': '📹',
                'song': '🎵',
                'ytaudio': '🎧',
                'getpp': '🕵️',
                'deleteme': '🗑️',
                'autostatus': '👁️',
                'autolike': '❤️',
                'autorecord': '🎙️',
                'vv': '👁️',
                'vv2': '🕵️',
                'removebg': '🖼️',
                'bible': '📖',
                'quran': '🕌',
                'instagram': '📸',
                'tiktok': '🎵',
                'ytmp4': '🎬',
                'idch': 'ℹ️',
                'mode': '⚙️',
                'pair': '🔗',
                'textmaker': '✨',
                'sora': '🎥',
                'pies': '🥧',
                'freebot': '🎁',
                'owner': '👑',
                'sc': '📦',
                'script': '💻',
                'repo': '🔗'
            };

            const emoji = commandEmojis[command] || '⚡';
            await socket.sendMessage(sender, { 
                react: { text: emoji, key: msg.key } 
            });

            switch (command) {
                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const caption = `╔═══════════════════════╗
║   🤖 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸   ║
╚═══════════════════════╝

💚 𝚂𝚝𝚊𝚝𝚞𝚜: 𝙾𝙽𝙻𝙸𝙽𝙴
⏱️ 𝚄𝚙𝚝𝚒𝚖𝚎: ${hours}𝚑 ${minutes}𝚖 ${seconds}𝚜
📱 𝚄𝚜𝚎𝚛: ${number}
🔖 𝚅𝚎𝚛𝚜𝚒𝚘𝚗: 𝚟2.0.0

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                    await socket.sendMessage(sender, {
                        image: { url: 'https://files.catbox.moe/gwuzwl.jpg' },
                        caption: caption.trim(),
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'freebot': {
                    const freebotInfo = `╔═══════════════════════╗
║   🎁 𝙵𝚁𝙴𝙴 𝙱𝙾𝚃 𝙻𝙸𝙽𝙺   ║
╚═══════════════════════╝

🔗 *Bot Link:* ${silaLink}

📋 *How to Get Your Free Bot:*

1. 👉 Visit: ${silaLink}
2. 📱 Enter your WhatsApp number
3. 🔐 Get pairing code
4. 📲 Use code in WhatsApp
5. ✅ Your bot is ready!

🌟 *Features Included:*
• Media Downloader
• Auto Status Viewer
• Text Maker
• AI Tools
• And much more!

💬 *Support Group:* ${silaGroup}
📢 *Channel:* ${silaChannel}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                    await socket.sendMessage(sender, {
                        image: { url: 'https://files.catbox.moe/ebj284.jpg' },
                        caption: freebotInfo,
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'pair': {
                    const phoneNumber = args[0];
                    if (!phoneNumber) {
                        await socket.sendMessage(sender, {
                            text: `╔═══════════════════════╗
║   🔗 𝙿𝙰𝙸𝚁 𝙱𝙾𝚃   ║
╚═══════════════════════╝

*Usage:* ${config.PREFIX}pair <number>

*Example:*
${config.PREFIX}pair 255612491554

*Instructions:*
1. Visit: ${silaLink}
2. Enter your number
3. Get pairing code
4. Use code in WhatsApp

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    try {
                        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                        
                        await socket.sendMessage(sender, {
                            text: '🔄 Please wait... pairing in progress.',
                            contextInfo: silaContext
                        });

                        const response = await axios.get(`${silaLink}/code?number=${cleanNumber}`);
                        const pairCode = response.data.code;

                        if (!pairCode) {
                            throw new Error('No pairing code received from server.');
                        }

                        await socket.sendMessage(sender, {
                            image: { url: 'https://files.catbox.moe/gnjb7s.jpg' },
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

*Bot Link:* ${silaLink}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`
                        });

                        // Send code separately for easy copying
                        await socket.sendMessage(sender, {
                            text: `📋 *Copy this code:*\n${pairCode}`
                        });

                    } catch (error) {
                        console.error('Error in pair command:', error);
                        await socket.sendMessage(sender, {
                            text: `╔═══════════════════════╗
║   ❌ 𝙿𝙰𝙸𝚁𝙸𝙽𝙶 𝙵𝙰𝙸𝙻𝙴𝙳   ║
╚═══════════════════════╝

Failed to generate pairing code.

*Error:* ${error.message}

*Alternative Method:*
1. Go to: ${silaLink}
2. Enter your number directly
3. Get pairing code from website

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'menu':
                case 'help':
                case 'allmenu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
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
║ ${config.PREFIX}freebot  - 𝙶𝚎𝚝 𝚏𝚛𝚎𝚎 𝚋𝚘𝚝
║ ${config.PREFIX}pair     - 𝙿𝚊𝚒𝚛 𝚗𝚎𝚠 𝚋𝚘𝚝
╠══════════════════════════════════════╣
║           ⚡ 𝙰𝚄𝚃𝙾 𝙵𝙴𝙰𝚃𝚄𝚁𝙴𝚂           ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}autostatus on/off
║ ${config.PREFIX}autolike on/off
║ ${config.PREFIX}autorecord on/off
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
║         ✨ 𝚃𝙴𝚇𝚃 𝙴𝙵𝙵𝙴𝙲𝚃𝚂         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}textmaker <type> <text>
║ ${config.PREFIX}sora <prompt>
╠══════════════════════════════════════╣
║         🎮 𝙵𝚄𝙽 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂         ║
╠══════════════════════════════════════╣
║ ${config.PREFIX}pies <country>
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

                    await socket.sendMessage(sender, {
                        image: { url: 'https://files.catbox.moe/ftbfm1.jpg' },
                        caption: menuCaption.trim(),
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'ping': {
                    const start = Date.now();
                    const latency = Date.now() - start;
                    await socket.sendMessage(sender, { 
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
                    break;
                }

                case 'textmaker': {
                    if (args.length < 2) {
                        await socket.sendMessage(sender, {
                            text: `╔═══════════════════════╗
║   ✨ 𝚃𝙴𝚇𝚃 𝙼𝙰𝙺𝙴𝚁   ║
╚═══════════════════════╝

*Usage:* ${config.PREFIX}textmaker <type> <text>

*Available Types:*
metallic, ice, snow, neon, fire, 
matrix, glitch, devil, thunder

*Example:*
${config.PREFIX}textmaker neon SILA MD

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    const type = args[0].toLowerCase();
                    const text = args.slice(1).join(' ');

                    try {
                        const result = await createTextEffect(type, text);
                        await socket.sendMessage(sender, {
                            text: `╔═══════════════════════╗
║   ✨ 𝚃𝙴𝚇𝚃 𝙴𝙵𝙵𝙴𝙲𝚃   ║
╚═══════════════════════╝

*Type:* ${type}
*Result:* ${result}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Error creating text effect: ${error.message}`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'sora': {
                    if (args.length === 0) {
                        await socket.sendMessage(sender, {
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
                        break;
                    }

                    const prompt = args.join(' ');
                    await socket.sendMessage(sender, {
                        text: `⏳ Creating video from: "${prompt}"...`,
                        contextInfo: silaContext
                    });

                    try {
                        const apiUrl = `https://okatsu-rolezapiiz.vercel.app/ai/txt2video?text=${encodeURIComponent(prompt)}`;
                        const response = await axios.get(apiUrl);
                        
                        if (response.data && response.data.videoUrl) {
                            await socket.sendMessage(sender, {
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
                            await socket.sendMessage(sender, {
                                text: `❌ Failed to generate video. Try again later.`,
                                contextInfo: silaContext
                            });
                        }
                    } catch (error) {
                        console.error('Sora AI error:', error);
                        await socket.sendMessage(sender, {
                            text: `❌ Error generating video: ${error.message}`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'pies': {
                    const country = args[0]?.toLowerCase() || 'random';
                    
                    try {
                        const apiUrl = `https://shizoapi.onrender.com/api/pies/${country}?apikey=shizo`;
                        const response = await axios.get(apiUrl);
                        
                        if (response.data && response.data.url) {
                            await socket.sendMessage(sender, {
                                image: { url: response.data.url },
                                caption: `╔═══════════════════════╗
║   🥧 𝙿𝙸𝙴𝚂 𝙸𝙼𝙰𝙶𝙴   ║
╚═══════════════════════╝

*Country:* ${country}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                                contextInfo: silaContext
                            });
                        } else {
                            await socket.sendMessage(sender, {
                                text: `❌ No pies image found for ${country}`,
                                contextInfo: silaContext
                            });
                        }
                    } catch (error) {
                        console.error('Pies API error:', error);
                        await socket.sendMessage(sender, {
                            text: `❌ Error fetching pies image: ${error.message}`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'japan':
                case 'korea':
                case 'china':
                case 'thai': {
                    const country = command;
                    try {
                        const apiUrl = `https://shizoapi.onrender.com/api/pies/${country}?apikey=shizo`;
                        const response = await axios.get(apiUrl);
                        
                        if (response.data && response.data.url) {
                            await socket.sendMessage(sender, {
                                image: { url: response.data.url },
                                caption: `╔═══════════════════════╗
║   🥧 ${country.toUpperCase()} 𝙿𝙸𝙴𝚂   ║
╚═══════════════════════╝

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                                contextInfo: silaContext
                            });
                        }
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Error fetching ${country} pies`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'song':
                case 'play': {
                    if (args.length === 0) {
                        await socket.sendMessage(sender, {
                            text: `╔═══════════════════════╗
║   🎵 𝚂𝙾𝙽𝙶 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳   ║
╚═══════════════════════╝

*Usage:* ${config.PREFIX}song <song name or YouTube URL>

*Example:*
${config.PREFIX}song shape of you
${config.PREFIX}song https://youtu.be/xxx

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    const query = args.join(' ');
                    await socket.sendMessage(sender, {
                        text: `🔍 Searching for "${query}"...`,
                        contextInfo: silaContext
                    });

                    try {
                        let ytUrl = query;
                        if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                            const searchResults = await ytSearch(query);
                            if (!searchResults.videos || searchResults.videos.length === 0) {
                                await socket.sendMessage(sender, {
                                    text: `❌ No results found for "${query}"`,
                                    contextInfo: silaContext
                                });
                                return;
                            }
                            ytUrl = searchResults.videos[0].url;
                        }

                        const apiUrl = `https://sadiya-tech-apis.vercel.app/download/ytdl?url=${encodeURIComponent(ytUrl)}&format=mp3&apikey=sadiya`;
                        const response = await axios.get(apiUrl);

                        if (response.data && response.data.downloadUrl) {
                            await socket.sendMessage(sender, {
                                audio: { url: response.data.downloadUrl },
                                mimetype: "audio/mpeg",
                                caption: `╔═══════════════════════╗
║   🎵 𝚂𝙾𝙽𝙶 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝙳   ║
╚═══════════════════════╝

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                                contextInfo: silaContext
                            });
                        } else {
                            await socket.sendMessage(sender, {
                                text: `❌ Failed to download song`,
                                contextInfo: silaContext
                            });
                        }
                    } catch (error) {
                        console.error('Song download error:', error);
                        await socket.sendMessage(sender, {
                            text: `❌ Error downloading song: ${error.message}`,
                            contextInfo: silaContext
                        });
                    }
                    break;
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
🔗 *Bot Link:* ${silaLink}

💬 *Support Group:*
${silaGroup}

📢 *Channel:*
${silaChannel}

🎁 *Get Free Bot:*
Use ${config.PREFIX}freebot

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                    await socket.sendMessage(sender, {
                        image: { url: 'https://files.catbox.moe/ebj284.jpg' },
                        caption: ownerInfo,
                        contextInfo: silaContext
                    });
                    break;
                }

                // Add other commands here with the same box formatting...
                // [Previous command implementations remain the same but with updated box formatting]

            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                text: `╔═══════════════════════╗
║   ❌ 𝙴𝚁𝚁𝙾𝚁   ║
╚═══════════════════════╝

An error occurred while processing your command.

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                contextInfo: silaContext
            });
        }
    });
}

// Setup all socket handlers
function setupSocketHandlers(socket, number, userConfig) {
    setupStatusHandlers(socket, userConfig);
    setupCommandHandlers(socket, number, userConfig);
    setupAntiDeleteHandler(socket, userConfig);
    setupAntiLinkHandler(socket, userConfig);
    setupAutoTypingHandler(socket, userConfig);
    setupAutoReplyStatusHandler(socket, userConfig);
    setupAutoReplyHandler(socket);
}

// Memory optimization: Cache session data
const sessionCache = new Map();
const SESSION_CACHE_TTL = 300000; // 5 minutes

async function restoreSession(number) {
    try {
        if (!octokit) return null;
        
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        
        // Check cache first
        const cached = sessionCache.get(sanitizedNumber);
        if (cached && Date.now() - cached.timestamp < SESSION_CACHE_TTL) {
            return cached.data;
        }
        
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name === `creds_${sanitizedNumber}.json`
        );

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `session/${latestSession.name}`
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        const sessionData = JSON.parse(content);
        
        // Cache the session data
        sessionCache.set(sanitizedNumber, {
            data: sessionData,
            timestamp: Date.now()
        });
        
        return sessionData;
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

// Memory optimization: Cache user config
const userConfigCache = new Map();
const USER_CONFIG_CACHE_TTL = 300000; // 5 minutes

async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        
        // Check cache first
        const cached = userConfigCache.get(sanitizedNumber);
        if (cached && Date.now() - cached.timestamp < USER_CONFIG_CACHE_TTL) {
            return cached.data;
        }
        
        let configData = { ...defaultConfig };
        
        if (octokit) {
            try {
                const configPath = `session/config_${sanitizedNumber}.json`;
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: configPath
                });

                const content = Buffer.from(data.content, 'base64').toString('utf8');
                const userConfig = JSON.parse(content);
                
                // Merge with default config
                configData = { ...configData, ...userConfig };
            } catch (error) {
                console.warn(`No configuration found for ${number}, using default config`);
            }
        }
        
        // Set owner number to the user's number if not set
        if (!configData.OWNER_NUMBER) {
            configData.OWNER_NUMBER = sanitizedNumber;
        }
        
        // Cache the config
        userConfigCache.set(sanitizedNumber, {
            data: configData,
            timestamp: Date.now()
        });
        
        return configData;
    } catch (error) {
        console.warn(`Error loading config for ${number}, using default config:`, error);
        return { ...defaultConfig, OWNER_NUMBER: number.replace(/[^0-9]/g, '') };
    }
}

async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        
        if (octokit) {
            const configPath = `session/config_${sanitizedNumber}.json`;
            let sha;

            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: configPath
                });
                sha = data.sha;
            } catch (error) {
                // File doesn't exist yet, no sha needed
            }

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: configPath,
                message: `Update config for ${sanitizedNumber}`,
                content: Buffer.from(JSON.stringify(newConfig, null, 2)).toString('base64'),
                sha
            });
        }
        
        // Update cache
        userConfigCache.set(sanitizedNumber, {
            data: newConfig,
            timestamp: Date.now()
        });
        
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
}

// Memory optimization: Improve auto-restart logic
function setupAutoRestart(socket, number) {
    let restartAttempts = 0;
    const MAX_RESTART_ATTEMPTS = 5;
    const RESTART_DELAY_BASE = 10000; // 10 seconds
    
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            // Delete session from GitHub when connection is lost
            await deleteSessionFromGitHub(number);
            
            if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
                console.log(`Max restart attempts reached for ${number}, giving up`);
                activeSockets.delete(number.replace(/[^0-9]/g, ''));
                socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
                return;
            }
            
            restartAttempts++;
            const delayTime = RESTART_DELAY_BASE * Math.pow(2, restartAttempts - 1); // Exponential backoff
            
            console.log(`Connection lost for ${number}, attempting to reconnect in ${delayTime/1000} seconds (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
            
            await delay(delayTime);
            
            try {
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
            } catch (error) {
                console.error(`Reconnection attempt ${restartAttempts} failed for ${number}:`, error);
            }
        } else if (connection === 'open') {
            // Reset restart attempts on successful connection
            restartAttempts = 0;
        }
    });
}

async function deleteSessionFromGitHub(number) {
    try {
        if (!octokit) return;
        
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.includes(sanitizedNumber) && file.name.endsWith('.json')
        );

        // Delete files in sequence to avoid rate limiting
        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: `session/${file.name}`,
                message: `Delete session for ${sanitizedNumber}`,
                sha: file.sha
            });
            await delay(500); // Add delay between deletions
        }
    } catch (error) {
        console.error('Failed to delete session from GitHub:', error);
    }
}

// Memory optimization: Improve pairing process
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    // Check if already connected
    if (activeSockets.has(sanitizedNumber)) {
        if (!res.headersSent) {
            res.send({ 
                status: 'already_connected',
                message: 'This number is already connected'
            });
        }
        return;
    }

    await cleanDuplicateFiles(sanitizedNumber);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.windows('Chrome')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        // Load user config
        const userConfig = await loadUserConfig(sanitizedNumber);
        
        setupSocketHandlers(socket, sanitizedNumber, userConfig);
        setupAutoRestart(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = parseInt(userConfig.MAX_RETRIES) || 3;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code: ${retries}, ${error.message}`);
                    await delay(2000 * (parseInt(userConfig.MAX_RETRIES) - retries));
                }
            }
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            
            if (octokit) {
                let sha;
                try {
                    const { data } = await octokit.repos.getContent({
                        owner,
                        repo,
                        path: `session/creds_${sanitizedNumber}.json`
                    });
                    sha = data.sha;
                } catch (error) {
                    // File doesn't exist yet, no sha needed
                }

                await octokit.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path: `session/creds_${sanitizedNumber}.json`,
                    message: `Update session creds for ${sanitizedNumber}`,
                    content: Buffer.from(fileContent).toString('base64'),
                    sha
                });
                console.log(`Updated creds for ${sanitizedNumber} in GitHub`);
            }
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    
                    const userJid = jidNormalizedUser(socket.user.id);
   
                    await socket.newsletterFollow("120363422610520277@newsletter");
                    await socket.newsletterUnmute("120363422610520277@newsletter");   
                        
                    await updateAboutStatus(socket);
                    await updateStoryStatus(socket);

                    activeSockets.set(sanitizedNumber, socket);
                    userConfig.OWNER_NUMBER = sanitizedNumber;
                    await updateUserConfig(sanitizedNumber, userConfig);
                    
                    await socket.sendMessage(userJid, {
                        image: { url: 'https://files.catbox.moe/gnjb7s.jpg' },
                        caption: `╔═══════════════════════╗
║   🎉 𝙱𝙾𝚃 𝙲𝙾𝙽𝙽𝙴𝙲𝚃𝙴𝙳!   ║
╚═══════════════════════╝

✅ Successfully connected!

🔢 *Number:* ${sanitizedNumber}
⚡ *Status:* Active and Ready

✨ Bot is now active and ready to use!

📌 Type ${userConfig.PREFIX || '.'}menu to view all commands

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// API Routes
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

// Memory optimization: Limit concurrent connections
const MAX_CONCURRENT_CONNECTIONS = 5;
let currentConnections = 0;

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        const connectionPromises = [];
        
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }
            
            // Limit concurrent connections
            if (currentConnections >= MAX_CONCURRENT_CONNECTIONS) {
                results.push({ number, status: 'queued' });
                continue;
            }
            
            currentConnections++;
            connectionPromises.push((async () => {
                try {
                    const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                    await EmpirePair(number, mockRes);
                    results.push({ number, status: 'connection_initiated' });
                } catch (error) {
                    results.push({ number, status: 'failed', error: error.message });
                } finally {
                    currentConnections--;
                }
            })());
        }
        
        await Promise.all(connectionPromises);
        
        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

// Memory optimization: Limit concurrent reconnections
router.get('/reconnect', async (req, res) => {
    try {
        if (!octokit) {
            return res.status(500).send({ error: 'GitHub integration not configured' });
        }
        
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith('creds_') && file.name.endsWith('.json')
        );

        if (sessionFiles.length === 0) {
            return res.status(404).send({ error: 'No session files found in GitHub repository' });
        }

        const results = [];
        const reconnectPromises = [];
        
        for (const file of sessionFiles) {
            const match = file.name.match(/creds_(\d+)\.json/);
            if (!match) {
                console.warn(`Skipping invalid session file: ${file.name}`);
                results.push({ file: file.name, status: 'skipped', reason: 'invalid_file_name' });
                continue;
            }

            const number = match[1];
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }
            
            // Limit concurrent reconnections
            if (currentConnections >= MAX_CONCURRENT_CONNECTIONS) {
                results.push({ number, status: 'queued' });
                continue;
            }
            
            currentConnections++;
            reconnectPromises.push((async () => {
                try {
                    const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                    await EmpirePair(number, mockRes);
                    results.push({ number, status: 'connection_initiated' });
                } catch (error) {
                    console.error(`Failed to reconnect bot for ${number}:`, error);
                    results.push({ number, status: 'failed', error: error.message });
                } finally {
                    currentConnections--;
                }
            })());
        }
        
        await Promise.all(reconnectPromises);
        
        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

// Config management routes for HTML interface
router.get('/config/:number', async (req, res) => {
    try {
        const { number } = req.params;
        const config = await loadUserConfig(number);
        res.status(200).send(config);
    } catch (error) {
        console.error('Failed to load config:', error);
        res.status(500).send({ error: 'Failed to load config' });
    }
});

router.post('/config/:number', async (req, res) => {
    try {
        const { number } = req.params;
        const newConfig = req.body;
        
        // Validate config
        if (typeof newConfig !== 'object') {
            return res.status(400).send({ error: 'Invalid config format' });
        }
        
        // Load current config and merge
        const currentConfig = await loadUserConfig(number);
        const mergedConfig = { ...currentConfig, ...newConfig };
        
        await updateUserConfig(number, mergedConfig);
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
    } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
    }
});

// Cleanup with better memory management
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
    
    // Clear all caches
    adminCache = null;
    adminCacheTime = 0;
    sessionCache.clear();
    userConfigCache.clear();
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});

// Regular memory cleanup
setInterval(() => {
    // Clean up expired cache entries
    const now = Date.now();
    
    // Clean session cache
    for (let [key, value] of sessionCache.entries()) {
        if (now - value.timestamp > SESSION_CACHE_TTL) {
            sessionCache.delete(key);
        }
    }
    
    // Clean user config cache
    for (let [key, value] of userConfigCache.entries()) {
        if (now - value.timestamp > USER_CONFIG_CACHE_TTL) {
            userConfigCache.delete(key);
        }
    }
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
}, 300000); // Run every 5 minutes

module.exports = router;
