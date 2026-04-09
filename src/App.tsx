import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Zap, 
  MessageSquare, 
  Layers, 
  Users, 
  UserPlus, 
  Settings, 
  Terminal, 
  LogOut, 
  Server, 
  Trash2, 
  Plus, 
  Ban, 
  UserMinus, 
  Mail,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Edit3,
  RefreshCw
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Section = 'VERIFY' | 'QUICK_NUKE' | 'COPY_SERVER' | 'SNIPER' | 'LEVELING' | 'MACRO' | 'SPEED';

interface SpeedSettings {
  threads: number;
  timeout: number;
  retries: number;
  retryDelay: number;
  mode: 'BATCH' | 'INSTANT';
  burstSize?: number;
  burstDelay?: number;
  staggerDelay?: number;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
}

interface Guild {
  id: string;
  name: string;
  icon: string;
  owner: boolean;
  permissions: string;
}

export default function App() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isBot, setIsBot] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch {
        setServerStatus('offline');
      }
    };
    checkStatus();
  }, []);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<Section>('QUICK_NUKE');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [speedSettings, setSpeedSettings] = useState<SpeedSettings>({
    threads: 100,
    timeout: 1500,
    retries: 20,
    retryDelay: 0,
    mode: 'INSTANT',
    burstSize: 50,
    burstDelay: 100,
    staggerDelay: 0
  });

  const [nukeSpeedSettings, setNukeSpeedSettings] = useState<SpeedSettings>({
    threads: 200,
    timeout: 1000,
    retries: 30,
    retryDelay: 0,
    mode: 'INSTANT',
    burstSize: 100,
    burstDelay: 50,
    staggerDelay: 0
  });

  // Input states
  const [spamMsg, setSpamMsg] = useState('NUKED BY TROJAN');
  const [channelName, setChannelName] = useState('By-Trojan');
  const [channelAmount, setChannelAmount] = useState(20);
  const [roleName, setRoleName] = useState('By Trojan');
  const [roleAmount, setRoleAmount] = useState(20);
  const [dmMsg, setDmMsg] = useState('NUKED BY TROJAN');
  const [newServerName, setNewServerName] = useState('NUKED BY TROJAN');
  const [nukeMessage, setNukeMessage] = useState('@everyone **NUKED BY TROJAN CONTROL v8.0**\n**SERVER OWNED BY 1888**\nhttps://github.com/trojan-control\n' + '☠️'.repeat(10));
  const [nukeChannelCount, setNukeChannelCount] = useState(50);
  const [firstChannelName, setFirstChannelName] = useState('hello-trojan-was-here');
  const [nukeChannelNames, setNukeChannelNames] = useState('By-trojan, By-1888, nuked-by-trojan, ez, rip-server, trojan-was-here, owned-by-1888');
  const [nukeSpamCount, setNukeSpamCount] = useState(10);
  const [nukeSpamType, setNukeSpamType] = useState<'NORMAL' | 'WEBHOOK'>('NORMAL');
  const [nukeToggles, setNukeToggles] = useState({
    deleteChannels: true,
    deleteRoles: true,
    deleteEmojis: true,
    deleteStickers: true,
    banMembers: false,
    kickMembers: false,
    createChannels: true,
    createRoles: true,
    spamChannels: true,
    adminEveryone: true,
    changeIdentity: true
  });
  const [customRenameChannel, setCustomRenameChannel] = useState('nuked-by-trojan');
  const [customRenameRole, setCustomRenameRole] = useState('TROJAN OWNED');
  const [randomRenameList, setRandomRenameList] = useState('owned, hacked, rip, ez, trojan, 1888');
  const [spamCount, setSpamCount] = useState(10);

  // New features states
  const [copySourceId, setCopySourceId] = useState('');
  const [copyTargetId, setCopyTargetId] = useState('');
  const [copyOptions, setCopyOptions] = useState({ roles: true, channels: true, settings: true });
  const [levelingChannelId, setLevelingChannelId] = useState('');
  const [levelingActive, setLevelingActive] = useState(false);
  const [levelingInterval, setLevelingInterval] = useState(4);

  const [sniperUsernames, setSniperUsernames] = useState('');
  const [sniperResults, setSniperResults] = useState<any[]>([]);

  // Macro states
  const [macroChannelId, setMacroChannelId] = useState('');
  const [macroMessage, setMacroMessage] = useState('TRJ BOT ON TOP');
  const [macroCount, setMacroCount] = useState(0);
  const [macroDuration, setMacroDuration] = useState(60);
  const [macroDelay, setMacroDelay] = useState(1); // Default 1s

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedToken = token.trim();
    if (!trimmedToken) return;
    
    // Basic token validation to prevent obviously wrong inputs
    if (trimmedToken.length < 20) {
      setLoginError("Token is too short");
      return;
    }

    setIsLoading(true);
    setLoginError(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65000); // 65s client-side timeout to allow for server-side retries

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmedToken, isBot }),
        signal: controller.signal
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUser(data.user);
      setGuilds(Array.isArray(data.guilds) ? data.guilds : []);
      setIsLoggedIn(true);
      if (data.user?.username) {
        addLog(`Logged in as ${data.user.username}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setLoginError("Request timed out. Discord or Cloudflare might be rate-limiting you. Please wait a minute and try again.");
      } else if (err.message.includes('429')) {
        setLoginError("Rate limited by Discord. Please wait at least 30 seconds before trying again.");
      } else {
        setLoginError(err.message);
      }
      addLog(`Login failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      clearTimeout(timeoutId);
    }
  };

  const refreshGuilds = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, isBot })
      });
      const data = await res.json();
      if (data.guilds) {
        setGuilds(Array.isArray(data.guilds) ? data.guilds : []);
        addLog('Server list refreshed.');
      }
    } catch (err) {
      addLog('Failed to refresh servers.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (type: string, data: any = {}) => {
    if (!selectedGuild) {
      addLog('Error: No server selected');
      return;
    }
    setIsLoading(true);
    addLog(`Executing action: ${type}...`);
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          isBot, 
          guildId: selectedGuild.id, 
          type, 
          data,
          existingChannels: channels,
          existingRoles: roles,
          speedSettings
        }),
      });
      const result = await res.json();
      if (result.success) {
        addLog(`Action ${type} completed successfully. Affected: ${result.count || 'N/A'}`);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      addLog(`Action failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuildSelect = async (guild: Guild) => {
    setSelectedGuild(guild);
    setChannels([]);
    setRoles([]);
    try {
      const [channelsRes, rolesRes] = await Promise.all([
        fetch('/api/guild/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, isBot, guildId: guild.id })
        }),
        fetch('/api/guild/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, isBot, guildId: guild.id })
        })
      ]);
      const channelsData = await channelsRes.json();
      const rolesData = await rolesRes.json();
      if (Array.isArray(channelsData)) setChannels(channelsData);
      if (Array.isArray(rolesData)) setRoles(rolesData);
    } catch (err) {
      console.error("Failed to pre-fetch guild data", err);
    }
  };

  const handleNuke = async () => {
    if (!selectedGuild) return;
    setIsLoading(true);
    addLog('🚀 INITIATING HYPER ROCKET NUKE PROTOCOL...');
    addLog('⚡ Firing parallel requests (Deletion + Creation + Admin)...');
    try {
      const res = await fetch('/api/nuke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          isBot, 
          guildId: selectedGuild.id, 
          options: { 
            newName: newServerName,
            message: nukeMessage,
            channelCount: nukeChannelCount,
            firstChannelName: firstChannelName,
            channelNames: nukeChannelNames.split(',').map(s => s.trim()).filter(s => s),
            spamCount: nukeSpamCount,
            spamType: nukeSpamType,
            existingChannels: channels,
            existingRoles: roles,
            toggles: nukeToggles
          },
          speedSettings: nukeSpeedSettings
        }),
      });
      const result = await res.json();
      if (result.success) {
        addLog('✅ Protocol successfully deployed to background!');
        addLog(`> Target Channels: ${result.channels_target || nukeChannelCount}`);
      }
    } catch (err: any) {
      addLog(`❌ Nuke failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!copySourceId || !copyTargetId) {
      addLog('Error: Source and Target IDs are required');
      return;
    }
    setIsLoading(true);
    addLog('📋 Starting server copy protocol...');
    addLog(`> Source: ${copySourceId}`);
    addLog(`> Target: ${copyTargetId}`);
    
    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          isBot, 
          sourceId: copySourceId, 
          targetId: copyTargetId, 
          options: copyOptions, 
          speedSettings 
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('✅ Server copy completed successfully!');
        if (data.results) {
          addLog(`> Settings: ${data.results.settings ? 'COPIED' : 'SKIPPED/FAILED'}`);
          addLog(`> Roles: ${data.results.roles.success} Success, ${data.results.roles.failed} Failed`);
          addLog(`> Channels: ${data.results.channels.success} Success, ${data.results.channels.failed} Failed`);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addLog(`❌ Copy failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSniper = async () => {
    const usernames = sniperUsernames.split('\n').map(u => u.trim()).filter(u => u);
    if (usernames.length === 0) {
      addLog('Error: No usernames to check');
      return;
    }
    setIsLoading(true);
    addLog(`🎯 Sniping ${usernames.length} usernames...`);
    try {
      const res = await fetch('/api/sniper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, usernames }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSniperResults(data);
        addLog('✅ Sniper check completed!');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      addLog(`❌ Sniper failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateUsernames = (type: '3L' | '4L' | 'RANDOM') => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789._';
    const count = 20;
    let newNames = '';
    
    for (let i = 0; i < count; i++) {
      let name = '';
      const length = type === '3L' ? 3 : type === '4L' ? 4 : Math.floor(Math.random() * 5) + 3;
      for (let j = 0; j < length; j++) {
        name += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      newNames += name + '\n';
    }
    setSniperUsernames(newNames.trim());
    addLog(`✨ Generated ${count} ${type} usernames.`);
  };

  const handleMacro = async () => {
    if (!macroChannelId) return;
    setIsLoading(true);
    addLog('⚡ Starting Macro Spam...');
    try {
      const res = await fetch('/api/macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          isBot, 
          channelId: macroChannelId, 
          message: macroMessage, 
          count: macroCount, 
          duration: macroDuration,
          delay: macroDelay * 1000 // Convert seconds to ms
        }),
      });
      const data = await res.json();
      if (data.success) addLog('✅ Macro initiated!');
      else throw new Error(data.error);
    } catch (err: any) {
      addLog(`❌ Macro failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (levelingActive && levelingChannelId) {
      addLog(`📈 Leveling started in channel ${levelingChannelId} (Interval: ${levelingInterval}s)...`);
      interval = setInterval(async () => {
        try {
          // Use a direct fetch to a new endpoint or pass channelId specifically
          await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              token, 
              isBot, 
              guildId: selectedGuild?.id, 
              type: 'SPAM', 
              data: { 
                message: 'Leveling...', 
                count: 1, 
                isRandom: true,
                targetChannelId: levelingChannelId // Pass specific channel
              },
              speedSettings: { ...speedSettings, threads: 1 }
            }),
          });
        } catch (e) { /* ignore */ }
      }, levelingInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [levelingActive, levelingChannelId, levelingInterval, token, isBot, selectedGuild]);

  const TokenInput = () => (
    <div className="matrix-card border-matrix-green/30 bg-matrix-green/5 mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[10px] uppercase tracking-widest text-matrix-green/70 font-bold">Token Configuration</label>
        <div className="flex gap-2 p-1 bg-matrix-dark border border-matrix-green/20 rounded">
          <button onClick={() => setIsBot(true)} className={cn("px-2 py-0.5 text-[8px] font-bold", isBot ? "bg-matrix-green text-matrix-dark" : "text-matrix-green")}>BOT</button>
          <button onClick={() => setIsBot(false)} className={cn("px-2 py-0.5 text-[8px] font-bold", !isBot ? "bg-matrix-green text-matrix-dark" : "text-matrix-green")}>USER</button>
        </div>
      </div>
      <div className="relative">
        <input
          type={showToken ? "text" : "password"}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter Token Here..."
          className="w-full matrix-input text-xs pr-10"
        />
        <button 
          onClick={() => setShowToken(!showToken)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-matrix-green/50 hover:text-matrix-green"
        >
          {showToken ? <Shield className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-matrix-dark">
        <div className="w-full max-w-md matrix-card">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-matrix-green/10 rounded-full flex items-center justify-center mb-4 border border-matrix-green">
              <Shield className="w-8 h-8 text-matrix-green" />
            </div>
            <h1 className="text-3xl font-bold tracking-tighter text-matrix-green">TRJ BOT v2.0</h1>
            <div className="flex items-center gap-2 text-[10px] text-matrix-green/50 uppercase tracking-widest mt-2">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                serverStatus === 'online' ? "bg-matrix-green animate-pulse" : "bg-red-500"
              )} />
              {serverStatus === 'online' ? 'System Online' : 'System Offline'}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="flex gap-2 p-1 bg-matrix-dark border border-matrix-green/30 rounded">
              <button
                type="button"
                onClick={() => setIsBot(true)}
                className={cn(
                  "flex-1 py-2 text-xs font-bold transition-all",
                  isBot ? "bg-matrix-green text-matrix-dark" : "text-matrix-green hover:bg-matrix-green/10"
                )}
              >
                BOT TOKEN
              </button>
              <button
                type="button"
                onClick={() => setIsBot(false)}
                className={cn(
                  "flex-1 py-2 text-xs font-bold transition-all",
                  !isBot ? "bg-matrix-green text-matrix-dark" : "text-matrix-green hover:bg-matrix-green/10"
                )}
              >
                USER TOKEN
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Access Token</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setToken('')}
                    className="text-[10px] text-matrix-green/50 hover:text-red-500 uppercase tracking-tighter"
                  >
                    Clear
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[10px] text-matrix-green/50 hover:text-matrix-green uppercase tracking-tighter"
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (loginError) setLoginError(null);
                }}
                placeholder="MTA..."
                className={cn(
                  "w-full matrix-input",
                  loginError && "border-red-500 text-red-500"
                )}
              />
              {loginError && (
                <div className="flex items-center gap-2 text-[10px] text-red-500 mt-1 uppercase font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  {loginError}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full matrix-button py-3 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              AUTHENTICATE
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-matrix-green/10 text-[10px] text-matrix-green/30 text-center uppercase tracking-widest">
            v8.0.0-PRO | .NET 8.0 CORE ENGINE
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-matrix-dark">
      {/* Header */}
      <header className="h-16 border-b border-matrix-green/20 flex items-center justify-between px-6 bg-matrix-gray/30 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Shield className="w-6 h-6 text-matrix-green" />
          <div>
            <h2 className="text-sm font-bold tracking-tighter">TRJ BOT v2.0</h2>
            <div className="flex items-center gap-2 text-[10px] text-matrix-green/50">
              <span className="w-1.5 h-1.5 rounded-full bg-matrix-green animate-pulse" />
              SYSTEM ONLINE: {user?.username}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-matrix-green/50 uppercase">Active Server</div>
              <div className="text-xs font-bold">{selectedGuild?.name || 'NONE SELECTED'}</div>
            </div>
            <div className="w-8 h-8 rounded border border-matrix-green/30 bg-matrix-gray flex items-center justify-center overflow-hidden">
              {selectedGuild?.icon ? (
                <img src={`https://cdn.discordapp.com/icons/${selectedGuild?.id}/${selectedGuild?.icon}.png`} alt="" referrerPolicy="no-referrer" />
              ) : (
                <Server className="w-4 h-4 text-matrix-green/30" />
              )}
            </div>
          </div>
          <button 
            onClick={() => setIsLoggedIn(false)}
            className="p-2 hover:bg-matrix-green/10 text-matrix-green transition-colors rounded"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-matrix-green/10 flex flex-col bg-matrix-gray/20">
          <div className="p-4">
            <div className="text-[10px] text-matrix-green/30 uppercase tracking-widest mb-4">Navigation</div>
            <nav className="space-y-1">
              {[
                { id: 'VERIFY', icon: Shield, label: 'Verify Token' },
                { id: 'QUICK_NUKE', icon: Zap, label: 'Quick Nuker' },
                { id: 'COPY_SERVER', icon: Layers, label: 'Copy Server' },
                { id: 'SNIPER', icon: UserPlus, label: 'User Sniper' },
                { id: 'LEVELING', icon: RefreshCw, label: 'Leveling' },
                { id: 'MACRO', icon: Terminal, label: 'Macro' },
                { id: 'SPEED', icon: Settings, label: 'Speed Settings' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as Section)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all uppercase tracking-wider",
                    activeSection === item.id 
                      ? "bg-matrix-green text-matrix-dark" 
                      : "text-matrix-green/70 hover:bg-matrix-green/10 hover:text-matrix-green"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-4 border-t border-matrix-green/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-matrix-green/30 uppercase tracking-widest">Server List</div>
              <button 
                onClick={refreshGuilds}
                disabled={isLoading}
                className="p-1 hover:bg-matrix-green/10 text-matrix-green/50 hover:text-matrix-green transition-colors rounded"
                title="Refresh Servers"
              >
                <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-2">
              {guilds.length === 0 ? (
                <div className="text-[10px] text-matrix-green/20 italic text-center py-4">
                  No servers found or failed to load.
                </div>
              ) : guilds.map((guild) => (
                <button
                  key={guild.id}
                  onClick={() => handleGuildSelect(guild)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-[10px] transition-all text-left",
                    selectedGuild?.id === guild.id 
                      ? "bg-matrix-green/20 text-matrix-green border-l-2 border-matrix-green" 
                      : "text-matrix-green/50 hover:bg-matrix-green/5 hover:text-matrix-green"
                  )}
                >
                  <div className="w-4 h-4 rounded-sm bg-matrix-gray flex-shrink-0 flex items-center justify-center overflow-hidden border border-matrix-green/20">
                    {guild.icon ? (
                      <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <Server className="w-2 h-2" />
                    )}
                  </div>
                  <span className="truncate">{guild.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {!selectedGuild && (
            <div className="absolute inset-0 bg-matrix-dark/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-matrix-green mx-auto mb-4 animate-bounce" />
                <h3 className="text-xl font-bold uppercase tracking-widest">Select a Target Server</h3>
                <p className="text-matrix-green/50 text-xs mt-2">Choose a server from the sidebar to begin operations</p>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-matrix-green/20 pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tighter uppercase">{activeSection.replace('_', ' ')}</h1>
                <p className="text-matrix-green/50 text-[10px] uppercase tracking-widest">TRJ Engine v2.0</p>
              </div>
              <div className="px-3 py-1 bg-matrix-green/10 border border-matrix-green/30 text-[10px] font-bold">
                STATUS: READY
              </div>
            </div>

            {/* Section Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeSection === 'VERIFY' && (
                <div className="col-span-full space-y-6">
                  <TokenInput />
                  <div className="matrix-card flex flex-col items-center justify-center py-12">
                    <Shield className="w-16 h-16 text-matrix-green mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold uppercase tracking-widest mb-2">Token Verification</h3>
                    <p className="text-matrix-green/50 text-xs mb-8">Check if your token is valid and get account details.</p>
                    <button 
                      onClick={handleLogin}
                      disabled={isLoading}
                      className="matrix-button px-12 py-3"
                    >
                      {isLoading ? 'VERIFYING...' : 'START VERIFICATION'}
                    </button>
                    {user && (
                      <div className="mt-8 p-4 border border-matrix-green/30 bg-matrix-green/5 rounded w-full max-w-md">
                        <div className="flex items-center gap-4">
                          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-12 h-12 rounded-full border border-matrix-green" alt="" referrerPolicy="no-referrer" />
                          <div>
                            <div className="text-sm font-bold text-matrix-green">{user.username}#{user.discriminator}</div>
                            <div className="text-[10px] text-matrix-green/50 uppercase">ID: {user.id}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'SPEED' && (
                <div className="col-span-full matrix-card border-matrix-green/50 bg-matrix-green/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-matrix-green/20 rounded-full border border-matrix-green">
                      <Settings className="w-8 h-8 text-matrix-green" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">HYPER-SPEED CONFIGURATION</h3>
                      <p className="text-[10px] text-matrix-green/70 uppercase tracking-widest">Advanced Performance Control</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <label className="text-[10px] uppercase tracking-widest text-matrix-green/70 font-bold">Execution Mode</label>
                          <span className="text-xs font-mono text-matrix-green bg-matrix-green/10 px-2 py-0.5 rounded border border-matrix-green/30">{speedSettings.mode}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setSpeedSettings(prev => ({ ...prev, mode: 'BATCH' }))}
                            className={cn(
                              "py-2 text-[10px] uppercase tracking-widest border transition-all",
                              speedSettings.mode === 'BATCH' 
                                ? "bg-matrix-green text-matrix-dark border-matrix-green font-bold shadow-[0_0_10px_rgba(0,255,65,0.5)]" 
                                : "bg-transparent text-matrix-green border-matrix-green/30 hover:border-matrix-green"
                            )}
                          >
                            Batch Mode
                          </button>
                          <button 
                            onClick={() => setSpeedSettings(prev => ({ ...prev, mode: 'INSTANT' }))}
                            className={cn(
                              "py-2 text-[10px] uppercase tracking-widest border transition-all",
                              speedSettings.mode === 'INSTANT' 
                                ? "bg-matrix-green text-matrix-dark border-matrix-green font-bold shadow-[0_0_10px_rgba(0,255,65,0.5)]" 
                                : "bg-transparent text-matrix-green border-matrix-green/30 hover:border-matrix-green"
                            )}
                          >
                            Instant Mode
                          </button>
                        </div>
                        <p className="text-[9px] text-matrix-green/50 italic">
                          {speedSettings.mode === 'BATCH' 
                            ? "Processes actions in controlled chunks for stability." 
                            : "Fires all requests simultaneously for maximum aggression."}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <label className="text-[10px] uppercase tracking-widest text-matrix-green/70 font-bold">Threads (Parallel Workers)</label>
                          <span className="text-xs font-mono text-matrix-green bg-matrix-green/10 px-2 py-0.5 rounded border border-matrix-green/30">{speedSettings.threads}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="1000" 
                          step="1"
                          value={speedSettings.threads}
                          onChange={(e) => setSpeedSettings(prev => ({ ...prev, threads: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-matrix-dark border border-matrix-green/30 rounded-lg appearance-none cursor-pointer accent-matrix-green"
                        />
                        <p className="text-[9px] text-matrix-green/50 italic">How many parallel execution threads to spawn. Higher = Faster but more likely to hit global rate limits.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <label className="text-[10px] uppercase tracking-widest text-matrix-green/70 font-bold">Request Timeout (ms)</label>
                          <span className="text-xs font-mono text-matrix-green bg-matrix-green/10 px-2 py-0.5 rounded border border-matrix-green/30">{speedSettings.timeout}ms</span>
                        </div>
                        <input 
                          type="range" 
                          min="100" 
                          max="10000" 
                          step="100"
                          value={speedSettings.timeout}
                          onChange={(e) => setSpeedSettings(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-matrix-dark border border-matrix-green/30 rounded-lg appearance-none cursor-pointer accent-matrix-green"
                        />
                        <p className="text-[9px] text-matrix-green/50 italic">Wait time before a request is considered failed. Lower = Faster recovery from dead connections.</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <label className="text-[10px] uppercase tracking-widest text-matrix-green/70 font-bold">Max Retries (429 Handling)</label>
                          <span className="text-xs font-mono text-matrix-green bg-matrix-green/10 px-2 py-0.5 rounded border border-matrix-green/30">{speedSettings.retries}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="50" 
                          step="1"
                          value={speedSettings.retries}
                          onChange={(e) => setSpeedSettings(prev => ({ ...prev, retries: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-matrix-dark border border-matrix-green/30 rounded-lg appearance-none cursor-pointer accent-matrix-green"
                        />
                        <p className="text-[9px] text-matrix-green/50 italic">Number of times to retry a request if rate-limited by Discord.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <label className="text-[10px] uppercase tracking-widest text-matrix-green/70 font-bold">Retry Buffer Delay (ms)</label>
                          <span className="text-xs font-mono text-matrix-green bg-matrix-green/10 px-2 py-0.5 rounded border border-matrix-green/30">{speedSettings.retryDelay}ms</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="2000" 
                          step="10"
                          value={speedSettings.retryDelay}
                          onChange={(e) => setSpeedSettings(prev => ({ ...prev, retryDelay: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-matrix-dark border border-matrix-green/30 rounded-lg appearance-none cursor-pointer accent-matrix-green"
                        />
                        <p className="text-[9px] text-matrix-green/50 italic">Extra wait time added to Discord's retry_after. 0ms is absolute maximum speed.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 border border-matrix-green/20 bg-matrix-green/5 rounded flex items-center gap-4">
                    <AlertTriangle className="w-6 h-6 text-matrix-green shrink-0" />
                    <p className="text-[10px] text-matrix-green/80 leading-relaxed uppercase tracking-tighter">
                      Warning: High concurrency and low timeouts can lead to account flags or temporary IP bans from Discord. Use these settings carefully.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'QUICK_NUKE' && (
                <div className="col-span-full space-y-6">
                  <TokenInput />
                  <div className="matrix-card border-red-500/50 bg-red-500/5">
                    <div className="flex flex-col gap-6">
                      <div className="flex items-start gap-6">
                        <div className="p-4 bg-red-500/20 rounded-full border border-red-500">
                          <Zap className="w-12 h-12 text-red-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold mb-2 text-red-500 uppercase tracking-widest">Nuker Control Suite</h3>
                          <p className="text-xs text-red-500/70 mb-4 leading-relaxed">
                            Complete server destruction and takeover protocol. Configure your payload below.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Column 1: Payload Config */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-red-500/20 pb-2">
                            <MessageSquare className="w-3 h-3 text-red-500" />
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-red-500">Payload Config</h3>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-red-500/70">Spam Message</label>
                            <textarea 
                              value={nukeMessage}
                              onChange={(e) => setNukeMessage(e.target.value)}
                              className="w-full matrix-input h-24 text-xs resize-none border-red-500/30 focus:border-red-500"
                              placeholder="Enter nuke message..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-red-500/70">New Server Name</label>
                            <input 
                              type="text" 
                              value={newServerName}
                              onChange={(e) => setNewServerName(e.target.value)}
                              className="w-full matrix-input text-xs border-red-500/30 focus:border-red-500"
                              placeholder="NUKED BY TROJAN"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-red-500/70">Channel Names (Comma)</label>
                            <input 
                              type="text" 
                              value={nukeChannelNames}
                              onChange={(e) => setNukeChannelNames(e.target.value)}
                              className="w-full matrix-input text-xs border-red-500/30 focus:border-red-500"
                            />
                          </div>
                        </div>

                        {/* Column 2: Destruction Toggles */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-red-500/20 pb-2">
                            <Trash2 className="w-3 h-3 text-red-500" />
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-red-500">Destruction Toggles</h3>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(nukeToggles).map(([key, value]) => (
                              <button
                                key={key}
                                onClick={() => setNukeToggles(prev => ({ ...prev, [key]: !value }))}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 text-[9px] uppercase tracking-widest border transition-all",
                                  value 
                                    ? "bg-red-500/20 border-red-500 text-red-500 font-bold" 
                                    : "bg-transparent border-red-500/10 text-red-500/40 hover:border-red-500/30"
                                )}
                              >
                                {key.replace(/([A-Z])/g, ' $1')}
                                {value ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-red-500/20 rounded-full" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Column 3: Speed & Execution */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-red-500/20 pb-2">
                            <Settings className="w-3 h-3 text-red-500" />
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-red-500">Execution Speed</h3>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-end">
                              <label className="text-[9px] uppercase tracking-widest text-red-500/70">Threads</label>
                              <span className="text-[10px] font-mono text-red-500">{nukeSpeedSettings.threads}</span>
                            </div>
                            <input 
                              type="range" min="1" max="1000" step="1"
                              value={nukeSpeedSettings.threads}
                              onChange={(e) => setNukeSpeedSettings(prev => ({ ...prev, threads: parseInt(e.target.value) }))}
                              className="w-full h-1 bg-matrix-dark border border-red-500/20 rounded-lg appearance-none cursor-pointer accent-red-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => setNukeSpeedSettings(prev => ({ ...prev, mode: 'BATCH' }))}
                              className={cn(
                                "py-1.5 text-[8px] uppercase tracking-widest border transition-all",
                                nukeSpeedSettings.mode === 'BATCH' ? "bg-red-500 text-white border-red-500 font-bold" : "bg-transparent text-red-500 border-red-500/20"
                              )}
                            >
                              Batch
                            </button>
                            <button 
                              onClick={() => setNukeSpeedSettings(prev => ({ ...prev, mode: 'INSTANT' }))}
                              className={cn(
                                "py-1.5 text-[8px] uppercase tracking-widest border transition-all",
                                nukeSpeedSettings.mode === 'INSTANT' ? "bg-red-500 text-white border-red-500 font-bold shadow-[0_0_8px_rgba(239,68,68,0.3)]" : "bg-transparent text-red-500 border-red-500/20"
                              )}
                            >
                              Instant
                            </button>
                          </div>

                          <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-end">
                              <label className="text-[9px] uppercase tracking-widest text-red-500/70">Channels to Create</label>
                              <span className="text-[10px] font-mono text-red-500">{nukeChannelCount}</span>
                            </div>
                            <input 
                              type="range" min="1" max="500" step="1"
                              value={nukeChannelCount}
                              onChange={(e) => setNukeChannelCount(parseInt(e.target.value))}
                              className="w-full h-1 bg-matrix-dark border border-red-500/20 rounded-lg appearance-none cursor-pointer accent-red-500"
                            />
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-end">
                              <label className="text-[9px] uppercase tracking-widest text-red-500/70">Spam per Channel</label>
                              <span className="text-[10px] font-mono text-red-500">{nukeSpamCount}</span>
                            </div>
                            <input 
                              type="range" min="1" max="100" step="1"
                              value={nukeSpamCount}
                              onChange={(e) => setNukeSpamCount(parseInt(e.target.value))}
                              className="w-full h-1 bg-matrix-dark border border-red-500/20 rounded-lg appearance-none cursor-pointer accent-red-500"
                            />
                          </div>

                          <div className="pt-4">
                            <button 
                              onClick={handleNuke}
                              disabled={isLoading}
                              className="matrix-button w-full py-4 text-sm bg-red-500 text-white hover:bg-red-600 font-black tracking-[0.5em] shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all active:scale-95"
                            >
                              {isLoading ? 'EXECUTING...' : 'INITIATE DESTRUCTION'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'COPY_SERVER' && (
                <div className="col-span-full space-y-6">
                  <TokenInput />
                  <div className="matrix-card space-y-6">
                  <div className="flex items-center gap-4 border-b border-matrix-green/20 pb-4">
                    <Layers className="w-6 h-6 text-matrix-green" />
                    <h3 className="text-lg font-bold uppercase tracking-widest">Server Copy Module</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Source Server ID</label>
                        <input 
                          type="text" 
                          value={copySourceId}
                          onChange={(e) => setCopySourceId(e.target.value)}
                          className="w-full matrix-input text-xs"
                          placeholder="ID of server to copy FROM"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Target Server ID</label>
                        <input 
                          type="text" 
                          value={copyTargetId}
                          onChange={(e) => setCopyTargetId(e.target.value)}
                          className="w-full matrix-input text-xs"
                          placeholder="ID of server to copy TO"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Options</label>
                      <div className="space-y-2">
                        {['roles', 'channels', 'settings'].map(opt => (
                          <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={(copyOptions as any)[opt]} 
                              onChange={(e) => setCopyOptions(prev => ({ ...prev, [opt]: e.target.checked }))}
                              className="hidden"
                            />
                            <div className={cn(
                              "w-4 h-4 border flex items-center justify-center transition-all",
                              (copyOptions as any)[opt] ? "bg-matrix-green border-matrix-green" : "border-matrix-green/30"
                            )}>
                              {(copyOptions as any)[opt] && <CheckCircle2 className="w-3 h-3 text-matrix-dark" />}
                            </div>
                            <span className="text-xs uppercase tracking-widest group-hover:text-matrix-green transition-colors">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleCopy}
                    disabled={isLoading}
                    className="matrix-button w-full py-3"
                  >
                    {isLoading ? 'COPYING...' : 'START CLONING'}
                  </button>
                </div>
              </div>
              )}

              {activeSection === 'LEVELING' && (
                <div className="col-span-full space-y-6">
                  <TokenInput />
                  <div className="matrix-card space-y-6">
                  <div className="flex items-center gap-4 border-b border-matrix-green/20 pb-4">
                    <RefreshCw className="w-6 h-6 text-matrix-green" />
                    <h3 className="text-lg font-bold uppercase tracking-widest">Auto Leveling Module</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Target Channel ID</label>
                        <input 
                          type="text" 
                          value={levelingChannelId}
                          onChange={(e) => setLevelingChannelId(e.target.value)}
                          className="w-full matrix-input text-xs"
                          placeholder="ID of channel to level in"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Interval (Seconds)</label>
                        <input 
                          type="number" 
                          value={levelingInterval}
                          onChange={(e) => setLevelingInterval(parseInt(e.target.value) || 1)}
                          className="w-full matrix-input text-xs"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <button 
                      onClick={() => setLevelingActive(!levelingActive)}
                      className={cn(
                        "matrix-button w-full py-4 text-sm font-black tracking-[0.3em]",
                        levelingActive ? "bg-red-500 border-red-500 text-white" : ""
                      )}
                    >
                      {levelingActive ? 'STOP LEVELING' : 'START AUTO LEVELING'}
                    </button>
                    <p className="text-[10px] text-matrix-green/50 text-center uppercase tracking-widest">
                      Sends a random message every {levelingInterval} seconds to bypass common anti-spam filters.
                    </p>
                  </div>
                </div>
              </div>
              )}

              {activeSection === 'SNIPER' && (
                <div className="col-span-full space-y-6">
                  <TokenInput />
                  <div className="matrix-card border-matrix-green/50 bg-matrix-green/5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Usernames to Check</label>
                          <div className="flex gap-2">
                            <button onClick={() => generateUsernames('3L')} className="text-[8px] bg-matrix-green/10 hover:bg-matrix-green/20 px-2 py-1 border border-matrix-green/30 rounded">3L</button>
                            <button onClick={() => generateUsernames('4L')} className="text-[8px] bg-matrix-green/10 hover:bg-matrix-green/20 px-2 py-1 border border-matrix-green/30 rounded">4L</button>
                            <button onClick={() => generateUsernames('RANDOM')} className="text-[8px] bg-matrix-green/10 hover:bg-matrix-green/20 px-2 py-1 border border-matrix-green/30 rounded">RAND</button>
                          </div>
                        </div>
                        <textarea 
                          value={sniperUsernames}
                          onChange={(e) => setSniperUsernames(e.target.value)}
                          className="w-full matrix-input h-64 text-xs font-mono"
                          placeholder="Enter usernames (one per line)..."
                        />
                        <button 
                          onClick={handleSniper}
                          disabled={isLoading}
                          className="matrix-button w-full py-3"
                        >
                          {isLoading ? 'CHECKING...' : 'START SNIPER'}
                        </button>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Results</label>
                        <div className="matrix-input h-[320px] overflow-y-auto p-4 space-y-2 font-mono text-[11px] bg-matrix-dark/50">
                          {sniperResults.length === 0 && <div className="text-matrix-green/20 italic text-center py-20">No results yet. Start the sniper to see availability.</div>}
                          {sniperResults.map((res, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-matrix-green/10 pb-2">
                              <span className="text-matrix-green/80">{res.username}</span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                                res.status === 'available' ? "bg-matrix-green text-matrix-dark shadow-[0_0_8px_rgba(0,255,65,0.3)]" : 
                                res.status === 'taken' ? "text-red-500 border border-red-500/30" : "text-yellow-500 border border-yellow-500/30"
                              )}>{res.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'MACRO' && (
                <div className="col-span-full space-y-6">
                  <TokenInput />
                  <div className="matrix-card space-y-6">
                    <div className="flex items-center gap-4 border-b border-matrix-green/20 pb-4">
                      <Terminal className="w-6 h-6 text-matrix-green" />
                      <h3 className="text-lg font-bold uppercase tracking-widest">Macro Spam Module</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Target Channel ID</label>
                          <input 
                            type="text" 
                            value={macroChannelId}
                            onChange={(e) => setMacroChannelId(e.target.value)}
                            className="w-full matrix-input text-xs"
                            placeholder="Channel ID to spam"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Duration (Sec)</label>
                            <input 
                              type="number" 
                              value={macroDuration}
                              onChange={(e) => setMacroDuration(parseInt(e.target.value) || 0)}
                              className="w-full matrix-input text-xs"
                              placeholder="0 = Infinite"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Delay (Seconds)</label>
                            <input 
                              type="number" 
                              step="0.5"
                              value={macroDelay}
                              onChange={(e) => setMacroDelay(parseFloat(e.target.value) || 0)}
                              className="w-full matrix-input text-xs"
                              placeholder="0.5 = Half sec"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest text-matrix-green/70">Spam Message</label>
                        <textarea 
                          value={macroMessage}
                          onChange={(e) => setMacroMessage(e.target.value)}
                          className="w-full matrix-input h-32 text-xs resize-none"
                          placeholder="Message to spam..."
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleMacro}
                      disabled={isLoading}
                      className="matrix-button w-full py-3"
                    >
                      {isLoading ? 'SPAMMING...' : 'START MACRO SPAM'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Logs Sidebar */}
        <aside className="w-80 border-l border-matrix-green/10 flex flex-col bg-matrix-gray/30">
          <div className="p-4 border-b border-matrix-green/10 flex items-center justify-between">
            <div className="text-[10px] text-matrix-green/30 uppercase tracking-widest">Console Logs</div>
            <Terminal className="w-3 h-3 text-matrix-green/30" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1">
            {logs.length === 0 && <div className="text-matrix-green/20 italic">Waiting for input...</div>}
            {logs.map((log, i) => (
              <div key={i} className={cn(
                "break-words",
                log.includes('failed') || log.includes('Error') ? "text-red-500" : 
                log.includes('SUCCESS') || log.includes('COMPLETED') ? "text-matrix-green font-bold" : "text-matrix-green/70"
              )}>
                {log}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-matrix-green/10 bg-matrix-dark/50">
            <div className="flex items-center justify-between text-[8px] uppercase tracking-tighter text-matrix-green/30">
              <span>CPU: 12%</span>
              <span>MEM: 256MB</span>
              <span>PING: 24MS</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
