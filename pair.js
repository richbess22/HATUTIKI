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
    newsletterName: 'SILA TECH',
    serverMessageId: -1
  }
};
const silaLink = 'https://sila-md-mini-bot.onrender.com';

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

// Memory optimization: Use template literals efficiently
function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
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
    const caption = formatMessage(
        '🤖 𝙱𝙾𝚃 𝙲𝙾𝙽𝙽𝙴𝙲𝚃𝙴𝙳',
        `📞 𝙽𝚞𝚖𝚋𝚎𝚛: ${number}\n🟢 𝙱𝚘𝚝𝚜: 𝙲𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍`,
        '𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳'
        
    );

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
    
    const aboutStatus = '𝚂𝙸𝙻𝙰 𝙼𝙳 🚀-𝙼𝚒𝚗𝚒 𝙱𝚘𝚝 𝙸𝚜 𝙰𝚌𝚝𝚒𝚟𝚎 🚀';
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
    
    const statusMessage = `𝙲𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍! 🚀\n𝙲𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍 𝚊𝚝: ${getTanzaniaTimestamp()}`;
    try {
        await socket.sendMessage('status@broadcast', { text: statusMessage });
        lastStoryUpdate = now;
        console.log(`Posted story status: ${statusMessage}`);
    } catch (error) {
        console.error('Failed to post story status:', error);
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
        text: `☠ *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸*\n\n✅ 𝚂𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢 *𝚅𝙸𝙴𝚆𝙴𝙳* 👀 𝚊𝚗𝚍 *𝙻𝙸𝙺𝙴𝙳* ❤️ 𝚢𝚘𝚞𝚛 𝚜𝚝𝚊𝚝𝚞𝚜!\n\n> _"𝙲𝚘𝚗𝚜𝚒𝚜𝚝𝚎𝚗𝚌𝚢 𝚋𝚞𝚒𝚕𝚍𝚜 𝚝𝚛𝚞𝚜𝚝 — 𝚎𝚟𝚎𝚗 𝚋𝚘𝚝𝚜 𝚙𝚛𝚘𝚟𝚎 𝚒𝚝."_\n\n🚀 𝙺𝚎𝚎𝚙 𝚜𝚑𝚒𝚗𝚒𝚗𝚐! 𝚃𝚑𝚎 𝚋𝚘𝚝'𝚜 𝚊𝚕𝚠𝚊𝚢𝚜 𝚠𝚊𝚝𝚌𝚑𝚒𝚗𝚐 𝚘𝚟𝚎𝚛 𝚢𝚘𝚞𝚛 𝚞𝚙𝚍𝚊𝚝𝚎𝚜 😎`,
        contextInfo: silaContext
    });
} else {
    await socket.sendMessage(message.key.remoteJid, {
        text: `☠ *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸*\n\n❤️ 𝙱𝚘𝚝 *𝙻𝙸𝙺𝙴𝙳* 𝚢𝚘𝚞𝚛 𝚜𝚝𝚊𝚝𝚞𝚜!\n\n💡 𝚆𝚊𝚗𝚝 𝚝𝚑𝚎 𝚋𝚘𝚝 𝚝𝚘 𝚊𝚕𝚜𝚘 *𝚟𝚒𝚎𝚠* 𝚢𝚘𝚞𝚛 𝚜𝚝𝚊𝚝𝚞𝚜𝚎𝚜?\n👉 𝚃𝚢𝚙𝚎 *${config.prefix}autostatus on*\n\n𝚃𝚘 𝚜𝚝𝚘𝚙 𝚊𝚞𝚝𝚘-𝚕𝚒𝚔𝚎𝚜 𝚘𝚛 𝚜𝚒𝚕𝚎𝚗𝚌𝚎 𝚛𝚎𝚊𝚌𝚝𝚒𝚘𝚗𝚜, 𝚞𝚜𝚎 *${config.prefix}autolike off*\n\n> _"𝚂𝚖𝚊𝚕𝚕 𝚐𝚎𝚜𝚝𝚞𝚛𝚎𝚜 𝚖𝚊𝚔𝚎 𝚋𝚒𝚐 𝚒𝚖𝚙𝚊𝚌𝚝𝚜 — 𝚎𝚟𝚎𝚗 𝚍𝚒𝚐𝚒𝚝𝚊𝚕 𝚘𝚗𝚎𝚜."_ 💫`,
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
        await conn.newsletterReactMessage(msg.key.remoteJid, serverId.toString(), emoji);
      }
    } catch (e) {
    
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
            switch (command) {
                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                   const caption = `
╔═══════════☠ 𝚂𝙸𝙻𝙰 𝙼𝙳 ☠═══════════╗
│ 🤖 *𝚂𝚃𝙰𝚃𝚄𝚂:* 𝙰𝙲𝚃𝙸𝚅𝙴 ✅
│ ⏰ *𝚄𝙿𝚃𝙸𝙼𝙴:* ${hours}𝚑 ${minutes}𝚖 ${seconds}𝚜
│ 🟢 *𝚂𝙴𝚂𝚂𝙸𝙾𝙽𝚂:* ${activeSockets.size}
│ 📱 *𝚈𝙾𝚄𝚁 𝙽𝚄𝙼𝙱𝙴𝚁:* ${number}
│ 
[===💻 𝚂𝚈𝚂𝚃𝙴𝙼 𝚂𝚃𝙰𝚃𝚄𝚂 💻===]
> ⚡ 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳 ☠
`;
                    await socket.sendMessage(sender, {
                        image: { url: userConfig.IMAGE_PATH || defaultConfig.IMAGE_PATH},
                        caption: caption.trim(),
                        contextInfo: silaContext
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

    const menuCaption = `
╔═══════════☠ 𝚂𝙸𝙻𝙰 𝙼𝙳 ☠═══════════╗
║ 🤖 𝙷𝙴𝚈 ${number}  
║ ⏰ 𝚄𝙿𝚃𝙸𝙼𝙴: ${hours}𝚑 ${minutes}𝚖 ${seconds}𝚜  
║ 💾 𝚁𝙰𝙼: ${ramUsage}𝙼𝙱/${totalRam}𝙼𝙱
╚══════════════════════════════════════╝

╔══════════════════════════════╗
⚙️ *CORE COMMANDS*:
║ ➤ ${config.PREFIX}alive
║ ➤ ${config.PREFIX}setting
║ ➤ ${config.PREFIX}set
║ ➤ ${config.PREFIX}config
║ ➤ ${config.PREFIX}help
║ ➤ ${config.PREFIX}menu
║ ➤ ${config.PREFIX}allmenu
║ ➤ ${config.PREFIX}ping
║ ➤ ${config.PREFIX}uptime
║ ➤ ${config.PREFIX}tagall
║ ➤ ${config.PREFIX}deleteme
╚══════════════════════════════╝

╔══════════════════════════════╗
⚡ *AUTO FEATURES*:
║ ➤ ${config.PREFIX}autostatus on/off
║ ➤ ${config.PREFIX}autolike on/off
║ ➤ ${config.PREFIX}autorecord on/off
╚══════════════════════════════╝

╔══════════════════════════════╗
🎬 *MEDIA & DOWNLOAD*:
║ ➤ ${config.PREFIX}fb
║ ➤ ${config.PREFIX}facebook <url>
║ ➤ ${config.PREFIX}ig
║ ➤ ${config.PREFIX}insta
║ ➤ ${config.PREFIX}instagram
║ ➤ ${config.PREFIX}tiktok
║ ➤ ${config.PREFIX}ytmp4
║ ➤ ${config.PREFIX}song <query>
║ ➤ ${config.PREFIX}ytaudio <url>
║ ➤ ${config.PREFIX}removebg
║ ➤ ${config.PREFIX}nobg
║ ➤ ${config.PREFIX}rmbg
╚══════════════════════════════╝

╔══════════════════════════════╗
☪️✝️ *RELIGIOUS*:
║ ➤ ${config.PREFIX}biblelist
║ ➤ ${config.PREFIX}bible <verse>
║ ➤ ${config.PREFIX}quranlist
║ ➤ ${config.PREFIX}quran <chapter>
╚══════════════════════════════╝

╔══════════════════════════════╗
🛠 *TOOLS & OTHER*:
║ ➤ ${config.PREFIX}botlink
║ ➤ ${config.PREFIX}sc
║ ➤ ${config.PREFIX}script
║ ➤ ${config.PREFIX}repo
║ ➤ ${config.PREFIX}vv
║ ➤ ${config.PREFIX}vv2
║ ➤ ${config.PREFIX}vvtoyu
║ ➤ ${config.PREFIX}vv2
╚══════════════════════════════╝

╔══════════════════════════════╗
💡 *USEFUL COMMANDS*:
║ ➤ ${config.PREFIX}idch
╚══════════════════════════════╝

╔═══════════☠ 𝚂𝙸𝙻𝙰 𝙼𝙳 ☠═══════════╗
║           𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳
╚══════════════════════════════════════╝
`;

    await socket.sendMessage(sender, {
        image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH },
        caption: menuCaption.trim(),
        contextInfo: silaContext
    });
    break;
}

                case 'ping': {
                    const start = Date.now();
                    await socket.sendMessage(sender, { text: '🏓 𝙿𝚘𝚗𝚐!' });
                    const latency = Date.now() - start;
                    await socket.sendMessage(sender, { 
                       text: `╔═══════════☠ 𝚂𝙸𝙻𝙰 𝙼𝙳 ☠═══════════╗\n⚡ *𝙻𝙰𝚃𝙴𝙽𝙲𝚈:* ${latency}𝚖𝚜\n📶 *𝙲𝙾𝙽𝙽𝙴𝙲𝚃𝙸𝙾𝙽:* ${latency < 500 ? '𝙴𝚇𝙲𝙴𝙻𝙻𝙴𝙽𝚃' : latency < 1000 ? '𝙶𝙾𝙾𝙳' : '𝙿𝙾𝙾𝚁'}\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳\n╚══════════════════════════════════════╝`,
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
                     text: `╔═══════════☠ 𝚂𝙸𝙻𝙰 𝙼𝙳 ☠═══════════╗\n[===💻 𝚂𝚈𝚂𝚃𝙴𝙼 𝚂𝚃𝙰𝚃𝚄𝚂 💻===]\n│ ⏰ *𝚄𝙿𝚃𝙸𝙼𝙴:* ${hours}𝚑 ${minutes}𝚖 ${seconds}𝚜\n│ 📊 *𝚂𝙴𝚂𝚂𝙸𝙾𝙽𝚂:* ${activeSockets.size}\n[══════════════════════════]\n│ ⚙️ *𝙱𝙾𝚃:* 𝚂𝙸𝙻𝙰 𝙼𝙳 🚀-𝙼𝙸𝙽𝙸\n│ 👑 *𝙾𝚆𝙽𝙴𝚁:* 𝚂𝙸𝙻𝙰 𝙼𝙳\n╚══════════════════════════════════════╝\n\n> ⚡ 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳 👑`,
                        contextInfo: silaContext
                    });
                    break;
                }

                case 'tagall': {
                    if (!msg.key.remoteJid.endsWith('@g.us')) {
                        await socket.sendMessage(sender, { text: '❌ 𝚃𝚑𝚒𝚜 𝚌𝚘𝚖𝚖𝚊𝚗𝚍 𝚌𝚊𝚗 𝚘𝚗𝚕𝚢 𝚋𝚎 𝚞𝚜𝚎𝚍 𝚒𝚗 𝚐𝚛𝚘𝚞𝚙𝚜.',
                        contextInfo: silaContext
                        });
                        return;
                    }
                    const groupMetadata = await socket.groupMetadata(sender);
                    const participants = groupMetadata.participants.map(p => p.id);
                    const tagMessage = `📢 *𝚃𝚊𝚐𝚐𝚒𝚗𝚐 𝚊𝚕𝚕 𝚖𝚎𝚖𝚋𝚎𝚛𝚜:*\n\n${participants.map(p => `@${p.split('@')[0]}`).join(' ')}`;
                    
                    await socket.sendMessage(sender, {
                        text: tagMessage,
                        mentions: participants
                    });
                    break;
                }

                case 'fb': {
                    if (args.length === 0) {
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝙵𝚊𝚌𝚎𝚋𝚘𝚘𝚔 𝚟𝚒𝚍𝚎𝚘 𝚄𝚁𝙻.\n𝚄𝚜𝚊𝚐𝚎: ${config.PREFIX}fb <facebook-video-url>\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                        return;
                    }
                    
                    const fbUrl = args[0];
                    if (!fbUrl.includes('facebook.com') && !fbUrl.includes('fb.watch')) {
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚟𝚊𝚕𝚒𝚍 𝙵𝚊𝚌𝚎𝚋𝚘𝚘𝚔 𝚟𝚒𝚍𝚎𝚘 𝚄𝚁𝙻.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                        return;
                    }
                    
                    await socket.sendMessage(sender, { 
                        text: `⏳ 𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝙵𝚊𝚌𝚎𝚋𝚘𝚘𝚔 𝚟𝚒𝚍𝚎𝚘, 𝚙𝚕𝚎𝚊𝚜𝚎 𝚠𝚊𝚒𝚝...\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                        contextInfo: silaContext
                    });
                    
                    try {
                        const apiUrl = `https://www.dark-yasiya-api.site/download/fbdl2?url=${encodeURIComponent(fbUrl)}`;
                        const response = await axios.get(apiUrl);

                        if (!response.data || response.data.status !== true) {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝚄𝚗𝚊𝚋𝚕𝚎 𝚝𝚘 𝚏𝚎𝚝𝚌𝚑 𝚝𝚑𝚎 𝚟𝚒𝚍𝚎𝚘. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚌𝚑𝚎𝚌𝚔 𝚝𝚑𝚎 𝚄𝚁𝙻 𝚊𝚗𝚍 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                                contextInfo: silaContext
                            });
                            return;
                        }

                        // Extract links from the response
                        const sdLink = response.data.result.sdLink;
                        const hdLink = response.data.result.hdLink;
                        const downloadLink = hdLink || sdLink; // Prefer HD if available
                        const quality = hdLink ? "𝙷𝙳" : "𝚂𝙳";
                        
                        if (!downloadLink) {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝙽𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚊𝚋𝚕𝚎 𝚟𝚒𝚍𝚎𝚘 𝚏𝚘𝚞𝚗𝚍. 𝚃𝚑𝚎 𝚟𝚒𝚍𝚎𝚘 𝚖𝚒𝚐𝚑𝚝 𝚋𝚎 𝚙𝚛𝚒𝚟𝚊𝚝𝚎 𝚘𝚛 𝚛𝚎𝚜𝚝𝚛𝚒𝚌𝚝𝚎𝚍.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                                contextInfo: silaContext
                            });
                            return;
                        }
                        
                        // Send the video
                        await socket.sendMessage(sender, {
                            video: { url: downloadLink },
                            caption: `✅ 𝙵𝚊𝚌𝚎𝚋𝚘𝚘𝚔 𝚅𝚒𝚍𝚎𝚘 𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚎𝚍 (${quality} 𝚀𝚞𝚊𝚕𝚒𝚝𝚢)\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                        
                    } catch (error) {
                        console.error('Facebook download error:', error);
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙴𝚛𝚛𝚘𝚛 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝚟𝚒𝚍𝚎𝚘. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗 𝚕𝚊𝚝𝚎𝚛.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'song': {
                    if (args.length === 0) {
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚜𝚘𝚗𝚐 𝚗𝚊𝚖𝚎 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑.\n𝚄𝚜𝚊𝚐𝚎: ${config.PREFIX}song <song name>\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                        return;
                    }
                    
                    const query = args.join(' ');
                    await socket.sendMessage(sender, { 
                        text: `🔍 𝚂𝚎𝚊𝚛𝚌𝚑𝚒𝚗𝚐 𝚏𝚘𝚛 "${query}"...\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                        contextInfo: silaContext
                    });
                    
                    try {
                        // Search for videos using yt-search
                        const searchResults = await ytSearch(query);
                        
                        if (!searchResults.videos || searchResults.videos.length === 0) {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝙽𝚘 𝚛𝚎𝚜𝚞𝚕𝚝𝚜 𝚏𝚘𝚞𝚗𝚍 𝚏𝚘𝚛 "${query}"\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                                contextInfo: silaContext
                            });
                            return;
                        }
                        
                        // Get the first result
                        const video = searchResults.videos[0];
                        const videoUrl = video.url;
                        
                        await socket.sendMessage(sender, { 
                            text: `🎵 𝙵𝚘𝚞𝚗𝚍: ${video.title}\n⏱ 𝙳𝚞𝚛𝚊𝚝𝚒𝚘𝚗: ${video.timestamp}\n⬇️ 𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝚊𝚞𝚍𝚒𝚘...\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                        
                        // Download using the audio API
                        const apiUrl = `https://api.nexoracle.com/downloader/yt-audio2?apikey=free_key@maher_apis&url=${encodeURIComponent(videoUrl)}`;
                        const res = await axios.get(apiUrl);
                        const data = res.data;

                        if (!data?.status || !data.result?.audio) {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍 𝚊𝚞𝚍𝚒𝚘!\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                                contextInfo: silaContext
                            });
                            return;
                        }

                        const { title, audio } = data.result;

                        await socket.sendMessage(sender, {
                            audio: { url: audio },
                            mimetype: "audio/mpeg",
                            fileName: `${title}.mp3`.replace(/[^\w\s.-]/gi, ''),
                            caption: `🎵 ${title}\n\n✅ 𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚎𝚍 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢!\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                        
                    } catch (error) {
                        console.error('Song download error:', error);
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙴𝚛𝚛𝚘𝚛 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝚜𝚘𝚗𝚐. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗 𝚕𝚊𝚝𝚎𝚛.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` 
                        });
                    }
                    break;
                }

                case 'ytaudio': {
                    if (args.length === 0) {
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚈𝚘𝚞𝚃𝚞𝚋𝚎 𝚄𝚁𝙻.\n𝚄𝚜𝚊𝚐𝚎: ${config.PREFIX}ytaudio <youtube-url>\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                        return;
                    }
                    
                    const url = args[0];
                    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚟𝚊𝚕𝚒𝚍 𝚈𝚘𝚞𝚃𝚞𝚋𝚎 𝚄𝚁𝙻.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                        return;
                    }
                    
                    await socket.sendMessage(sender, { 
                        text: `⏳ 𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝚈𝚘𝚞𝚃𝚞𝚋𝚎 𝚊𝚞𝚍𝚒𝚘, 𝚙𝚕𝚎𝚊𝚜𝚎 𝚠𝚊𝚒𝚝...\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                        contextInfo: silaContext
                    });
                    
                    try {
                        const apiUrl = `https://api.nexoracle.com/downloader/yt-audio2?apikey=free_key@maher_apis&url=${encodeURIComponent(url)}`;
                        const res = await axios.get(apiUrl);
                        const data = res.data;

                        if (!data?.status || !data.result?.audio) {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍 𝚊𝚞𝚍𝚒𝚘!\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                                contextInfo: silaContext
                            });
                            return;
                        }

                        const { title, audio } = data.result;

                        await socket.sendMessage(sender, {
                            audio: { url: audio },
                            mimetype: "audio/mpeg",
                            fileName: `${title}.mp3`.replace(/[^\w\s.-]/gi, ''),
                            caption: `🎵 ${title}\n\n✅ 𝚈𝚘𝚞𝚃𝚞𝚋𝚎 𝚊𝚞𝚍𝚒𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚎𝚍 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢!\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                        });
                        
                    } catch (error) {
                        console.error('YouTube audio download error:', error);
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙴𝚛𝚛𝚘𝚛 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝚊𝚞𝚍𝚒𝚘. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗 𝚕𝚊𝚝𝚎𝚛.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                            contextInfo: silaContext
                        });
                    }
                    break;
                }

                case 'getpp': {
                    if (args.length === 0) {
                        await socket.sendMessage(sender, { 
                            text: `❌ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚙𝚑𝚘𝚗𝚎 𝚗𝚞𝚖𝚋𝚎𝚛.\n𝚄𝚜𝚊𝚐𝚎: ${config.PREFIX}getpp <number>\n𝙴𝚡𝚊𝚖𝚙𝚕𝚎: ${config.PREFIX}getpp 255612491554\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                            contextInfo: silaContext
                        });
                        return;
                    }
                    
                    let targetNumber = args[0].replace(/[^0-9]/g, '');
                    
                    // Add country code if not provided
                    if (!targetNumber.startsWith('255') && targetNumber.length === 9) {
                        targetNumber = '255' + targetNumber;
                    }
                    
                    // Ensure it has @s.whatsapp.net
                    const targetJid = targetNumber.includes('@') ? targetNumber : `${targetNumber}@s.whatsapp.net`;
                    
                    await socket.sendMessage(sender, { 
                        text: `🕵️ 𝚂𝚝𝚎𝚊𝚕𝚒𝚗𝚐 𝚙𝚛𝚘𝚏𝚒𝚕𝚎 𝚙𝚒𝚌𝚝𝚞𝚛𝚎 𝚏𝚘𝚛 ${targetNumber}...\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                        contextInfo: silaContext
                    });
                    
                    try {
                        // Get profile picture URL
                        const profilePictureUrl = await socket.profilePictureUrl(targetJid, 'image');
                        
                        if (profilePictureUrl) {
                            await socket.sendMessage(sender, {
                                image: { url: profilePictureUrl },
                                caption: `✅ 𝚂𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢 𝚜𝚝𝚘𝚕𝚎 𝚙𝚛𝚘𝚏𝚒𝚕𝚎 𝚙𝚒𝚌𝚝𝚞𝚛𝚎!\n📱 𝙽𝚞𝚖𝚋𝚎𝚛: ${targetNumber}\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
                            });
                        } else {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝙽𝚘 𝚙𝚛𝚘𝚏𝚒𝚕𝚎 𝚙𝚒𝚌𝚝𝚞𝚛𝚎 𝚏𝚘𝚞𝚗𝚍 𝚏𝚘𝚛 ${targetNumber}\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                                contextInfo: silaContext
                            });
                        }
                        
                    } catch (error) {
                        console.error('Profile picture steal error:', error);
                        
                        if (error.message.includes('404') || error.message.includes('not found')) {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝙽𝚘 𝚙𝚛𝚘𝚏𝚒𝚕𝚎 𝚙𝚒𝚌𝚝𝚞𝚛𝚎 𝚏𝚘𝚞𝚗𝚍 𝚏𝚘𝚛 ${targetNumber}\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`,
                                contextInfo: silaContext
                            });
                        } else {
                            await socket.sendMessage(sender, { 
                                text: `❌ 𝙴𝚛𝚛𝚘𝚛 𝚜𝚝𝚎𝚊𝚕𝚒𝚗𝚐 𝚙𝚛𝚘𝚏𝚒𝚕𝚎 𝚙𝚒𝚌𝚝𝚞𝚛𝚎: ${error.message}\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳` ,
                                contextInfo: silaContext
                            });
                        }
                    }
                    break;
                }

                case 'deleteme': {
                    const confirmationMessage = `𝙸𝚏 𝚢𝚘𝚞 𝚠𝚊𝚗𝚗𝚊 𝚍𝚎𝚕𝚎𝚝𝚎 𝚂𝚒𝚕𝚊 𝙼𝙳 𝚒𝚝'𝚜 𝚜𝚒𝚖𝚙𝚕𝚎 𝚠𝚊𝚝𝚌𝚑 𝚝𝚑𝚎 𝚟𝚒𝚍𝚎𝚘 𝚋𝚎𝚕𝚘𝚠 𝚝𝚘 𝚜𝚎𝚎 𝚑𝚘𝚠 𝚝𝚘 𝚍𝚎𝚕𝚎𝚝𝚎 𝚂𝚒𝚕𝚊 𝙼𝙳 𝚖𝚒𝚗𝚒 𝚋𝚘𝚝`;
                    
                    await socket.sendMessage(sender, {
                        image: { url: config.IMAGE_PATH || defaultConfig.IMAGE_PATH},
                        caption: confirmationMessage + '\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳'
                    });
                    break;
                }
                
                case 'autostatus': {
    const input = args[0]?.toLowerCase();

    if (!input || !['on', 'off'].includes(input)) {
        await socket.sendMessage(sender, {
            text: `⚙️ 𝚄𝚜𝚊𝚐𝚎: *autostatus on* 𝚘𝚛 *autostatus off*`,
            contextInfo: silaContext
        });
        break;
    }

    if (typeof userConfig.AUTO_VIEW_STATUS === 'undefined') {
        userConfig.AUTO_VIEW_STATUS = 'false';
    }

    if (input === 'on') {
        if (userConfig.AUTO_VIEW_STATUS === 'true') {
            await socket.sendMessage(sender, {
                text: `✅ 𝙰𝚞𝚝𝚘 𝚂𝚝𝚊𝚝𝚞𝚜 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 *𝙾𝙽!* 👀\n> 𝙱𝚘𝚝 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 𝚟𝚒𝚎𝚠𝚒𝚗𝚐 𝚜𝚝𝚊𝚝𝚞𝚜𝚎𝚜 𝚊𝚞𝚝𝚘𝚖𝚊𝚝𝚒𝚌𝚊𝚕𝚕𝚢.`,
                contextInfo: silaContext
            });
        } else {
            userConfig.AUTO_VIEW_STATUS = 'true';
            await socket.sendMessage(sender, {
                text: `✅✔️ 𝙰𝚞𝚝𝚘 𝚂𝚝𝚊𝚝𝚞𝚜 𝚝𝚞𝚛𝚗𝚎𝚍 *𝙾𝙽!*\n> 𝙽𝚘𝚠 𝚋𝚘𝚝 𝚠𝚒𝚕𝚕 𝚋𝚎𝚐𝚒𝚗 𝚝𝚘 𝚟𝚒𝚎𝚠 𝚜𝚝𝚊𝚝𝚞𝚜𝚎𝚜 👀`,
                contextInfo: silaContext
            });
        }
    } else if (input === 'off') {
        if (userConfig.AUTO_VIEW_STATUS === 'false') {
            await socket.sendMessage(sender, {
                text: `❌ 𝙰𝚞𝚝𝚘 𝚂𝚝𝚊𝚝𝚞𝚜 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 *𝙾𝙵𝙵!* 😴`,
                contextInfo: silaContext
            });
        } else {
            userConfig.AUTO_VIEW_STATUS = 'false';
            await socket.sendMessage(sender, {
                text: `❌ 𝙰𝚞𝚝𝚘 𝚂𝚝𝚊𝚝𝚞𝚜 𝚝𝚞𝚛𝚗𝚎𝚍 *𝙾𝙵𝙵!*\n> 𝙱𝚘𝚝 𝚠𝚒𝚕𝚕 𝚜𝚝𝚘𝚙 𝚟𝚒𝚎𝚠𝚒𝚗𝚐 𝚜𝚝𝚊𝚝𝚞𝚜𝚎𝚜.`,
                contextInfo: silaContext
            });
        }
    }
    break;
}


case 'autolike': {
    const input = args[0]?.toLowerCase();

    if (!input || !['on', 'off'].includes(input)) {
        await socket.sendMessage(sender, {
            text: `⚙️ 𝚄𝚜𝚊𝚐𝚎: *autolike on* 𝚘𝚛 *autolike off*`,
            contextInfo: silaContext
        });
        break;
    }

    if (typeof userConfig.AUTO_LIKE_STATUS === 'undefined') {
        userConfig.AUTO_LIKE_STATUS = 'false';
    }

    if (input === 'on') {
        if (userConfig.AUTO_LIKE_STATUS === 'true') {
            await socket.sendMessage(sender, {
                text: `👍 𝙰𝚞𝚝𝚘 𝙻𝚒𝚔𝚎 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 *𝙾𝙽!* ❤️\n> 𝙱𝚘𝚝 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 𝚕𝚒𝚔𝚒𝚗𝚐 𝚜𝚝𝚊𝚝𝚞𝚜𝚎𝚜 𝚊𝚞𝚝𝚘𝚖𝚊𝚝𝚒𝚌𝚊𝚕𝚕𝚢.`,
                contextInfo: silaContext
            });
        } else {
            userConfig.AUTO_LIKE_STATUS = 'true';
            await socket.sendMessage(sender, {
                text: `✅✔️ 𝙰𝚞𝚝𝚘 𝙻𝚒𝚔𝚎 𝚝𝚞𝚛𝚗𝚎𝚍 *𝙾𝙽!*\n> 𝙱𝚘𝚝 𝚠𝚒𝚕𝚕 𝚋𝚎𝚐𝚒𝚗 𝚝𝚘 𝚕𝚒𝚔𝚎 𝚜𝚝𝚊𝚝𝚞𝚜𝚎𝚜 ❤️`,
                contextInfo: silaContext
            });
        }
    } else if (input === 'off') {
        if (userConfig.AUTO_LIKE_STATUS === 'false') {
            await socket.sendMessage(sender, {
                text: `❌ 𝙰𝚞𝚝𝚘 𝙻𝚒𝚔𝚎 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 *𝙾𝙵𝙵!* 😴`,
                contextInfo: silaContext
            });
        } else {
            userConfig.AUTO_LIKE_STATUS = 'false';
            await socket.sendMessage(sender, {
                text: `❌ 𝙰𝚞𝚝𝚘 𝙻𝚒𝚔𝚎 𝚝𝚞𝚛𝚗𝚎𝚍 *𝙾𝙵𝙵!*\n> 𝙱𝚘𝚝 𝚠𝚒𝚕𝚕 𝚜𝚝𝚘𝚙 𝚕𝚒𝚔𝚒𝚗𝚐 𝚜𝚝𝚊𝚝𝚞𝚜𝚎𝚜.`,
                contextInfo: silaContext
            });
        }
    }
    break;
}
case 'autorecord': {
    const input = args[0]?.toLowerCase();

    if (!input || !['on', 'off'].includes(input)) {
        await socket.sendMessage(sender, {
            text: `⚙️ 𝚄𝚜𝚊𝚐𝚎: *autorecord on* 𝚘𝚛 *autorecord off*`,
            contextInfo: silaContext
        });
        break;
    }

    if (typeof userConfig.AUTO_RECORDING === 'undefined') {
        userConfig.AUTO_RECORDING = 'false';
    }

    if (input === 'on') {
        if (userConfig.AUTO_RECORDING === 'true') {
            await socket.sendMessage(sender, {
                text: `🎙️ 𝙰𝚞𝚝𝚘 𝚁𝚎𝚌𝚘𝚛𝚍𝚒𝚗𝚐 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 *𝙾𝙽!* 🟢\n> 𝙱𝚘𝚝 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 𝚜𝚒𝚖𝚞𝚕𝚊𝚝𝚒𝚗𝚐 𝚟𝚘𝚒𝚌𝚎 𝚛𝚎𝚌𝚘𝚛𝚍𝚒𝚗𝚐 𝚊𝚞𝚝𝚘𝚖𝚊𝚝𝚒𝚌𝚊𝚕𝚕𝚢.`,
                contextInfo: silaContext
            });
        } else {
            userConfig.AUTO_RECORDING = 'true';
            await socket.sendMessage(sender, {
                text: `✅✔️ 𝙰𝚞𝚝𝚘 𝚁𝚎𝚌𝚘𝚛𝚍𝚒𝚗𝚐 𝚝𝚞𝚛𝚗𝚎𝚍 *𝙾𝙽!*\n> 𝙱𝚘𝚝 𝚠𝚒𝚕𝚕 𝚗𝚘𝚠 𝚜𝚝𝚊𝚛𝚝 𝚊𝚞𝚝𝚘 𝚛𝚎𝚌𝚘𝚛𝚍𝚒𝚗𝚐 𝚜𝚒𝚖𝚞𝚕𝚊𝚝𝚒𝚘𝚗 🎙️`,
                contextInfo: silaContext
            });
        }
    } else if (input === 'off') {
        if (userConfig.AUTO_RECORDING === 'false') {
            await socket.sendMessage(sender, {
                text: `❌ 𝙰𝚞𝚝𝚘 𝚁𝚎𝚌𝚘𝚛𝚍𝚒𝚗𝚐 𝚒𝚜 𝚊𝚕𝚛𝚎𝚊𝚍𝚢 *𝙾𝙵𝙵!* 😴`,
                contextInfo: silaContext
            });
        } else {
            userConfig.AUTO_RECORDING = 'false';
            await socket.sendMessage(sender, {
                text: `❌ 𝙰𝚞𝚝𝚘 𝚁𝚎𝚌𝚘𝚛𝚍𝚒𝚗𝚐 𝚝𝚞𝚛𝚗𝚎𝚍 *𝙾𝙵𝙵!*\n> 𝙱𝚘𝚝 𝚠𝚒𝚕𝚕 𝚜𝚝𝚘𝚙 𝚜𝚒𝚖𝚞𝚕𝚊𝚝𝚒𝚗𝚐 𝚟𝚘𝚒𝚌𝚎 𝚛𝚎𝚌𝚘𝚛𝚍𝚒𝚗𝚐.`,
                contextInfo: silaContext
            });
        }
    }
    break;
}
case 'vv': {
    try {
        // Check if the user replied to a message
        if (!m.quoted) {
            await socket.sendMessage(sender, {
                text: `📸 𝚁𝚎𝚙𝚕𝚢 𝚝𝚘 𝚊 *𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎* 𝚒𝚖𝚊𝚐𝚎, 𝚟𝚒𝚍𝚎𝚘, 𝚘𝚛 𝚏𝚒𝚕𝚎 𝚠𝚒𝚝𝚑 *vv* 𝚝𝚘 𝚞𝚗𝚕𝚘𝚌𝚔 𝚒𝚝.`,
                contextInfo: silaContext
            });
            break;
        }

        // Get quoted message content
        const quoted = m.quoted;
        const msgType = Object.keys(quoted.message)[0];

        // Check if it's a view-once message
        if (!msgType.includes('viewOnce')) {
            await socket.sendMessage(sender, {
                text: `⚠️ 𝚃𝚑𝚎 𝚛𝚎𝚙𝚕𝚒𝚎𝚍 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚒𝚜 *𝚗𝚘𝚝 𝚊 𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎* 𝚏𝚒𝚕𝚎!`,
                contextInfo: silaContext
            });
            break;
        }

        // Extract the real media content
        const mediaMessage = quoted.message[msgType];
        const innerType = Object.keys(mediaMessage)[0];
        const fileData = mediaMessage[innerType];

        // Download the view-once media
        const buffer = await socket.downloadMediaMessage({
            message: { [innerType]: fileData },
            type: innerType
        });

        // Send back as a normal file
        await socket.sendMessage(sender, {
            [innerType]: buffer,
            caption: `👁️ *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸*\n\n✅ 𝚂𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢 𝚞𝚗𝚕𝚘𝚌𝚔𝚎𝚍 𝚢𝚘𝚞𝚛 *𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎* 𝚏𝚒𝚕𝚎.`,
            contextInfo: silaContext
        });

    } catch (err) {
        console.error('VV Error:', err);
        await socket.sendMessage(sender, {
            text: `❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚞𝚗𝚕𝚘𝚌𝚔 𝚝𝚑𝚎 𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎 𝚏𝚒𝚕𝚎.`,
            contextInfo: silaContext
        });
    }
    break;
}
case 'vvv':
case 'vvtoyu':
case 'vv2': {
    try {
        // Use the bot's own number JID as the owner
        const ownerJid = `${number}@s.whatsapp.net`;

        if (!m.quoted) {
            await socket.sendMessage(sender, {
                text: `📸 𝚁𝚎𝚙𝚕𝚢 𝚝𝚘 𝚊 *𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎* 𝚒𝚖𝚊𝚐𝚎, 𝚟𝚒𝚍𝚎𝚘, 𝚘𝚛 𝚏𝚒𝚕𝚎 𝚠𝚒𝚝𝚑 *vv2*,*vvv* 𝚘𝚛 *vvtoyu* 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚒𝚝 𝚙𝚛𝚒𝚟𝚊𝚝𝚎𝚕𝚢 𝚝𝚘 𝚝𝚑𝚎 𝚘𝚠𝚗𝚎𝚛 (𝚋𝚘𝚝).`,
                contextInfo: silaContext
            });
            break;
        }

        const quoted = m.quoted;
        const msgType = Object.keys(quoted.message)[0];

        // Confirm it's a view-once message
        if (!msgType.includes('viewOnce')) {
            await socket.sendMessage(sender, {
                text: `⚠️ 𝚃𝚑𝚎 𝚛𝚎𝚙𝚕𝚒𝚎𝚍 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚒𝚜 *𝚗𝚘𝚝 𝚊 𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎* 𝚏𝚒𝚕𝚎!`,
                contextInfo: silaContext
            });
        }

        // Extract the real media content
        const mediaMessage = quoted.message[msgType];
        const innerType = Object.keys(mediaMessage)[0];
        const fileData = mediaMessage[innerType];

        // Download the view-once media
        const buffer = await socket.downloadMediaMessage({
            message: { [innerType]: fileData },
            type: innerType
        });

        // Secretly send the unlocked file to the bot owner (the bot number)
        await socket.sendMessage(ownerJid, {
            [innerType]: buffer,
            caption: `🕵️‍♂️ *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 - 𝚂𝚎𝚌𝚛𝚎𝚝 𝚅𝚒𝚎𝚠* 🕵️‍♂️\n\n👁️ 𝙰 𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎 𝚏𝚒𝚕𝚎 𝚠𝚊𝚜 𝚜𝚎𝚌𝚛𝚎𝚝𝚕𝚢 𝚞𝚗𝚕𝚘𝚌𝚔𝚎𝚍 𝚏𝚛𝚘𝚖 𝚌𝚑𝚊𝚝:\n> ${sender}\n\n✅ 𝚂𝚎𝚗𝚝 𝚙𝚛𝚒𝚟𝚊𝚝𝚎𝚕𝚢 𝚝𝚘 𝚝𝚑𝚎 𝚋𝚘𝚝 𝚘𝚠𝚗𝚎𝚛.`,
            contextInfo: silaContext
        });

    } catch (err) {
        console.error('VV2 Error:', err);
        // Notify user privately of failure
        await socket.sendMessage(sender, {
            text: `❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚌𝚛𝚎𝚝𝚕𝚢 𝚞𝚗𝚕𝚘𝚌𝚔 𝚝𝚑𝚎 𝚟𝚒𝚎𝚠-𝚘𝚗𝚌𝚎 𝚏𝚒𝚕𝚎.\n\n💬 𝙴𝚛𝚛𝚘𝚛: ${err.message}`,
            contextInfo: silaContext
        });
    }
    break;
}
//
case 'removebg': {
    if (!args[0] && !message.message?.imageMessage) {
        await socket.sendMessage(sender, { text: `🖼️ *𝙿𝚕𝚎𝚊𝚜𝚎 𝚛𝚎𝚙𝚕𝚢 𝚝𝚘 𝚊𝚗 𝚒𝚖𝚊𝚐𝚎* 𝚘𝚛 𝚜𝚎𝚗𝚍 𝚊𝚗 𝚒𝚖𝚊𝚐𝚎 𝚠𝚒𝚝𝚑 𝚝𝚑𝚎 𝚌𝚘𝚖𝚖𝚊𝚗𝚍.\n𝙴𝚡𝚊𝚖𝚙𝚕𝚎: ${config.prefix}removebg` });
        break;
    }

    const apiKey = 'ymx66uG6cizvJMvPpkjVC4Q3'; // put your key here

    try {
        let imageBuffer;

        // Check if the user replied to an image
        if (message.message?.imageMessage) {
            const mediaMessage = message.message.imageMessage;
            const media = await downloadMediaMessage(message, 'buffer', {}, { reuploadRequest: socket });
            imageBuffer = media;
        } else if (args[0]) {
            // or use a direct image URL
            const url = args[0];
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            imageBuffer = response.data;
        }

        await socket.sendMessage(sender, { text: `🪄 𝚁𝚎𝚖𝚘𝚟𝚒𝚗𝚐 𝚋𝚊𝚌𝚔𝚐𝚛𝚘𝚞𝚗𝚍... 𝙿𝚕𝚎𝚊𝚜𝚎 𝚠𝚊𝚒𝚝 𝚊 𝚖𝚘𝚖𝚎𝚗𝚝.`,
        contextInfo: silaContext});

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
        fs.writeFileSync(outputPath, result.data);

        await socket.sendMessage(sender, {
            image: fs.readFileSync(outputPath),
            caption: `✅ *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸* 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢 𝚛𝚎𝚖𝚘𝚟𝚎𝚍 𝚋𝚊𝚌𝚔𝚐𝚛𝚘𝚞𝚗𝚍!\n> "𝙿𝚎𝚛𝚏𝚎𝚌𝚝𝚒𝚘𝚗 𝚒𝚜 𝚗𝚘𝚝 𝚖𝚊𝚐𝚒𝚌, 𝚒𝚝'𝚜 𝚊𝚞𝚝𝚘𝚖𝚊𝚝𝚒𝚘𝚗 ✨"`,
            contextInfo: silaContext
        });

        fs.unlinkSync(outputPath); // clean up temp file

    } catch (error) {
        console.error('RemoveBG Error:', error);
        await socket.sendMessage(sender, { text: `❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚛𝚎𝚖𝚘𝚟𝚎 𝚋𝚊𝚌𝚔𝚐𝚛𝚘𝚞𝚗𝚍.\n𝚁𝚎𝚊𝚜𝚘𝚗: ${error.response?.data?.errors?.[0]?.title || error.message}` });
    }

    break;
}
case 'biblelist': {
    const bibleBooks = [
        "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
        "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
        "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
        "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
        "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
        "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
        "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
        "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
        "1 John", "2 John", "3 John", "Jude", "Revelation"
    ];

    const formattedList = bibleBooks.map((book, index) => `${index + 1}. ${book}`).join('\n');
    const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg'; // 🖼️ replace this with your image

    await socket.sendMessage(sender, {
        image: { url: imageUrl },
        caption: `📜 *𝙷𝙾𝙻𝚈 𝙱𝙸𝙱𝙻𝙴 𝙱𝙾𝙾𝙺𝚂 𝙻𝙸𝚂𝚃*\n\n${formattedList}\n\n𝚄𝚜𝚎:\n${config.prefix}bible John 3:16\n\n> 🙏 "𝚃𝚑𝚢 𝚠𝚘𝚛𝚍 𝚒𝚜 𝚊 𝚕𝚊𝚖𝚙 𝚞𝚗𝚝𝚘 𝚖𝚢 𝚏𝚎𝚎𝚝, 𝚊𝚗𝚍 𝚊 𝚕𝚒𝚐𝚑𝚝 𝚞𝚗𝚝𝚘 𝚖𝚢 𝚙𝚊𝚝𝚑." — 𝙿𝚜𝚊𝚕𝚖𝚜 119:105`
    });
    break;
}
case 'bible': {
    if (!args[0]) {
        await socket.sendMessage(sender, { text: `📖 *𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚟𝚎𝚛𝚜𝚎!*\n𝙴𝚡𝚊𝚖𝚙𝚕𝚎: ${config.prefix}bible John 3:16` });
        break;
    }

    const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg'; // 🖼️ replace with your image

    try {
        const query = args.join(' ');
        const response = await axios.get(`https://bible-api.com/${encodeURIComponent(query)}`);

        if (response.data && response.data.text) {
            await socket.sendMessage(sender, {
                image: { url: imageUrl },
                caption: `📖 *${response.data.reference}*\n\n${response.data.text.trim()}\n\n— ${response.data.translation_name}\n\n> 🙌 "𝚃𝚑𝚎 𝚠𝚘𝚛𝚍 𝚘𝚏 𝙶𝚘𝚍 𝚒𝚜 𝚊𝚕𝚒𝚟𝚎 𝚊𝚗𝚍 𝚙𝚘𝚠𝚎𝚛𝚏𝚞𝚕." — 𝙷𝚎𝚋𝚛𝚎𝚠𝚜 4:12`
            });
        } else {
            await socket.sendMessage(sender, { text: `❌ 𝚅𝚎𝚛𝚜𝚎 𝚗𝚘𝚝 𝚏𝚘𝚞𝚗𝚍. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚌𝚑𝚎𝚌𝚔 𝚢𝚘𝚞𝚛 𝚒𝚗𝚙𝚞𝚝.` });
        }
    } catch (error) {
        await socket.sendMessage(sender, { text: `⚠️ 𝚄𝚗𝚊𝚋𝚕𝚎 𝚝𝚘 𝚏𝚎𝚝𝚌𝚑 𝚟𝚎𝚛𝚜𝚎.\n𝙴𝚛𝚛𝚘𝚛: ${error.message}` });
    }
    break;
}
case 'quranlist': {
    const surahNames = [
        "1. Al-Fatihah (The Opening)", "2. Al-Baqarah (The Cow)", "3. Aal-E-Imran (The Family of Imran)",
        "4. An-Nisa (The Women)", "5. Al-Ma'idah (The Table Spread)", "6. Al-An'am (The Cattle)",
        "7. Al-A'raf (The Heights)", "8. Al-Anfal (The Spoils of War)", "9. At-Tawbah (The Repentance)",
        "10. Yunus (Jonah)", "11. Hud", "12. Yusuf (Joseph)", "13. Ar-Ra'd (The Thunder)",
        "14. Ibrahim (Abraham)", "15. Al-Hijr (The Rocky Tract)", "16. An-Nahl (The Bee)",
        "17. Al-Isra (The Night Journey)", "18. Al-Kahf (The Cave)", "19. Maryam (Mary)",
        "20. Ta-Ha", "21. Al-Anbiya (The Prophets)", "22. Al-Hajj (The Pilgrimage)",
        "23. Al-Mu'minun (The Believers)", "24. An-Nur (The Light)", "25. Al-Furqan (The Criterion)",
        "26. Ash-Shu'ara (The Poets)", "27. An-Naml (The Ant)", "28. Al-Qasas (The Stories)",
        "29. Al-Ankabut (The Spider)", "30. Ar-Rum (The Romans)", "31. Luqman", "32. As-Sajda (The Prostration)",
        "33. Al-Ahzab (The Confederates)", "34. Saba (Sheba)", "35. Fatir (The Originator)",
        "36. Ya-Sin", "37. As-Saffat (Those Ranged in Ranks)", "38. Sad", "39. Az-Zumar (The Groups)",
        "40. Ghafir (The Forgiver)", "41. Fussilat (Explained in Detail)", "42. Ash-Shura (Consultation)",
        "43. Az-Zukhruf (Ornaments of Gold)", "44. Ad-Dukhan (The Smoke)", "45. Al-Jathiya (The Crouching)",
        "46. Al-Ahqaf (The Wind-Curved Sandhills)", "47. Muhammad", "48. Al-Fath (The Victory)",
        "49. Al-Hujurat (The Rooms)", "50. Qaf", "51. Adh-Dhariyat (The Winnowing Winds)",
        "52. At-Tur (The Mount)", "53. An-Najm (The Star)", "54. Al-Qamar (The Moon)",
        "55. Ar-Rahman (The Beneficent)", "56. Al-Waqia (The Inevitable)", "57. Al-Hadid (The Iron)",
        "58. Al-Mujadila (The Woman Who Disputes)", "59. Al-Hashr (The Exile)", "60. Al-Mumtahanah (The Examined One)",
        "61. As-Saff (The Ranks)", "62. Al-Jumu'a (The Congregation, Friday)", "63. Al-Munafiqoon (The Hypocrites)",
        "64. At-Taghabun (Mutual Disillusion)", "65. At-Talaq (Divorce)", "66. At-Tahrim (Prohibition)",
        "67. Al-Mulk (The Sovereignty)", "68. Al-Qalam (The Pen)", "69. Al-Haqqah (The Reality)",
        "70. Al-Ma'arij (The Ascending Stairways)", "71. Nuh (Noah)", "72. Al-Jinn (The Jinn)",
        "73. Al-Muzzammil (The Enshrouded One)", "74. Al-Muddathir (The Cloaked One)",
        "75. Al-Qiyamah (The Resurrection)", "76. Al-Insan (Man)", "77. Al-Mursalat (The Emissaries)",
        "78. An-Naba (The Tidings)", "79. An-Nazi'at (Those Who Drag Forth)", "80. Abasa (He Frowned)",
        "81. At-Takwir (The Overthrowing)", "82. Al-Infitar (The Cleaving)", "83. Al-Mutaffifin (Defrauding)",
        "84. Al-Inshiqaq (The Splitting Open)", "85. Al-Buruj (The Mansions of the Stars)",
        "86. At-Tariq (The Nightcomer)", "87. Al-A'la (The Most High)", "88. Al-Ghashiya (The Overwhelming)",
        "89. Al-Fajr (The Dawn)", "90. Al-Balad (The City)", "91. Ash-Shams (The Sun)",
        "92. Al-Lail (The Night)", "93. Ad-Duha (The Morning Hours)", "94. Ash-Sharh (The Relief)",
        "95. At-Tin (The Fig)", "96. Al-Alaq (The Clot)", "97. Al-Qadr (The Power)", "98. Al-Bayyina (The Clear Proof)",
        "99. Az-Zalzalah (The Earthquake)", "100. Al-Adiyat (The Courser)", "101. Al-Qari'a (The Calamity)",
        "102. At-Takathur (The Rivalry in World Increase)", "103. Al-Asr (The Time)", "104. Al-Humaza (The Slanderer)",
        "105. Al-Fil (The Elephant)", "106. Quraysh", "107. Al-Ma'un (Small Kindnesses)", "108. Al-Kawthar (Abundance)",
        "109. Al-Kafirun (The Disbelievers)", "110. An-Nasr (The Divine Support)", "111. Al-Masad (The Palm Fibre)",
        "112. Al-Ikhlas (Sincerity)", "113. Al-Falaq (The Daybreak)", "114. An-Nas (Mankind)"
    ];

    const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg'; // 🕌 your banner image

    await socket.sendMessage(sender, {
        image: { url: imageUrl },
        caption: `🕌 *𝙷𝙾𝙻𝚈 𝚀𝚄𝚁'𝙰𝙽 𝚂𝚄𝚁𝙰𝙷 𝙻𝙸𝚂𝚃 (114)*\n\n${surahNames.join('\n')}\n\n𝚄𝚜𝚎:\n${config.prefix}quran 2:255\n\n> 🌙 "𝙸𝚗𝚍𝚎𝚎𝚍, 𝚝𝚑𝚒𝚜 𝚀𝚞𝚛'𝚊𝚗 𝚐𝚞𝚒𝚍𝚎𝚜 𝚝𝚘 𝚝𝚑𝚊𝚝 𝚠𝚑𝚒𝚌𝚑 𝚒𝚜 𝚖𝚘𝚜𝚝 𝚓𝚞𝚜𝚝 𝚊𝚗𝚍 𝚛𝚒𝚐𝚑𝚝." — 𝚂𝚞𝚛𝚊𝚑 𝙰𝚕-𝙸𝚜𝚛𝚊 17:9`
    });
    break;
}
case 'quran': {
    if (!args[0]) {
        await socket.sendMessage(sender, { text: `🕌 *𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚟𝚎𝚛𝚜𝚎!*\n𝙴𝚡𝚊𝚖𝚙𝚕𝚎: ${config.prefix}quran 2:255` });
        break;
    }

    const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg'; // 🕌 your banner image

    try {
        const query = args[0].split(':');
        const surah = query[0];
        const ayah = query[1];

        const response = await axios.get(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/en.asad`);

        if (response.data && response.data.data) {
            const verse = response.data.data.text;
            const surahName = response.data.data.surah.englishName;

            await socket.sendMessage(sender, {
                image: { url: imageUrl },
                caption: `🕌 *${surahName}* — ${surah}:${ayah}\n\n${verse}\n\n> ✨ "𝚂𝚘 𝚛𝚎𝚖𝚎𝚖𝚋𝚎𝚛 𝙼𝚎; 𝙸 𝚠𝚒𝚕𝚕 𝚛𝚎𝚖𝚎𝚖𝚋𝚎𝚛 𝚢𝚘𝚞." — 𝚀𝚞𝚛𝚊𝚗 2:152`
            });
        } else {
            await socket.sendMessage(sender, { text: `❌ 𝚅𝚎𝚛𝚜𝚎 𝚗𝚘𝚝 𝚏𝚘𝚞𝚗𝚍. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚌𝚑𝚎𝚌𝚔 𝚢𝚘𝚞𝚛 𝚒𝚗𝚙𝚞𝚝.` });
        }
    } catch (error) {
        await socket.sendMessage(sender, { text: `⚠️ 𝚄𝚗𝚊𝚋𝚕𝚎 𝚝𝚘 𝚏𝚎𝚝𝚌𝚑 𝚀𝚞𝚛𝚊𝚗 𝚟𝚎𝚛𝚜𝚎.\n𝙴𝚛𝚛𝚘𝚛: ${error.message}` });
    }
    break;
}
case 'Instagram':
case 'insta':
case 'ig': {
    const igUrl = args[0];
    if (!igUrl) {
        await socket.sendMessage(sender, { 
            text: `📸 *𝚄𝚜𝚊𝚐𝚎:* ${config.prefix}Instagram <Instagram URL>`,
            contextInfo: silaContext
        });
        break;
    }

    await socket.sendMessage(sender, { 
        text: `⏳ *𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝙸𝚗𝚜𝚝𝚊𝚐𝚛𝚊𝚖 𝚙𝚘𝚜𝚝... 𝚙𝚕𝚎𝚊𝚜𝚎 𝚠𝚊𝚒𝚝.*`,
        contextInfo: silaContext
    });

    try {
        const apiUrl = `https://api.fgmods.xyz/api/downloader/igdl?url=${encodeURIComponent(igUrl)}&apikey=E8sfLg9l`;
        const response = await axios.get(apiUrl);

        const { url, caption, username, like, comment, isVideo } = response.data.result;
        const mediaBuffer = (await axios.get(url, { responseType: 'arraybuffer' })).data;

        await socket.sendMessage(sender, {
            [isVideo ? "video" : "image"]: mediaBuffer,
            caption: `📸 *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 𝙸𝙶 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳 𝚂𝚄𝙲𝙲𝙴𝚂𝚂*\n\n👤 *𝚄𝚜𝚎𝚛:* ${username}\n💬 *𝙲𝚊𝚙𝚝𝚒𝚘𝚗:* ${caption || '𝙽𝚘 𝚌𝚊𝚙𝚝𝚒𝚘𝚗'}\n❤️ *𝙻𝚒𝚔𝚎𝚜:* ${like}\n💭 *𝙲𝚘𝚖𝚖𝚎𝚗𝚝𝚜:* ${comment}\n\n> ✨ 𝙺𝚎𝚎𝚙 𝚜𝚑𝚒𝚗𝚒𝚗𝚐 — 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍 𝚍𝚘𝚗𝚎 𝚋𝚢 *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 𝙱𝙾𝚃* ✨`,
            contextInfo: silaContext
        }, { quoted: m }); // reply to user message

    } catch (error) {
        console.error('Instagram Error:', error);
        await socket.sendMessage(sender, { 
            text: `❌ *𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍 𝙸𝚗𝚜𝚝𝚊𝚐𝚛𝚊𝚖 𝚖𝚎𝚍𝚒𝚊.*\n𝙿𝚕𝚎𝚊𝚜𝚎 𝚌𝚑𝚎𝚌𝚔 𝚢𝚘𝚞𝚛 𝚕𝚒𝚗𝚔 𝚊𝚗𝚍 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗.` ,
            contextInfo: silaContext
        });
    }
    break;
}
case 'tiktok': {
    if (!text) {
        await socket.sendMessage(sender, { 
            text: `⚠️ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚃𝚒𝚔𝚃𝚘𝚔 𝚟𝚒𝚍𝚎𝚘 𝚄𝚁𝙻.\n\n𝙴𝚡𝚊𝚖𝚙𝚕𝚎:\n${config.prefix}tiktok https://www.tiktok.com/@user/video/12345`,
            contextInfo: silaContext
        });
        break;
    }

    try {
        const tiktokUrl = text.trim();
        const apiUrl = `https://api.nexoracle.com/downloader/tiktok-nowm?apikey=free_key@maher_apis&url=${encodeURIComponent(tiktokUrl)}`;
        
        const response = await axios.get(apiUrl);
        const result = response.data.result;

        if (!result || !result.url) {
            await socket.sendMessage(sender, { text: "❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍 𝚃𝚒𝚔𝚃𝚘𝚔 𝚟𝚒𝚍𝚎𝚘. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚌𝚑𝚎𝚌𝚔 𝚝𝚑𝚎 𝚕𝚒𝚗𝚔 𝚘𝚛 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗 𝚕𝚊𝚝𝚎𝚛.",
            contextInfo: silaContext});
            break;
        }

        const { title, author, metrics, url } = result;

        const tiktokCaption = `🛡️ •• 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 •• 🛡️
╔═▸  𝚃𝙸𝙺𝚃𝙾𝙺 𝚅𝙸𝙳𝙴𝙾 𝙳𝙻  ▸════════════════╗
┃ 🔖  𝚃𝚒𝚝𝚕𝚎    : ${title || "𝙽𝚘 𝚝𝚒𝚝𝚕𝚎"}
┃ 👤  𝙰𝚞𝚝𝚑𝚘𝚛   : @${author?.username || "𝚞𝚗𝚔𝚗𝚘𝚠𝚗"} (${author?.nickname || "𝚞𝚗𝚔𝚗𝚘𝚠𝚗"})
┃ ❤️  𝙻𝚒𝚔𝚎𝚜    : ${metrics?.digg_count ?? "𝙽/𝙰"}
┃ 💬  𝙲𝚘𝚖𝚖𝚎𝚗𝚝𝚜 : ${metrics?.comment_count ?? "𝙽/𝙰"}
┃ 🔁  𝚂𝚑𝚊𝚛𝚎𝚜   : ${metrics?.share_count ?? "𝙽/𝙰"}
┃ 📥  𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚜: ${metrics?.download_count ?? metrics?.play_count ?? "𝙽/𝙰"}
╚════════════════════════════════════════════════╝

> 🚀 𝙴𝚗𝚓𝚘𝚢 𝚢𝚘𝚞𝚛 𝚟𝚒𝚍𝚎𝚘 𝚙𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸* 👑`;

        await socket.sendMessage(sender, {
            video: { url },
            caption: tiktokCaption
        });

    } catch (error) {
        console.error("TikTok Downloader Error:", error);
        await socket.sendMessage(sender, { 
            text: "❌ 𝙰𝚗 𝚎𝚛𝚛𝚘𝚛 𝚘𝚌𝚌𝚞𝚛𝚛𝚎𝚍 𝚠𝚑𝚒𝚕𝚎 𝚙𝚛𝚘𝚌𝚎𝚜𝚜𝚒𝚗𝚐 𝚝𝚑𝚎 𝚃𝚒𝚔𝚃𝚘𝚔 𝚟𝚒𝚍𝚎𝚘. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗 𝚕𝚊𝚝𝚎𝚛." ,
            contextInfo: silaContext
        });
    }

    break;
}
case 'ytmp4': {
    if (!text) {
        await socket.sendMessage(sender, { 
            text: `⚠️ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 𝚈𝚘𝚞𝚃𝚞𝚋𝚎 𝚟𝚒𝚍𝚎𝚘 𝚕𝚒𝚗𝚔.\n\n𝙴𝚡𝚊𝚖𝚙𝚕𝚎:\n${config.prefix}ytmp4 https://youtu.be/dQw4w9WgXcQ`,
            contextInfo: silaContext
        });
        break;
    }

    try {
        const videoUrl = text.trim();
        const apiUrl = `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(videoUrl)}`;
        
        const response = await axios.get(apiUrl);
        const result = response.data.result;

        if (!result || !result.download_url) {
            await socket.sendMessage(sender, { 
                text: "❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚏𝚎𝚝𝚌𝚑 𝚟𝚒𝚍𝚎𝚘. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚌𝚑𝚎𝚌𝚔 𝚝𝚑𝚎 𝚈𝚘𝚞𝚃𝚞𝚋𝚎 𝚕𝚒𝚗𝚔 𝚘𝚛 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗 𝚕𝚊𝚝𝚎𝚛." 
            });
            break;
        }

        const { title, quality, size, thumbnail, download_url } = result;

        const caption = `💥 •• 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 •• 💥
╔═▸  𝚈𝙾𝚄𝚃𝚄𝙱𝙴 𝚅𝙸𝙳𝙴𝙾 𝙳𝙻  ▸════════════════╗
┃ 🎬  𝚃𝚒𝚝𝚕𝚎    : ${title || "𝙽𝚘 𝚝𝚒𝚝𝚕𝚎"}
┃ 🎞️  𝚀𝚞𝚊𝚕𝚒𝚝𝚢  : ${quality || "𝚄𝚗𝚔𝚗𝚘𝚠𝚗"}
┃ 💾  𝚂𝚒𝚣𝚎     : ${size || "𝙽/𝙰"}
╚════════════════════════════════════════════════╝

> 🚀 𝙳𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚎𝚍 𝚞𝚜𝚒𝚗𝚐 *𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸* 👑
> ⚡ 𝙴𝚗𝚓𝚘𝚢 𝚢𝚘𝚞𝚛 𝚟𝚒𝚍𝚎𝚘!`;

        await socket.sendMessage(sender, {
            video: { url: download_url },
            caption,
            contextInfo: silaContext
        });

    } catch (error) {
        console.error("YouTube MP4 Error:", error);
        await socket.sendMessage(sender, { 
            text: "❌ 𝙰𝚗 𝚎𝚛𝚛𝚘𝚛 𝚘𝚌𝚌𝚞𝚛𝚛𝚎𝚍 𝚠𝚑𝚒𝚕𝚎 𝚙𝚛𝚘𝚌𝚎𝚜𝚜𝚒𝚗𝚐 𝚝𝚑𝚎 𝚈𝚘𝚞𝚃𝚞𝚋𝚎 𝚟𝚒𝚍𝚎𝚘. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗 𝚕𝚊𝚝𝚎𝚛." 
        });
    }

    break;
}
case 'idch': {
    if (!text) {
        await socket.sendMessage(sender, {
            text: `⚠️ 𝙿𝚕𝚎𝚊𝚜𝚎 𝚙𝚛𝚘𝚟𝚒𝚍𝚎 𝚊 *𝚆𝚑𝚊𝚝𝚜𝙰𝚙𝚙 𝙲𝚑𝚊𝚗𝚗𝚎𝚕* 𝚕𝚒𝚗𝚔.\n\n𝙴𝚡𝚊𝚖𝚙𝚕𝚎:\n${config.prefix}idch https://whatsapp.com/channel/0029VaA2KzF3eHuyE3Jw1R3`,
            contextInfo: silaContext
        });
        break;
    }

    try {
        const chLink = text.trim();

        // Detect if link is not a channel (group or chat)
        if (chLink.includes('/invite/') || chLink.includes('/chat/')) {
            await socket.sendMessage(sender, {
                text: `❌ 𝚃𝚑𝚊𝚝 𝚕𝚘𝚘𝚔𝚜 𝚕𝚒𝚔𝚎 𝚊 *𝚐𝚛𝚘𝚞𝚙 𝚘𝚛 𝚌𝚑𝚊𝚝 𝚕𝚒𝚗𝚔*, 𝚗𝚘𝚝 𝚊 𝚌𝚑𝚊𝚗𝚗𝚎𝚕 𝚕𝚒𝚗𝚔.\n\n𝙿𝚕𝚎𝚊𝚜𝚎 𝚜𝚎𝚗𝚍 𝚊 *𝚆𝚑𝚊𝚝𝚜𝙰𝚙𝚙 𝙲𝚑𝚊𝚗𝚗𝚎𝚕* 𝚕𝚒𝚗𝚔 𝚝𝚑𝚊𝚝 𝚕𝚘𝚘𝚔𝚜 𝚕𝚒𝚔𝚎 𝚝𝚑𝚒𝚜:\nhttps://whatsapp.com/channel/XXXXXXXXXXXXXXX`,
                contextInfo: silaContext
            });
            break;
        }

        // Extract invite code from channel link
        const match = chLink.match(/channel\/([\w\d]+)/);
        if (!match) {
            await socket.sendMessage(sender, { 
                text: `❌ 𝙸𝚗𝚟𝚊𝚕𝚒𝚍 𝚆𝚑𝚊𝚝𝚜𝙰𝚙𝚙 𝙲𝚑𝚊𝚗𝚗𝚎𝚕 𝚕𝚒𝚗𝚔. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚌𝚑𝚎𝚌𝚔 𝚊𝚗𝚍 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗.`,
                contextInfo: silaContext
            });
            break;
        }

        const inviteCode = match[1];
        const newsletterJid = `${inviteCode}@newsletter`;

        // Fetch channel info using Baileys function
        const channelInfo = await socket.newsletterMetadata(newsletterJid);
        if (!channelInfo) {
            await socket.sendMessage(sender, { 
                text: `⚠️ 𝚄𝚗𝚊𝚋𝚕𝚎 𝚝𝚘 𝚏𝚎𝚝𝚌𝚑 𝚍𝚎𝚝𝚊𝚒𝚕𝚜 𝚏𝚘𝚛 𝚝𝚑𝚊𝚝 𝚌𝚑𝚊𝚗𝚗𝚎𝚕. 𝙸𝚝 𝚖𝚊𝚢 𝚋𝚎 𝚙𝚛𝚒𝚟𝚊𝚝𝚎 𝚘𝚛 𝚞𝚗𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎.`,
                contextInfo: silaContext
            });
            break;
        }

        const { name, id, subscribers, creation, description } = channelInfo;

        const caption = `🛡️ •• 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 •• 🛡️
╔═▸  𝚆𝙷𝙰𝚃𝚂𝙰𝙿𝙿 𝙲𝙷𝙰𝙽𝙽𝙴𝙻 𝙸𝙽𝙵𝙾  ▸════════════════╗
┃ 🏷️  𝙽𝚊𝚖𝚎        : ${name || "𝙽/𝙰"}
┃ 🆔  𝙸𝚗𝚝𝚎𝚛𝚗𝚊𝚕 𝙹𝙸𝙳 : ${id || newsletterJid}
┃ 👥  𝙵𝚘𝚕𝚕𝚘𝚠𝚎𝚛𝚜   : ${subscribers || "𝚄𝚗𝚔𝚗𝚘𝚠𝚗"}
┃ 🗓️  𝙲𝚛𝚎𝚊𝚝𝚎𝚍 𝙾𝚗  : ${creation ? new Date(creation * 1000).toLocaleString() : "𝙽/𝙰"}
┃ 📝  𝙳𝚎𝚜𝚌𝚛𝚒𝚙𝚝𝚒𝚘𝚗 : ${description || "𝙽𝚘 𝚍𝚎𝚜𝚌𝚛𝚒𝚙𝚝𝚒𝚘𝚗"}
╚════════════════════════════════════════════════╝

> 🚀  𝙵𝚘𝚕𝚕𝚘𝚠 𝚘𝚞𝚛 𝙾𝚏𝚏𝚒𝚌𝚒𝚊𝚕 𝙲𝚑𝚊𝚗𝚗𝚎𝚕:
> 🔗  ${silaContext.forwardedNewsletterMessageInfo.newsletterName}`;

        await socket.sendMessage(sender, { 
            text: caption,
            contextInfo: silaContext
        });

    } catch (error) {
        console.error("Channel Info Error:", error);
        await socket.sendMessage(sender, {
            text: "❌ 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚐𝚎𝚝 𝚌𝚑𝚊𝚗𝚗𝚎𝚕 𝚒𝚗𝚏𝚘. 𝙼𝚊𝚔𝚎 𝚜𝚞𝚛𝚎 𝚝𝚑𝚎 𝚕𝚒𝚗𝚔 𝚒𝚜 𝚟𝚊𝚕𝚒𝚍 𝚊𝚗𝚍 𝚙𝚞𝚋𝚕𝚒𝚌.",
            contextInfo: silaContext
        });
    }

    break;
}
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                text: `❌ 𝙰𝚗 𝚎𝚛𝚛𝚘𝚛 𝚘𝚌𝚌𝚞𝚛𝚛𝚎𝚍 𝚠𝚑𝚒𝚕𝚎 𝚙𝚛𝚘𝚌𝚎𝚜𝚜𝚒𝚗𝚐 𝚢𝚘𝚞𝚛 𝚌𝚘𝚖𝚖𝚊𝚗𝚍. 𝙿𝚕𝚎𝚊𝚜𝚎 𝚝𝚛𝚢 𝚊𝚐𝚊𝚒𝚗.\n\n> © 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳`
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
                    await delay(2000 * ((parseInt(userConfig.MAX_RETRIES) || 3) - retries));
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
                        caption: formatMessage(
                            '🤖 𝚂𝙸𝙻𝙰 𝙼𝙳-𝙼𝙸𝙽𝙸 𝙱𝙾𝚃 𝙲𝙾𝙽𝙽𝙴𝙲𝚃𝙴𝙳',
`✅ 𝚂𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍!\n\n🔢 𝙽𝚞𝚖𝚋𝚎𝚛: ${sanitizedNumber}\n\n✨ 𝙱𝚘𝚝 𝚒𝚜 𝚗𝚘𝚠 𝚊𝚌𝚝𝚒𝚟𝚎 𝚊𝚗𝚍 𝚛𝚎𝚊𝚍𝚢 𝚝𝚘 𝚞𝚜𝚎!\n\n📌 𝚃𝚢𝚙𝚎 ${userConfig.PREFIX || '.'}menu 𝚝𝚘 𝚟𝚒𝚎𝚠 𝚊𝚕𝚕 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜`,
'𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳'
                        ) ,
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
