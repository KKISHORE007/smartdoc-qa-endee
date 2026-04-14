import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Menu, X, Upload, FileText, Trash2, BookOpen, Send,
  Loader2, CheckCircle2, AlertCircle, History, ChevronRight,
  MessageSquare, Sparkles, ArrowLeft, Globe, ExternalLink, Eye, EyeOff,
  Signal, Brain, Wifi, WifiOff, Download, Search, HardDrive, ShieldCheck, FolderSearch, LogIn, Camera, KeyRound, UserCircle
} from 'lucide-react';
import axios from 'axios';
import LocalDocViewer from './LocalDocViewer';
import { marked } from 'marked';
import html2pdf from 'html2pdf.js';

const API_BASE = 'http://localhost:5000/api';
const USER_NAME = 'Kishore';

/* ─── helpers ─── */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  const imageExts = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'webp', 'gif'];
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📽️';
  if (imageExts.includes(ext)) return '🖼️';
  if (['txt', 'md', 'csv', 'log'].includes(ext)) return '📃';
  if (['js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'xml', 'json'].includes(ext)) return '💻';
  return '📎';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ═══════════════════════════ APP ═══════════════════════════ */
function App() {
  // ── Sidebar state ──
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState('main'); // 'main' | 'history'
  
  // ── Authentication State ──
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(0); // 0: no, 1: verify params, 2: new pwd
  const [authForm, setAuthForm] = useState({ firstName: '', lastName: '', age: '', contactMethod: '', password: '', profilePhoto: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smartdoc_user')) || null; } catch { return null; }
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Chat Mode: 'offline' or 'online' ──
  const [chatMode, setChatMode] = useState('online');

  // ── Document state ──
  const [uploadedFile, setUploadedFile] = useState(null);      // { file, id, name, size, type }
  const [isUploading, setIsUploading] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [documentReady, setDocumentReady] = useState(false);
  const [readPreview, setReadPreview] = useState('');

  // ── Chat state (separate for each mode) ──
  const [inputText, setInputText] = useState('');
  const [offlineMessages, setOfflineMessages] = useState([]);
  const [onlineMessages, setOnlineMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);

  // Active messages based on mode
  const messages = chatMode === 'offline' ? offlineMessages : onlineMessages;
  const setMessages = chatMode === 'offline' ? setOfflineMessages : setOnlineMessages;

  // ── Broad Search panel state ──
  const [broadSearchOpen, setBroadSearchOpen] = useState(false);
  const [broadSearchResults, setBroadSearchResults] = useState(null);
  const [broadSearchQuery, setBroadSearchQuery] = useState('');
  const [isBroadSearching, setIsBroadSearching] = useState(false);

  // ── Document Preview state ──
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);

  // ── History state (separate for each mode) ──
  const [offlineChatHistory, setOfflineChatHistory] = useState([]);
  const [onlineChatHistory, setOnlineChatHistory] = useState([]);
  const chatHistory = chatMode === 'offline' ? offlineChatHistory : onlineChatHistory;
  const setChatHistory = chatMode === 'offline' ? setOfflineChatHistory : setOnlineChatHistory;

  // ── Connection & AI Mode state ──
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelCached, setIsModelCached] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [workerStatus, setWorkerStatus] = useState(''); // 'idle' | 'loading' | 'ready' | 'thinking' | 'verifying'
  const [workerStatusMessage, setWorkerStatusMessage] = useState('');
  const [localDocText, setLocalDocText] = useState(''); // Store text for offline mode
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [modelStorageInfo, setModelStorageInfo] = useState(null); // { fileCount, cacheName }
  const [detectMessage, setDetectMessage] = useState(''); // 'found' | 'not-found' | ''

  // ── Refs ──
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const aiWorker = useRef(null);

  // Connection listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // AI Worker setup
  useEffect(() => {
    aiWorker.current = new Worker(new URL('./ai.worker.js', import.meta.url), {
      type: 'module'
    });

    aiWorker.current.onmessage = (e) => {
      const { status, progress, message, answer, file, cached, fileCount, cacheName } = e.data;

      if (status === 'cache-check') {
        // Response from 'check' — model files found in Cache API
        if (cached) {
          setIsModelCached(true);
          setModelStorageInfo({ fileCount, cacheName });
          // Auto-load since cache exists
          aiWorker.current.postMessage({ type: 'verify' });
          setWorkerStatus('verifying');
          setIsVerifying(true);
        } else {
          setIsModelCached(false);
          localStorage.removeItem('smartdoc_secondBrain');
        }
      } else if (status === 'verifying') {
        setWorkerStatus('verifying');
        setIsVerifying(true);
      } else if (status === 'progress') {
        setDownloadProgress(progress);
        setWorkerStatus('loading');
        setWorkerStatusMessage(file || '');
      } else if (status === 'ready') {
        setIsModelLoaded(true);
        setIsModelCached(true);
        setIsVerifying(false);
        setWorkerStatus('ready');
        setDownloadProgress(100);
        setWorkerStatusMessage('');
        setDetectMessage('');
        // Persist to localStorage
        localStorage.setItem('smartdoc_secondBrain', JSON.stringify({
          downloaded: true,
          timestamp: new Date().toISOString(),
          model: 'Llama-3.2-1B-Instruct-q4f16',
        }));
      } else if (status === 'load-error') {
        setIsVerifying(false);
        setWorkerStatus('');
        setDetectMessage('not-found');
        localStorage.removeItem('smartdoc_secondBrain');
      } else if (status === 'thinking') {
        setWorkerStatus('thinking');
        setIsThinking(true);
      } else if (status === 'stream-start') {
        setIsThinking(false);
        setOfflineMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
      } else if (status === 'stream') {
        const { text } = e.data;
        setOfflineMessages(prev => {
          const newPrev = [...prev];
          const lastMsg = newPrev[newPrev.length - 1];
          if (lastMsg && lastMsg.isStreaming) {
            return [...prev.slice(0, -1), { ...lastMsg, content: text }];
          }
          return prev;
        });
      } else if (status === 'complete') {
        setWorkerStatus('ready');
        setIsThinking(false);
        const finalAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer);
        setOfflineMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.isStreaming) {
            return [...prev.slice(0, -1), { role: 'assistant', content: finalAnswer }];
          }
          return [...prev, { role: 'assistant', content: finalAnswer }];
        });
      } else if (status === 'error') {
        setWorkerStatus('ready');
        setIsThinking(false);
        alert('Offline AI Error: ' + message);
      }
    };

    return () => aiWorker.current?.terminate();
  }, []);

  // Auto-detect cached model on startup
  useEffect(() => {
    const saved = localStorage.getItem('smartdoc_secondBrain');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.downloaded && aiWorker.current) {
          // Ask worker to check cache
          aiWorker.current.postMessage({ type: 'check' });
        }
      } catch { /* ignore parse errors */ }
    }
  }, []);

  /* ── Fetch Chat History from MySQL ── */
  useEffect(() => {
    if (currentUser && currentUser._id) {
      axios.get(`${API_BASE}/history/${currentUser._id}`)
        .then(res => {
          if (res.data.success) {
            setOfflineChatHistory(res.data.histories.filter(h => h.chatMode === 'offline'));
            setOnlineChatHistory(res.data.histories.filter(h => h.chatMode === 'online'));
          }
        })
        .catch(err => console.error("Failed to fetch history:", err));
    } else {
      setOfflineChatHistory([]);
      setOnlineChatHistory([]);
    }
  }, [currentUser]);

  /* ── Download handler — show confirmation modal first ── */
  const handleDownloadModel = useCallback(() => {
    setShowDownloadModal(true);
  }, []);

  /* ── Confirm download — actually trigger the download ── */
  const confirmDownload = useCallback(() => {
    setShowDownloadModal(false);
    if (aiWorker.current) {
      aiWorker.current.postMessage({ type: 'load' });
    }
  }, []);

  /* ── Manual detect — user triggers cache verification ── */
  const handleManualDetect = useCallback(() => {
    setDetectMessage('');
    setIsVerifying(true);
    if (aiWorker.current) {
      aiWorker.current.postMessage({ type: 'check' });
    }
  }, []);

  /* ── Authentication Handlers ── */
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (forgotStep > 0) return handleForgotPassword();

    setAuthLoading(true);
    try {
      const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
      const payload = isLoginMode ? { contactMethod: authForm.contactMethod, password: authForm.password } : authForm;
      
      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload);
      
      if (data.success) {
        localStorage.setItem('smartdoc_user', JSON.stringify(data));
        setCurrentUser(data);
        setShowAuthModal(false);
        setAuthForm({ firstName: '', lastName: '', age: '', contactMethod: '', password: '', profilePhoto: '' });
        setForgotStep(0);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Authentication failed. Please check your network and credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { data } = await axios.put(`${API_BASE}/auth/profile`, {
        id: currentUser._id,
        firstName: authForm.firstName,
        lastName: authForm.lastName,
        age: authForm.age,
        profilePhoto: authForm.profilePhoto
      });
      if (data.success) {
        localStorage.setItem('smartdoc_user', JSON.stringify(data));
        setCurrentUser(data);
        setShowProfileModal(false);
        setAuthForm({ firstName: '', lastName: '', age: '', contactMethod: '', password: '', profilePhoto: '' });
      }
    } catch (err) {
      alert('Profile update failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (forgotStep === 1) {
      if (!authForm.firstName || !authForm.lastName || !authForm.contactMethod) return alert("Please fill First Name, Last Name, and Account Contact to verify your identity.");
      setAuthLoading(true);
      try {
        const { data } = await axios.post(`${API_BASE}/auth/forgot-password`, { 
            firstName: authForm.firstName, 
            lastName: authForm.lastName, 
            contactMethod: authForm.contactMethod 
        });
        alert(data.message);
        setForgotStep(2);
      } catch (err) {
        alert(err.response?.data?.error || 'Identity verification failed.');
      } finally {
        setAuthLoading(false);
      }
    } else if (forgotStep === 2) {
      if (!authForm.password || authForm.password.length < 8) return alert("New password must be at least 8 characters long.");
      setAuthLoading(true);
      try {
        const { data } = await axios.post(`${API_BASE}/auth/reset-password`, { 
            contactMethod: authForm.contactMethod, 
            newPassword: authForm.password 
        });
        alert(data.message);
        setForgotStep(0);
        setIsLoginMode(true);
        setAuthForm({ firstName: '', lastName: '', age: '', contactMethod: '', password: '', profilePhoto: '' });
      } catch (err) {
        alert(err.response?.data?.error || 'Password reset failed.');
      } finally {
        setAuthLoading(false);
      }
    } else {
      // Initiate forgot password process
      setForgotStep(1);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('smartdoc_user');
    setCurrentUser(null);
  };

  // Webcam Capture Handlers
  const startCamera = async () => {
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied or unavailable.");
      setShowCameraModal(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      // Set canvas size to video size
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
      setAuthForm({ ...authForm, profilePhoto: dataUrl });
      closeCamera();
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setShowCameraModal(false);
  };


  /* ── Upload handler ── */
  const handleUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setDocumentReady(false);
    setReadPreview('');
    setLocalDocText('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`${API_BASE}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setUploadedFile({
          file,
          id: res.data.document.id,
          name: res.data.document.name,
          size: res.data.document.size,
          type: res.data.document.type,
        });
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, []);

  /* ── Read document handler ── */
  const handleRead = useCallback(async () => {
    if (!uploadedFile?.id) return;

    setIsReading(true);
    try {
      const res = await axios.post(`${API_BASE}/documents/${uploadedFile.id}/read`);
      if (res.data.success) {
        const doc = res.data.document;
        setDocumentReady(true);
        setReadPreview(doc.preview || '');

        // Try every possible field name to get the full document text
        const fullText = doc.text || doc.content || doc.preview || '';
        console.log('[SmartDoc] handleRead - localDocText length:', fullText.length);
        setLocalDocText(fullText);
      }
    } catch (err) {
      console.error('Read failed:', err);
      alert('Failed to read document: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsReading(false);
    }
  }, [uploadedFile]);

  /* ── Change document (save history) ── */
  const handleChangeDocument = useCallback(() => {
    const saveEntry = (msgs, setHistory, mode) => {
      if (uploadedFile && msgs.length > 0) {
        const payload = {
          docId: uploadedFile.id,
          docName: uploadedFile.name,
          docSize: uploadedFile.size,
          docType: uploadedFile.type,
          readPreview: readPreview || '',
          localDocText: localDocText || '',
          messages: [...msgs],
          chatMode: mode,
          timestamp: new Date().toISOString()
        };
        if (currentUser) {
           axios.post(`${API_BASE}/history`, { ...payload, userId: currentUser._id })
             .then(res => setHistory(prev => [res.data.history, ...prev]))
             .catch(e => console.error('History API error:', e));
        } else {
           setHistory(prev => [payload, ...prev]);
        }
      }
    };

    // Save both offline and online conversations to their respective histories
    saveEntry(offlineMessages, setOfflineChatHistory, 'offline');
    saveEntry(onlineMessages, setOnlineChatHistory, 'online');

    // Reset document + chat state
    setUploadedFile(null);
    setDocumentReady(false);
    setReadPreview('');
    setLocalDocText('');
    setOfflineMessages([]);
    setOnlineMessages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadedFile, offlineMessages, onlineMessages, readPreview, localDocText, currentUser]);

  /* ── Send message ── */
  const handleSend = useCallback(async (e) => {
    e?.preventDefault();
    const question = inputText.trim();
    if (!question) return;

    // Offline mode requires a document
    if (chatMode === 'offline' && (!documentReady || !uploadedFile?.id)) return;

    const userMsg = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    // Helper: Route query to local Second Brain (safe — never throws)
    const useLocalBrain = async () => {
      try {
        if (isModelLoaded && aiWorker.current) {
          let docText = localDocText;

          // FALLBACK: If localDocText is empty, try fetching from backend
          if (!docText || docText.trim() === '') {
            try {
              const fallbackRes = await axios.get(`${API_BASE}/documents/${uploadedFile.id}`);
              if (fallbackRes.data && fallbackRes.data.text) {
                docText = fallbackRes.data.text;
                setLocalDocText(docText);
              }
            } catch (fetchErr) {
              console.warn('[SmartDoc] Fallback fetch failed:', fetchErr.message);
            }
          }

          // FALLBACK 2: If still empty, use readPreview
          if (!docText || docText.trim() === '') {
            docText = readPreview || '';
          }

          aiWorker.current.postMessage({
            type: 'query',
            data: {
              documentText: docText,
              question,
              chatHistory: messages.map(m => ({ role: m.role, content: m.content }))
            }
          });
          return true;
        }
      } catch (workerErr) {
        console.error('Local brain error:', workerErr);
      }
      return false;
    };

    // MODE-BASED ROUTING
    if (chatMode === 'offline') {
      // OFFLINE MODE: Always use Second Brain (document required)
      if (await useLocalBrain()) {
        return;
      }
      setIsThinking(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🚫 Second Brain is not loaded. Please download it from the sidebar to use offline search.',
        question,
      }]);
    } else {
      // ONLINE MODE
      if (documentReady && uploadedFile?.id) {
        // Document uploaded → use Groq API for document Q&A
        try {
          const historyToSend = [...messages, userMsg].slice(-10);
          const res = await axios.post(`${API_BASE}/chat`, {
            documentId: uploadedFile.id,
            question,
            chatHistory: historyToSend,
          });

          if (res.data.success) {
            setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer, question }]);
            setIsThinking(false);
          }
        } catch (err) {
          console.error('Online API error:', err);
          setIsThinking(false);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '⚠️ Online API error: ' + (err.response?.data?.error || err.message),
            question,
          }]);
        }
      } else {
        // No document → route directly to Broad Search
        try {
          const historyToSend = [...messages, userMsg].slice(-10);
          const res = await axios.post(`${API_BASE}/search/broad`, {
            query: question,
            documentId: null,
            chatHistory: historyToSend,
          });

          if (res.data.success) {
            const broadContent = res.data.aiSummary
              ? res.data.aiSummary
              : res.data.results?.map(r => `• ${r.title}: ${r.snippet}`).join('\n') || 'No web results found.';

            setMessages(prev => [...prev, {
              role: 'assistant',
              content: broadContent,
              question,
              type: 'broad-search',
            }]);
          }
        } catch (err) {
          console.error('Broad search error:', err);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '⚠️ Search failed: ' + (err.response?.data?.error || err.message) + '. Check your internet connection.',
            question,
          }]);
        } finally {
          setIsThinking(false);
        }
      }
    }
  }, [inputText, documentReady, uploadedFile, messages, chatMode, isModelLoaded, localDocText, readPreview]);

  /* ── Broad Search handler (per response) ── */
  const handleBroadSearch = useCallback(async (query) => {
    if (!query || isBroadSearching) return;
    if (!isOnline) {
      alert('Broad Search requires internet connection.');
      return;
    }

    setBroadSearchQuery(query);
    setBroadSearchOpen(true);
    setDocPreviewOpen(false); // close preview panel
    setBroadSearchResults(null);
    setIsBroadSearching(true);

    try {
      const res = await axios.post(`${API_BASE}/search/broad`, {
        query,
        documentId: uploadedFile?.id || null,
        chatHistory: [...messages].slice(-10),
      });

      if (res.data.success) {
        setBroadSearchResults(res.data);

        // Save broad search result as a chat message
        const broadContent = res.data.aiSummary
          ? res.data.aiSummary
          : res.data.results?.map(r => `• ${r.title}: ${r.snippet}`).join('\n') || 'No web results found.';

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: broadContent,
          question: query,
          type: 'broad-search',
        }]);
      }
    } catch (err) {
      console.error('Broad search error:', err);
      setBroadSearchResults({ error: 'Search failed. Please try again.' });
    } finally {
      setIsBroadSearching(false);
    }
  }, [uploadedFile, isBroadSearching]);

  /* ── Keyboard handler ── */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Restore from history ── */
  const handleRestoreHistory = useCallback(async (histEntry) => {
    // Save current conversation to active mode's history if there are messages
    if (uploadedFile && messages.length > 0) {
        const payload = {
          docId: uploadedFile.id,
          docName: uploadedFile.name,
          docSize: uploadedFile.size,
          docType: uploadedFile.type,
          readPreview: readPreview || '',
          localDocText: localDocText || '',
          messages: [...messages],
          chatMode: chatMode,
          timestamp: new Date().toISOString()
        };
        if (currentUser) {
           axios.post(`${API_BASE}/history`, { ...payload, userId: currentUser._id })
             .then(res => setChatHistory(prev => [res.data.history, ...prev]))
             .catch(e => console.error('History save error:', e));
        } else {
           setChatHistory(prev => [payload, ...prev]);
        }
    }

    // Restore old document info
    setUploadedFile({
      id: histEntry.docId,
      name: histEntry.docName,
      size: histEntry.docSize || 0,
      type: histEntry.docType || '',
    });
    setReadPreview(histEntry.readPreview || '');
    setLocalDocText(histEntry.localDocText || '');
    // Restore messages to the current active mode
    setMessages(histEntry.messages || []);
    setSidebarView('main');
    setIsSidebarOpen(false);

    // If it's a DB record, we DELETE the old record so it's not duplicated when saved again later
    if (histEntry.id && currentUser) {
       axios.delete(`${API_BASE}/history/${histEntry.id}`).catch(console.error);
    }
    setChatHistory(prev => prev.filter(e => e.id ? e.id !== histEntry.id : e !== histEntry));

    // Verify the document still exists in backend memory
    try {
      const res = await axios.get(`${API_BASE}/documents/${histEntry.docId}`);
      if (res.data && res.data.isRead) {
        setDocumentReady(true);
      } else {
        setDocumentReady(false);
      }
    } catch {
      // Document no longer in server memory (server restarted etc.)
      setDocumentReady(false);
    }
  }, [uploadedFile, messages, readPreview, chatMode, localDocText, currentUser, setChatHistory]);

  const hasMessages = messages.length > 0;

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-grid-pattern" style={{ backgroundColor: 'var(--bg-primary)' }}>

      {/* ━━━ SIDEBAR OVERLAY ━━━ */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setIsSidebarOpen(false); setSidebarView('main'); }}
        />
      )}

      {/* ━━━ SIDEBAR ━━━ */}
      <div
        className="fixed top-0 left-0 h-full z-50 flex flex-col"
        style={{
          width: '320px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            {sidebarView === 'history' && (
              <button
                onClick={() => setSidebarView('main')}
                className="p-1.5 rounded-lg transition-all duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-secondary)'; }}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {sidebarView === 'history' ? (chatMode === 'offline' ? 'Offline History' : 'Online History') : 'SmartDoc AI'}
            </span>
          </div>
          <button
            onClick={() => { setIsSidebarOpen(false); setSidebarView('main'); }}
            className="p-2 rounded-lg transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-secondary)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Search Mode Toggle Tabs ── */}
        <div style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex">
            {/* Offline Search Tab */}
            <button
              onClick={() => setChatMode('offline')}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold tracking-wide transition-all duration-200"
              style={{
                backgroundColor: chatMode === 'offline' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                color: chatMode === 'offline' ? '#a855f7' : 'var(--text-muted)',
                borderBottom: chatMode === 'offline' ? '2px solid #a855f7' : '2px solid transparent',
              }}
            >
              <Brain className="w-3.5 h-3.5" />
              OFFLINE SEARCH
              {offlineChatHistory.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                  {offlineChatHistory.length}
                </span>
              )}
            </button>
            {/* Online Search Tab */}
            <button
              onClick={() => setChatMode('online')}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold tracking-wide transition-all duration-200"
              style={{
                backgroundColor: chatMode === 'online' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: chatMode === 'online' ? '#3b82f6' : 'var(--text-muted)',
                borderBottom: chatMode === 'online' ? '2px solid #3b82f6' : '2px solid transparent',
              }}
            >
              <Globe className="w-3.5 h-3.5" />
              ONLINE SEARCH
              {onlineChatHistory.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                  {onlineChatHistory.length}
                </span>
              )}
            </button>
          </div>
          {/* Status indicator */}
          <div className="px-4 py-1.5 flex items-center justify-center gap-2 bg-black/20">
            {chatMode === 'offline' ? (
              <>
                <div className={`w-1.5 h-1.5 rounded-full ${isModelLoaded ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-[10px] font-medium text-white/50">
                  {isModelLoaded ? '🧠 Second Brain Active' : '⚠️ Download Second Brain to use'}
                </span>
              </>
            ) : (
              <>
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[10px] font-medium text-white/50">
                  {isOnline ? '🟢 Groq API Connected' : '🔴 No Internet Connection'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {sidebarView === 'main' ? (
            <div className="space-y-6 animate-fade-in">
              
              {/* Offline AI Setup Section */}
              <div className="rounded-xl border border-white/10 p-4 bg-white/5 relative overflow-hidden group offline-card">
                <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
                   <Brain className={`w-8 h-8 ${isModelLoaded ? 'text-purple-400 brain-pulse' : isModelCached ? 'text-purple-400/50' : 'text-white/20'}`} />
                </div>
                
                <h3 className="text-[10px] font-bold tracking-widest text-[#a855f7] mb-2 uppercase">Second Brain (Offline AI)</h3>
                
                {/* STATE: Model loaded and ready */}
                {isModelLoaded ? (
                  <div className="space-y-3">
                    <p className="text-xs text-white/70">Offline mode is active. You can chat with documents even without internet.</p>
                    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Brain Ready</span>
                    </div>
                    {/* Storage location info */}
                    <div className="storage-badge flex items-center gap-2">
                      <HardDrive className="w-3 h-3" />
                      <span>Stored in: Browser Cache Storage (Origin Private)</span>
                    </div>
                    {modelStorageInfo && (
                      <p className="text-[10px] text-white/30">
                        {modelStorageInfo.fileCount} cached files · Model: Llama-3.2-1B
                      </p>
                    )}
                  </div>

                /* STATE: Verifying cached model */
                ) : isVerifying || workerStatus === 'verifying' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-white/50">Verifying local model files...</p>
                    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-purple-500/10 border border-purple-500/20 detect-shimmer">
                      <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Loading from cache...</span>
                    </div>
                  </div>

                /* STATE: Downloading in progress */
                ) : workerStatus === 'loading' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-white/50">Downloading Second Brain...</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-medium text-white/40">
                        <span className="truncate max-w-[150px]">Fetching {workerStatusMessage || 'AI Components'}...</span>
                        <span>{Math.round(downloadProgress)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden progress-bar-container">
                        <div 
                          className="h-full progress-bar-fill rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30">~500MB · Will be stored in Browser Cache Storage</p>
                  </div>

                /* STATE: Not downloaded — show download + detect buttons */
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-white/50">Download the 500MB local brain to use SmartDoc without an internet connection.</p>
                    
                    {/* Download Button */}
                    <button
                      onClick={handleDownloadModel}
                      disabled={!isOnline}
                      className={`w-full py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border flex items-center justify-center gap-2 ${
                        isOnline ? 'border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400' : 'border-white/10 text-white/20 cursor-not-allowed'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Second Brain (~500MB)
                    </button>

                    {/* Manual Detect Button */}
                    <button
                      onClick={handleManualDetect}
                      className="w-full py-2 rounded-lg text-[10px] font-medium tracking-wide transition-all duration-300 border border-white/5 text-white/40 hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/5 flex items-center justify-center gap-2"
                    >
                      <FolderSearch className="w-3.5 h-3.5" />
                      Detect Existing Model
                    </button>

                    {/* Detection result message */}
                    {detectMessage === 'found' && (
                      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-green-500/10 border border-green-500/20 animate-fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-[10px] font-bold text-green-400">Model found in cache! Loading...</span>
                      </div>
                    )}
                    {detectMessage === 'not-found' && (
                      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-fade-in">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[10px] font-bold text-red-400">No cached model found. Please download first.</span>
                      </div>
                    )}

                    {/* Storage info */}
                    <div className="storage-badge flex items-center gap-2">
                      <HardDrive className="w-3 h-3" />
                      <span>Location: Browser Cache Storage (auto-managed)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Section */}
              {!uploadedFile ? (
                <div>
                  <p className="text-xs font-semibold tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                    UPLOAD DOCUMENT
                  </p>
                  <label
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-full py-10 rounded-xl cursor-pointer transition-all duration-300"
                    style={{
                      border: '2px dashed var(--border-primary)',
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--accent-glow)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    ) : (
                      <>
                        <div className="p-3 rounded-full mb-3" style={{ backgroundColor: 'var(--accent-glow)' }}>
                          <Upload className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          Click to upload
                        </span>
                        <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          PDF, DOCX, TXT, Images & more
                        </span>
                      </>
                    )}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}
                    accept=".pdf,.doc,.docx,.txt,.csv,.md,.json,.xml,.html,.htm,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.bmp,.tiff,.tif,.webp,.gif,.py,.js,.ts,.java,.c,.cpp,.css,.log"
                    onChange={handleUpload}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    ACTIVE DOCUMENT
                  </p>

                  {/* Document Card */}
                  <div
                    className="rounded-xl p-4 transition-all duration-300"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: documentReady ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid var(--border-primary)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{getFileIcon(uploadedFile.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {uploadedFile.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {formatFileSize(uploadedFile.size)}
                        </p>
                        {documentReady && (
                          <div className="flex items-center gap-1 mt-2 animate-fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                              Ready to chat
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Read Button */}
                    {!documentReady && !isReading && (
                      <button
                        onClick={handleRead}
                        className="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                        style={{
                          background: 'var(--accent-gradient)',
                          color: '#fff',
                          boxShadow: '0 4px 15px var(--accent-glow)',
                        }}
                        onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 25px var(--accent-glow)'; }}
                        onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px var(--accent-glow)'; }}
                      >
                        <BookOpen className="w-4 h-4" />
                        Read Document
                      </button>
                    )}

                    {/* Reading spinner */}
                    {isReading && (
                      <div className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-secondary)' }}
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Reading document...
                      </div>
                    )}

                    {/* Preview */}
                    {documentReady && readPreview && (
                      <div className="mt-3 p-3 rounded-lg text-xs leading-relaxed max-h-32 overflow-y-auto"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-primary)' }}
                      >
                        {readPreview}
                      </div>
                    )}
                  </div>

                  {/* Change Document */}
                  <button
                    onClick={handleChangeDocument}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                    style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Change Document
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── History View ── */
            <div className="space-y-2 animate-fade-in">
              {chatHistory.length === 0 ? (
                <div className="text-center py-10">
                  <History className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No history yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Chat history will appear here when you change documents</p>
                </div>
              ) : (
                chatHistory.map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => handleRestoreHistory(entry)}
                    className="w-full text-left p-3 rounded-xl transition-all duration-200"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-card)'; }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg mt-0.5">{getFileIcon(entry.docName)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {entry.docName}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {entry.messages.length} messages · {new Date(entry.timestamp).toLocaleDateString()}
                          {entry.docSize ? ` · ${formatFileSize(entry.docSize)}` : ''}
                        </p>
                        {/* Document Preview */}
                        {entry.readPreview && (
                          <div
                            className="mt-2 p-2 rounded-lg text-xs leading-relaxed"
                            style={{
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border-primary)',
                              color: 'var(--text-muted)',
                              maxHeight: '48px',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            📝 {entry.readPreview.substring(0, 120)}...
                          </div>
                        )}
                        {entry.messages.length > 0 && (
                          <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                            💬 "{String(entry.messages[entry.messages.length - 1]?.content || '').substring(0, 50)}..."
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 mt-1 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
          {/* History Button (Lifted) */}
          <button
            onClick={() => setSidebarView(sidebarView === 'history' ? 'main' : 'history')}
            className="flex items-center w-full p-2.5 rounded-lg transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <History className="w-4 h-4 mr-3" />
            <span className="font-medium text-sm">
              {sidebarView === 'history' ? 'Back to Upload' : (chatMode === 'offline' ? 'Offline History' : 'Online History')}
            </span>
            {chatHistory.length > 0 && sidebarView !== 'history' && (
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ 
                  backgroundColor: chatMode === 'offline' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                  color: chatMode === 'offline' ? '#a855f7' : '#3b82f6' 
                }}>
                {chatHistory.length}
              </span>
            )}
          </button>

          {/* New Sign In / Login Button (Bottom) */}
          {currentUser ? (
            <button
              onClick={() => { setIsSidebarOpen(false); setAuthForm({ ...currentUser, password: '' }); setShowProfileModal(true); setForgotStep(0); }}
              className="flex items-center w-full p-2.5 rounded-lg transition-all duration-200 mt-1"
              style={{ background: 'rgba(74, 222, 128, 0.1)', color: 'var(--success)', border: '1px solid rgba(74, 222, 128, 0.2)' }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] mr-2 overflow-hidden bg-cover bg-center" style={{ backgroundColor: 'var(--success)', color: '#fff', backgroundImage: currentUser.profilePhoto ? `url(${currentUser.profilePhoto})` : 'none' }}>
                {!currentUser.profilePhoto && currentUser.firstName[0]}
              </div>
              <span className="font-bold text-sm tracking-wide">Hi, {currentUser.firstName}</span>
            </button>
          ) : (
            <button
              onClick={() => { setIsSidebarOpen(false); setIsLoginMode(false); setForgotStep(0); setAuthForm({ firstName: '', lastName: '', age: '', contactMethod: '', password: '', profilePhoto: '' }); setShowAuthModal(true); }}
              className="flex items-center w-full p-2.5 rounded-lg transition-all duration-200 mt-1"
              style={{ 
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.1))',
                color: 'var(--text-primary)',
                border: '1px solid rgba(168, 85, 247, 0.2)'
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.2)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <LogIn className="w-4 h-4 mr-3" style={{ color: '#a855f7' }} />
              <span className="font-bold text-sm tracking-wide">Sign In / Login</span>
            </button>
          )}
        </div>
      </div>

      {/* ━━━ MAIN CONTENT ━━━ */}
      <div className="flex-1 flex flex-col h-full w-full relative" style={{ zIndex: 1 }}>

        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: hasMessages ? '1px solid var(--border-primary)' : 'none' }}>
          <div className="flex items-center gap-3">
            <button
              id="sidebar-toggle"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-secondary)'; }}
            >
              <Menu className="w-5 h-5" />
            </button>
            {hasMessages && uploadedFile && (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-sm">{getFileIcon(uploadedFile.name)}</span>
                <span className="text-xs font-medium truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
                  {uploadedFile.name}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Document Preview Toggle */}
            {hasMessages && uploadedFile && readPreview && (
              <button
                onClick={() => {
                  setDocPreviewOpen(prev => {
                    if (!prev) setBroadSearchOpen(false); // close broad search when opening preview
                    return !prev;
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 animate-fade-in"
                style={{
                  backgroundColor: docPreviewOpen ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-card)',
                  color: docPreviewOpen ? '#a855f7' : 'var(--text-secondary)',
                  border: docPreviewOpen ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border-primary)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  if (!docPreviewOpen) {
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                    e.currentTarget.style.color = '#a855f7';
                  }
                }}
                onMouseLeave={e => {
                  if (!docPreviewOpen) {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                title={docPreviewOpen ? 'Hide document preview' : 'Show document preview'}
              >
                {docPreviewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {docPreviewOpen ? 'Hide Preview' : 'Preview Doc'}
              </button>
            )}
            {hasMessages && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full animate-fade-in"
                style={{ backgroundColor: chatMode === 'offline' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)' }}>
                {chatMode === 'offline' ? <Brain className="w-3 h-3" style={{ color: '#a855f7' }} /> : <Globe className="w-3 h-3" style={{ color: '#3b82f6' }} />}
                <span className="text-xs font-medium" style={{ color: chatMode === 'offline' ? '#a855f7' : '#3b82f6' }}>
                  {chatMode === 'offline' ? 'Offline Search' : 'Online Search'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Landing / Chat Area ── */}
        {!hasMessages ? (
          /* ──── LANDING SCREEN ──── */
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
            <div className="w-full max-w-[680px] flex flex-col items-center" style={{ marginTop: '-5vh' }}>

              {/* Animated Logo */}
              <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--accent-gradient)', boxShadow: '0 0 40px var(--accent-glow)' }}>
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent-gradient-vibrant)' }}>
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>

              {/* Greeting */}
              <div className="text-center mb-8 animate-fade-in-up" style={{ animationDelay: '0.25s', opacity: 0 }}>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {getGreeting()}{currentUser ? <>, <span className="gradient-text">{currentUser.firstName}</span></> : ''}
                </h1>
                <p className="text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
                  Upload a document and ask me anything about it
                </p>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8 animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
                {!uploadedFile ? (
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-muted)' }}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    No document uploaded — open the menu to upload
                  </span>
                ) : !documentReady ? (
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                    style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)', color: 'var(--warning)' }}>
                    <FileText className="w-3.5 h-3.5" />
                    Document uploaded — press "Read Document" in the menu
                  </span>
                ) : (
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                    style={{ backgroundColor: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.2)', color: 'var(--success)' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {uploadedFile.name} is ready — ask your questions below!
                  </span>
                )}
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 animate-fade-in-up" style={{ animationDelay: '0.55s', opacity: 0 }}>
                {[
                  { icon: <Upload className="w-5 h-5" />, title: 'Multi-Format', desc: 'PDF, DOCX, Images & more' },
                  { icon: <BookOpen className="w-5 h-5" />, title: 'Smart Reading', desc: 'AI-powered text extraction' },
                  { icon: <MessageSquare className="w-5 h-5" />, title: 'Interactive Q&A', desc: 'Ask anything about your doc' },
                ].map((card, i) => (
                  <div key={i} className="p-4 rounded-xl text-center transition-all duration-300"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div className="flex justify-center mb-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-primary)' }}>
                        {card.icon}
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{card.title}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.desc}</p>
                  </div>
                ))}
              </div>

              {/* Input Box */}
              <div className="w-full animate-fade-in-up" style={{ animationDelay: '0.7s', opacity: 0 }}>
                <InputBox
                  inputText={inputText}
                  setInputText={setInputText}
                  handleSend={handleSend}
                  handleKeyDown={handleKeyDown}
                  documentReady={documentReady}
                  textareaRef={textareaRef}
                  isThinking={isThinking}
                  chatMode={chatMode}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ──── CHAT VIEW ──── */
          <>
            {/* Document expired notice */}
            {uploadedFile && !documentReady && (
              <div className="px-4 py-2 flex items-center justify-center gap-2 animate-fade-in"
                style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', borderBottom: '1px solid rgba(251, 191, 36, 0.2)' }}>
                <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>
                  Document expired from server memory — re-upload "{uploadedFile.name}" to continue asking questions
                </span>
              </div>
            )}

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-[760px] mx-auto space-y-6">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    question={msg.question}
                    msgType={msg.type}
                    onBroadSearch={handleBroadSearch}
                    isBroadSearching={isBroadSearching}
                  />
                ))}
                {isThinking && <ThinkingIndicator />}
              </div>
            </div>

            {/* Chat Input */}
            <div className="shrink-0 px-4 pb-4 pt-2">
              <div className="max-w-[760px] mx-auto">
                <InputBox
                  inputText={inputText}
                  setInputText={setInputText}
                  handleSend={handleSend}
                  handleKeyDown={handleKeyDown}
                  documentReady={documentReady}
                  textareaRef={textareaRef}
                  isThinking={isThinking}
                  chatMode={chatMode}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ━━━ RIGHT PANEL OVERLAY (shared by both panels) ━━━ */}
      {(broadSearchOpen || docPreviewOpen) && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }}
          onClick={() => { setBroadSearchOpen(false); setDocPreviewOpen(false); }}
        />
      )}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: '420px',
          maxWidth: '90vw',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          transform: broadSearchOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: broadSearchOpen ? '-10px 0 40px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
              <Globe className="w-4 h-4" style={{ color: '#3b82f6' }} />
            </div>
            <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
              BROAD SEARCH RESULTS
            </span>
          </div>
          <button
            onClick={() => setBroadSearchOpen(false)}
            className="p-2 rounded-lg transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-secondary)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Query display */}
        {broadSearchQuery && (
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>SEARCHING FOR</p>
            <p className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>"{broadSearchQuery}"</p>
          </div>
        )}

        {/* Results area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isBroadSearching ? (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: '#3b82f6' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Searching the web...</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Finding relevant information</p>
            </div>
          ) : broadSearchResults?.error ? (
            <div className="text-center py-16">
              <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--error)' }} />
              <p className="text-sm" style={{ color: 'var(--error)' }}>{broadSearchResults.error}</p>
            </div>
          ) : broadSearchResults ? (
            <div className="space-y-4 animate-fade-in">
              {/* AI Summary */}
              {broadSearchResults.aiSummary && (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                    <span className="text-xs font-bold tracking-wide" style={{ color: '#3b82f6' }}>AI SUMMARY (DOC + WEB)</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {broadSearchResults.aiSummary}
                  </p>
                </div>
              )}

              {/* Individual Results */}
              {broadSearchResults.results && broadSearchResults.results.length > 0 && (
                <>
                  <p className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-muted)' }}>WEB SOURCES</p>
                  {broadSearchResults.results.map((result, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3.5 transition-all duration-200"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
                    >
                      <p className="text-sm font-medium mb-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {result.title}
                      </p>
                      <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {result.snippet}
                      </p>
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs transition-colors"
                          style={{ color: '#3b82f6' }}
                          onMouseEnter={e => { e.target.style.color = '#60a5fa'; }}
                          onMouseLeave={e => { e.target.style.color = '#3b82f6'; }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Source
                        </a>
                      )}
                    </div>
                  ))}
                </>
              )}

              {(!broadSearchResults.results || broadSearchResults.results.length === 0) && !broadSearchResults.aiSummary && (
                <div className="text-center py-16">
                  <Globe className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No web results found for this query</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ━━━ DOCUMENT PREVIEW PANEL (Right Slide) ━━━ */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: '50vw',
          maxWidth: '90vw',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          transform: docPreviewOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: docPreviewOpen ? '-10px 0 40px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)' }}>
              <FileText className="w-4 h-4" style={{ color: '#a855f7' }} />
            </div>
            <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
              DOCUMENT PREVIEW
            </span>
          </div>
          <button
            onClick={() => setDocPreviewOpen(false)}
            className="p-2 rounded-lg transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-secondary)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Document info */}
        {uploadedFile && (
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{getFileIcon(uploadedFile.name)}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{uploadedFile.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {uploadedFile.size && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatFileSize(uploadedFile.size)}</span>
              )}
              {uploadedFile.type && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{uploadedFile.type}</span>
              )}
            </div>
          </div>
        )}

        {/* Document content */}
        <div className="flex-1 w-full h-full overflow-hidden flex flex-col relative bg-[var(--bg-primary)]">
          
          {/* Visual Document Viewer */}
          {uploadedFile ? (
            <div className="flex-1 w-full h-full relative">
                <LocalDocViewer uploadedFile={uploadedFile} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <FileText className="w-8 h-8 mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No document selected</p>
            </div>
          )}

          {/* Text preview removed by user request to maximize visual document viewer space */}
        </div>
      </div>

      {/* ━━━ DOCUMENT PREVIEW PANEL CHECK ━━━ */}

      {/* ━━━ USER AUTHENTICATION MODAL ━━━ */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center modal-overlay animate-fade-in"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="modal-content rounded-2xl p-7 w-full max-w-md mx-4 animate-fade-in-up"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(59, 130, 246, 0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)' }}>
                  {forgotStep > 0 ? <KeyRound className="w-5 h-5 text-white" /> : <LogIn className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                    {forgotStep === 1 ? 'Verify Identity' : forgotStep === 2 ? 'Reset Password' : isLoginMode ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {forgotStep === 1 ? 'Enter exact account details match' : forgotStep === 2 ? 'Create a new strong password' : isLoginMode ? 'Login to access your data' : 'Join SmartDoc to sync your data'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setShowAuthModal(false); setForgotStep(0); }}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              {forgotStep === 0 && !isLoginMode && (
                <>
                  <div className="flex flex-col items-center justify-center mb-5 relative">
                    <div className="w-20 h-20 rounded-full border-2 overflow-hidden flex items-center justify-center mb-3"
                         style={{ borderColor: 'var(--accent-primary)', backgroundColor: 'var(--bg-primary)', backgroundImage: authForm.profilePhoto ? `url(${authForm.profilePhoto})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                      {!authForm.profilePhoto && <UserCircle className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => document.getElementById('authPhotoUpload').click()} 
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform hover:scale-105"
                              style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        <Upload className="w-3.5 h-3.5" /> Upload File
                      </button>
                      
                      <button type="button" onClick={startCamera} 
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform hover:scale-105"
                              style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        <Camera className="w-3.5 h-3.5" /> WebCam
                      </button>
                    </div>

                    {/* Hidden Native File Input */}
                    <input id="authPhotoUpload" type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setAuthForm({...authForm, profilePhoto: reader.result});
                          reader.readAsDataURL(file);
                        }
                    }} />
                  </div>
                </>
              )}

              {/* Name Row (Used for Register && ForgotStep 1) */}
              {(forgotStep === 1 || (forgotStep === 0 && !isLoginMode)) && (
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>FIRST NAME</label>
                      <input type="text" required placeholder="John" 
                             value={authForm.firstName} onChange={e => setAuthForm({...authForm, firstName: e.target.value})}
                             className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                             style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                             onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                             onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>LAST NAME</label>
                      <input type="text" required placeholder="Doe" 
                             value={authForm.lastName} onChange={e => setAuthForm({...authForm, lastName: e.target.value})}
                             className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                             style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                             onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                             onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
                    </div>
                  </div>
              )}

              {/* Age (Used for Register ONLY) */}
              {forgotStep === 0 && !isLoginMode && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>AGE</label>
                    <input type="number" required placeholder="24" min="13" max="120"
                           value={authForm.age} onChange={e => setAuthForm({...authForm, age: e.target.value})}
                           className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                           style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                           onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                           onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
                  </div>
              )}

              {/* Email / Phone (Used anywhere EXCEPT ForgotStep 2) */}
              {forgotStep !== 2 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>EMAIL OR PHONE NUMBER</label>
                  <input type="text" required placeholder="john.doe@example.com" 
                         value={authForm.contactMethod} onChange={e => setAuthForm({...authForm, contactMethod: e.target.value})}
                         className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                         style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                         onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                         onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
                </div>
              )}

              {/* Password (Used anywhere EXCEPT ForgotStep 1 ) */}
              {forgotStep !== 1 && (
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    {forgotStep === 2 ? 'NEW CREATED PASSWORD' : (isLoginMode ? 'PASSWORD' : 'CREATE PASSWORD')}
                  </label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required placeholder="••••••••" minLength="8"
                           value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
                           className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 pr-10"
                           style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                           onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                           onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            title={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {(!isLoginMode || forgotStep === 2) && <PasswordStrengthMeter password={authForm.password} />}
                </div>
              )}

              {/* Forgot Password Link (Login Mode Only) */}
              {isLoginMode && forgotStep === 0 && (
                <div className="flex justify-end">
                  <button type="button" onClick={handleForgotPassword} className="text-[11px] font-bold transition-all duration-200 hover:underline" style={{ color: '#3b82f6' }}>
                    Forgot your password?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  style={{ background: forgotStep > 0 ? 'var(--accent-gradient-vibrant)' : 'linear-gradient(135deg, #a855f7, #3b82f6)', opacity: authLoading ? 0.7 : 1 }}
                  onMouseEnter={e => { if(!authLoading) { e.currentTarget.style.transform = 'translateY(-2px)' } }}
                  onMouseLeave={e => { if(!authLoading) { e.currentTarget.style.transform = 'translateY(0)' } }}
                >
                  {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {forgotStep === 1 ? 'Verify Identity' : forgotStep === 2 ? 'Save && Login' : isLoginMode ? 'Login' : 'Create Account'}
                </button>
                
                {forgotStep === 0 ? (
                  <div className="text-center">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => { setIsLoginMode(!isLoginMode); setShowPassword(false); setAuthForm({ firstName: '', lastName: '', age: '', contactMethod: '', password: '', profilePhoto: '' }); }}
                      className="ml-2 text-xs font-bold transition-colors"
                      style={{ color: '#3b82f6' }}
                    >
                      {isLoginMode ? 'Sign Up' : 'Login instead'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <button type="button" onClick={() => { setForgotStep(0); setAuthForm({ firstName: '', lastName: '', age: '', contactMethod: '', password: '', profilePhoto: '' }); setIsLoginMode(true); }} className="text-xs font-bold transition-colors" style={{ color: 'var(--text-muted)' }}>
                      ← Cancel and return to Login
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ USER PROFILE EDIT MODAL ━━━ */}
      {showProfileModal && currentUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center modal-overlay animate-fade-in"
             style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
             onClick={() => setShowProfileModal(false)}>
          <div className="modal-content rounded-2xl p-7 w-full max-w-md mx-4 animate-fade-in-up"
               style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Account Settings</h2>
              <button onClick={() => setShowProfileModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            
            <form className="space-y-4" onSubmit={handleProfileUpdate}>
               <div className="flex flex-col items-center justify-center mb-5 relative">
                 <div className="w-24 h-24 rounded-full border-2 overflow-hidden flex items-center justify-center mb-3"
                      style={{ borderColor: '#3b82f6', backgroundColor: 'var(--bg-primary)', backgroundImage: authForm.profilePhoto ? `url(${authForm.profilePhoto})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                   {!authForm.profilePhoto && <UserCircle className="w-12 h-12" style={{ color: 'var(--text-muted)' }} />}
                 </div>
                 
                 <div className="flex items-center gap-3">
                   <button type="button" onClick={() => document.getElementById('profilePhotoUpload').click()} 
                           className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform hover:scale-105"
                           style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                     <Upload className="w-3.5 h-3.5" /> Upload File
                   </button>
                   
                   <button type="button" onClick={startCamera} 
                           className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform hover:scale-105"
                           style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                     <Camera className="w-3.5 h-3.5" /> WebCam
                   </button>
                 </div>

                 <input id="profilePhotoUpload" type="file" accept="image/*" className="hidden" onChange={e => {
                     const file = e.target.files[0];
                     if (file) {
                       const reader = new FileReader();
                       reader.onloadend = () => setAuthForm({...authForm, profilePhoto: reader.result});
                       reader.readAsDataURL(file);
                     }
                 }} />
               </div>

               <div className="flex gap-4">
                 <div className="flex-1 space-y-1.5">
                   <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>FIRST NAME</label>
                   <input type="text" required value={authForm.firstName} onChange={e => setAuthForm({...authForm, firstName: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                          style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                          onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
                 </div>
                 <div className="flex-1 space-y-1.5">
                   <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>LAST NAME</label>
                   <input type="text" required value={authForm.lastName} onChange={e => setAuthForm({...authForm, lastName: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                          style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                          onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
                 </div>
               </div>
               
               <div className="space-y-1.5">
                   <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>AGE</label>
                   <input type="number" required value={authForm.age} onChange={e => setAuthForm({...authForm, age: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                          style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                          onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border-primary)'} />
               </div>

               <div className="space-y-1.5 opacity-50 relative" title="Email/Phone cannot be changed securely from this pane">
                   <label className="text-xs font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>EMAIL OR PHONE NUMBER</label>
                   <input type="text" disabled value={authForm.contactMethod} 
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none cursor-not-allowed"
                          style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
               </div>

               <div className="pt-4 flex justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
                 <button type="button" onClick={() => { handleLogout(); setShowProfileModal(false); }} 
                         className="px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200"
                         style={{ color: 'var(--error)', backgroundColor: 'rgba(248, 113, 113, 0.1)' }}
                         onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.2)' }}
                         onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.1)' }}>
                   Logout
                 </button>
                 <button type="submit" disabled={authLoading} 
                         className="px-6 py-2 rounded-lg text-sm font-bold text-white transition-all duration-200 shadow-md"
                         style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)', opacity: authLoading ? 0.7 : 1 }}
                         onMouseEnter={e => { if(!authLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 15px rgba(59, 130, 246, 0.3)'; } }}
                         onMouseLeave={e => { if(!authLoading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}>
                   {authLoading ? 'Saving...' : 'Save Changes'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ WEBCAM CAPTURE OVERLAY ━━━ */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)' }}>
           <div className="w-full max-w-md p-5 rounded-2xl relative shadow-2xl animate-fade-in-up" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <button onClick={closeCamera} className="absolute top-3 right-3 p-2 rounded-full transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                 <X className="w-5 h-5"/>
              </button>
              <h3 className="font-bold text-center mb-5 tracking-wide" style={{ color: 'var(--text-primary)' }}>Take a Profile Picture</h3>
              <div className="rounded-xl overflow-hidden flex justify-center mb-5" style={{ backgroundColor: '#000', border: '1px solid var(--border-primary)' }}>
                 <video ref={videoRef} autoPlay playsInline className="w-full h-auto max-h-[60vh] object-cover" />
              </div>
              <button onClick={capturePhoto} className="w-full py-3.5 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
                      style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)', boxShadow: '0 8px 20px rgba(168, 85, 247, 0.3)' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(168, 85, 247, 0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(168, 85, 247, 0.3)'; }}>
                 <Camera className="w-5 h-5" /> Capture Photo
              </button>
           </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* ━━━ DOWNLOAD CONFIRMATION MODAL ━━━ */}
      {showDownloadModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center modal-overlay"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowDownloadModal(false)}
        >
          <div
            className="modal-content rounded-2xl p-6 w-full max-w-md mx-4"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(168, 85, 247, 0.1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 0 40px rgba(168, 85, 247, 0.3)' }}
              >
                <Brain className="w-8 h-8 text-white brain-pulse" />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Download Second Brain?
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Enable full offline AI capabilities
              </p>
            </div>

            {/* Info Cards */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <Download className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#a855f7' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Download Size</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>~500MB will be downloaded from Hugging Face</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <HardDrive className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#818cf8' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Storage Location</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Browser Cache Storage (Origin Private) — auto-managed, persists across sessions</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#4ade80' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>After Download</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>The model will be auto-detected on every visit. No re-download needed!</p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDownload}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                  boxShadow: '0 4px 20px rgba(124, 92, 252, 0.4)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(124, 92, 252, 0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124, 92, 252, 0.4)'; }}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ COMPONENTS ═══════════════════════════ */

function PasswordStrengthMeter({ password }) {
  const criteria = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'Number (0-9)', met: /[0-9]/.test(password) },
    { label: 'Special character (!@#...)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    { label: 'No spaces', met: password.length > 0 && !/\s/.test(password) }
  ];

  const metCount = criteria.filter(c => c.met).length;
  
  let label = 'CREATE PASSWORD';
  let color = 'var(--text-muted)';
  if (password.length > 0) {
    if (metCount < 4) { label = 'WEAK PASSWORD'; color = '#ef4444'; /* bg-red-500 */ }
    else if (metCount < 6) { label = 'MEDIUM PASSWORD'; color = '#eab308'; /* bg-yellow-500 */ }
    else { label = 'STRONG PASSWORD'; color = '#22c55e'; /* bg-green-500 */ }
  }

  return (
    <div className="pt-2 animate-fade-in select-none">
      <div className="flex gap-1.5 mb-2.5">
        {[1, 2, 3, 4, 5, 6].map(level => {
           const isActive = password.length > 0 && level <= metCount;
           return (
             <div key={level} className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ backgroundColor: isActive ? color : 'var(--border-primary)' }} />
           );
        })}
      </div>
      <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color }}>{label}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        {criteria.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            {c.met ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#22c55e' }} /> : <div className="w-2.5 h-2.5 shrink-0 ml-0.5 mr-0.5 rounded-full border" style={{ borderColor: 'var(--text-muted)' }} />}
            <span className="text-[11px] truncate tracking-wide" style={{ color: c.met ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InputBox({ inputText, setInputText, handleSend, handleKeyDown, documentReady, textareaRef, isThinking, chatMode }) {
  // In online mode, input is always active (no doc = broad search)
  const isActive = chatMode === 'online' ? true : documentReady;

  const placeholder = chatMode === 'online'
    ? (documentReady ? 'Ask about your document...' : 'Ask anything — powered by Broad Search 🌐')
    : (documentReady ? 'Ask about your document...' : 'Upload a document first to use offline search');

  return (
    <div
      className="rounded-2xl transition-all duration-300"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        boxShadow: isActive ? '0 0 20px var(--accent-glow)' : 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
    >
      <form onSubmit={handleSend} className="flex flex-col">
        <textarea
          ref={textareaRef}
          value={inputText}
          disabled={!isActive || isThinking}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pt-4 px-5 pb-1 bg-transparent text-[15px] focus:outline-none resize-none"
          style={{
            color: 'var(--text-primary)',
            minHeight: '52px',
            maxHeight: '150px',
          }}
          rows={1}
        />
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full animate-fade-in"
                style={{
                  backgroundColor: chatMode === 'online'
                    ? (documentReady ? 'rgba(74, 222, 128, 0.08)' : 'rgba(59, 130, 246, 0.08)')
                    : 'rgba(74, 222, 128, 0.08)',
                  color: chatMode === 'online'
                    ? (documentReady ? 'var(--success)' : '#3b82f6')
                    : 'var(--success)',
                }}>
                <CheckCircle2 className="w-3 h-3" />
                {chatMode === 'online' ? (documentReady ? 'Ready' : 'Broad Search') : 'Ready'}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || !isActive || isThinking}
            className="p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
            style={{
              backgroundColor: inputText.trim() && isActive && !isThinking ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: inputText.trim() && isActive && !isThinking ? '#fff' : 'var(--text-muted)',
              cursor: inputText.trim() && isActive && !isThinking ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={e => {
              if (inputText.trim() && isActive && !isThinking) {
                e.target.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
          >
            {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatMessage({ role, content, question, msgType, onBroadSearch, isBroadSearching }) {
  const isUser = role === 'user';
  const isBroadSearch = msgType === 'broad-search';

  return (
    <div className={`flex gap-3 animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1"
          style={{ background: isBroadSearch ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'var(--accent-gradient)' }}>
          {isBroadSearch ? <Globe className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
        </div>
      )}
      <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
        {/* Broad Search heading */}
        {isBroadSearch && (
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <span className="text-[10px] font-bold tracking-widest" style={{ color: '#3b82f6' }}>BROAD SEARCH</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>— web + document</span>
          </div>
        )}
        <div
          className="rounded-2xl px-4 py-3 chat-message-content"
          style={{
            backgroundColor: isUser
              ? 'var(--accent-primary)'
              : isBroadSearch
                ? 'rgba(59, 130, 246, 0.06)'
                : 'var(--bg-card)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            border: isUser
              ? 'none'
              : isBroadSearch
                ? '1px solid rgba(59, 130, 246, 0.2)'
                : '1px solid var(--border-primary)',
            fontSize: '14px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </div>
        {/* Interaction buttons — on all assistant messages */}
        {!isUser && (
          <div className="mt-1.5 flex items-center gap-2">
            {question && onBroadSearch && (
              <button
                onClick={() => onBroadSearch(question)}
                disabled={isBroadSearching}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-primary)',
                  cursor: isBroadSearching ? 'wait' : 'pointer',
                  opacity: isBroadSearching ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (!isBroadSearching) {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.color = '#3b82f6';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                title="Search the web for more information about this question"
              >
                {isBroadSearching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Globe className="w-3 h-3" />
                )}
                Broad Search
              </button>
            )}

            {/* DOWNLOAD BUTTON */}
            <button
              onClick={async () => {
                const button = document.activeElement;
                if (button) button.style.pointerEvents = 'none'; // prevent double click
                
                try {
                  // 1. Create Beautiful "Textbook" HTML Layout
                  const htmlContainer = document.createElement('div');
                  htmlContainer.style.fontFamily = "'Georgia', serif";
                  htmlContainer.style.padding = '40px';
                  htmlContainer.style.color = '#1f2937';
                  htmlContainer.style.lineHeight = '1.8';
                  htmlContainer.style.fontSize = '12pt';
                  
                  // Clean Markdown formatting into HTML using Marked
                  const formattedContext = question ? marked.parse(question) : "<em>General Document Context</em>";
                  const formattedResponse = marked.parse(content);
                  
                  htmlContainer.innerHTML = `
                    <div style="text-align: center; border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px;">
                      <h1 style="font-family: 'Helvetica', sans-serif; font-size: 24pt; margin: 0; color: #111827;">SmartDoc Reference Guide</h1>
                      <p style="font-family: 'Helvetica', sans-serif; font-size: 10pt; color: #6b7280; font-style: italic;">Generated by SmartDoc AI Assistant</p>
                    </div>
                    
                    <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 15px 20px; margin-bottom: 30px;">
                      <h2 style="font-family: 'Helvetica', sans-serif; font-size: 14pt; margin-top: 0; color: #1e3a8a;">Question & Context</h2>
                      <div style="font-size: 11pt;">${formattedContext}</div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                      <h2 style="font-family: 'Helvetica', sans-serif; font-size: 16pt; margin-bottom: 15px; color: #111827;">AI Comprehensive Overview</h2>
                      <div style="text-align: justify; text-justify: inter-word;">
                        ${formattedResponse}
                      </div>
                    </div>
                    
                    <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; font-size: 9pt; color: #9ca3af; font-family: 'Helvetica', sans-serif;">
                      Document autonomously generated on ${new Date().toLocaleDateString()}
                    </div>
                  `;
                  
                  // 2. Generate the PDF Blob
                  const opt = {
                    margin:       10,
                    filename:     'SmartDoc_Response.pdf',
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true },
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                  };
                  
                  const pdfBlob = await html2pdf().set(opt).from(htmlContainer).outputPdf('blob');
                  
                  // 3. Ask System where to save using Native Save Dialog
                  let fileHandle;
                  try {
                    // Try the elegant File System Access API first
                    if (window.showSaveFilePicker) {
                      fileHandle = await window.showSaveFilePicker({
                        suggestedName: `SmartDoc_Response_${new Date().getTime()}.pdf`,
                        types: [{
                          description: 'PDF Document',
                          accept: { 'application/pdf': ['.pdf'] },
                        }],
                      });
                      const writable = await fileHandle.createWritable();
                      await writable.write(pdfBlob);
                      await writable.close();
                      if (button) button.style.pointerEvents = 'auto';
                      return; // Success!
                    }
                  } catch (err) {
                     // The user cancelled the dialog, just abort.
                     if (err.name === 'AbortError') {
                        if (button) button.style.pointerEvents = 'auto';
                        return;
                     }
                  }
                  
                  // 4. Fallback for older browsers (no custom location prompt)
                  const url = URL.createObjectURL(pdfBlob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `SmartDoc_Response_${new Date().getTime()}.pdf`;
                  a.style.display = 'none';
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, 1000);
                  
                } catch (error) {
                  console.error('PDF Generation Error:', error);
                  alert('There was an error generating the PDF.');
                } finally {
                  if (button) button.style.pointerEvents = 'auto';
                }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-primary)',
                cursor: 'pointer',
                opacity: 1,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                e.currentTarget.style.color = '#a855f7';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title="Download this response as a document"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1 text-xs font-bold"
          style={{ background: 'var(--accent-gradient-vibrant)', color: '#fff' }}>
          {USER_NAME[0]}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--accent-gradient)' }}>
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="rounded-2xl px-4 py-3"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: 'var(--accent-primary)',
                animation: `typing-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
