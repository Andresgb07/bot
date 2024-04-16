import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 
 * @param name 
 * @param history 
 */
const run = async (prompt: string, history: ChatCompletionMessageParam[]): Promise<string> => {

    const promtp = prompt;
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
            ...history,
            {
                "role": "system",
                "content": promtp
            }
        ],
        temperature: 1,
        max_tokens: 800,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    });
    return response.choices[0].message.content;
}

export { run }


