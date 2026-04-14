import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import { DropboxService } from './lib/dropbox';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Search,
  Music,
  Radio,
  ExternalLink,
  Github,
  Database,
  Calendar,
  Type,
  Link as LinkIcon,
  FileCode,
  X,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Constants ---

const FIXED_TYPES = [
  { id:'zoo', label:'Zoo\nSettimana', icon:'🎧',
    maskTitle:'Zoo-#DD#-#MM#-#YYYY#-#DAY#-S@m',
    maskDesc:'Zoo-#DAY#,#DD#-#MM#-#YYYY#-S@m',
    mime:'audio/mpeg' },
  { id:'zootv', label:'ZooTv\nVideo', icon:'📺',
    maskTitle:'ZooTv-#DD#-#MM#-#YYYY#-#DAY#-S@m',
    maskDesc:'ZooTv-#DAY#,#DD#-#MM#-#YYYY#-S@m',
    mime:'video/mp4' },
  { id:'compilation', label:'Zoo\nCompilation', icon:'🎵',
    maskTitle:'Zoo-#DD#-#MM#-#YYYY#-Compilation-S@m',
    maskDesc:'Zoo-#DAY#,#DD#-#MM#-#YYYY#-Compilation-S@m',
    mime:'audio/mpeg' },
];

const DAYS_IT  = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const TOKENS   = ['#DD#','#MM#','#YYYY#','#DAY#'];

// --- Types ---

interface CustomType {
  id: string;
  label: string;
  icon: string;
  mime: string;
  maskTitle: string;
  maskDesc: string;
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch: string;
}

interface DropboxConfig {
  token: string;
  path: string;
  appKey?: string;
  appSecret?: string;
  refreshToken?: string;
}

// --- App Component ---

export default function App() {
  // --- State ---
  const [ghConfig, setGhConfig] = useState<GitHubConfig>(() => {
    const saved = localStorage.getItem('zoo105_config') || sessionStorage.getItem('zoo105_config');
    return saved ? JSON.parse(saved) : { token: '', owner: '', repo: '', path: 'rss.xml', branch: 'main' };
  });

  const [dbxConfig, setDbxConfig] = useState<DropboxConfig>(() => {
    const saved = localStorage.getItem('zoo105_dbx_config');
    return saved ? JSON.parse(saved) : { token: '', path: '/rss.xml', appKey: '', appSecret: '', refreshToken: '' };
  });

  const [customTypes, setCustomTypes] = useState<CustomType[]>(() => {
    const saved = localStorage.getItem('zoo105_custom_types');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [day, setDay] = useState(new Date().getDate());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [mediaUrl, setMediaUrl] = useState('');
  const [itemGuid, setItemGuid] = useState('');
  const [isPermaLink, setIsPermaLink] = useState(false);
  const [mimeType, setMimeType] = useState('audio/mpeg');
  const [fileLength, setFileLength] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDbxConfigOpen, setIsDbxConfigOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [datesUpdated, setDatesUpdated] = useState(false);
  const [lockedPubDate, setLockedPubDate] = useState('');

  // --- Refs for Modals ---
  const tNomeRef = useRef<HTMLInputElement>(null);
  const tIconRef = useRef<HTMLInputElement>(null);
  const tMimeRef = useRef<HTMLSelectElement>(null);
  const tMaskTitleRef = useRef<HTMLInputElement>(null);
  const tMaskDescRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('zoo105_custom_types', JSON.stringify(customTypes));
  }, [customTypes]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Dropbox OAuth Listener
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'DROPBOX_AUTH_CODE') {
        const { code } = event.data;
        try {
          setLoading(true);
          setStatus('Scambio codice Dropbox...');
          const redirectUri = `${window.location.origin}/auth/dropbox/callback`;
          
          const response = await fetch('/api/auth/dropbox/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              clientId: dbxConfig.appKey,
              clientSecret: dbxConfig.appSecret,
              redirectUri
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.details?.error_description || errData.error || 'Errore nello scambio token');
          }

          const data = await response.json();
          // data contiene access_token e refresh_token
          const newConfig = {
            ...dbxConfig,
            token: data.access_token,
            refreshToken: data.refresh_token
          };
          setDbxConfig(newConfig);
          localStorage.setItem('zoo105_dbx_config', JSON.stringify(newConfig));
          showToast('Dropbox collegato con successo! ✓', 'success');
        } catch (err: any) {
          showToast('Errore collegamento: ' + err.message, 'error');
        } finally {
          setLoading(false);
          setStatus('');
        }
      } else if (event.data?.type === 'DROPBOX_AUTH_ERROR') {
        showToast('Errore Dropbox: ' + event.data.error, 'error');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dbxConfig]);

  // --- Helpers ---

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
  };

  const applyMaskWith = (mask: string, d: number, m: number, y: number) => {
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const yyyy = String(y);
    const dayName = DAYS_IT[new Date(y, m - 1, d).getDay()];
    return (mask || '')
      .replace(/#DD#/g, dd)
      .replace(/#MM#/g, mm)
      .replace(/#YYYY#/g, yyyy)
      .replace(/#DAY#/g, dayName);
  };

  const applyMask = (mask: string) => applyMaskWith(mask, day, month, year);

  const autoFillFromType = useCallback(() => {
    const type = [...FIXED_TYPES, ...customTypes].find(t => t.id === selectedTypeId);
    if (type) {
      setItemTitle(applyMask(type.maskTitle));
      setItemDesc(applyMask(type.maskDesc));
      setMimeType(type.mime);
    }
  }, [selectedTypeId, customTypes, day, month, year]);

  useEffect(() => {
    autoFillFromType();
  }, [autoFillFromType]);

  const extractGuid = (url: string) => {
    const match = url.match(/download\/([a-f0-9-]{36})\./i);
    if (match) return match[1];
    const parts = url.split('/');
    const last = parts[parts.length - 1];
    return last.replace(/\.[^.]+$/, '') || url;
  };

  const onUrlChange = (url: string) => {
    setMediaUrl(url);
    if (url.endsWith('.mp3')) {
      setMimeType('audio/mpeg');
      setFileLength('100123123');
    } else if (url.endsWith('.mp4')) {
      setMimeType('video/mp4');
      setFileLength('0');
    }
    const extracted = extractGuid(url);
    if (extracted && extracted !== url) setItemGuid(extracted);
  };

  const formatRfc822 = (dt: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => String(n).padStart(2, '0');
    const o = -dt.getTimezoneOffset();
    const sign = o >= 0 ? '+' : '-';
    const offset = sign + pad(Math.floor(Math.abs(o) / 60)) + pad(Math.abs(o) % 60);
    return `${days[dt.getDay()]}, ${pad(dt.getDate())} ${months[dt.getMonth()]} ${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())} ${offset}`;
  };

  const getPubDate = () => {
    if (lockedPubDate) return lockedPubDate;
    return "--- PREMI 'AGGIORNA DATA ITEM' ---";
  };

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const buildXmlItem = () => {
    if (!itemTitle || !mediaUrl) return null;
    const guid = itemGuid || extractGuid(mediaUrl);
    const date = getPubDate();
    return `<item>\n<title>${esc(itemTitle)}</title>\n<link>${esc(mediaUrl)}</link>\n<description>${esc(itemDesc)}</description>\n<pubDate>${date}</pubDate>\n<guid isPermaLink="${isPermaLink}">${guid}</guid>\n<enclosure length="${fileLength}" type="${mimeType}" url="${esc(mediaUrl)}"/>\n</item>`;
  };

  const updateXmlLogic = (currentXml: string, newItem: string) => {
    const MARKER = '<!-- Puntate Giornaliere -->';
    const markerIdx = currentXml.indexOf(MARKER);
    if (markerIdx === -1) throw new Error('Marker "' + MARKER + '" non trovato nel RSS');

    const finalDate = getPubDate();

    // Update pubDate of fixed items (before marker)
    const beforeMarker = currentXml.slice(0, markerIdx);
    const afterMarker = currentXml.slice(markerIdx + MARKER.length);

    const parts = beforeMarker.split('<pubDate>');
    let rebuiltBefore = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const ci = parts[i].indexOf('</pubDate>');
      if (ci !== -1) {
        rebuiltBefore += '<pubDate>' + finalDate + '</pubDate>' + parts[i].slice(ci + 10);
      } else {
        rebuiltBefore += '<pubDate>' + parts[i];
      }
    }

    // Insert new item
    const afterTrimmed = afterMarker.replace(/^[\r\n\s]+/, '');
    let updatedXml = rebuiltBefore + MARKER + '\n' + newItem + '\n' + afterTrimmed;

    // Update lastBuildDate
    const lbdParts = updatedXml.split('<lastBuildDate>');
    if (lbdParts.length > 1) {
      const rest = lbdParts[1].split('</lastBuildDate>');
      updatedXml = lbdParts[0] + '<lastBuildDate>' + finalDate + '</lastBuildDate>' + rest.slice(1).join('</lastBuildDate>');
    }

    return updatedXml;
  };

  // --- Actions ---

  const publishToGithub = async () => {
    if (!ghConfig.token) { showToast('Configura GitHub prima', 'error'); return; }
    const newItem = buildXmlItem();
    if (!newItem) { showToast('Compila Titolo e URL prima', 'error'); return; }
    if (!datesUpdated) { showToast('⚠ Prima aggiorna le date degli item fissi!', 'error'); return; }

    setLoading(true);
    setStatus('1/3 — Lettura file XML da GitHub...');
    try {
      const owner = ghConfig.owner.trim();
      const repo = ghConfig.repo.trim();
      const path = ghConfig.path.trim();
      const branch = ghConfig.branch.trim();
      const token = ghConfig.token.trim();

      if (!owner || !repo || !path) {
        throw new Error("Configurazione GitHub incompleta (Owner, Repo o Path mancanti)");
      }

      // Pulizia path: rimuoviamo slash iniziali e codifichiamo ogni segmento separatamente
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const encodedPath = cleanPath.split('/').map(part => encodeURIComponent(part)).join('/');
      
      const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
      
      let getResp;
      try {
        getResp = await fetch(url, { 
          headers: { 
            'Authorization': `token ${token}`, 
            'Accept': 'application/vnd.github.v3+json'
          } 
        });
      } catch (fetchErr) {
        console.error('Fetch Error:', fetchErr);
        throw new Error("Errore di rete o CORS: Impossibile contattare GitHub.");
      }
      if (!getResp.ok) { 
        const e = await getResp.json(); 
        throw new Error(`GitHub API (Read): ${e.message || getResp.status}`); 
      }
      const fileData = await getResp.json();
      const sha = fileData.sha;

      // Decodifica robusta per Safari/iOS
      const fromBase64 = (b64: string) => {
        const bin = window.atob(b64.replace(/\s/g, ''));
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(u8);
      };
      
      const currentXml = fromBase64(fileData.content);

      setStatus('2/3 — Aggiornamento XML...');
      const updatedXml = updateXmlLogic(currentXml, newItem);

      setStatus('3/3 — Pubblicazione su GitHub...');
      
      // Funzione robusta per Base64 compatibile con UTF-8 e Safari/iOS
      const toBase64 = (str: string) => {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      };

      if (!sha) throw new Error("SHA del file non trovato. Riprova.");
      if (!branch) throw new Error("Branch non configurato.");

      let putResp;
      try {
        putResp = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
          {
            method: 'PUT',
            headers: { 
              'Authorization': `token ${token}`, 
              'Accept': 'application/vnd.github.v3+json', 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
              message: `Add: ${itemTitle}`, 
              content: toBase64(updatedXml), 
              sha, 
              branch: branch 
            })
          }
        );
      } catch (putErr) {
        console.error('Put Fetch Error:', putErr);
        throw new Error("Errore di rete durante l'invio a GitHub.");
      }
      if (!putResp.ok) { 
        const e = await putResp.json(); 
        if (putResp.status === 409) {
          throw new Error("Conflitto di versione (409). Riprova tra pochi secondi, GitHub sta ancora processando il file.");
        }
        if (putResp.status === 400) {
          throw new Error(`Errore 400 (Bad Request): ${e.message || 'Dati inviati non validi'}. Verifica che il branch "${ghConfig.branch}" esista.`);
        }
        throw new Error(`Push fallito (${putResp.status}): ${e.message || JSON.stringify(e)}`); 
      }

      showToast(`✓ "${itemTitle}" pubblicato su GitHub!`, 'success');
      setDatesUpdated(false);
    } catch (err: any) {
      showToast('Errore: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const connectDropbox = () => {
    if (!dbxConfig.appKey || !dbxConfig.appSecret) {
      showToast('Inserisci App Key e App Secret prima di collegare', 'error');
      return;
    }
    const redirectUri = `${window.location.origin}/auth/dropbox/callback`;
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dbxConfig.appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&token_access_type=offline`;
    
    window.open(authUrl, 'dropbox_auth', 'width=600,height=700');
  };

  const publishToDropbox = async () => {
    if (!dbxConfig.token && !dbxConfig.refreshToken) { 
      showToast('Configura Dropbox prima (Token o App Key/Secret)', 'error'); 
      return; 
    }
    const newItem = buildXmlItem();
    if (!newItem) { showToast('Compila Titolo e URL prima', 'error'); return; }
    if (!datesUpdated) { showToast('⚠ Prima aggiorna le date degli item fissi!', 'error'); return; }

    setLoading(true);
    setStatus('1/3 — Lettura file XML da Dropbox...');
    try {
      const dbx = new DropboxService({
        accessToken: dbxConfig.token,
        refreshToken: dbxConfig.refreshToken,
        clientId: dbxConfig.appKey,
        clientSecret: dbxConfig.appSecret
      });
      let currentXml = '';
      
      try {
        currentXml = await dbx.downloadFile(dbxConfig.path);
      } catch (err: any) {
        if (err.message.includes('non trovato')) {
          throw new Error(`Il file "${dbxConfig.path}" non esiste su Dropbox. Crealo manualmente nel tuo Dropbox prima di caricare, oppure controlla che il percorso sia corretto (deve iniziare con /).`);
        }
        throw err;
      }

      setStatus('2/3 — Aggiornamento XML...');
      const updatedXml = updateXmlLogic(currentXml, newItem);

      setStatus('3/3 — Pubblicazione su Dropbox...');
      await dbx.uploadFile(dbxConfig.path, updatedXml);

      // Salvataggio copia di backup nella cartella "xml rss" con data ITA
      try {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}-${month}-${year}`;
        const backupPath = `/xml rss/105Zoo-${dateStr}.xml`;
        
        await dbx.uploadFile(backupPath, updatedXml);
        console.log(`Backup ${backupPath} salvato con successo`);
      } catch (backupErr) {
        console.error('Errore durante il salvataggio del backup:', backupErr);
        // Non blocchiamo l'operazione principale se il backup fallisce
      }

      showToast(`✓ "${itemTitle}" pubblicato su Dropbox! (Backup creato in /xml rss/)`, 'success');
      setDatesUpdated(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const setToday = () => {
    const now = new Date();
    setDay(now.getDate());
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    showToast('Data impostata a oggi ✓', 'info');
  };

  const resetFields = () => {
    // Usiamo uno stato o un toast per la conferma se vogliamo evitare window.confirm
    // Ma per ora implementiamo la logica di reset
    setMediaUrl('');
    setItemGuid('');
    setItemTitle('');
    setItemDesc('');
    setIsPermaLink(false);
    setLockedPubDate('');
    setSelectedTypeId(null);
    setDatesUpdated(false);
    showToast('Campi svuotati ✓', 'info');
  };

  const saveCustomType = () => {
    const nome = tNomeRef.current?.value.trim();
    const icon = tIconRef.current?.value.trim() || '📌';
    const mime = tMimeRef.current?.value || 'audio/mpeg';
    const mT = tMaskTitleRef.current?.value.trim();
    const mD = tMaskDescRef.current?.value.trim();

    if (!nome || !mT) { showToast('Nome e Maschera Titolo sono obbligatori', 'error'); return; }

    if (editingTypeId) {
      setCustomTypes(prev => prev.map(t => t.id === editingTypeId ? { ...t, label: nome, icon, mime, maskTitle: mT, maskDesc: mD || '' } : t));
    } else {
      const id = 'custom_' + Date.now();
      setCustomTypes(prev => [...prev, { id, label: nome, icon, mime, maskTitle: mT, maskDesc: mD || '' }]);
    }

    setIsTypeModalOpen(false);
    showToast(editingTypeId ? `Tipo "${nome}" aggiornato ✓` : `Tipo "${nome}" aggiunto ✓`, 'success');
  };

  const deleteCustomType = (id: string) => {
    if (confirm('Eliminare definitivamente questo tipo?')) {
      setCustomTypes(prev => prev.filter(t => t.id !== id));
      if (selectedTypeId === id) setSelectedTypeId(null);
      showToast('Tipo eliminato', 'info');
    }
  };

  const exportTypes = () => {
    if (!customTypes.length) { showToast('Nessun tipo personalizzato da esportare', 'info'); return; }
    const json = JSON.stringify(customTypes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zoo105_tipi.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${customTypes.length} tipi esportati ✓`, 'success');
  };

  const importTypes = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) throw new Error('Formato non valido');
        let added = 0;
        imported.forEach(t => {
          if (!t.id || !t.label || !t.maskTitle) return;
          const newId = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          setCustomTypes(prev => [...prev, { ...t, id: newId }]);
          added++;
        });
        showToast(`${added} tipi importati ✓`, 'success');
      } catch (err: any) {
        showToast('File non valido: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#050508] text-[#ffffff] font-sans selection:bg-[#ff3c3c] selection:text-white">
      {/* Header */}
      <header className="bg-[#12121a] border-b border-[#2a2a3e] px-4 md:px-6 py-3 md:h-[60px] flex flex-col md:flex-row items-center justify-between sticky top-0 z-50 gap-3 md:gap-0">
        <div className="font-sans font-bold text-2xl md:text-3xl tracking-widest flex items-center gap-2">
          <span className="chromatic-text">Rec-Zoo</span>
          <span className="text-[#fd0]">1o5™</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button 
              onClick={() => setIsConfigOpen(true)}
              className="btn-hdr flex items-center gap-2 text-[10px] md:text-xs"
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", ghConfig.token ? "bg-[var(--green)] shadow-[0_0_4px_var(--green)]" : "bg-[var(--muted)]")} />
              <Github size={14} /> GitHub
            </button>
            <button 
              onClick={() => setIsDbxConfigOpen(true)}
              className="btn-hdr flex items-center gap-2 hover:border-[var(--accent2)] text-[10px] md:text-xs"
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", dbxConfig.token ? "bg-[var(--green)] shadow-[0_0_4px_var(--green)]" : "bg-[var(--muted)]")} />
              <Database size={14} /> Dropbox
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto py-4 md:py-8 px-4 md:px-6">
        {/* Step 1: Tipo Episodio */}
        <section className="panel">
          <div className="panel-title">
            01 — Tipo episodio
          </div>

          <div className="font-mono text-[12px] font-bold tracking-[2px] uppercase text-[var(--muted)] mb-2.5">Tipi fissi</div>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {FIXED_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTypeId(t.id)}
                className={cn(
                  "type-btn",
                  selectedTypeId === t.id && "active"
                )}
              >
                <span className="text-xl block mb-1">{t.icon}</span>
                {t.label.split('\n').map((line, i) => <div key={i}>{line}</div>)}
              </button>
            ))}
          </div>

          <div className="font-mono text-[12px] font-bold tracking-[2px] uppercase text-[var(--muted)] mt-[18px] mb-2.5">Tipi personalizzati</div>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {customTypes.map(t => (
              <div key={t.id} className="relative group">
                <button
                  onClick={() => setSelectedTypeId(t.id)}
                  className={cn(
                    "type-btn w-full",
                    selectedTypeId === t.id && "active"
                  )}
                >
                  <span className="text-xl block mb-1">{t.icon}</span>
                  {t.label}
                </button>
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingTypeId(t.id); setIsTypeModalOpen(true); }}
                    className="w-5 h-5 bg-[#7c4dff33] text-[#a080ff] rounded flex items-center justify-center hover:bg-[#7c4dff80]"
                  >
                    <Settings size={10} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteCustomType(t.id); }}
                    className="w-5 h-5 bg-[#ff3c3c33] text-[#ff3c3c] rounded flex items-center justify-center hover:bg-[#ff3c3c80]"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}
            <button 
              onClick={() => { setEditingTypeId(null); setIsTypeModalOpen(true); }}
              className="bg-transparent border border-dashed border-[#2a2a3e] text-[#7070a0] p-3 rounded-lg font-mono text-xs text-center hover:border-[#7c4dff] hover:text-[#7c4dff] transition-all"
            >
              <span className="text-xl block mb-1">＋</span>
              Aggiungi<br/>tipo
            </button>
          </div>

          <div className="flex gap-2.5 mt-4">
            <button onClick={exportTypes} className="flex-1 bg-transparent border border-[var(--border)] text-[var(--muted)] p-2 rounded-lg font-mono text-[12px] font-bold hover:border-[var(--accent2)] hover:text-[var(--text)] transition-all">
              ⬇ Esporta tipi (JSON)
            </button>
            <button onClick={() => document.getElementById('importFile')?.click()} className="flex-1 bg-transparent border border-[var(--border)] text-[var(--muted)] p-2 rounded-lg font-mono text-[12px] font-bold hover:border-[var(--accent2)] hover:text-[var(--text)] transition-all">
              ⬆ Importa tipi (JSON)
            </button>
            <input type="file" id="importFile" className="hidden" accept=".json" onChange={importTypes} />
          </div>

          <button 
            onClick={() => {
              // Usiamo ESCLUSIVAMENTE la data e l'orario di ADESSO (attuale)
              setLockedPubDate(formatRfc822(new Date()));
              setDatesUpdated(true);
            }}
            className={cn(
              "w-full mt-4 p-3.5 border-2 rounded-[10px] font-sans font-bold text-lg tracking-[2px] transition-all flex items-center justify-center gap-2.5",
              datesUpdated ? "bg-[#00e6761f] border-[#00e676] text-[#00e676] animate-[pulse-green_0.4s_ease]" : "bg-transparent border-[#ffd740] text-[#ffd740] hover:bg-[#ffd7401a]"
            )}
          >
            <Calendar size={18} /> {datesUpdated ? "✓ DATA PRONTA — VERRANNO AGGIORNATE AL PUBLISH" : "📅 AGGIORNA DATA ITEM"}
          </button>
          {!datesUpdated && <div className="text-center font-mono text-[11px] text-[#ff3c3c] mt-2">⚠ Premi prima di pubblicare!</div>}
        </section>

        {/* Step 2: Data & URL */}
        <section className="panel">
          <div className="panel-title">
            02 — Data & URL media
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-[18px]">
            <div className="flex-shrink-0 flex items-end">
              <button 
                onClick={setToday}
                className="h-[46px] px-4 bg-[var(--surface2)] border border-[var(--border)] text-[var(--gold)] rounded-lg font-mono text-sm font-bold hover:border-[var(--gold)] transition-all flex items-center gap-2"
              >
                <Calendar size={16} /> OGGI
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 flex-1">
              <div>
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Giorno</label>
                <input type="number" value={day} onChange={e => setDay(parseInt(e.target.value))} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
              </div>
              <div>
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Mese</label>
                <input type="number" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
              </div>
              <div>
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Anno</label>
                <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
              </div>
            </div>
          </div>

          <div className="mb-[18px]">
            <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[#ffd740] mb-1.5">URL file media (link diretto)</label>
            <input 
              type="url" 
              value={mediaUrl} 
              onChange={e => onUrlChange(e.target.value)} 
              placeholder="https://..." 
              className="w-full bg-[#1a1a2e] border-2 border-[#ffd740] text-[var(--text)] p-3 rounded-lg font-mono text-sm outline-none shadow-[0_0_15px_rgba(255,215,64,0.1)] focus:shadow-[0_0_20px_rgba(255,215,64,0.2)] transition-all" 
            />
          </div>

          <div className="mb-[18px]">
            <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">GUID — codice univoco episodio</label>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="text" value={itemGuid} onChange={e => setItemGuid(e.target.value)} className="flex-1 min-w-[200px] bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
              <button onClick={() => setItemGuid(extractGuid(mediaUrl))} className="bg-[var(--surface2)] border border-[var(--border)] text-[var(--muted)] p-2.5 rounded-lg text-sm font-bold hover:border-[var(--accent2)] hover:text-[var(--text)] transition-all">
                ↻ da URL
              </button>
              <button 
                onClick={() => setIsPermaLink(!isPermaLink)}
                className={cn(
                  "p-2.5 rounded-lg text-[11px] font-bold transition-all border flex items-center gap-1.5",
                  isPermaLink 
                    ? "bg-[var(--accent2)] border-[var(--accent2)] text-white" 
                    : "bg-[var(--surface2)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent2)]"
                )}
              >
                {isPermaLink ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-current" />}
                isPermaLink
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Tipo MIME</label>
              <select value={mimeType} onChange={e => setMimeType(e.target.value)} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]">
                <option value="audio/mpeg">🎵 Audio MP3 (audio/mpeg)</option>
                <option value="video/mp4">🎬 Video MP4 (video/mp4)</option>
                <option value="text/plain">📄 Testo (text/plain)</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Dimensione (length)</label>
              <input type="number" value={fileLength} onChange={e => setFileLength(e.target.value)} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
            </div>
          </div>
        </section>

        {/* Step 3: Titolo & Descrizione */}
        <section className="panel">
          <div className="panel-title">
            03 — Titolo & Descrizione
          </div>

          <div className="mb-[18px]">
            <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Titolo item</label>
            <input type="text" value={itemTitle} onChange={e => setItemTitle(e.target.value)} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
          </div>

          <div className="mb-[18px]">
            <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Descrizione item</label>
            <input type="text" value={itemDesc} onChange={e => setItemDesc(e.target.value)} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
          </div>

          <div className="flex flex-col gap-2">
            {!showResetConfirm ? (
              <button 
                onClick={() => setShowResetConfirm(true)} 
                className="btn-secondary border-dashed border-[#ff3c3c66] text-[#ff8080] hover:border-[#ff3c3c] hover:text-[#ff3c3c]"
              >
                🗑 Svuota tutti i campi
              </button>
            ) : (
              <div className="flex gap-2 mt-2.5">
                <button 
                  onClick={() => { resetFields(); setShowResetConfirm(false); }} 
                  className="flex-1 p-3 bg-[#ff3c3c] text-white rounded-[10px] font-mono text-[13px] font-bold"
                >
                  CONFERMA SVUOTA
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)} 
                  className="flex-1 p-3 bg-transparent text-[var(--muted)] border border-[var(--border)] rounded-[10px] font-mono text-[13px]"
                >
                  Annulla
                </button>
              </div>
            )}
          </div>

          <div className="mt-[18px]">
            <div className="font-mono text-[12px] font-bold tracking-[2px] uppercase text-[var(--accent)] mb-3 pb-1.5 border-b border-[rgba(255,77,77,0.3)]">Preview item XML</div>
            <div className="xml-block">
              {buildXmlItem() || "← Compila i campi per visualizzare l'anteprima XML"}
            </div>
          </div>
        </section>

        {/* Publish Buttons */}
        <div className="flex flex-col gap-3">
          <button 
            onClick={publishToGithub}
            disabled={loading || !ghConfig.token}
            className="btn-submit flex items-center justify-center gap-3 font-bold"
          >
            {loading && status.includes('GitHub') && <RefreshCw className="animate-spin" size={20} />}
            ⇑ PUBBLICA SU GITHUB
          </button>
          <button 
            onClick={publishToDropbox}
            disabled={loading || !dbxConfig.token}
            className="btn-submit bg-[#0061ff] hover:bg-[#3381ff] flex items-center justify-center gap-3 font-bold"
          >
            {loading && status.includes('Dropbox') && <RefreshCw className="animate-spin" size={20} />}
            ⇑ PUBBLICA SU DROPBOX
          </button>
        </div>
        
        {status && <div className="text-center mt-3 font-mono text-xs text-[#7070a0]">{status}</div>}
      </main>

      {/* GitHub Config Modal */}
      <AnimatePresence>
        {isConfigOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4"
            onClick={() => setIsConfigOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-9 w-full max-w-[540px] max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="font-sans font-bold text-3xl tracking-widest text-[#7c4dff] mb-1">⚙ GitHub Config</div>
              <div className="font-mono text-xs text-[#7070a0] mb-6">Imposta le credenziali GitHub per pubblicare il feed RSS</div>

              <div className="mb-[18px]">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">GitHub Personal Access Token</label>
                <input type="password" value={ghConfig.token} onChange={e => setGhConfig({...ghConfig, token: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
                <div className="font-mono text-[12px] text-[var(--muted)] mt-1.5 leading-relaxed">→ github.com/settings/tokens → New token → scope: <b>repo</b></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-[18px]">
                <div>
                  <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Owner</label>
                  <input type="text" value={ghConfig.owner} onChange={e => setGhConfig({...ghConfig, owner: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
                </div>
                <div>
                  <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Repository</label>
                  <input type="text" value={ghConfig.repo} onChange={e => setGhConfig({...ghConfig, repo: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
                </div>
              </div>

              <div className="mb-[18px]">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Percorso file XML</label>
                <input type="text" value={ghConfig.path} onChange={e => setGhConfig({...ghConfig, path: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
              </div>

              <div className="mb-6">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Branch</label>
                <input type="text" value={ghConfig.branch} onChange={e => setGhConfig({...ghConfig, branch: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
              </div>

              <button 
                onClick={() => { 
                  const cleanedConfig = {
                    ...ghConfig,
                    token: ghConfig.token.trim(),
                    owner: ghConfig.owner.trim(),
                    repo: ghConfig.repo.trim(),
                    path: ghConfig.path.trim(),
                    branch: ghConfig.branch.trim()
                  };
                  setGhConfig(cleanedConfig);
                  localStorage.setItem('zoo105_config', JSON.stringify(cleanedConfig)); 
                  setIsConfigOpen(false); 
                  showToast('Configurazione GitHub salvata ✓', 'success'); 
                }}
                className="w-full p-3.5 bg-[#7c4dff] text-white rounded-[10px] font-sans font-bold text-xl tracking-[2px] hover:bg-[#9b73ff] transition-all"
              >
                SALVA CONFIGURAZIONE
              </button>
              <button onClick={() => setIsConfigOpen(false)} className="w-full mt-2 p-3 bg-transparent border border-[#2a2a3e] text-[#7070a0] rounded-[10px] font-mono text-sm hover:text-[#e8e8f0] transition-all">
                Annulla
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropbox Config Modal */}
      <AnimatePresence>
        {isDbxConfigOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4"
            onClick={() => setIsDbxConfigOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-9 w-full max-w-[540px] max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="font-sans font-bold text-3xl tracking-widest text-[#0061ff] mb-1">⚙ Dropbox Config</div>
              <div className="font-mono text-xs text-[#7070a0] mb-6">Imposta le credenziali Dropbox per pubblicare il feed RSS</div>

              <div className="mb-[18px] p-4 bg-[#0061ff1a] border border-[#0061ff33] rounded-xl">
                <div className="font-sans font-bold text-sm text-[#0061ff] mb-3 flex items-center gap-2">
                  <RefreshCw size={16} /> Metodo Consigliato (Refresh Token)
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-[var(--muted)] mb-1">App Key</label>
                    <input type="text" value={dbxConfig.appKey} onChange={e => setDbxConfig({...dbxConfig, appKey: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2 rounded-lg font-mono text-xs outline-none focus:border-[#0061ff]" />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-[var(--muted)] mb-1">App Secret</label>
                    <input type="password" value={dbxConfig.appSecret} onChange={e => setDbxConfig({...dbxConfig, appSecret: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2 rounded-lg font-mono text-xs outline-none focus:border-[#0061ff]" />
                  </div>
                </div>
                <button 
                  onClick={connectDropbox}
                  className="w-full p-2 bg-[#0061ff] text-white rounded-lg font-sans font-bold text-sm hover:bg-[#3381ff] transition-all flex items-center justify-center gap-2"
                >
                  <Database size={16} /> COLLEGA ACCOUNT DROPBOX
                </button>
                {dbxConfig.refreshToken && <div className="text-[10px] text-[#00e676] font-mono mt-2 text-center">✓ Refresh Token salvato (Connessione permanente)</div>}
              </div>

              <div className="mb-[18px]">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5 flex items-center justify-between">
                  <span>Dropbox Access Token (Manuale)</span>
                  <span className="text-[10px] normal-case font-normal text-[#ff3c3c]">Scade ogni 4 ore</span>
                </label>
                <input type="password" value={dbxConfig.token} onChange={e => setDbxConfig({...dbxConfig, token: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
                <div className="font-mono text-[12px] text-[var(--muted)] mt-1.5 leading-relaxed">→ Usa questo solo se non vuoi usare App Key/Secret</div>
              </div>

              <div className="mb-6">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Percorso file XML (es: /rss.xml)</label>
                <input type="text" value={dbxConfig.path} onChange={e => setDbxConfig({...dbxConfig, path: e.target.value})} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--accent2)]" />
              </div>

              <button 
                onClick={() => { 
                  const cleanedConfig = {
                    ...dbxConfig,
                    token: dbxConfig.token.trim(),
                    path: dbxConfig.path.trim()
                  };
                  setDbxConfig(cleanedConfig);
                  localStorage.setItem('zoo105_dbx_config', JSON.stringify(cleanedConfig)); 
                  setIsDbxConfigOpen(false); 
                  showToast('Configurazione Dropbox salvata ✓', 'success'); 
                }}
                className="w-full p-3.5 bg-[#0061ff] text-white rounded-[10px] font-sans font-bold text-xl tracking-[2px] hover:bg-[#3381ff] transition-all"
              >
                SALVA CONFIGURAZIONE
              </button>
              <button onClick={() => setIsDbxConfigOpen(false)} className="w-full mt-2 p-3 bg-transparent border border-[#2a2a3e] text-[#7070a0] rounded-[10px] font-mono text-sm hover:text-[#e8e8f0] transition-all">
                Annulla
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Type Modal */}
      <AnimatePresence>
        {isTypeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4"
            onClick={() => setIsTypeModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-9 w-full max-w-[540px] max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="font-sans font-bold text-3xl tracking-widest text-[#ffd740] mb-1">{editingTypeId ? '✎ Modifica Tipo' : '＋ Nuovo Tipo'}</div>
              <div className="font-mono text-xs text-[#7070a0] mb-6">Crea una maschera personalizzata per questo tipo di episodio</div>

              <div className="grid grid-cols-2 gap-4 mb-[18px]">
                <div>
                  <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Nome tipo</label>
                  <input ref={tNomeRef} defaultValue={customTypes.find(t => t.id === editingTypeId)?.label || ''} type="text" className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--gold)]" />
                </div>
                <div>
                  <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Icona (emoji)</label>
                  <input ref={tIconRef} defaultValue={customTypes.find(t => t.id === editingTypeId)?.icon || ''} type="text" className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--gold)]" />
                </div>
              </div>

              <div className="mb-[18px]">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">MIME type</label>
                <select ref={tMimeRef} defaultValue={customTypes.find(t => t.id === editingTypeId)?.mime || 'audio/mpeg'} className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--gold)]">
                  <option value="audio/mpeg">🎵 Audio MP3</option>
                  <option value="video/mp4">🎬 Video MP4</option>
                  <option value="text/plain">📄 Testo</option>
                </select>
              </div>

              <div className="mb-[18px]">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Maschera Titolo</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TOKENS.map(tok => (
                    <button key={tok} onClick={() => { if(tMaskTitleRef.current) tMaskTitleRef.current.value += tok; }} className="font-mono text-[10px] px-2 py-1 bg-[var(--surface2)] border border-[var(--border)] rounded text-[var(--gold)] hover:border-[var(--gold)]">{tok}</button>
                  ))}
                </div>
                <input ref={tMaskTitleRef} defaultValue={customTypes.find(t => t.id === editingTypeId)?.maskTitle || ''} type="text" className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--gold)]" />
              </div>

              <div className="mb-6">
                <label className="block font-mono text-[12px] font-bold tracking-[1px] uppercase text-[var(--muted)] mb-1.5">Maschera Descrizione</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TOKENS.map(tok => (
                    <button key={tok} onClick={() => { if(tMaskDescRef.current) tMaskDescRef.current.value += tok; }} className="font-mono text-[10px] px-2 py-1 bg-[var(--surface2)] border border-[var(--border)] rounded text-[var(--gold)] hover:border-[var(--gold)]">{tok}</button>
                  ))}
                </div>
                <input ref={tMaskDescRef} defaultValue={customTypes.find(t => t.id === editingTypeId)?.maskDesc || ''} type="text" className="w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] p-2.5 rounded-lg font-mono text-sm outline-none focus:border-[var(--gold)]" />
              </div>

              <button 
                onClick={saveCustomType}
                className="w-full p-3.5 bg-[#ffd740] text-black rounded-[10px] font-sans font-bold text-xl tracking-[2px] hover:bg-white transition-all"
              >
                SALVA TIPO
              </button>
              <button onClick={() => setIsTypeModalOpen(false)} className="w-full mt-2 p-3 bg-transparent border border-[#2a2a3e] text-[#7070a0] rounded-[10px] font-mono text-sm hover:text-[#e8e8f0] transition-all">
                Annulla
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-6 left-6 right-6 md:left-auto md:right-6 p-4 rounded-[10px] font-mono text-sm z-[999] border shadow-2xl md:max-w-[380px]",
              toast.type === 'success' && "bg-[#0d3d24] border-[#00e676] text-[#00e676]",
              toast.type === 'error' && "bg-[#3d0d0d] border-[#ff3c3c] text-[#ff8080]",
              toast.type === 'info' && "bg-[#1a1a40] border-[#7c4dff] text-[#a080ff]"
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#12121a] p-6 md:p-10 border border-[#2a2a3e] rounded-2xl flex flex-col items-center gap-4 shadow-2xl w-full max-w-[320px] md:max-w-none">
            <RefreshCw className="animate-spin text-[#ff3c3c]" size={40} />
            <p className="font-sans font-bold text-2xl tracking-[2px] text-[#e8e8f0]">{status || "Processing..."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
