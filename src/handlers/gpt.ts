import os from "os";
import fs from "fs";
import path from "path";

import { randomUUID } from "crypto";
import { ChatMessage } from "chatgpt";
import { Message, MessageMedia } from "whatsapp-web.js";

import { config } from "../env/env-variables";

import { chatgpt } from "../providers/openai";
import { ttsRequest } from "../providers/speech";

import * as cli from "../cli/ui";

// Mapping from number to last conversation id
const conversations = {};

const handleMessageGPT = async (message: Message, prompt: string) => {
	try {
		// Get last conversation
		const lastConversation = conversations[message.from];

		cli.print(`[GPT] Received prompt from ${message.from}: ${prompt}`);

		const start = Date.now();

		// Check if we have a conversation with the user
		let response: ChatMessage;
		if (lastConversation) {
			// Handle message with previous conversation
			response = await chatgpt.sendMessage(prompt, lastConversation);
		} else {
			// Handle message with new conversation
			response = await chatgpt.sendMessage(prompt);
		}

		const end = Date.now() - start;

		cli.print(`[GPT] Answer to ${message.from}: ${response.text}  | OpenAI request took ${end}ms)`);

		// Set the conversation
		conversations[message.from] = {
			conversationId: response.conversationId,
			parentMessageId: response.id
		};

		// TTS reply (Default: disabled)
		if (config.TTS_ENABLED) {
			return sendVoiceMessageReply(message, response);
		}

		// Default: Text reply
		return message.reply(response.text);
	} catch (error: any) {
		console.error("An error occured", error);
		return message.reply("An error occured, please contact the administrator. (" + error.message + ")");
	}
};

const handleDeleteConversation = async (message: Message) => {
	delete conversations[message.from];
	return message.reply("Conversation context was resetted!");
}

async function sendVoiceMessageReply(message: Message, gptResponse: any) {
	// Get audio buffer
	cli.print(`[Speech API] Generating audio from GPT response "${gptResponse.text}"...`);

	const audioBuffer = await ttsRequest(gptResponse.text);
	cli.print("[Speech API] Audio generated!");

	// Check if audio buffer is valid
	if (audioBuffer == null || audioBuffer.length == 0) {
		return message.reply("Speech API couldn't generate audio, please contact the administrator.");
	}

	// Get temp folder and file path
	const tempFolder = os.tmpdir();
	const tempFilePath = path.join(tempFolder, randomUUID() + ".opus");

	// Save buffer to temp file
	fs.writeFileSync(tempFilePath, audioBuffer);

	// Send audio
	const messageMedia = new MessageMedia("audio/ogg; codecs=opus", audioBuffer.toString("base64"));
	return message.reply(messageMedia);

	// Delete temp file
	fs.unlinkSync(tempFilePath);
}

export { handleMessageGPT, handleDeleteConversation };
