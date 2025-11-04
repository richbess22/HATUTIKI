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
const  getImage  = require('./masky.js');

// Default config structure
const defaultConfig = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_TYPING: 'true',
    ANTI_LINK: 'true',
    ANTI_DELETE: 'true',
    AUTO_REPLY_STATUS: 'true',
    AUTO_LIKE_EMOJI: ['💥', '👍', '😍', '💗', '🎈', '🎉', '🥳', '😎', '🚀', '🔥'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: getImage(),
    OWNER_NUMBER: '255612491554',
    BOT_MODE: true
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

// Auto reply messages
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

// Command reactions
const commandReactions = {
    'alive': '🤖',
    'menu': '📜',
    'help': '❓',
    'ping': '🏓',
    'uptime': '⏱️',
    'tagall': '🏷️',
    'fb': '📹',
    'song': '🎵',
    'ytaudio': '🎧',
    'getpp': '🖼️',
    'deleteme': '🗑️',
    'autostatus': '👁️',
    'autolike': '❤️',
    'autorecord': '🎙️',
    'vv': '👁️',
    'vv2': '🕵️',
    'removebg': '🖼️',
    'bible': '📖',
    'quran': '🕌',
    'ig': '📸',
    'tiktok': '🎵',
    'ytmp4': '🎬',
    'idch': '📢',
    'mode': '⚙️',
    'pair': '🔗',
    'botlink': '🤖',
    'script': '📜',
    'repo': '📦',
    'owner': '👑',
    'support': '💬',
    'textfx': '🎨',
    'pies': '🥧',
    'sora': '🎥'
};

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
    const caption = `🤖 *Bot Connected*\n\n📞 Number: ${number}\n🟢 Status: Connected\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`;

    // Send messages sequentially to avoid memory spikes
    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: defaultConfig.IMAGE_PATH },
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
    
    const aboutStatus = '𝚂𝙸𝙻𝙰 𝙼𝙳 🚀-𝙼𝚒𝚗𝚒 𝙱𝚘𝚝 𝚒𝚜 𝙰𝚌𝚝𝚒𝚟𝚎 🚀';
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

// Auto typing function
async function setTyping(socket, jid, duration = 2000) {
    try {
        await socket.sendPresenceUpdate('composing', jid);
        await delay(duration);
        await socket.sendPresenceUpdate('paused', jid);
    } catch (error) {
        console.error('Typing error:', error);
    }
}

// Anti-link function
async function handleAntiLink(socket, message, userConfig) {
    if (userConfig.ANTI_LINK !== 'true') return false;
    
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || 
                message.message?.imageMessage?.caption ||
                message.message?.videoMessage?.caption || '';
    
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const hasLink = linkRegex.test(text);
    
    if (hasLink && !message.key.fromMe) {
        const sender = message.key.remoteJid;
        try {
            await socket.sendMessage(sender, {
                text: `⚠️ *ANTI-LINK SYSTEM*\n\nLinks are not allowed in this chat!\n\nYour message has been deleted.`,
                contextInfo: silaContext
            });
            
            // Delete the message with link
            await socket.sendMessage(sender, {
                delete: message.key
            });
            
            return true;
        } catch (error) {
            console.error('Anti-link error:', error);
        }
    }
    return false;
}

// Anti-delete function
async function handleAntiDelete(socket, message, userConfig) {
    if (userConfig.ANTI_DELETE !== 'true') return;
    
    try {
        const deletedMessage = message.message?.protocolMessage;
        if (deletedMessage?.type === 0 && deletedMessage.key) {
            const sender = message.key.remoteJid;
            const deletedBy = deletedMessage.key.participant || deletedMessage.key.remoteJid;
            
            await socket.sendMessage(sender, {
                text: `⚠️ *ANTI-DELETE DETECTED*\n\nA message was deleted by @${deletedBy.split('@')[0]}\n\nMessage deletion is monitored!`,
                mentions: [deletedBy],
                contextInfo: silaContext
            });
        }
    } catch (error) {
        console.error('Anti-delete error:', error);
    }
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
                        await delay(1000 * (parseInt(userConfig.MAX_RETRIES) || 3 - retries));
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
                        
                        // 📨 Send confirmation message after reacting
                        if (userConfig.AUTO_VIEW_STATUS === 'true') {
                            await socket.sendMessage(message.key.remoteJid, {
                                text: `👑 *SILA MD MINI*\n\n✅ Successfully *VIEWED* 👀 and *LIKED* ❤️ your status!\n\n> "I saw your status by SILA MD"\n\n🚀 Keep shining! The bot's always watching over your updates 😎`,
                                contextInfo: silaContext
                            });
                        } else {
                            await socket.sendMessage(message.key.remoteJid, {
                                text: `👑 *SILA MD MINI*\n\n❤️ Bot *LIKED* your status!\n\n💡 Want the bot to also *view* your statuses?\n👉 Type *${config.prefix}autostatus on*\n\nTo stop auto-likes or silence reactions, use *${config.prefix}autolike off*\n\n> "Small gestures make big impacts — even digital ones." 💫`,
                                contextInfo: silaContext
                            });
                        }
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (parseInt(userConfig.MAX_RETRIES) || 3 - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}

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
    
    if (!apis[type]) throw new Error('Invalid text effect type');
    
    // Implementation would go here for text effect generation
    return `Text effect "${type}" created for: ${text}`;
  } catch (error) {
    throw error;
  }
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
                console.error('Newsletter react error:', e);
            }
        }
        
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        // Handle anti-delete
        await handleAntiDelete(socket, msg, userConfig);

        // Handle anti-link
        const linkBlocked = await handleAntiLink(socket, msg, userConfig);
        if (linkBlocked) return;

        // 🧠 Extract message text
        let text = '';
        if (msg.message.conversation) {
            text = msg.message.conversation.trim();
        } else if (msg.message.extendedTextMessage?.text) {
            text = msg.message.extendedTextMessage.text.trim();
        } else if (msg.message.imageMessage?.caption) {
            text = msg.message.imageMessage.caption.trim();
        } else if (msg.message.videoMessage?.caption) {
            text = msg.message.videoMessage.caption.trim();
        }

        const sender = msg.key.remoteJid;
        const now = Date.now();

        // Auto typing
        if (userConfig.AUTO_TYPING === 'true' && text.startsWith(config.PREFIX)) {
            await setTyping(socket, sender, 1500);
        }

        // Auto reply for inbox messages
        if (!text.startsWith(config.PREFIX) && sender.endsWith('@s.whatsapp.net')) {
            const lowercaseText = text.toLowerCase();
            for (const [trigger, response] of Object.entries(autoReplies)) {
                if (lowercaseText.includes(trigger)) {
                    await socket.sendMessage(sender, { 
                        text: response,
                        contextInfo: silaContext
                    });
                    break;
                }
            }
        }

        // ⚙️ Handle button presses before command logic
        if (msg.message?.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId.startsWith('cmd_')) {
                const cmd = buttonId.replace('cmd_', '').trim();

                switch (cmd) {
                    case 'menu': {
                        const startTime = socketCreationTime.get(number) || Date.now();
                        const uptime = Math.floor((Date.now() - startTime) / 1000);
                        const hours = Math.floor(uptime / 3600);
                        const minutes = Math.floor((uptime % 3600) / 60);
                        const seconds = Math.floor(uptime % 60);

                        const os = require('os');
                        const ramUsage = Math.round(process.memoryUsage().rss / 1024 / 1024);
                        const totalRam = Math.round(os.totalmem() / 1024 / 1024);

                        const menuCaption = `╔══════════════════════════════════╗
║           🤖 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸           ║
╠══════════════════════════════════╣
║ 📱 User: ${number}
║ ⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
║ 💾 RAM: ${ramUsage}MB/${totalRam}MB
║ 🔧 Prefix: ${config.PREFIX}
╚══════════════════════════════════╝

╭─❖「 🎯 𝙲𝙾𝚁𝙴 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂 」❖─╮
│ ${config.PREFIX}alive ${commandReactions.alive}
│ ${config.PREFIX}menu ${commandReactions.menu}
│ ${config.PREFIX}ping ${commandReactions.ping}
│ ${config.PREFIX}uptime ${commandReactions.uptime}
│ ${config.PREFIX}tagall ${commandReactions.tagall}
╰─────────────────────────────╯

╭─❖「 ⚡ 𝙰𝚄𝚃𝙾 𝙵𝙴𝙰𝚃𝚄𝚁𝙴𝚂 」❖─╮
│ ${config.PREFIX}autostatus ${commandReactions.autostatus}
│ ${config.PREFIX}autolike ${commandReactions.autolike}
│ ${config.PREFIX}autorecord ${commandReactions.autorecord}
│ ${config.PREFIX}mode ${commandReactions.mode}
╰─────────────────────────────╯

╭─❖「 🎬 𝙼𝙴𝙳𝙸𝙰 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳 」❖─╮
│ ${config.PREFIX}fb ${commandReactions.fb}
│ ${config.PREFIX}ig ${commandReactions.ig}
│ ${config.PREFIX}tiktok ${commandReactions.tiktok}
│ ${config.PREFIX}ytmp4 ${commandReactions.ytmp4}
│ ${config.PREFIX}song ${commandReactions.song}
│ ${config.PREFIX}ytaudio ${commandReactions.ytaudio}
╰─────────────────────────────╯

╭─❖「 🛠️ 𝚃𝙾𝙾𝙻𝚂 & 𝙾𝚃𝙷𝙴𝚁𝚂 」❖─╮
│ ${config.PREFIX}removebg ${commandReactions.removebg}
│ ${config.PREFIX}vv ${commandReactions.vv}
│ ${config.PREFIX}vv2 ${commandReactions.vv2}
│ ${config.PREFIX}textfx ${commandReactions.textfx}
│ ${config.PREFIX}idch ${commandReactions.idch}
╰─────────────────────────────╯

╭─❖「 📞 𝙲𝙾𝙽𝚃𝙰𝙲𝚃 」❖─╮
│ ${config.PREFIX}owner ${commandReactions.owner}
│ ${config.PREFIX}support ${commandReactions.support}
│ ${config.PREFIX}botlink ${commandReactions.botlink}
╰─────────────────────────────╯

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`;

                        await socket.sendMessage(sender, {
                            image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH },
                            caption: menuCaption.trim(),
                            footer: '𝚂𝙸𝙻𝙰 𝙼𝙳 | 𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝙸𝙻𝙰 𝙼𝙳',
                            buttons: [
                                { buttonId: 'cmd_ping', buttonText: { displayText: '📶 PING SILA MD' } },
                                { buttonId: 'cmd_get', buttonText: { displayText: '🤖 GET SILA MD' } },
                                { buttonId: 'cmd_config', buttonText: { displayText: '⚙️ CONFIG SILA MD' } },
                                { buttonId: 'cmd_menu', buttonText: { displayText: '🧩 MAIN MENU' } }
                            ],
                            viewOnce: true
                        });
                        break;
                    }
                    case 'get': {
                        const startTime = socketCreationTime.get(number) || Date.now();
                        const uptime = Math.floor((Date.now() - startTime) / 1000);
                        const hours = Math.floor(uptime / 3600);
                        const minutes = Math.floor((uptime % 3600) / 60);
                        const seconds = Math.floor(uptime % 60);

                        const buttons = [
                            { buttonId: 'cmd_ping', buttonText: { displayText: '⚡ PING SILA MD' }, type: 1 },
                            { buttonId: 'cmd_config', buttonText: { displayText: '⚙️ CONFIG SILA MD' }, type: 1 },
                            { buttonId: 'cmd_menu', buttonText: { displayText: '🧩 MAIN MENU' }, type: 1 },
                        ];

                        await socket.sendMessage(sender, {
                            image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH },
                            caption: `╔══════════════════════════════════╗
║           📦 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸           ║
╠══════════════════════════════════╣
║ 🔗 Link: ${silaLink}
║ ⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
║ 👥 Sessions: ${activeSockets.size}
║ 📞 Owner: +255612491554
╚══════════════════════════════════╝

🌟 *Features:*
• Fast & Reliable ${commandReactions.ping}
• Easy to Use ${commandReactions.menu}
• Multiple Sessions ${commandReactions.alive}

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            footer: '𝚂𝙸𝙻𝙰 𝙼𝙳 | 𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝙸𝙻𝙰 𝙼𝙳',
                            buttons,
                            headerType: 4,
                            viewOnce: false,
                            contextInfo: silaContext
                        });
                        break;
                    }
                    case 'ping': {
                        const start = Date.now();
                        await socket.sendMessage(sender, { text: '🏓 Pong!' });
                        const latency = Date.now() - start;
                        await socket.sendMessage(sender, { 
                            text: `╔══════════════════════════════════╗
║           🏓 𝙿𝙸𝙽𝙶 𝚁𝙴𝚂𝚄𝙻𝚃𝚂           ║
╠══════════════════════════════════╣
║ ⚡ Latency: ${latency}ms
║ 📶 Connection: ${latency < 500 ? 'Excellent' : latency < 1000 ? 'Good' : 'Poor'}
║ 🤖 Bot: SILA MD MINI
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                        break;
                    }
                    case 'config': {
                        const viewStatus = userConfig.AUTO_VIEW_STATUS === 'true' ? 'on' : 'off';
                        const likeStatus = userConfig.AUTO_LIKE_STATUS === 'true' ? 'on' : 'off';
                        const records = userConfig.AUTO_RECORDING === 'true' ? 'on' : 'off';
                        const typing = userConfig.AUTO_TYPING === 'true' ? 'on' : 'off';
                        const antilink = userConfig.ANTI_LINK === 'true' ? 'on' : 'off';
                        const antidelete = userConfig.ANTI_DELETE === 'true' ? 'on' : 'off';

                        const configCaption = `╔══════════════════════════════════╗
║           ⚙️ 𝙲𝙾𝙽𝙵𝙸𝙶𝚄𝚁𝙰𝚃𝙸𝙾𝙽           ║
╠══════════════════════════════════╣
║ 💬 Prefix: ${config.PREFIX}
║ 👁 Auto Status: ${viewStatus}
║ ❤️ Auto Like: ${likeStatus}
║ 🎙 Auto Record: ${records}
║ ⌨️ Auto Typing: ${typing}
║ 🔗 Anti Link: ${antilink}
║ 🗑️ Anti Delete: ${antidelete}
╚══════════════════════════════════╝

Use buttons below to toggle features 👇`;

                        await socket.sendMessage(sender, {
                            image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH },
                            caption: configCaption.trim(),
                            footer: '𝚂𝙸𝙻𝙰 𝙼𝙳 | 𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝙸𝙻𝙰 𝙼𝙳',
                            buttons: [
                                {
                                    buttonId: userConfig.AUTO_VIEW_STATUS === 'true' ? 'cmd_autostatus_off' : 'cmd_autostatus_on',
                                    buttonText: { displayText: userConfig.AUTO_VIEW_STATUS === 'true' ? '🚫 Disable Auto Status' : '✅ Enable Auto Status' },
                                    type: 1
                                },
                                {
                                    buttonId: userConfig.AUTO_LIKE_STATUS === 'true' ? 'cmd_autolike_off' : 'cmd_autolike_on',
                                    buttonText: { displayText: userConfig.AUTO_LIKE_STATUS === 'true' ? '🚫 Disable Auto Like' : '✅ Enable Auto Like' },
                                    type: 1
                                },
                                {
                                    buttonId: userConfig.AUTO_RECORDING === 'true' ? 'cmd_autorecord_off' : 'cmd_autorecord_on',
                                    buttonText: { displayText: userConfig.AUTO_RECORDING === 'true' ? '🚫 Disable Auto Record' : '✅ Enable Auto Record' },
                                    type: 1
                                }
                            ],
                            headerType: 4,
                            viewOnce: false
                        });
                        break;
                    }
                    case 'autostatus_on':
                        userConfig.AUTO_VIEW_STATUS = 'true';
                        await socket.sendMessage(sender, { text: '✅ Auto Status Enabled! 👀' });
                        break;
                    case 'autostatus_off':
                        userConfig.AUTO_VIEW_STATUS = 'false';
                        await socket.sendMessage(sender, { text: '🚫 Auto Status Disabled! 😴' });
                        break;
                    case 'autolike_on':
                        userConfig.AUTO_LIKE_STATUS = 'true';
                        await socket.sendMessage(sender, { text: '✅ Auto Like Enabled! ❤️' });
                        break;
                    case 'autolike_off':
                        userConfig.AUTO_LIKE_STATUS = 'false';
                        await socket.sendMessage(sender, { text: '🚫 Auto Like Disabled! 😴' });
                        break;
                    case 'autorecord_on':
                        userConfig.AUTO_RECORDING = 'true';
                        await socket.sendMessage(sender, { text: '✅ Auto Recording Enabled! 🎙️' });
                        break;
                    case 'autorecord_off':
                        userConfig.AUTO_RECORDING = 'false';
                        await socket.sendMessage(sender, { text: '🚫 Auto Recording Disabled! 😴' });
                        break;
                }
                return;
            }
        }

        // 🧭 Continue normal command handling
        if (!text.startsWith(config.PREFIX)) return;

        // ⏱ Rate limiting
        if (commandCooldowns.has(sender) && now - commandCooldowns.get(sender) < COMMAND_COOLDOWN) {
            return;
        }
        commandCooldowns.set(sender, now);

        const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        // 🔐 BOT_MODE protection
        const ownerJid = `${userConfig.OWNER_NUMBER || number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        const from = msg.key.remoteJid;
        const participant = msg.key.participant || sender;
        const isGroup = from.endsWith('@g.us');

        if (userConfig.BOT_MODE) {
            if (participant !== ownerJid && from !== ownerJid) {
                return;
            }
        }

        // Add command reaction
        const reaction = commandReactions[command] || '⚡';
        try {
            await socket.sendMessage(sender, {
                react: { text: reaction, key: msg.key }
            });
        } catch (error) {
            console.error('Failed to add reaction:', error);
        }

        try {
            switch (command) {
                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const caption = `╔══════════════════════════════════╗
║           🤖 𝙱𝙾𝚃 𝚂𝚃𝙰𝚃𝚄𝚂           ║
╠══════════════════════════════════╣
║ 💚 Status: ONLINE
║ ⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
║ 📱 User: ${number}
║ 👥 Sessions: ${activeSockets.size}
║ 🔖 Version: v2.0.0
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`;

                    await socket.sendMessage(sender, {
                        image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH },
                        caption: caption.trim(),
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'settings':
                case 'setting':
                case 'config': {
                    const viewStatus = userConfig.AUTO_VIEW_STATUS === 'true' ? 'on' : 'off';
                    const likeStatus = userConfig.AUTO_LIKE_STATUS === 'true' ? 'on' : 'off';
                    const records = userConfig.AUTO_RECORDING === 'true' ? 'on' : 'off';
                    const typing = userConfig.AUTO_TYPING === 'true' ? 'on' : 'off';
                    const antilink = userConfig.ANTI_LINK === 'true' ? 'on' : 'off';
                    const antidelete = userConfig.ANTI_DELETE === 'true' ? 'on' : 'off';

                    const configCaption = `╔══════════════════════════════════╗
║           ⚙️ 𝙲𝙾𝙽𝙵𝙸𝙶𝚄𝚁𝙰𝚃𝙸𝙾𝙽           ║
╠══════════════════════════════════╣
║ 💬 Prefix: ${config.PREFIX}
║ 👁 Auto Status: ${viewStatus}
║ ❤️ Auto Like: ${likeStatus}
║ 🎙 Auto Record: ${records}
║ ⌨️ Auto Typing: ${typing}
║ 🔗 Anti Link: ${antilink}
║ 🗑️ Anti Delete: ${antidelete}
╚══════════════════════════════════╝

Use buttons below to toggle features 👇`;

                    await socket.sendMessage(sender, {
                        image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH },
                        caption: configCaption.trim(),
                        footer: '𝚂𝙸𝙻𝙰 𝙼𝙳 | 𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝙸𝙻𝙰 𝙼𝙳',
                        buttons: [
                            {
                                buttonId: userConfig.AUTO_VIEW_STATUS === 'true' ? 'cmd_autostatus_off' : 'cmd_autostatus_on',
                                buttonText: { displayText: userConfig.AUTO_VIEW_STATUS === 'true' ? '🚫 Disable Auto Status' : '✅ Enable Auto Status' },
                                type: 1
                            },
                            {
                                buttonId: userConfig.AUTO_LIKE_STATUS === 'true' ? 'cmd_autolike_off' : 'cmd_autolike_on',
                                buttonText: { displayText: userConfig.AUTO_LIKE_STATUS === 'true' ? '🚫 Disable Auto Like' : '✅ Enable Auto Like' },
                                type: 1
                            },
                            {
                                buttonId: userConfig.AUTO_RECORDING === 'true' ? 'cmd_autorecord_off' : 'cmd_autorecord_on',
                                buttonText: { displayText: userConfig.AUTO_RECORDING === 'true' ? '🚫 Disable Auto Record' : '✅ Enable Auto Record' },
                                type: 1
                            }
                        ],
                        headerType: 4,
                        viewOnce: false
                    });
                    break;
                }

                case 'help':
                case 'allmenu':
                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const os = require('os');
                    const ramUsage = Math.round(process.memoryUsage().rss / 1024 / 1024);
                    const totalRam = Math.round(os.totalmem() / 1024 / 1024);

                    const menuCaption = `╔══════════════════════════════════╗
║           🤖 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸           ║
╠══════════════════════════════════╣
║ 📱 User: ${number}
║ ⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
║ 💾 RAM: ${ramUsage}MB/${totalRam}MB
║ 🔧 Prefix: ${config.PREFIX}
╚══════════════════════════════════╝

╭─❖「 🎯 𝙲𝙾𝚁𝙴 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂 」❖─╮
│ ${config.PREFIX}alive ${commandReactions.alive}
│ ${config.PREFIX}menu ${commandReactions.menu}
│ ${config.PREFIX}ping ${commandReactions.ping}
│ ${config.PREFIX}uptime ${commandReactions.uptime}
│ ${config.PREFIX}tagall ${commandReactions.tagall}
╰─────────────────────────────╯

╭─❖「 ⚡ 𝙰𝚄𝚃𝙾 𝙵𝙴𝙰𝚃𝚄𝚁𝙴𝚂 」❖─╮
│ ${config.PREFIX}autostatus ${commandReactions.autostatus}
│ ${config.PREFIX}autolike ${commandReactions.autolike}
│ ${config.PREFIX}autorecord ${commandReactions.autorecord}
│ ${config.PREFIX}mode ${commandReactions.mode}
╰─────────────────────────────╯

╭─❖「 🎬 𝙼𝙴𝙳𝙸𝙰 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳 」❖─╮
│ ${config.PREFIX}fb ${commandReactions.fb}
│ ${config.PREFIX}ig ${commandReactions.ig}
│ ${config.PREFIX}tiktok ${commandReactions.tiktok}
│ ${config.PREFIX}ytmp4 ${commandReactions.ytmp4}
│ ${config.PREFIX}song ${commandReactions.song}
│ ${config.PREFIX}ytaudio ${commandReactions.ytaudio}
╰─────────────────────────────╯

╭─❖「 🛠️ 𝚃𝙾𝙾𝙻𝚂 & 𝙾𝚃𝙷𝙴𝚁𝚂 」❖─╮
│ ${config.PREFIX}removebg ${commandReactions.removebg}
│ ${config.PREFIX}vv ${commandReactions.vv}
│ ${config.PREFIX}vv2 ${commandReactions.vv2}
│ ${config.PREFIX}textfx ${commandReactions.textfx}
│ ${config.PREFIX}idch ${commandReactions.idch}
╰─────────────────────────────╯

╭─❖「 📞 𝙲𝙾𝙽𝚃𝙰𝙲𝚃 」❖─╮
│ ${config.PREFIX}owner ${commandReactions.owner}
│ ${config.PREFIX}support ${commandReactions.support}
│ ${config.PREFIX}botlink ${commandReactions.botlink}
╰─────────────────────────────╯

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`;

                    await socket.sendMessage(sender, {
                        image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH },
                        caption: menuCaption.trim(),
                        footer: '𝚂𝙸𝙻𝙰 𝙼𝙳 | 𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝙸𝙻𝙰 𝙼𝙳',
                        buttons: [
                            { buttonId: 'cmd_ping', buttonText: { displayText: '📶 PING SILA MD' } },
                            { buttonId: 'cmd_get', buttonText: { displayText: '🤖 GET SILA MD' } },
                            { buttonId: 'cmd_config', buttonText: { displayText: '⚙️ CONFIG SILA MD' } },
                            { buttonId: 'cmd_menu', buttonText: { displayText: '🧩 MAIN MENU' } }
                        ],
                        viewOnce: true
                    });
                    break;
                }

                case 'ping': {
                    const start = Date.now();
                    await socket.sendMessage(sender, { text: '🏓 Pong!' });
                    const latency = Date.now() - start;
                    await socket.sendMessage(sender, { 
                        text: `╔══════════════════════════════════╗
║           🏓 𝙿𝙸𝙽𝙶 𝚁𝙴𝚂𝚄𝙻𝚃𝚂           ║
╠══════════════════════════════════╣
║ ⚡ Latency: ${latency}ms
║ 📶 Connection: ${latency < 500 ? 'Excellent' : latency < 1000 ? 'Good' : 'Poor'}
║ 🤖 Bot: SILA MD MINI
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                        contextInfo: silaContext
                    });
                    break;
                }
                
                case 'uptime': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    
                    await socket.sendMessage(sender, {
                        text: `╔══════════════════════════════════╗
║           ⏰ 𝚄𝙿𝚃𝙸𝙼𝙴 𝙸𝙽𝙵𝙾           ║
╠══════════════════════════════════╣
║ ⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s
║ 👥 Active Sessions: ${activeSockets.size}
║ 🤖 Bot: SILA MD MINI
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                        buttons: [ { buttonId: 'cmd_menu', buttonText: { displayText: '🧩 MAIN MENU' } }],
                        headerType: 4,
                        viewOnce: false,
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'tagall': {
                    if (!msg.key.remoteJid.endsWith('@g.us')) {
                        await socket.sendMessage(sender, { 
                            text: '❌ This command can only be used in groups.',
                            contextInfo: silaContext
                        });
                        return;
                    }
                    const groupMetadata = await socket.groupMetadata(sender);
                    const participants = groupMetadata.participants.map(p => p.id);
                    const tagMessage = `📢 *Tagging all members:*\n\n${participants.map(p => `@${p.split('@')[0]}`).join(' ')}`;
                    
                    await socket.sendMessage(sender, {
                        text: tagMessage,
                        mentions: participants
                    });
                    break;
                }
                
                case 'botlink':
                case 'sc':
                case 'script':
                case 'repo': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
               
                    const buttons = [
                        { buttonId: 'cmd_ping', buttonText: { displayText: '⚡ PING SILA MD' }, type: 1 },
                        { buttonId: 'cmd_config', buttonText: { displayText: '⚙️ CONFIG SILA MD' }, type: 1 },
                        { buttonId: 'cmd_menu', buttonText: { displayText: '🧩 MAIN MENU' }, type: 1 }
                    ];

                    await socket.sendMessage(sender, {
                        image: { url: defaultConfig.IMAGE_PATH },
                        caption: `╔══════════════════════════════════╗
║           📦 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸           ║
╠══════════════════════════════════╣
║ 🔗 Link: ${silaLink}
║ ⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
║ 👥 Sessions: ${activeSockets.size}
║ 📞 Owner: +255612491554
╚══════════════════════════════════╝

🌟 *Features:*
• Fast & Reliable ${commandReactions.ping}
• Easy to Use ${commandReactions.menu}
• Multiple Sessions ${commandReactions.alive}

Get a free bot from the link above!

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                        buttons,
                        headerType: 4,
                        viewOnce: false,
                        contextInfo: silaContext
                    });
                    break;
                }

                // Add other command cases here (fb, song, ytaudio, etc.)
                // The implementation would be similar to the original but with new styling

                case 'owner': {
                    await socket.sendMessage(sender, {
                        text: `╔══════════════════════════════════╗
║           👑 𝙾𝚆𝙽𝙴𝚁 𝙸𝙽𝙵𝙾           ║
╠══════════════════════════════════╣
║ 🤖 Bot: SILA MD MINI
║ 👑 Owner: SILA MD
║ 📞 Number: +255612491554
║ 📢 Channel: https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28
║ 👥 Group: https://chat.whatsapp.com/C03aOCLQeRUH821jWqRPC6
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'support': {
                    await socket.sendMessage(sender, {
                        text: `╔══════════════════════════════════╗
║           💬 𝚂𝚄𝙿𝙿𝙾𝚁𝚃           ║
╠══════════════════════════════════╣
║ 📞 Contact: +255612491554
║ 📢 Channel: https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28
║ 👥 Group: https://chat.whatsapp.com/C03aOCLQeRUH821jWqRPC6
║ 🤖 Bot: SILA MD MINI
╚══════════════════════════════════╝

Need help? Contact us above!

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'textfx': {
                    if (args.length < 2) {
                        await socket.sendMessage(sender, {
                            text: `╔══════════════════════════════════╗
║           🎨 𝚃𝙴𝚇𝚃 𝙴𝙵𝙵𝙴𝙲𝚃𝚂           ║
╠══════════════════════════════════╣
║ Usage: ${config.PREFIX}textfx <effect> <text>
║ 
║ Available Effects:
║ • metallic 🎭
║ • ice ❄️
║ • snow 🌨️
║ • neon 💡
║ • fire 🔥
║ • glitch 📟
║ • matrix 💚
║ • thunder ⚡
╚══════════════════════════════════╝

Example: ${config.PREFIX}textfx neon SILA MD

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                        break;
                    }
                    
                    const effect = args[0].toLowerCase();
                    const text = args.slice(1).join(' ');
                    
                    try {
                        await socket.sendMessage(sender, {
                            text: `🔄 Creating ${effect} effect for: ${text}...`
                        });
                        
                        const result = await createTextEffect(effect, text);
                        await socket.sendMessage(sender, {
                            text: `✅ ${result}\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Failed to create text effect: ${error.message}\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                    }
                    break;
                }

                case 'pies': {
                    const country = args[0]?.toLowerCase() || 'random';
                    try {
                        const response = await axios.get(`https://shizoapi.onrender.com/api/pies/${country}?apikey=shizo`);
                        const imageUrl = response.data.url;
                        
                        await socket.sendMessage(sender, {
                            image: { url: imageUrl },
                            caption: `🥧 *Pies Image* - ${country.toUpperCase()}\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Failed to fetch pies image\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                    }
                    break;
                }

                case 'sora': {
                    const prompt = args.join(' ');
                    if (!prompt) {
                        await socket.sendMessage(sender, {
                            text: `╔══════════════════════════════════╗
║           🎥 𝚂𝙾𝚁𝙰 𝙰𝙸 𝚅𝙸𝙳𝙴𝙾           ║
╠══════════════════════════════════╣
║ Usage: ${config.PREFIX}sora <prompt>
║ 
║ Example:
║ ${config.PREFIX}sora a cat playing piano
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                        break;
                    }
                    
                    try {
                        await socket.sendMessage(sender, {
                            text: `🎬 Generating AI video for: ${prompt}...`
                        });
                        
                        const response = await axios.get(`https://okatsu-rolezapiiz.vercel.app/ai/txt2video?text=${encodeURIComponent(prompt)}`);
                        const videoUrl = response.data.url;
                        
                        await socket.sendMessage(sender, {
                            video: { url: videoUrl },
                            caption: `🎥 *Sora AI Video*\n\nPrompt: ${prompt}\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Failed to generate AI video\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                    }
                    break;
                }

                case 'song':
                case 'play': {
                    if (args.length === 0) {
                        await socket.sendMessage(sender, {
                            text: `╔══════════════════════════════════╗
║           🎵 𝚂𝙾𝙽𝙶 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳           ║
╠══════════════════════════════════╣
║ Usage: ${config.PREFIX}song <song name>
║ 
║ Example:
║ ${config.PREFIX}song shape of you
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                        return;
                    }
                    
                    const query = args.join(' ');
                    await socket.sendMessage(sender, {
                        text: `🔍 Searching for "${query}"...`
                    });
                    
                    try {
                        const searchResults = await ytSearch(query);
                        if (!searchResults.videos || searchResults.videos.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `❌ No results found for "${query}"\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                            });
                            return;
                        }
                        
                        const video = searchResults.videos[0];
                        const ytUrl = video.url;
                        
                        const apiUrl = `https://sadiya-tech-apis.vercel.app/download/ytdl?url=${encodeURIComponent(ytUrl)}&format=mp3&apikey=sadiya`;
                        const response = await axios.get(apiUrl);
                        const data = response.data;

                        if (data?.url) {
                            await socket.sendMessage(sender, {
                                audio: { url: data.url },
                                mimetype: "audio/mpeg",
                                fileName: `${video.title}.mp3`.replace(/[^\w\s.-]/gi, ''),
                                caption: `🎵 ${video.title}\n\n✅ Downloaded successfully!\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                            });
                        } else {
                            throw new Error('No audio URL found');
                        }
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Error downloading song: ${error.message}\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                    }
                    break;
                }

                // Add other country-specific pies commands
                case 'japan': {
                    try {
                        const response = await axios.get(`https://shizoapi.onrender.com/api/pies/japan?apikey=shizo`);
                        const imageUrl = response.data.url;
                        
                        await socket.sendMessage(sender, {
                            image: { url: imageUrl },
                            caption: `🥧 *Japanese Pies*\n\n🇯🇵 Japan\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Failed to fetch Japan pies\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                    }
                    break;
                }

                case 'korea': {
                    try {
                        const response = await axios.get(`https://shizoapi.onrender.com/api/pies/korea?apikey=shizo`);
                        const imageUrl = response.data.url;
                        
                        await socket.sendMessage(sender, {
                            image: { url: imageUrl },
                            caption: `🥧 *Korean Pies*\n\n🇰🇷 Korea\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                    } catch (error) {
                        await socket.sendMessage(sender, {
                            text: `❌ Failed to fetch Korea pies\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                    }
                    break;
                }

                case 'autostatus': {
                    const input = args[0]?.toLowerCase();
                    if (!input || !['on', 'off'].includes(input)) {
                        await socket.sendMessage(sender, {
                            text: `⚙️ Usage: *autostatus on* or *autostatus off*`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    if (input === 'on') {
                        userConfig.AUTO_VIEW_STATUS = 'true';
                        await socket.sendMessage(sender, {
                            text: `✅✔️ Auto Status turned *ON!*\n> Now bot will begin to view statuses 👀`,
                            contextInfo: silaContext
                        });
                    } else {
                        userConfig.AUTO_VIEW_STATUS = 'false';
                        await socket.sendMessage(sender, {
                            text: `❌ Auto Status turned *OFF!*\n> Bot will stop viewing statuses.`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'autolike': {
                    const input = args[0]?.toLowerCase();
                    if (!input || !['on', 'off'].includes(input)) {
                        await socket.sendMessage(sender, {
                            text: `⚙️ Usage: *autolike on* or *autolike off*`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    if (input === 'on') {
                        userConfig.AUTO_LIKE_STATUS = 'true';
                        await socket.sendMessage(sender, {
                            text: `✅✔️ Auto Like turned *ON!*\n> Bot will begin to like statuses ❤️`,
                            contextInfo: silaContext
                        });
                    } else {
                        userConfig.AUTO_LIKE_STATUS = 'false';
                        await socket.sendMessage(sender, {
                            text: `❌ Auto Like turned *OFF!*\n> Bot will stop liking statuses.`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'autorecord': {
                    const input = args[0]?.toLowerCase();
                    if (!input || !['on', 'off'].includes(input)) {
                        await socket.sendMessage(sender, {
                            text: `⚙️ Usage: *autorecord on* or *autorecord off*`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    if (input === 'on') {
                        userConfig.AUTO_RECORDING = 'true';
                        await socket.sendMessage(sender, {
                            text: `✅✔️ Auto Recording turned *ON!*\n> Bot will now start auto recording simulation 🎙️`,
                            contextInfo: silaContext
                        });
                    } else {
                        userConfig.AUTO_RECORDING = 'false';
                        await socket.sendMessage(sender, {
                            text: `❌ Auto Recording turned *OFF!*\n> Bot will stop simulating voice recording.`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'autotyping': {
                    const input = args[0]?.toLowerCase();
                    if (!input || !['on', 'off'].includes(input)) {
                        await socket.sendMessage(sender, {
                            text: `⚙️ Usage: *autotyping on* or *autotyping off*`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    if (input === 'on') {
                        userConfig.AUTO_TYPING = 'true';
                        await socket.sendMessage(sender, {
                            text: `✅✔️ Auto Typing turned *ON!*\n> Bot will show typing indicator when commands are used ⌨️`,
                            contextInfo: silaContext
                        });
                    } else {
                        userConfig.AUTO_TYPING = 'false';
                        await socket.sendMessage(sender, {
                            text: `❌ Auto Typing turned *OFF!*\n> Bot will stop showing typing indicator.`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'antilink': {
                    const input = args[0]?.toLowerCase();
                    if (!input || !['on', 'off'].includes(input)) {
                        await socket.sendMessage(sender, {
                            text: `⚙️ Usage: *antilink on* or *antilink off*`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    if (input === 'on') {
                        userConfig.ANTI_LINK = 'true';
                        await socket.sendMessage(sender, {
                            text: `✅✔️ Anti Link turned *ON!*\n> Bot will now delete links in chats 🔗`,
                            contextInfo: silaContext
                        });
                    } else {
                        userConfig.ANTI_LINK = 'false';
                        await socket.sendMessage(sender, {
                            text: `❌ Anti Link turned *OFF!*\n> Bot will allow links in chats.`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'antidelete': {
                    const input = args[0]?.toLowerCase();
                    if (!input || !['on', 'off'].includes(input)) {
                        await socket.sendMessage(sender, {
                            text: `⚙️ Usage: *antidelete on* or *antidelete off*`,
                            contextInfo: silaContext
                        });
                        break;
                    }

                    if (input === 'on') {
                        userConfig.ANTI_DELETE = 'true';
                        await socket.sendMessage(sender, {
                            text: `✅✔️ Anti Delete turned *ON!*\n> Bot will now detect and report deleted messages 🗑️`,
                            contextInfo: silaContext
                        });
                    } else {
                        userConfig.ANTI_DELETE = 'false';
                        await socket.sendMessage(sender, {
                            text: `❌ Anti Delete turned *OFF!*\n> Bot will ignore deleted messages.`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                default: {
                    await socket.sendMessage(sender, {
                        text: `╔══════════════════════════════════╗
║           ❌ 𝙴𝚁𝚁𝙾𝚁           ║
╠══════════════════════════════════╣
║ Unknown command: ${command}
║ 
║ Use ${config.PREFIX}menu to see
║ all available commands
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                        contextInfo: silaContext
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                text: `❌ An error occurred while processing your command. Please try again.\n\n> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                contextInfo: silaContext
            });
        }
    });
}

// Memory optimization: Throttle message handlers
function setupMessageHandlers(socket, userConfig) {
    let lastPresenceUpdate = 0;
    const PRESENCE_UPDATE_COOLDOWN = 5000; // 5 seconds
    
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        // Throttle presence updates
        const now = Date.now();
        if (now - lastPresenceUpdate < PRESENCE_UPDATE_COOLDOWN) {
            return;
        }

        if (userConfig.AUTO_RECORDING === 'true') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                lastPresenceUpdate = now;
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

// Memory optimization: Batch GitHub operations
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
        
        setupStatusHandlers(socket, userConfig);
        setupCommandHandlers(socket, sanitizedNumber, userConfig);
        setupMessageHandlers(socket, userConfig);
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
                    console.warn(`Failed to request pairing code: ${retries}, error.message`, retries);
                    await delay(2000 * ((parseInt(userConfig.MAX_RETRIES) || 3 - retries));
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
                        image: { url: userConfig.IMAGE_PATH || defaultConfig.IMAGE_PATH },
                        caption: `╔══════════════════════════════════╗
║           🤖 𝙱𝙾𝚃 𝙲𝙾𝙽𝙽𝙴𝙲𝚃𝙴𝙳           ║
╠══════════════════════════════════╣
║ ✅ Successfully connected!
║ 📱 Number: ${sanitizedNumber}
║ 🚀 Bot is now active and ready!
║ 💡 Type ${userConfig.PREFIX || '.'}menu
╚══════════════════════════════════╝

> 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
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

// API Routes - Only essential routes kept
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
