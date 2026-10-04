import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import "dotenv/config";
import { evaluate } from "mathjs";

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
  {
    type: "function" as const,
    function: {
      name: "calculate",
      description:
        "Evaluate a math expression and return the exact result. Use this for ANY math calculation (addition, subtraction, multiplication, division, percentages, square roots, powers, trigonometry, etc.) to ensure accuracy instead of calculating mentally.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "The math expression to evaluate, e.g. '25 * 4 + 10', 'sqrt(144)', '15% of 200', '2^10'",
          },
        },
        required: ["expression"],
      },
    },
  },
];

async function getWeather(city: string) {
  if (!city) return "City ka naam nahi mila, dobara poochho.";
  return `${city} mein mausam saaf hai, 28°C`;
}

function calculate(expression: string) {
  if (!expression) return "Koi expression nahi mila calculate karne ke liye.";
  try {
    const cleaned = expression
      .replace(/(\d+(\.\d+)?)\s*%\s*of\s*(\d+(\.\d+)?)/gi, "($1/100)*$3")
      .replace(/%/g, "/100");
    const result = evaluate(cleaned);
    return "Result: " + result;
  } catch (err) {
    return "Calculation error: expression samajh nahi aayi. (" + expression + ")";
  }
}

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "Tum " +
    AGENT_NAME +
    " ho, ek helpful AI assistant. Hamesha friendly aur seedhe jawab do. Kisi bhi math calculation ke liye hamesha 'calculate' tool use karo, mentally calculate mat karo. Jab bhi koi tool call karo, uske saare required parameters zaroor bharo — khali mat chodo.",
};

async function callGroq(messages: any[], useTools: boolean) {
  try {
    if (useTools) {
      return await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: messages,
        tools: tools,
      });
    } else {
      return await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: messages,
      });
    }
  } catch (err: any) {
    let errText = "";
    try {
      errText = JSON.stringify(err) + " " + String(err?.message || "");
    } catch {
      errText = String(err);
    }
    const isToolError =
      errText.includes("tool_use_failed") ||
      errText.includes("tool call validation");

    if (isToolError && useTools) {
      console.warn("Tool call validation failed, retrying without tools...");
      return await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: messages,
      });
    }
    throw err;
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    const history = req.body.history;
    const messages: any[] = [SYSTEM_PROMPT];
    if (Array.isArray(history)) {
      for (let i = 0; i < history.length; i++) {
        messages.push(history[i]);
      }
    }

    let response = await callGroq(messages, true);
    let msg = response.choices[0].message;

    let safetyCounter = 0;
    while (msg.tool_calls && safetyCounter < 5) {
      safetyCounter++;
      messages.push(msg);
      for (const call of msg.tool_calls) {
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch (e) {
          args = {};
        }
        let result = "";
        if (call.function.name === "get_weather") {
          result = await getWeather(args.city);
        } else if (call.function.name === "calculate") {
          result = calculate(args.expression);
        } else {
          result = "Unknown tool call.";
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }
      response = await callGroq(messages, true);
      msg = response.choices[0].message;
    }

    messages.push(msg);
    res.json({ reply: msg.content || "Maaf karo, jawab nahi bana paaya." });
  } catch (err: any) {
    console.error(err);
    res.json({
      reply:
        "Maaf karo, abhi samajhne me thodi dikkat hui. Dobara simple shabdon me pooch sakte ho?",
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log("\n✅ Vishu app chal raha hai! Browser me kholo: http://localhost:" + PORT + "\n");
});