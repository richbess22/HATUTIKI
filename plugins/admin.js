module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        // Check if user is admin in group
        const isAdmin = async (groupId, userId) => {
            try {
                const metadata = await socket.groupMetadata(groupId);
                const participant = metadata.participants.find(p => p.id === userId);
                return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
            } catch (error) {
                return false;
            }
        };

        // Check if command is used in group
        if (!msg.key.remoteJid.endsWith('@g.us')) {
            if (['ban', 'promote', 'demote', 'kick', 'mute', 'unmute', 'warn', 'warnings', 'antilink', 'antibadword', 'clear', 'tag', 'tagall', 'tagnotadmin', 'hidetag', 'chatbot', 'resetlink', 'antitag', 'welcome', 'goodbye', 'setgdesc', 'setgname', 'setgpp'].includes(command)) {
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `❌ This command can only be used in groups.`,
                    contextInfo: silaContext
                });
                return true;
            }
        }

        const groupId = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        switch (command) {
            case 'ban': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (!args[0] || !args[0].includes('@')) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Please mention a user to ban.\nUsage: ${config.PREFIX}ban @user`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const userId = args[0].replace('@', '') + '@s.whatsapp.net';
                
                try {
                    await socket.groupParticipantsUpdate(groupId, [userId], 'remove');
                    await socket.sendMessage(groupId, {
                        text: `✅ User has been banned from the group.`,
                        contextInfo: silaContext
                    });
                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to ban user. I may not have admin permissions.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'promote': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (!args[0] || !args[0].includes('@')) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Please mention a user to promote.\nUsage: ${config.PREFIX}promote @user`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const userId = args[0].replace('@', '') + '@s.whatsapp.net';
                
                try {
                    await socket.groupParticipantsUpdate(groupId, [userId], 'promote');
                    await socket.sendMessage(groupId, {
                        text: `✅ User has been promoted to admin.`,
                        contextInfo: silaContext
                    });
                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to promote user. I may not have admin permissions.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'demote': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (!args[0] || !args[0].includes('@')) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Please mention a user to demote.\nUsage: ${config.PREFIX}demote @user`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const userId = args[0].replace('@', '') + '@s.whatsapp.net';
                
                try {
                    await socket.groupParticipantsUpdate(groupId, [userId], 'demote');
                    await socket.sendMessage(groupId, {
                        text: `✅ User has been demoted from admin.`,
                        contextInfo: silaContext
                    });
                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to demote user. I may not have admin permissions.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'kick': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (!args[0] || !args[0].includes('@')) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Please mention a user to kick.\nUsage: ${config.PREFIX}kick @user`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const userId = args[0].replace('@', '') + '@s.whatsapp.net';
                
                try {
                    await socket.groupParticipantsUpdate(groupId, [userId], 'remove');
                    await socket.sendMessage(groupId, {
                        text: `✅ User has been kicked from the group.`,
                        contextInfo: silaContext
                    });
                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to kick user. I may not have admin permissions.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'mute': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const minutes = parseInt(args[0]) || 60;
                
                try {
                    await socket.groupSettingUpdate(groupId, 'announcement');
                    await socket.sendMessage(groupId, {
                        text: `✅ Group has been muted for ${minutes} minutes.`,
                        contextInfo: silaContext
                    });

                    // Auto unmute after specified time
                    setTimeout(async () => {
                        try {
                            await socket.groupSettingUpdate(groupId, 'not_announcement');
                            await socket.sendMessage(groupId, {
                                text: `🔊 Group has been unmuted automatically.`,
                                contextInfo: silaContext
                            });
                        } catch (error) {
                            console.error('Auto unmute error:', error);
                        }
                    }, minutes * 60 * 1000);

                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to mute group. I may not have admin permissions.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'unmute': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }
                
                try {
                    await socket.groupSettingUpdate(groupId, 'not_announcement');
                    await socket.sendMessage(groupId, {
                        text: `🔊 Group has been unmuted.`,
                        contextInfo: silaContext
                    });
                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to unmute group. I may not have admin permissions.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'delete':
            case 'del': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                try {
                    await socket.sendMessage(groupId, {
                        delete: msg.key
                    });
                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to delete message. I may not have admin permissions.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'tagall': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                try {
                    const metadata = await socket.groupMetadata(groupId);
                    const participants = metadata.participants.map(p => p.id);
                    const tagMessage = `📢 *Tagging all members:*\n\n${participants.map(p => `@${p.split('@')[0]}`).join(' ')}`;
                    
                    await socket.sendMessage(groupId, {
                        text: tagMessage,
                        mentions: participants,
                        contextInfo: silaContext
                    });
                } catch (error) {
                    await socket.sendMessage(groupId, {
                        text: `❌ Failed to tag all members.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'clear': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                await socket.sendMessage(groupId, {
                    text: `🧹 This feature is under development.`,
                    contextInfo: silaContext
                });
                return true;
            }

            case 'antilink': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const action = args[0]?.toLowerCase();
                if (!action || !['on', 'off'].includes(action)) {
                    await socket.sendMessage(groupId, {
                        text: `⚙️ Usage: ${config.PREFIX}antilink on/off`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                if (action === 'on') {
                    userConfig.ANTI_LINK = 'true';
                    await socket.sendMessage(groupId, {
                        text: `✅ Anti-link has been enabled for this group.`,
                        contextInfo: silaContext
                    });
                } else {
                    userConfig.ANTI_LINK = 'false';
                    await socket.sendMessage(groupId, {
                        text: `❌ Anti-link has been disabled for this group.`,
                        contextInfo: silaContext
                    });
                }
                
                const { updateUserConfig } = require('../pair.js');
                await updateUserConfig(number, userConfig);
                return true;
            }

            // Add other admin commands here...
            case 'warn':
            case 'warnings':
            case 'antibadword':
            case 'tag':
            case 'tagnotadmin':
            case 'hidetag':
            case 'chatbot':
            case 'resetlink':
            case 'antitag':
            case 'welcome':
            case 'goodbye':
            case 'setgdesc':
            case 'setgname':
            case 'setgpp': {
                if (!(await isAdmin(groupId, sender))) {
                    await socket.sendMessage(groupId, {
                        text: `❌ You need to be an admin to use this command.`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                await socket.sendMessage(groupId, {
                    text: `⚙️ This admin feature is under development and will be available soon!`,
                    contextInfo: silaContext
                });
                return true;
            }
        }

        return false;
    }
};
