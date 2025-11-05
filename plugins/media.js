const axios = require('axios');
const ytSearch = require('yt-search');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        switch (command) {
            case 'fb':
            case 'facebook': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Please provide a Facebook video URL.\nUsage: ${config.PREFIX}fb <facebook-video-url>`,
                        contextInfo: silaContext
                    });
                    return true;
                }
                
                const fbUrl = args[0];
                if (!fbUrl.includes('facebook.com') && !fbUrl.includes('fb.watch')) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Please provide a valid Facebook video URL.`,
                        contextInfo: silaContext
                    });
                    return true;
                }
                
                await socket.sendMessage(msg.key.remoteJid, { 
                    text: `⏳ Downloading Facebook video, please wait...`,
                    contextInfo: silaContext
                });
                
                try {
                    const apiUrl = `https://www.dark-yasiya-api.site/download/fbdl2?url=${encodeURIComponent(fbUrl)}`;
                    const response = await axios.get(apiUrl);

                    if (!response.data || response.data.status !== true) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ Unable to fetch the video. Please check the URL and try again.`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const sdLink = response.data.result.sdLink;
                    const hdLink = response.data.result.hdLink;
                    const downloadLink = hdLink || sdLink;
                    const quality = hdLink ? "HD" : "SD";
                    
                    if (!downloadLink) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ No downloadable video found. The video might be private or restricted.`,
                            contextInfo: silaContext
                        });
                        return true;
                    }
                    
                    await socket.sendMessage(msg.key.remoteJid, {
                        video: { url: downloadLink },
                        caption: `✅ Facebook Video Downloaded (${quality} Quality)\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });
                    
                } catch (error) {
                    console.error('Facebook download error:', error);
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Error downloading video. Please try again later.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'ig':
            case 'instagram': {
                const igUrl = args[0];
                if (!igUrl) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `📸 *Usage:* ${config.PREFIX}ig <Instagram URL>`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                await socket.sendMessage(msg.key.remoteJid, { 
                    text: `⏳ *Downloading Instagram post... please wait.*`,
                    contextInfo: silaContext
                });

                try {
                    const apiUrl = `https://api.fgmods.xyz/api/downloader/igdl?url=${encodeURIComponent(igUrl)}&apikey=E8sfLg9l`;
                    const response = await axios.get(apiUrl);

                    const { url, caption, username, like, comment, isVideo } = response.data.result;
                    const mediaBuffer = (await axios.get(url, { responseType: 'arraybuffer' })).data;

                    await socket.sendMessage(msg.key.remoteJid, {
                        [isVideo ? "video" : "image"]: mediaBuffer,
                        caption: `╔═══════════════════════╗
║   📸 𝙸𝙽𝚂𝚃𝙰𝙶𝚁𝙰𝙼   ║
╚═══════════════════════╝

👤 *User:* ${username}
💬 *Caption:* ${caption || 'No caption'}
❤️ *Likes:* ${like}
💭 *Comments:* ${comment}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`,
                        contextInfo: silaContext
                    });

                } catch (error) {
                    console.error('Instagram Error:', error);
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ *Failed to download Instagram media.*\nPlease check your link and try again.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'tiktok': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `⚠️ Please provide a TikTok video URL.\n\nExample:\n${config.PREFIX}tiktok https://www.tiktok.com/@user/video/12345`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                try {
                    const tiktokUrl = args[0];
                    const apiUrl = `https://api.nexoracle.com/downloader/tiktok-nowm?apikey=free_key@maher_apis&url=${encodeURIComponent(tiktokUrl)}`;
                    const response = await axios.get(apiUrl);
                    const result = response.data.result;

                    if (!result || !result.url) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: "❌ Failed to download TikTok video. Please check the link or try again later.",
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const { title, author, metrics, url } = result;

                    const tiktokCaption = `╔═══════════════════════╗
║   🎵 𝚃𝙸𝙺𝚃𝙾𝙺   ║
╚═══════════════════════╝

🔖 *Title:* ${title || "No title"}
👤 *Author:* @${author?.username || "unknown"} (${author?.nickname || "unknown"})
❤️ *Likes:* ${metrics?.digg_count ?? "N/A"}
💬 *Comments:* ${metrics?.comment_count ?? "N/A"}
🔁 *Shares:* ${metrics?.share_count ?? "N/A"}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                    await socket.sendMessage(msg.key.remoteJid, {
                        video: { url },
                        caption: tiktokCaption,
                        contextInfo: silaContext
                    });

                } catch (error) {
                    console.error("TikTok Downloader Error:", error);
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: "❌ An error occurred while processing the TikTok video. Please try again later.",
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'ytmp4': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `⚠️ Please provide a YouTube video link.\n\nExample:\n${config.PREFIX}ytmp4 https://youtu.be/dQw4w9WgXcQ`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                try {
                    const videoUrl = args[0];
                    const apiUrl = `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(videoUrl)}`;
                    
                    const response = await axios.get(apiUrl);
                    const result = response.data.result;

                    if (!result || !result.download_url) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: "❌ Failed to fetch video. Please check the YouTube link or try again later.",
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const { title, quality, size } = result;

                    const caption = `╔═══════════════════════╗
║   🎬 𝚈𝙾𝚄𝚃𝚄𝙱𝙴 𝙼𝙿𝟺   ║
╚═══════════════════════╝

🎬 *Title:* ${title || "No title"}
🎞️ *Quality:* ${quality || "Unknown"}
💾 *Size:* ${size || "N/A"}

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`;

                    await socket.sendMessage(msg.key.remoteJid, {
                        video: { url: result.download_url },
                        caption,
                        contextInfo: silaContext
                    });

                } catch (error) {
                    console.error("YouTube MP4 Error:", error);
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: "❌ An error occurred while processing the YouTube video. Please try again later.",
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'song':
            case 'play': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `🎵 *Usage:* ${config.PREFIX}song <song name or YouTube URL>`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const query = args.join(' ');
                await socket.sendMessage(msg.key.remoteJid, {
                    text: `🔍 Searching for "${query}"...`,
                    contextInfo: silaContext
                });

                try {
                    let ytUrl = query;
                    if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                        const searchResults = await ytSearch(query);
                        if (!searchResults.videos || searchResults.videos.length === 0) {
                            await socket.sendMessage(msg.key.remoteJid, {
                                text: `❌ No results found for "${query}"`,
                                contextInfo: silaContext
                            });
                            return true;
                        }
                        ytUrl = searchResults.videos[0].url;
                    }

                    const apiUrl = `https://sadiya-tech-apis.vercel.app/download/ytdl?url=${encodeURIComponent(ytUrl)}&format=mp3&apikey=sadiya`;
                    const response = await axios.get(apiUrl);

                    if (response.data && response.data.downloadUrl) {
                        await socket.sendMessage(msg.key.remoteJid, {
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
                        await socket.sendMessage(msg.key.remoteJid, {
                            text: `❌ Failed to download song`,
                            contextInfo: silaContext
                        });
                    }
                } catch (error) {
                    console.error('Song download error:', error);
                    await socket.sendMessage(msg.key.remoteJid, {
                        text: `❌ Error downloading song: ${error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }

            case 'ytaudio': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Please provide a YouTube URL.\nUsage: ${config.PREFIX}ytaudio <youtube-url>`,
                        contextInfo: silaContext
                    });
                    return true;
                }
                
                const url = args[0];
                if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Please provide a valid YouTube URL.`,
                        contextInfo: silaContext
                    });
                    return true;
                }
                
                await socket.sendMessage(msg.key.remoteJid, { 
                    text: `⏳ Downloading YouTube audio, please wait...`,
                    contextInfo: silaContext
                });
                
                try {
                    const apiUrl = `https://api.nexoracle.com/downloader/yt-audio2?apikey=free_key@maher_apis&url=${encodeURIComponent(url)}`;
                    const res = await axios.get(apiUrl);
                    const data = res.data;

                    if (!data?.status || !data.result?.audio) {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ Failed to download audio!`,
                            contextInfo: silaContext
                        });
                        return true;
                    }

                    const { title, audio } = data.result;

                    await socket.sendMessage(msg.key.remoteJid, {
                        audio: { url: audio },
                        mimetype: "audio/mpeg",
                        fileName: `${title}.mp3`.replace(/[^\w\s.-]/gi, ''),
                        caption: `🎵 ${title}\n\n✅ YouTube audio downloaded successfully!\n\n╔═══════════════════════╗\n║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║\n╚═══════════════════════╝`
                    });
                    
                } catch (error) {
                    console.error('YouTube audio download error:', error);
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `❌ Error downloading audio. Please try again later.`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }
        }

        return false;
    }
};
