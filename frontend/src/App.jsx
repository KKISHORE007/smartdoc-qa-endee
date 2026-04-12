import { useState } from 'react';
import { 
  Code2, GraduationCap, PenLine, Briefcase, Sparkles, Plus, 
  ChevronDown, Mic, Menu, Upload, History, FileText, Trash2 
} from 'lucide-react';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [inputText, setInputText] = useState("");

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file.name);
      setIsSidebarOpen(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !uploadedFile) return;
    // mock logic, same as before, user wants the landing page specifically
    setInputText("");
  };

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-[#aaaaaa] font-sans selection:bg-[#D4735A] selection:text-white overflow-hidden relative">
      
      {/* HAMBURGER SHELL */}
      <div className="absolute top-0 left-0 p-4 z-20">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-[#888888] hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* CLAUDE STYLE SIDEBAR (Retained functionality from earlier) */}
      <div 
        className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        fixed top-0 left-0 h-full z-50 w-[280px] bg-[#222222] border-r border-[#3a3a3a] transition-transform duration-300 ease-in-out flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between">
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors text-[#888888] hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-6 flex-1 overflow-y-auto">
          {uploadedFile ? (
             <div className="group relative bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl p-4 transition-all">
               <p className="text-[12px] text-[#888888] font-medium mb-3">ACTIVE DOCUMENT</p>
               <div className="flex items-start">
                 <FileText className="w-5 h-5 text-[#D4735A] mr-3 mt-0.5 shrink-0" />
                 <span className="text-[14px] text-white leading-snug break-words pr-6">{uploadedFile}</span>
               </div>
               <button 
                 onClick={() => setUploadedFile(null)}
                 className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#888] hover:text-[#F87171] bg-[#2a2a2a] rounded-md transition-all opacity-0 group-hover:opacity-100"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>
          ) : (
            <div>
              <p className="text-[12px] text-[#888888] font-medium mb-3">UPLOAD A PDF</p>
              <label className="flex flex-col items-center justify-center w-full py-10 rounded-xl border border-dashed border-[#444444] hover:border-[#D4735A] hover:bg-[#2a2a2a] cursor-pointer transition-all bg-transparent">
                <Upload className="w-6 h-6 text-[#777] mb-3" />
                <span className="text-[14px] text-white font-medium">Click to upload</span>
              </label>
              <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#3a3a3a]">
           <button className="flex items-center w-full p-2.5 hover:bg-[#2a2a2a] rounded-lg transition-colors text-[#888888] hover:text-white">
              <History className="w-4 h-4 mr-3" />
              <span className="font-medium text-[14px]">View History</span>
           </button>
        </div>
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setIsSidebarOpen(false)} />}


      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col items-center justify-center w-full h-full relative" style={{ zIndex: 1 }}>
        <div className="w-full max-w-[650px] flex flex-col items-center justify-center px-4 -mt-10">
          
          {/* Top badge */}
          <div className="flex items-center space-x-1 mb-[40px]">
            <span className="flex items-center bg-[#2a2a2a] border border-[#3a3a3a] text-[#aaaaaa] text-[13px] rounded-full px-[14px] py-[4px]">
              Free plan<span className="mx-2 text-[#555]">·</span>
              <a href="#" className="hover:text-white transition-colors">Upgrade</a>
            </span>
          </div>

          {/* Heading */}
          <div className="flex items-center justify-center mb-8">
            <svg viewBox="0 0 100 100" className="w-[34px] h-[34px] mr-3" style={{ fill: '#D4735A' }}>
               <path d="M50 0L54 36L90 14L66 43L100 50L66 57L90 86L54 64L50 100L46 64L10 86L34 57L0 50L34 43L10 14L46 36L50 0Z" />
            </svg>
            <h1 className="text-[42px] font-400 text-white font-serif-claude tracking-tight leading-none pt-1">
              KISHORE K returns!
            </h1>
          </div>

          {/* Input Box */}
          <div className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-[16px] shadow-sm focus-within:border-[#555555] transition-colors relative flex flex-col">
            <form onSubmit={handleSend} className="w-full h-full flex flex-col">
              <textarea 
                value={inputText}
                disabled={!uploadedFile}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={uploadedFile ? `Ask about ${uploadedFile}...` : "How can I help you today?"}
                className="w-full pt-[20px] px-[20px] pb-0 bg-transparent text-white text-[16px] focus:outline-none resize-none h-[80px]"
              />
              
              {/* Bottom bar inside input */}
              <div className="flex items-center justify-between px-[20px] pb-[14px]">
                {/* Left side */}
                <div>
                  <button type="button" className="p-1 text-[#888888] hover:bg-[#333333] hover:text-[#bbbbbb] rounded-full transition-colors flex items-center justify-center">
                    <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
                  </button>
                </div>
                
                {/* Right side */}
                <div className="flex items-center space-x-1">
                   <button type="button" className="flex items-center text-[13px] text-[#888888] font-medium hover:text-[#bbbbbb] hover:bg-[#333333] px-2 py-1 rounded transition-colors">
                     Sonnet 4.6 <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />
                   </button>
                   <button type="button" className="p-1.5 text-[#888888] hover:bg-[#333333] hover:text-[#bbbbbb] rounded transition-colors flex items-center justify-center">
                     <Mic className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </form>
          </div>

          {/* Quick action pills */}
          <div className="flex items-center justify-center space-x-[8px] mt-[16px] w-full flex-wrap gap-y-2">
            
            <button className="flex items-center bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#aaaaaa] hover:text-[#cccccc] text-[13px] rounded-full px-[16px] py-[7px] transition-colors">
              <Code2 className="w-3.5 h-3.5 mr-2 stroke-[2.5]" />
              &lt;/&gt; Code
            </button>
            
            <button className="flex items-center bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#aaaaaa] hover:text-[#cccccc] text-[13px] rounded-full px-[16px] py-[7px] transition-colors">
              <GraduationCap className="w-3.5 h-3.5 mr-2 stroke-[2.5]" />
              Learn
            </button>
            
            <button className="flex items-center bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#aaaaaa] hover:text-[#cccccc] text-[13px] rounded-full px-[16px] py-[7px] transition-colors">
              <PenLine className="w-3.5 h-3.5 mr-2 stroke-[2.5]" />
              Write
            </button>

            <button className="flex items-center bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#aaaaaa] hover:text-[#cccccc] text-[13px] rounded-full px-[16px] py-[7px] transition-colors">
              <Briefcase className="w-3.5 h-3.5 mr-2 stroke-[2.5]" />
              Life stuff
            </button>

            <button className="flex items-center bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#333333] text-[#aaaaaa] hover:text-[#cccccc] text-[13px] rounded-full px-[16px] py-[7px] transition-colors">
              <Sparkles className="w-3.5 h-3.5 mr-2 stroke-[2.5]" />
              Claude's choice
            </button>
            
          </div>

        </div>
      </div>

    </div>
  );
}

export default App;
