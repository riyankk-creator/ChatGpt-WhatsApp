const process = require("process")
const qrcode = require("qrcode-terminal");

// Whatsapp client
import { Client } from "whatsapp-web.js";

// ChatGPT & DALLE
import { handleMessageGPT } from './gpt'
import { handleMessageDALLE } from './dalle'

// Environment variables
require("dotenv").config()

// Prefixes
const prefixEnabled = process.env.PREFIX_ENABLED == "true"
const gptPrefix = '!gpt'
const dallePrefix = '!dalle'

// Whatsapp Client
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox']
    }
})

// Entrypoint
const start = async () => {
    // Whatsapp auth
    client.on("qr", (qr: string) => {
        console.log("[Whatsapp ChatGPT] Scan this QR code in whatsapp to log in:")
        qrcode.generate(qr, { small: true }, null);
    })

    // Whatsapp ready
    client.on("ready", () => {
        console.log("[Whatsapp ChatGPT] Client is ready!");
    })

    // Whatsapp message
    client.on("message", async (message) => {
        if (message.from.match(/status\@broadcast/ig)) return

        const messageString = message.body;
        if (messageString.length == 0) return

        console.log("[Whatsapp ChatGPT] Received message from " + message.from + ": " + messageString)

        if (prefixEnabled) {
            // GPT (!gpt <prompt>)
            if (messageString.startsWith(gptPrefix)) {
                const prompt = messageString.substring(gptPrefix.length + 1);
                await handleMessageGPT(message, prompt)
                return
            }
            
            // DALLE (!dalle <prompt>)
            if (messageString.startsWith(dallePrefix)) {
                const prompt = messageString.substring(dallePrefix.length + 1);
                await handleMessageDALLE(message, prompt)
                return
            }
        } else {
            // GPT (only <prompt>)
            await handleMessageGPT(message, messageString)
        }
    })

    // Whatsapp initialization
    client.initialize().catch((error: any) => {
        throw error
    })
}

start().then(() => {
    console.log("[Whatsapp ChatGPT] Started")
}).catch((error: any) => {
    console.error("An error happened:", error)
})
