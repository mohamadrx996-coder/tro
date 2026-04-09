import axios from "axios";
import https from "https";

// 1. Bot-Specific Hyper-Speed Agent (Maximum Aggression)
const botAgent = new https.Agent({ 
  keepAlive: true,
  maxSockets: 100000, 
  maxFreeSockets: 50000,
  timeout: 30000,
  scheduling: 'fifo'
});

// 2. User-Specific Fast Agent (Stealthy but Quick)
const userAgent = new https.Agent({ 
  keepAlive: true,
  maxSockets: 20000,
  maxFreeSockets: 10000,
  timeout: 45000,
  scheduling: 'fifo'
});

// Persistent axios instances
export const botClient = axios.create({
  baseURL: "https://discord.com/api/v10",
  httpsAgent: botAgent,
  timeout: 600, 
  validateStatus: () => true
});

export const userClient = axios.create({
  baseURL: "https://discord.com/api/v10",
  httpsAgent: userAgent,
  timeout: 8000, 
  validateStatus: () => true
});

export const discordRequest = async (token: string, isBot: boolean, method: string, endpoint: string, data?: any, retryCount = 0, speedSettings?: any): Promise<any> => {
  let cleanToken = token.trim();
  if (isBot && !cleanToken.startsWith("Bot ")) {
    cleanToken = `Bot ${cleanToken}`;
  } else if (!isBot && cleanToken.startsWith("Bot ")) {
    cleanToken = cleanToken.replace(/^Bot\s+/i, "");
  }

  const client = isBot ? botClient : userClient;
  const ua = isBot 
    ? "DiscordBot (https://github.com/discordapp/discord-api-docs, 1.0)" 
    : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 10) + 115}.0.0.0 Safari/537.36`;

  const timeout = speedSettings?.timeout || (method === "GET" ? (isBot ? 5000 : 15000) : (isBot ? 1500 : 5000));
  const maxRetries = speedSettings?.retries !== undefined ? speedSettings.retries : (isBot ? 20 : 5);

  try {
    const response = await client({
      method,
      url: endpoint,
      headers: {
        Authorization: cleanToken,
        "Content-Type": "application/json",
        "User-Agent": ua
      },
      data,
      timeout
    });

    if (response.status === 429 && retryCount < maxRetries) {
      const waitTime = (response.data?.retry_after || (isBot ? 0.001 : 0.1)) * 1000;
      await new Promise(r => setTimeout(r, waitTime));
      return discordRequest(token, isBot, method, endpoint, data, retryCount + 1, speedSettings);
    }

    return response.data;
  } catch (error) {
    if (retryCount < maxRetries) {
      return discordRequest(token, isBot, method, endpoint, data, retryCount + 1, speedSettings);
    }
    throw error;
  }
};

export const limitConcurrency = async (tasks: (() => Promise<any>)[], threads: number, mode: string = 'INSTANT', burstSize: number = 0, burstDelay: number = 0, staggerDelay: number = 0) => {
  if (mode === 'INSTANT') {
    if (staggerDelay > 0) {
      const results: any[] = [];
      for (const task of tasks) {
        results.push(task());
        await new Promise(r => setTimeout(r, staggerDelay));
      }
      return Promise.all(results);
    }
    return Promise.all(tasks.map(task => task()));
  }

  const results: any[] = [];
  const executing: Promise<any>[] = [];
  let count = 0;

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    
    if (threads > 0) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= threads) {
        await Promise.race(executing);
      }
    }

    count++;
    if (burstSize > 0 && count % burstSize === 0) {
      await new Promise(r => setTimeout(r, burstDelay));
    } else if (staggerDelay > 0) {
      await new Promise(r => setTimeout(r, staggerDelay));
    }
  }
  return Promise.all(results);
};
