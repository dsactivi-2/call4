
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from '@google/genai';
import { ConnectionStatus, Agent, Campaign, Candidate, TranscriptionEntry, ToolExecution, AgentCategory, AgentVoice } from './types';
import { 
  decode, 
  decodeAudioData, 
  createBlobFromAudioData 
} from './utils/audio-utils';
import { 
  Phone, PhoneOff, Database, Globe, 
  Settings, Volume2, Terminal, UserPlus, Trash2, ShieldAlert, 
  Plus, Briefcase, UserCheck, ListChecks, Clock, Save, Cpu, 
  ChevronRight, LayoutDashboard, Megaphone, Copy, Server, Key,
  Activity, MessageSquare, Zap, CheckCircle2, Loader2, Upload, FileCode, X, BookOpen,
  Building2, ShoppingCart, Users, Layers, Fingerprint
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'database' | 'call' | 'settings' | 'agents' | 'campaigns' | 'knowledge'>('database');
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // PERSISTENT ID GENERATION LOGIC
  const [nextIdSequence, setNextIdSequence] = useState(() => {
    // Start sequence for new agents (e.g., if JSON IDs are strings, this is for future numeric IDs)
    const saved = localStorage.getItem('jobstep_id_sequence');
    return saved ? parseInt(saved, 10) : 1001; 
  });

  const generateUniqueId = useCallback(() => {
    const seq = nextIdSequence;
    const newSeq = seq + 1;
    setNextIdSequence(newSeq);
    localStorage.setItem('jobstep_id_sequence', newSeq.toString());
    return `ge-${seq}`;
  }, [nextIdSequence]);

  // Helper to generate a consistent color based on string hash for avatars
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-purple-600', 'bg-blue-600', 'bg-teal-600', 'bg-amber-600', 'bg-pink-600',
      'bg-indigo-600', 'bg-green-600', 'bg-orange-600', 'bg-cyan-600', 'bg-red-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // DATA STATE - AGENTS
  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem('jobstep_agents_v2');
    if (saved) return JSON.parse(saved);
    
    // Initial agents from user provided JSON
    const initialAgents = [
      {
        id: "agent_sales_warm",
        name: "Mila",
        category: "Sales",
        systemPrompt: "You are Mila, an Inbound Sales Agent for Jobstep. Your primary goal is to qualify inbound leads and book a meeting or transfer to sales. Your tone is warm, confident, and concise. You can speak German and English.",
        voiceName: "Zephyr",
        avatarColor: getAvatarColor("Mila"),
        skills: ["Lead Qualification", "Meeting Booking", "German", "English"],
        rawConfig: JSON.stringify({ "language": ["de-DE", "en-US"], "voice_pace": "medium" }, null, 2)
      },
      {
        id: "agent_support_tech",
        name: "Noah",
        category: "Support",
        systemPrompt: "You are Noah, a Technical Support Agent for Jobstep. Your primary goal is to solve common technical issues and escalate when needed. Your tone is calm and structured. You can speak English and German.",
        voiceName: "Charon",
        avatarColor: getAvatarColor("Noah"),
        skills: ["Technical Troubleshooting", "Issue Escalation", "English", "German"],
        rawConfig: JSON.stringify({ "language": ["en-US", "de-DE"], "voice_pace": "slow_to_medium" }, null, 2)
      },
      {
        id: "agent_collections",
        name: "Sara",
        category: "Finance",
        systemPrompt: "You are Sara, a Billing & Collections Agent for Jobstep. Your primary goal is to resolve billing issues and arrange payments compliantly. Your tone is polite and firm. You can speak German and Bosnian.",
        voiceName: "Kore",
        avatarColor: getAvatarColor("Sara"),
        skills: ["Billing Resolution", "Payment Arrangements", "German", "Bosnian"],
        rawConfig: JSON.stringify({ "language": ["de-DE", "bs-BA"], "voice_pace": "medium" }, null, 2)
      },
      {
        id: "agent_recruiter_bihac",
        name: "Goran",
        category: "Recruitment",
        systemPrompt: "Ti si Goran, profesionalni regruter agencije 'Jobstep' (Bihać). Tvoj ton je profesionalan, direktan i ljubazan, sa lokalnim 'Bihać vibe'-om. Pomažeš kandidatima da pronađu posao u Njemačkoj, posebno za radnike u trgovini (trades).",
        voiceName: "Zephyr",
        avatarColor: 'bg-[#5fa19f]', // Keep original Goran color
        skills: ["Trade Recruitment", "German Job Explanation", "Bosnian", "German"],
        rawConfig: JSON.stringify({ "language": ["bs-BA", "de-DE"], "voice_pace": "slow_to_medium" }, null, 2)
      },
      {
        id: "agent_retention",
        name: "Leo",
        category: "Retention",
        systemPrompt: "You are Leo, a Customer Retention Agent for Jobstep. Your primary goal is to prevent churn with empathy and targeted offers. Your tone is empathetic and pragmatic. You can speak English and German.",
        voiceName: "Fenrir",
        avatarColor: getAvatarColor("Leo"),
        skills: ["Churn Prevention", "Customer Empathy", "English", "German"],
        rawConfig: JSON.stringify({ "language": ["en-US", "de-DE"], "voice_pace": "medium" }, null, 2)
      }
    ];
    return initialAgents;
  });

  useEffect(() => {
    localStorage.setItem('jobstep_agents_v2', JSON.stringify(agents));
  }, [agents]);

  const [campaigns, setCampaigns] = useState<Campaign[]>([
    { id: 'c1', name: 'VAG Grupa 2025', assignedNumber: '+387 37 222 333', agentId: 'agent_recruiter_bihac', status: 'Aktivna' }
  ]);

  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: '1', name: 'Alen Hodžić', experience: '5 god, VAG, Sarajevo', phone: '+38762333444', status: 'Novo', campaignId: 'c1' },
    { id: '2', name: 'Mustafa Karić', experience: '15 god, Mercedes, Bihać', phone: '+38761111222', status: 'Novo', campaignId: 'c1' }
  ]);

  const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  // GLOBAL KNOWLEDGE STATE
  const [globalKnowledge, setGlobalKnowledge] = useState<string>(() => {
    const saved = localStorage.getItem('jobstep_global_knowledge');
    return saved || "Jobstep je profesionalna agencija za regrutaciju sa sjedištem u Bihaću i Sarajevu, specijalizovana za spajanje kvalifikovanih kandidata iz Bosne i Hercegovine sa poslodavcima u Njemačkoj, posebno u sektorima trgovine i zanatstva. Naša misija je da olakšamo proces zapošljavanja i osiguramo uspješnu integraciju naših kandidata na njemačko tržište rada. Nudimo podršku u pripremi dokumenata, savjetovanju i posredovanju.";
  });

  useEffect(() => {
    localStorage.setItem('jobstep_global_knowledge', globalKnowledge);
  }, [globalKnowledge]);

  // SESSION REFS
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const handleFileUpload = (agentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setAgents(prev => prev.map(a => {
          if (a.id === agentId) {
            return {
              ...a,
              name: parsed.name || a.name,
              category: parsed.category || a.category,
              voiceName: parsed.voiceName || a.voiceName,
              systemPrompt: parsed.systemPrompt || a.systemPrompt,
              skills: Array.from(new Set([...a.skills, ...(parsed.skills || [])])),
              rawConfig: parsed.rawConfig ? JSON.stringify(parsed.rawConfig, null, 2) : a.rawConfig
            };
          }
          return a;
        }));
      } catch (err) {
        console.error("Greška pri učitavanju konfiguracije", err);
      }
    };
    reader.readAsText(file);
  };

  const createAgent = () => {
    const name = prompt("Ime novog agenta:");
    if (!name) return;
    const newId = generateUniqueId();
    setAgents(prev => [...prev, { 
      id: newId, 
      name, 
      category: 'General', // Default category
      systemPrompt: `Ti si ${name}, profesionalni agent agencije 'Jobstep'.`, 
      voiceName: 'Fenrir', // Default voice
      avatarColor: getAvatarColor(name), 
      skills: [], 
      rawConfig: '{}' 
    }]);
  };

  const deleteAgent = (id: string) => {
    if (window.confirm("Da li ste sigurni da želite obrisati agenta? ID se neće ponovo koristiti.")) {
      setAgents(prev => prev.filter(a => a.id !== id));
    }
  };

  const startCall = async (candidate: Candidate) => {
    const campaign = campaigns.find(c => c.id === candidate.campaignId);
    const agent = agents.find(a => a.id === campaign?.agentId) || agents[0];
    
    setSelectedCandidate(candidate);
    setActiveTab('call');
    setStatus(ConnectionStatus.CONNECTING);
    setTranscription([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = inCtx;

      // Constructing the system instruction with global knowledge
      const fullSystemInstruction = `
        Persona: ${agent.systemPrompt}.
        ${globalKnowledge ? `Globalno znanje Jobstep agencije: ${globalKnowledge}.` : ''}
        Ti predstavljaš agenciju 'Jobstep' (Bihać/Sarajevo).
        Razgovaraš sa kandidatom: ${candidate.name}.
      `.trim();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: fullSystemInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: agent.voiceName } } },
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ 
                media: { data: createBlobFromAudioData(inputData), mimeType: 'audio/pcm;rate=16000' } 
              }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            const audio = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buf = await decodeAudioData(decode(audio), outCtx, 24000, 1);
              const src = outCtx.createBufferSource();
              src.buffer = buf; 
              src.connect(outCtx.destination);
              src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
            }
          },
          onclose: () => stopSession(),
          onerror: () => setStatus(ConnectionStatus.ERROR)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error(e);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const stopSession = useCallback(() => {
    if (sessionRef.current) sessionRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    nextStartTimeRef.current = 0;
    setStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  const agentCategories: AgentCategory[] = ['Recruitment', 'Sales', 'Housing', 'Support', 'Finance', 'Retention', 'General'];
  const agentVoices: AgentVoice[] = ['Fenrir', 'Kore', 'Puck', 'Charon', 'Zephyr'];

  return (
    <div className="h-screen flex bg-[#fcfcfc] text-[#2c3e50] font-['Plus_Jakarta_Sans'] overflow-hidden">
      {/* SIDEBAR */}
      <nav className="w-64 border-r border-gray-100 flex flex-col py-10 px-6 shrink-0 bg-white shadow-sm">
        <div className="mb-14 px-2">
           <h1 className="text-2xl font-black italic tracking-tighter uppercase">JOB<span className="text-[#5fa19f] not-italic">STEP</span></h1>
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Agency Portal</p>
        </div>
        
        <div className="space-y-2 flex-1">
          {[
            { id: 'database', label: 'Baza Podataka', icon: Database },
            { id: 'agents', label: 'Agent Foundry', icon: Cpu },
            { id: 'campaigns', label: 'Kampanje', icon: Megaphone },
            { id: 'knowledge', label: 'Baza Znanja', icon: BookOpen }, // NEW TAB
            { id: 'call', label: 'Live Terminal', icon: Terminal },
            { id: 'settings', label: 'Postavke', icon: Settings } // NEW TAB
          ].map((item) => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-sm transition-all ${activeTab === item.id ? 'bg-[#5fa19f] text-white shadow-lg shadow-[#5fa19f]/20' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]/50">
        <header className="h-20 px-10 flex items-center justify-between border-b border-gray-100 bg-white/50 backdrop-blur-xl">
           <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">{activeTab}</h2>
           <div className={`flex items-center gap-2 px-5 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${status === ConnectionStatus.CONNECTED ? 'bg-[#5fa19f] text-white border-[#5fa19f] animate-pulse-soft' : 'bg-gray-100 text-gray-400'}`}>
             <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-white' : 'bg-gray-300'}`} />
             {status}
           </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
          {activeTab === 'agents' && (
            <div className="max-w-6xl mx-auto space-y-12">
               <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-black italic tracking-tighter uppercase">Intelligence Foundry</h3>
                    <p className="text-gray-400 text-sm">Kreirajte unikatne agente agencije Jobstep.</p>
                  </div>
                  <button onClick={createAgent} className="bg-black text-white px-8 py-4 rounded-[20px] font-black text-xs uppercase flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={18} /> New Agent</button>
               </div>

               <div className="grid gap-10">
                 {agents.map(a => (
                   <div key={a.id} className="bg-white border border-gray-100 rounded-[48px] p-10 flex flex-col gap-10 hover:shadow-2xl transition-all group overflow-hidden relative">
                      <div className="flex flex-col md:flex-row gap-10 relative z-10">
                        <div className="flex flex-col items-center gap-4">
                           <div className={`w-28 h-28 ${a.avatarColor} rounded-[40px] shrink-0 flex items-center justify-center text-white text-4xl font-black shadow-2xl transform group-hover:rotate-3 transition-transform`}>{a.name[0]}</div>
                           <div className="flex flex-col items-center gap-1">
                              <span className="px-4 py-1 bg-gray-100 rounded-full text-[9px] font-black uppercase tracking-tighter text-gray-500">{a.category}</span>
                              <div className="flex items-center gap-1 text-[#5fa19f] text-[9px] font-black mt-2 bg-[#5fa19f]/10 px-3 py-1 rounded-lg">
                                 <Fingerprint size={10} /> {a.id}
                              </div>
                           </div>
                        </div>

                        <div className="flex-1 space-y-6">
                           <div className="flex justify-between items-center">
                              <div>
                                 {/* Agent Name Editable */}
                                 <input 
                                    type="text"
                                    className="text-2xl font-black italic tracking-tight bg-transparent border-b border-gray-200 focus:border-[#5fa19f] outline-none mb-2"
                                    value={a.name}
                                    onChange={(e) => setAgents(prev => prev.map(ag => ag.id === a.id ? {...ag, name: e.target.value} : ag))}
                                 />
                                 {/* Agent Category Select */}
                                 <div className="flex items-center gap-2 text-sm text-gray-500">
                                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category:</label>
                                   <select
                                     className="px-3 py-1 bg-gray-50 rounded-lg text-xs font-medium border border-gray-100 focus:border-[#5fa19f] outline-none"
                                     value={a.category}
                                     onChange={(e) => setAgents(prev => prev.map(ag => ag.id === a.id ? {...ag, category: e.target.value as AgentCategory} : ag))}
                                   >
                                     {agentCategories.map(cat => (
                                       <option key={cat} value={cat}>{cat}</option>
                                     ))}
                                   </select>
                                   {/* Agent Voice Select */}
                                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Voice:</label>
                                   <select
                                     className="px-3 py-1 bg-gray-50 rounded-lg text-xs font-medium border border-gray-100 focus:border-[#5fa19f] outline-none"
                                     value={a.voiceName}
                                     onChange={(e) => setAgents(prev => prev.map(ag => ag.id === a.id ? {...ag, voiceName: e.target.value as AgentVoice} : ag))}
                                   >
                                     {agentVoices.map(voice => (
                                       <option key={voice} value={voice}>{voice}</option>
                                     ))}
                                   </select>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <label className="cursor-pointer bg-[#5fa19f] text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-colors">
                                    <Upload size={14} /> Import Config
                                    <input type="file" className="hidden" accept=".json" onChange={(e) => handleFileUpload(a.id, e)} />
                                 </label>
                                 <button onClick={() => deleteAgent(a.id)} className="p-3 bg-red-50 text-red-400 hover:text-red-600 rounded-2xl transition-all">
                                    <Trash2 size={20} />
                                 </button>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Prompt</label>
                                 <textarea 
                                   className="w-full text-xs bg-gray-50 p-6 rounded-[28px] border border-gray-100 text-gray-600 italic outline-none focus:border-[#5fa19f] min-h-[100px]" 
                                   value={a.systemPrompt}
                                   onChange={(e) => setAgents(agents.map(ag => ag.id === a.id ? {...ag, systemPrompt: e.target.value} : ag))}
                                 />
                              </div>
                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Technical Config (JSON)</label>
                                 <textarea 
                                   className="w-full text-[11px] bg-black p-6 rounded-[28px] border border-gray-800 text-[#5fa19f] font-mono outline-none min-h-[100px]" 
                                   value={a.rawConfig}
                                   spellCheck={false}
                                   onChange={(e) => setAgents(agents.map(ag => ag.id === a.id ? {...ag, rawConfig: e.target.value} : ag))}
                                 />
                              </div>
                           </div>
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {candidates.map(c => (
                <div key={c.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                   <div className="flex justify-between items-start mb-8">
                      <div className="w-16 h-16 bg-gray-50 rounded-[24px] flex items-center justify-center text-[#5fa19f] font-black text-2xl group-hover:bg-[#5fa19f] group-hover:text-white transition-all">{c.name[0]}</div>
                      <span className="px-4 py-1.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-500 uppercase">{c.status}</span>
                   </div>
                   <h3 className="font-bold text-xl mb-1 text-[#2c3e50]">{c.name}</h3>
                   <p className="text-sm text-gray-400 mb-8 font-medium">{c.experience}</p>
                   <button onClick={() => startCall(c)} className="w-full py-4 bg-gray-50 text-[#5fa19f] rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:bg-[#5fa19f] hover:text-white transition-all flex items-center justify-center gap-3">
                      <Phone size={16} /> Pozovi profesionalno
                   </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'call' && selectedCandidate && (
             <div className="h-full flex items-center justify-center">
                <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm p-12 text-center max-w-lg w-full">
                    <div className={`w-40 h-40 mx-auto bg-gray-50 rounded-full flex items-center justify-center border-8 border-white shadow-2xl mb-10 transition-all ${status === ConnectionStatus.CONNECTED ? 'scale-110 shadow-[#5fa19f]/20' : ''}`}>
                       {status === ConnectionStatus.CONNECTED ? <Activity size={50} className="text-[#5fa19f] animate-pulse" /> : <Phone size={50} className="text-gray-200" />}
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter text-[#2c3e50] mb-2">{selectedCandidate.name}</h2>
                    <p className="text-gray-400 font-medium mb-12">Jobstep Recruitment Session</p>
                    <button onClick={stopSession} className="bg-red-600 hover:bg-red-700 text-white px-12 py-5 rounded-[28px] font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center gap-4 mx-auto">
                       <PhoneOff size={20} /> Prekini poziv
                    </button>
                </div>
             </div>
          )}

          {/* NEW: Settings Tab Content */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <h3 className="text-3xl font-black italic tracking-tighter uppercase">Globalne Postavke</h3>
              <p className="text-gray-400 text-sm">Ovdje možete upravljati opštim postavkama Jobstep portala.</p>
              
              <div className="bg-white border border-gray-100 rounded-[32px] p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <Key size={24} className="text-[#5fa19f]" />
                  <div>
                    <h4 className="font-bold text-lg">API Ključ Status</h4>
                    <p className="text-sm text-gray-500">API ključ za Google Gemini je uspješno učitan iz okruženja.</p>
                  </div>
                </div>
                {/* Future global settings could go here, e.g., default language, theme, etc. */}
                <div className="flex items-center gap-4 mt-6">
                  <ShieldAlert size={24} className="text-red-500" />
                  <div>
                    <h4 className="font-bold text-lg text-red-600">Napomena: Naplativa Usluga</h4>
                    <p className="text-sm text-gray-500">Određene funkcionalnosti (npr. Veo video generacija, neki Gemini 3 Pro modeli) zahtijevaju naplativi API ključ. Više informacija: <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ai.google.dev/gemini-api/docs/billing</a></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NEW: Knowledge Base Tab Content */}
          {activeTab === 'knowledge' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <h3 className="text-3xl font-black italic tracking-tighter uppercase">Baza Znanja Agencije</h3>
              <p className="text-gray-400 text-sm">Ovdje možete definisati globalno znanje koje je dostupno svim AI agentima tokom razgovora.</p>
              
              <div className="bg-white border border-gray-100 rounded-[32px] p-8 space-y-6">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Globalno Znanje Jobstep Agencije</label>
                <textarea 
                  className="w-full text-sm bg-gray-50 p-6 rounded-[28px] border border-gray-100 text-gray-600 italic outline-none focus:border-[#5fa19f] min-h-[250px]" 
                  value={globalKnowledge}
                  onChange={(e) => setGlobalKnowledge(e.target.value)}
                  placeholder="Unesite ovdje opšte informacije o Jobstep agenciji, njenim vrijednostima, uslugama ili često postavljanim pitanjima. Ovo će biti uključeno u upute svakog agenta."
                />
                <p className="text-xs text-gray-500 mt-2">Ovo znanje će se automatski dodati u 'system instruction' svakog agenta tokom poziva.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
