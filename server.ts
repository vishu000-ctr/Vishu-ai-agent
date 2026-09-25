import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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

const sessions: Record<string, any[]> = {};

function getSession(sessionId: string) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = [
      {
        role: "system",
        content: `Tum ${AGENT_NAME} ho, ek helpful AI assistant. Hamesha friendly aur seedhe jawab do.`,
      },
    ];
  }
  return sessions[sessionId];
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const messages = getSession(sessionId || "default");

    messages.push({ role: "user", content: message });

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
    res.json({ reply: msg.content });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Kuch galat ho gaya" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Vishu app chal raha hai! Browser me kholo: http://localhost:${PORT}\n`);
});