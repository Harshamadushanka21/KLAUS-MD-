import dotenv from 'dotenv';
dotenv.config();

import {
    makeWASocket,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason,
    useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Handler, Callupdate, GroupUpdate } from './src/event/index.js';
import express from 'express';
import pino from 'pino';
import fs from 'fs';
import NodeCache from 'node-cache';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';
import axios from 'axios';
import config from './config.cjs';
import pkg from './lib/autoreact.cjs';
const { emojis, doReact } = pkg;

const sessionName = "session";
const app = express();
const orange = chalk.bold.hex("#FFA500");
const lime = chalk.bold.hex("#32CD32");
let useQR = false;
let initialConnection = true;
const PORT = process.env.PORT || 3000;

const MAIN_LOGGER = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const msgRetryCounterCache = new NodeCache();

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

async function downloadSessionData() {
    if (!config.SESSION_ID) {
        console.error('Please add your session to SESSION_ID env !!');
        return false;
    }
    const sessdata = config.SESSION_ID.split("{"noiseKey":{"private":{"type":"Buffer","data":"6Ovv1ghAiUBfaloDJ1FrzHwE/g16pJqh0Tm5e7BRF2I="},"public":{"type":"Buffer","data":"Zj74NxhQXdmcVGi6R8bjSi2OYLLKF5/ZGln79EiGIh0="}},"pairingEphemeralKeyPair":{"private":{"type":"Buffer","data":"IHplg5VCejjrL/e7azBRqwzUMc79nmL25IDELwD0NkI="},"public":{"type":"Buffer","data":"gym6h9BLMZw9rdVIrXJMsLxFebIH2BI6ZRAFN20Jqlc="}},"signedIdentityKey":{"private":{"type":"Buffer","data":"YHfntt9T1n4bK/pxge1RuGPDxWxHuX7Tykg3A3+O7nA="},"public":{"type":"Buffer","data":"ApzNnrVJHQVdD6jrCnP3n8cdMCUvqNU5d7S1aXB9XyI="}},"signedPreKey":{"keyPair":{"private":{"type":"Buffer","data":"SLPMA2ZoYsZPJfqMokclzd3Uc/EEU1h6+xG0Y+wfxmA="},"public":{"type":"Buffer","data":"T1Fb9aJQpMs+/hoEaFWx4b6y4+QVObvWo/wMcobPeBI="}},"signature":{"type":"Buffer","data":"ZDRB2OwaAy2m8HV1ZivSos3VVoz2RZgYYRRacbX1IiqmhJDRH5cyZTVsbjfUKE6miQhYzh0t2ikvFPdXjMcACg=="},"keyId":1},"registrationId":101,"advSecretKey":"p7DkVXfgtTM9m8lmWpSXek/Slpp3wQtEW22h4yw43Xw=","processedHistoryMessages":[{"key":{"remoteJid":"94702044598@s.whatsapp.net","fromMe":true,"id":"52548A684CDBC087CA06E46E9B4D1414"},"messageTimestamp":1735555589}],"nextPreKeyId":31,"firstUnuploadedPreKeyId":31,"accountSyncCounter":0,"accountSettings":{"unarchiveChats":false},"deviceId":"PzzWJ-BHSOeoGr5pLAZi5A","phoneId":"78cf602e-3185-432b-a401-e0239050fc50","identityId":{"type":"Buffer","data":"8xynCBzBldLTA2kroFGK9JJR9XU="},"registered":true,"backupToken":{"type":"Buffer","data":"WwwcHn7SkspElHkUDT4asVpwHnU="},"registration":{},"pairingCode":"S6F2F5HM","me":{"id":"94702044598:12@s.whatsapp.net","lid":"34287294386183:12@lid","name":"~DAS~  {☠️}"},"account":{"details":"CNDKicAFEPnzybsGGAQgACgA","accountSignatureKey":"ol5BsqpbyEcjoMg2eBEsE9AI6CSAG7Z969oIkm70mzw=","accountSignature":"O1ObXtBWtdXsh2iKqPOpQ88g2nYwxNRwwb4kBNtL88gp8trgnBQ0SBL130MpuqcjS8gVMsWjXl7G0/Re6oMQBw==","deviceSignature":"cKlRlQEdC51U9L96AVrUjr8bHKVO6l0DMR8LpsXzo5ab5P3YuuT2GrMf2ZU2uH7wA3vt+VJtwmnUM0DcCXINDQ=="},"signalIdentities":[{"identifier":{"name":"94702044598:12@s.whatsapp.net","deviceId":0},"identifierKey":{"type":"Buffer","data":"BaJeQbKqW8hHI6DINngRLBPQCOgkgBu2fevaCJJu9Js8"}}],"platform":"android","lastAccountSyncTimestamp":1735555580,"myAppStateKeyId":"AAAAAJXP"}")[1];
    const url = `https://pastebin.com/raw/${sessdata}`;
    try {
        const response = await axios.get(url);
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        await fs.promises.writeFile(credsPath, data);
        console.log("🔒 Session Successfully Loaded !!");
        return true;
    } catch (error) {
       // console.error('Failed to download session data:', error);
        return false;
    }
}

async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`🤖 ❝𝐊𝐋𝐀𝐔𝐒-𝐌𝐃❞ using WA v${version.join('.')}, isLatest: ${isLatest}`);
        
        const Matrix = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: useQR,
            browser: ["KLAUS-MD", "safari", "3.3"],
            auth: state,
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg.message || undefined;
                }
                return { conversation: "KLAUS-MD  whatsapp user bot" };
            }
        });

        Matrix.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    start();
                }
            } else if (connection === 'open') {
                if (initialConnection) {
                    console.log(chalk.green("❝𝐊𝐋𝐀𝐔𝐒-𝐌𝐃❞ ᴄᴏɴɴᴇᴄᴛᴇᴅ"));
                    Matrix.sendMessage(Matrix.user.id, { text: `ʜɪ ᴛʜᴀɴᴋ ʏᴏᴜ ꜰᴏʀ ᴄʜᴏᴏꜱɪɴɢ ❝𝐊𝐋𝐀𝐔𝐒-𝐌𝐃❞ ᴀꜱ ʏᴏᴜʀ ʙᴏᴛ ɪ ᴡɪꜱʜ ʏᴏᴜ ᴛʜᴇ ʙᴇꜱᴛ.` });
                    initialConnection = false;
                } else {
                    console.log(chalk.blue("♻️ Connection reestablished after restart."));
                }
            }
        });

        Matrix.ev.on('creds.update', saveCreds);

        Matrix.ev.on("messages.upsert", async chatUpdate => await Handler(chatUpdate, Matrix, logger));
        Matrix.ev.on("call", async (json) => await Callupdate(json, Matrix));
        Matrix.ev.on("group-participants.update", async (messag) => await GroupUpdate(Matrix, messag));

        if (config.MODE === "public") {
            Matrix.public = true;
        } else if (config.MODE === "private") {
            Matrix.public = false;
        }

        Matrix.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek.key.fromMe && config.AUTO_REACT) {
                    console.log(mek);
                    if (mek.message) {
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await doReact(randomEmoji, mek, Matrix);
                    }
                }
            } catch (err) {
                console.error('Error during auto reaction:', err);
            }
        });
    } catch (error) {
        console.error('Critical Error:', error);
        process.exit(1);
    }
}

async function init() {
    if (fs.existsSync(credsPath)) {
        console.log("🔒 Session file found, proceeding without QR code.");
        await start();
    } else {
        const sessionDownloaded = await downloadSessionData();
        if (sessionDownloaded) {
            console.log("🔒 Session downloaded, starting bot.");
            await start();
        } else {
            console.log("No session found or downloaded, QR code will be printed for authentication.");
            useQR = true;
            await start();
        }
    }
}

init();

app.get('/', (req, res) => {
    res.send('❝𝐊𝐋𝐀𝐔𝐒-𝐌𝐃❞ ONLINE ☑️');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
  
