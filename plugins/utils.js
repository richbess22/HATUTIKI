const axios = require('axios');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        switch (command) {
            case 'getpp': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Please provide a phone number.\nUsage: ${config.PREFIX}getpp <number>\nExample: ${config.PREFIX}getpp 255612491554`,
                        contextInfo: silaContext
                    });
                    return true;
                }
                
                let targetNumber = args[0].replace(/[^0-9]/g, '');
                
                // Add country code if not provided
                if (!targetNumber.startsWith('255') && targetNumber.length === 9) {
                    targetNumber = '255' + targetNumber;
                }
                
                // Ensure it has @s.whatsapp.net
                const targetJid = targetNumber.includes('@') ? targetNumber : `${targetNumber}@s.whatsapp.net`;
                
                await socket.sendMessage(msg.key.remoteJid, { 
                    text: `🕵️ Stealing profile picture for ${targetNumber}...`,
                    contextInfo: silaContext
                });
                
                try {
                    // Get profile picture URL
                    const profilePictureUrl = await socket.profilePictureUrl(targetJid, 'image');
                    
                    if (profilePictureUrl) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            image: { url: profilePictureUrl },
                            caption: `✅ Successfully got profile picture!\n📱 Number: ${targetNumber}\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝`,
                            contextInfo: silaContext
                        });
                    } else {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ No profile picture found for ${targetNumber}`,
                            contextInfo: silaContext
                        });
                    }
                    
                } catch (error) {
                    console.error('Profile picture error:', error);
                    
                    if (error.message.includes('404') || error.message.includes('not found')) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ No profile picture found for ${targetNumber}`,
                            contextInfo: silaContext
                        });
                    } else {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ Error getting profile picture: ${error.message}`,
                            contextInfo: silaContext
                        });
                    }
                }
                return true;
            }

            case 'deleteme': {
                const confirmationMessage = `╔═══════════════════════╗
║   🗑️ 𝙳𝙴𝙻𝙴𝚃𝙴 𝙱𝙾𝚃   ║
╚═══════════════════════╝

⚠️ *Are you sure you want to delete your session?*

This action will:
• Log out your bot
• Delete all session data  
• Require re-pairing to use again

Reply with *${config.PREFIX}confirm* to proceed or ignore to cancel.

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;
                
                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://files.catbox.moe/gnjb7s.jpg' },
                    caption: confirmationMessage
                });
                return true;
            }

            case 'confirm': {
                // Handle session deletion confirmation
                const sanitizedNumber = number.replace(/[^0-9]/g, '');
                
                await socket.sendMessage(msg.key.remoteJid, {
                    text: '🗑️ Deleting your session...',
                    contextInfo: silaContext
                });
                
                try {
                    // Close the socket connection
                    const activeSockets = require('../pair.js').activeSockets;
                    const socket = activeSockets.get(sanitizedNumber);
                    if (socket) {
                        socket.ws.close();
                        activeSockets.delete(sanitizedNumber);
                        require('../pair.js').socketCreationTime.delete(sanitizedNumber);
                    }
                    
                    // Delete session files
                    const fs = require('fs');
                    const path = require('path');
                    const sessionPath = path.join('./session', `session_${sanitizedNumber}`);
                    if (fs.existsSync(sessionPath)) {
                        require('fs-extra').removeSync(sessionPath);
                    }
                    
                    // Delete from GitHub if octokit is available
                    const { deleteSessionFromGitHub } = require('../pair.js');
                    await deleteSessionFromGitHub(sanitizedNumber);
                    
                    // Remove from numbers list
                    let numbers = [];
                    if (fs.existsSync('./numbers.json')) {
                        numbers = JSON.parse(fs.readFileSync('./numbers.json', 'utf8'));
                    }
                    const index = numbers.indexOf(sanitizedNumber);
                    if (index !== -1) {
                        numbers.splice(index, 1);
                        fs.writeFileSync('./numbers.json', JSON.stringify(numbers, null, 2));
                    }
                    
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: '✅ Your session has been successfully deleted!\n\nYou can pair again using the free bot link.',
                        contextInfo: silaContext
                    });
                } catch (error) {
                    console.error('Failed to delete session:', error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: '❌ Failed to delete your session. Please try again later.',
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'tts': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `🗣️ *Usage:* ${config.PREFIX}tts <text>\n\nExample: ${config.PREFIX}tts Hello World`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const text = args.join(' ');
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `🔊 Converting text to speech...`,
                    contextInfo: silaContext
                });

                try {
                    // Using a free TTS API
                    const apiUrl = `https://api.voicerss.org/?key=demo&hl=en-us&src=${encodeURIComponent(text)}`;
                    
                    await socket.sendMessage(msg.key.remoteJid, {
                        audio: { url: apiUrl },
                        mimetype: "audio/mpeg",
                        caption: `🗣️ *Text to Speech*\n\n*Text:* ${text}\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });

                } catch (error) {
                    console.error('TTS error:', error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Error converting text to speech: ${error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'url': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `🔗 *Usage:* ${config.PREFIX}url <website-url>\n\nExample: ${config.PREFIX}url https://google.com`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                let url = args[0];
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }

                await socket.sendMessage(msg.key.remoteJid, {
                    text: `🌐 Taking screenshot of ${url}...`,
                    contextInfo: silaContext
                });

                try {
                    // Using a website screenshot API
                    const apiUrl = `https://image.thum.io/get/width/800/crop/600/${encodeURIComponent(url)}`;
                    
                    await socket.sendMessage(msg.key.remoteJid, {
                        image: { url: apiUrl },
                        caption: `🌐 *Website Screenshot*\n\n*URL:* ${url}\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });

                } catch (error) {
                    console.error('URL screenshot error:', error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Error taking website screenshot: ${error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }
        }

        return false;
    }
};
