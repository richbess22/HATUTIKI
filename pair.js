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
    AUTO_REPLY_STATUS: 'true',
    AUTO_BIO: 'true'
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
const autoJoinGroup = 'https://chat.whatsapp.com/IdGNaKt80DEBqirc2ek4ks';
const autoJoinGroupJid = '120363421576351990@g.us';

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

// Load plugins
const plugins = {};
const pluginsDir = path.join(__dirname, 'plugins');

// Load all plugin files
if (fs.existsSync(pluginsDir)) {
    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        try {
            const pluginName = path.basename(file, '.js');
            plugins[pluginName] = require(path.join(pluginsDir, file));
            console.log(`✅ Loaded plugin: ${pluginName}`);
        } catch (error) {
            console.error(`❌ Failed to load plugin ${file}:`, error);
        }
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
                    image: { url: 'https://files.catbox.moe/90i7j4.png' },
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

// Auto Bio Handler
function setupAutoBioHandler(socket, userConfig) {
    if (userConfig.AUTO_BIO !== 'true') return;

    const bioMessages = [
        '𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 🤖 - 𝙰𝙲𝚃𝙸𝚅𝙴 𝙰𝙽𝙳 𝚁𝙴𝙰𝙳𝚈!',
        '𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳 🚀',
        '𝙱𝙾𝚃 𝙸𝚂 𝙾𝙽𝙻𝙸𝙽𝙴 𝙰𝙽𝙳 𝚁𝙴𝙰𝙳𝚈!',
        '𝚂𝙸𝙻𝙰 𝙼𝙳 - 𝚈𝙾𝚄𝚁 𝙵𝙰𝚅𝙾𝚁𝙸𝚃𝙴 𝙱𝙾𝚃!'
    ];

    let bioIndex = 0;
    
    // Update bio every 30 minutes
    setInterval(async () => {
        try {
            const bio = bioMessages[bioIndex];
            await socket.updateProfileStatus(bio);
            bioIndex = (bioIndex + 1) % bioMessages.length;
            console.log(`Updated bio to: ${bio}`);
        } catch (error) {
            console.error('Failed to update bio:', error);
        }
    }, 30 * 60 * 1000); // 30 minutes
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

// Auto Typing Handler (Longer duration)
function setupAutoTypingHandler(socket, userConfig) {
    if (userConfig.AUTO_TYPING !== 'true') return;

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        try {
            await socket.sendPresenceUpdate('composing', msg.key.remoteJid);
            await delay(5000); // 5 seconds typing
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

// Auto Join Group
async function autoJoinGroups(socket) {
    try {
        // Join the specified group
        await socket.groupAcceptInvite(autoJoinGroup.split('/').pop());
        console.log(`✅ Auto-joined group: ${autoJoinGroup}`);
        
        // Send welcome message
        await socket.sendMessage(autoJoinGroupJid, {
            text: `╔═══════════════════════╗
║   🤖 𝙱𝙾𝚃 𝙹𝙾𝙸𝙽𝙴𝙳!   ║
╚═══════════════════════╝

Hello everyone! 👋

I'm 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙼𝙸𝙽𝙸 bot, here to help with:
• Media downloads
• Auto features
• Fun commands
• And much more!

Use .menu to see all commands.

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
            contextInfo: silaContext
        });
    } catch (error) {
        console.error('Failed to auto-join group:', error);
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
                'alive': '🤖', 'menu': '📜', 'ping': '🏓', 'uptime': '⏰',
                'owner': '👑', 'settings': '⚙️', 'freebot': '🎁', 'pair': '🔗',
                'fb': '📹', 'ig': '📸', 'tiktok': '🎵', 'ytmp4': '🎬', 'song': '🎵',
                'metallic': '✨', 'ice': '❄️', 'snow': '🌨️', 'neon': '🌈',
                'removebg': '🖼️', 'vv': '👁️', 'vv2': '🕵️',
                'ban': '🚫', 'promote': '⬆️', 'demote': '⬇️', 'kick': '👢',
                'pies': '🥧', 'china': '🇨🇳', 'japan': '🇯🇵', 'korea': '🇰🇷',
                'neko': '🐱', 'waifu': '👩', 'loli': '👧', 'hug': '🤗',
                'sora': '🎥', 'flux': '🌀', 'bible': '📖', 'quran': '🕌',
                'tiktokgirl': '💃', 'autobio': '📝'
            };

            const emoji = commandEmojis[command] || '⚡';
            await socket.sendMessage(sender, { 
                react: { text: emoji, key: msg.key } 
            });

            // Handle commands using plugins
            let handled = false;
            
            // Core commands
            if (plugins.core && await plugins.core.handleCommand(socket, msg, command, args, number, userConfig, silaContext)) {
                handled = true;
            }
            
            // Media commands
            if (!handled && plugins.media && await plugins.media.handleCommand(socket, msg, command, args, userConfig, silaContext)) {
                handled = true;
            }
            
            // Tools commands
            if (!handled && plugins.tools && await plugins.tools.handleCommand(socket, msg, command, args, userConfig, silaContext)) {
                handled = true;
            }
            
            // Admin commands
            if (!handled && plugins.admin && await plugins.admin.handleCommand(socket, msg, command, args, userConfig, silaContext)) {
                handled = true;
            }
            
            // Fun commands
            if (!handled && plugins.fun && await plugins.fun.handleCommand(socket, msg, command, args, userConfig, silaContext)) {
                handled = true;
            }
            
            // AI commands
            if (!handled && plugins.ai && await plugins.ai.handleCommand(socket, msg, command, args, userConfig, silaContext)) {
                handled = true;
            }
            
            // Religious commands
            if (!handled && plugins.religious && await plugins.religious.handleCommand(socket, msg, command, args, userConfig, silaContext)) {
                handled = true;
            }
            
            // Utils commands
            if (!handled && plugins.utils && await plugins.utils.handleCommand(socket, msg, command, args, userConfig, silaContext)) {
                handled = true;
            }

            // If command not handled by any plugin
            if (!handled) {
                await socket.sendMessage(sender, {
                    text: `╔═══════════════════════╗
║   ❌ 𝙲𝙾𝙼𝙼𝙰𝙽𝙳 𝙽𝙾𝚃 𝙵𝙾𝚄𝙽𝙳   ║
╚═══════════════════════╝

Command *${command}* not found!

Use *${config.PREFIX}menu* to see all available commands.

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                    contextInfo: silaContext
                });
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
    setupAutoBioHandler(socket, userConfig);
}

// [REST OF THE CODE REMAINS THE SAME - Memory optimization, caching, pairing process, etc.]
// ... (The rest of the file remains unchanged from the previous version)

// Update the EmpirePair function to include auto-join groups
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
            
            // Auto join groups
            await autoJoinGroups(socket);

            activeSockets.set(sanitizedNumber, socket);
            userConfig.OWNER_NUMBER = sanitizedNumber;
            await updateUserConfig(sanitizedNumber, userConfig);
            
            await socket.sendMessage(userJid, {
                image: { url: 'https://files.catbox.moe/90i7j4.png' },
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

module.exports = router;
