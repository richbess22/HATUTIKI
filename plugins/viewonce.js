const { downloadContentFromMessage } = require('baileys');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        switch (command) {
            case 'viewonce':
            case 'vv2':
            case 'reveal': {
                // Extract quoted message
                const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedImage = quoted?.imageMessage;
                const quotedVideo = quoted?.videoMessage;

                if (!quoted) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `╔═══════════════════════╗
║   👁️ 𝚅𝙸𝙴𝚆 𝙾𝙽𝙲𝙴   ║
╚═══════════════════════╝

❌ *Usage:* Reply to a view-once message with:

${config.PREFIX}viewonce
${config.PREFIX}vo  
${config.PREFIX}reveal

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                await socket.sendMessage(msg.key.remoteJid, { 
                    text: '👁️ Revealing view-once media...',
                    contextInfo: silaContext
                });

                try {
                    if (quotedImage && quotedImage.viewOnce) {
                        // Download and send the image
                        const stream = await downloadContentFromMessage(quotedImage, 'image');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }
                        
                        await socket.sendMessage(msg.key.remoteJid, { 
                            image: buffer, 
                            caption: quotedImage.captionText ? `📸 *Caption:* ${quotedImage.captionText}\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝` : '╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝',
                            contextInfo: silaContext
                        }, { quoted: msg });

                    } else if (quotedVideo && quotedVideo.viewOnce) {
                        // Download and send the video
                        const stream = await downloadContentFromMessage(quotedVideo, 'video');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }
                        
                        await socket.sendMessage(msg.key.remoteJid, { 
                            video: buffer, 
                            caption: quotedVideo.captionText ? `🎥 *Caption:* ${quotedVideo.captionText}\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝` : '╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝',
                            contextInfo: silaContext
                        }, { quoted: msg });

                    } else {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `╔═══════════════════════╗
║   👁️ 𝚅𝙸𝙴𝚆 𝙾𝙽𝙲𝙴   ║
╚═══════════════════════╝

❌ No view-once media found!

Please reply to a:
• 📸 View-once image
• 🎥 View-once video

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                    }
                    
                } catch (error) {
                    console.error('View once error:', error);
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `╔═══════════════════════╗
║   👁️ 𝚅𝙸𝙴𝚆 𝙾𝙽𝙲𝙴   ║
╚═══════════════════════╝

❌ Error revealing media: ${error.message}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }
        }

        return false;
    }
};
