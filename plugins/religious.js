const axios = require('axios');

module.exports = {
    handleCommand: async function(socket, msg, command, args, number, userConfig, silaContext) {
        const config = require('../config.json');
        
        switch (command) {
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
                const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg';

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: imageUrl },
                    caption: `╔═══════════════════════╗
║   📖 𝙱𝙸𝙱𝙻𝙴 𝙻𝙸𝚂𝚃   ║
╚═══════════════════════╝

${formattedList}

*Usage:*
${config.PREFIX}bible John 3:16

> 🙏 "Thy word is a lamp unto my feet, and a light unto my path." — Psalms 119:105

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`
                });
                return true;
            }

            case 'bible': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `📖 *Please provide a verse!*\nExample: ${config.PREFIX}bible John 3:16`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg';

                try {
                    const query = args.join(' ');
                    const response = await axios.get(`https://bible-api.com/${encodeURIComponent(query)}`);

                    if (response.data && response.data.text) {
                        await socket.sendMessage(msg.key.remoteJid, {
                            image: { url: imageUrl },
                            caption: `╔═══════════════════════╗
║   📖 𝙱𝙸𝙱𝙻𝙴 𝚅𝙴𝚁𝚂𝙴   ║
╚═══════════════════════╝

*${response.data.reference}*

${response.data.text.trim()}

— ${response.data.translation_name}

> 🙌 "The word of God is alive and powerful." — Hebrews 4:12

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`
                        });
                    } else {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ Verse not found. Please check your input.`,
                            contextInfo: silaContext
                        });
                    }
                } catch (error) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `⚠️ Unable to fetch verse.\nError: ${error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
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

                const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg';

                await socket.sendMessage(msg.key.remoteJid, {
                    image: { url: imageUrl },
                    caption: `╔═══════════════════════╗
║   🕌 𝚀𝚄𝚁𝙰𝙽 𝚂𝚄𝚁𝙰𝙷𝚂   ║
╚═══════════════════════╝

${surahNames.slice(0, 30).join('\n')}

*... and ${surahNames.length - 30} more surahs*

*Usage:*
${config.PREFIX}quran 2:255

> 🌙 "Indeed, this Qur'an guides to that which is most just and right." — Surah Al-Isra 17:9

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`
                });
                return true;
            }

            case 'quran': {
                if (args.length === 0) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `🕌 *Please provide a verse!*\nExample: ${config.PREFIX}quran 2:255`,
                        contextInfo: silaContext
                    });
                    return true;
                }

                const imageUrl = 'https://files.catbox.moe/gwuzwl.jpg';

                try {
                    const query = args[0].split(':');
                    const surah = query[0];
                    const ayah = query[1];

                    const response = await axios.get(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/en.asad`);

                    if (response.data && response.data.data) {
                        const verse = response.data.data.text;
                        const surahName = response.data.data.surah.englishName;

                        await socket.sendMessage(msg.key.remoteJid, {
                            image: { url: imageUrl },
                            caption: `╔═══════════════════════╗
║   🕌 𝚀𝚄𝚁𝙰𝙽 𝚅𝙴𝚁𝚂𝙴   ║
╚═══════════════════════╝

*${surahName}* — ${surah}:${ayah}

${verse}

> ✨ "So remember Me; I will remember you." — Quran 2:152

╔═══════════════════════╗
║  𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝚂𝙸𝙻𝙰 𝙼𝙳  ║
╚═══════════════════════╝`
                        });
                    } else {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            text: `❌ Verse not found. Please check your input.`,
                            contextInfo: silaContext
                        });
                    }
                } catch (error) {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        text: `⚠️ Unable to fetch Quran verse.\nError: ${error.message}`,
                        contextInfo: silaContext
                    });
                }
                return true;
            }
        }

        return false;
    }
};
