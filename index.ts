import Groq from "groq-sdk";
import "dotenv/config";
import * as readline from "readline";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AGENT_NAME = "Vishu";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get current weather of a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  },
];

async function getWeather(city: string) {
  return `${city} mein mausam saaf hai, 28°C`;
}

const messages: any[] = [
  {
    role: "system",
    content: `Tum ${AGENT_NAME} ho, ek helpful AI assistant. Hamesha friendly aur seedhe jawab do.`,
  },
];

async function askAgent(userMessage: string) {
  messages.push({ role: "user", content: userMessage });

  let response = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages,
    tools,
  });

  let msg = response.choices[0].message;

  while (msg.tool_calls) {
    messages.push(msg);
    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments);
      let result = "";
      if (call.function.name === "get_weather") {
        result = await getWeather(args.city);
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
    response = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages,
      tools,
    });
    msg = response.choices[0].message;
  }

  messages.push(msg);
  return msg.content;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`\n${AGENT_NAME} se baat shuru karo! (band karne ke liye 'exit' likho)\n`);

function chatLoop() {
  rl.question("Tum: ", async (input) => {
    if (input.trim().toLowerCase() === "exit") {
      console.log(`\n${AGENT_NAME}: Theek hai, phir milte hain! 👋\n`);
      rl.close();
      return;
    }

    const reply = await askAgent(input);
    console.log(`${AGENT_NAME}: ${reply}\n`);

    chatLoop();
  });
}

chatLoop();