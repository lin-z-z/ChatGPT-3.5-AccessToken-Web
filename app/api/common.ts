import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
const OPENAI_URL = "api.openai.com";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = process.env.PROTOCOL ?? DEFAULT_PROTOCOL;
const BASE_URL = process.env.BASE_URL ?? OPENAI_URL;

type SendDataType = {
  prompt: any;
  message_id: string;
  parent_message_id: string;
  model: string;
  timezone_offset_min: number;
  // 添加一个可选的 conversation_id 属性
  conversation_id?: string;
};

export async function requestOpenai(req: NextRequest) {
  const apiKey = req.headers.get("token");
  const openaiPath = req.headers.get("path");

  let baseUrl = BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `${PROTOCOL}://${baseUrl}`;
  }

  console.log("[Proxy] ", openaiPath);
  console.log("[Base Url]", baseUrl);

  if (process.env.OPENAI_ORG_ID) {
    console.log("[Org ID]", process.env.OPENAI_ORG_ID);
  }

  let url = `${baseUrl}/${openaiPath}`;
  if (openaiPath === "v1/chat/completions") {
    url = "http://10.0.8.8:8181/api/conversation/talk";
    // console.log(req.body);
    const requestBody = await req.json(); // 解析请求体中的 JSON 内容
    const len = requestBody.messages.length;
    const model = requestBody.model;
    let prompt = "";
    let parent_message_id = req.headers.get("pid");
    let conversation_id = req.headers.get("cid");

    if (model == "gpt-3.5-turbo") {
      if (parent_message_id == "") {
        for (let i = 0; i < len; i++) {
          prompt = prompt + requestBody.messages[i].content + "\n";
        }
      } else {
        prompt = requestBody.messages[len - 1].content;
      }
    } else {
      prompt = requestBody.messages[len - 1].content;
    }

    if (parent_message_id === "") {
      parent_message_id = uuidv4();
    }
    const message_id = uuidv4();
    let senddata: SendDataType = {
      prompt: prompt,
      message_id: message_id,
      parent_message_id: parent_message_id,
      model: "text-davinci-002-render-sha",
      timezone_offset_min: -480,
    };

    if (conversation_id != "") {
      senddata.conversation_id = conversation_id;
    }

    return fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      method: req.method,
      body: JSON.stringify(senddata),
    });
  } else if (openaiPath === "api/conversation/gen_title") {
    const conversation_id = req.headers.get("cid");
    const message_id = req.headers.get("pid");
    let senddata = {
      message_id: message_id,
      model: "text-davinci-002-render-sha",
    };
    let titlejson = {
      object: "chat.completion",
      model: "gpt-3.5-turbo",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 360,
        completion_tokens: 7,
        total_tokens: 367,
      },
    };
    url = "http://10.0.8.8:8181/api/conversation/gen_title/" + conversation_id;
    return fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      method: req.method,
      body: JSON.stringify(senddata),
    });
  } else {
    return fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENAI_ORG_ID && {
          "OpenAI-Organization": process.env.OPENAI_ORG_ID,
        }),
      },
      method: req.method,
      body: req.body,
    });
  }
}
