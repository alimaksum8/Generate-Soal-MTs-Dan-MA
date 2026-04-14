import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  FileText, 
  Settings, 
  Download, 
  Sparkles, 
  School, 
  CheckCircle, 
  XCircle, 
  Layers,
  HelpCircle,
  Loader2,
  ChevronDown,
  Calendar,
  BookOpen,
  Printer,
  Image as ImageIcon,
  Upload,
  Building,
  Clock,
  Zap,
  Activity
} from 'lucide-react';

// --- API Configuration ---
const apiKey = ""; // Provided by environment
const MODEL_NAME = "gemini-3-flash-preview";

const App = () => {
  const [level, setLevel] = useState('MTs');
  const [academicYear, setAcademicYear] = useState('2024/2025');
  const [institutionHeader, setInstitutionHeader] = useState('KEMENTERIAN AGAMA REPUBLIK INDONESIA');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('VII');
  const [examDay, setExamDay] = useState('');
  const [examDate, setExamDate] = useState('');
  const [logo, setLogo] = useState(null);
  const fileInputRef = useRef(null);
  const [topics, setTopics] = useState({
    topic1: '',
    topic2: '',
    topic3: '',
    topic4: ''
  });
  const [counts, setCounts] = useState({
    pilihanGanda: 10,
    hots: 3,
    sedang: 3,
    salahBenar: 5,
    menjodohkan: 5,
    essay: 2
  });
  const [loading, setLoading] = useState(false);
  const [generatedExam, setGeneratedExam] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (level === 'MTs') setGrade('VII');
    else setGrade('X');
  }, [level]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Ukuran gambar terlalu besar. Maksimal 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    const activeTopics = Object.values(topics).filter((t): t is string => typeof t === 'string' && t.trim() !== '');
    
    if (!subject || activeTopics.length === 0) {
      setError("Mohon isi Mata Pelajaran dan minimal satu Materi.");
      return;
    }

    if (counts.hots + counts.sedang > counts.pilihanGanda) {
      setError("Jumlah soal HOTS + Sedang tidak boleh melebihi total Pilihan Ganda.");
      return;
    }

    setLoading(true);
    setError(null);

    const topicsString = activeTopics.join(', ');
    const isMA = level === 'MA';

    const systemPrompt = `Anda adalah pakar pembuat soal ujian madrasah (Kemenag).
    Buatlah soal dalam format JSON.
    
    Aturan Khusus Pilihan Ganda:
    - Total Soal PG: ${counts.pilihanGanda}
    - Jumlah soal HOTS: ${counts.hots} (HARUS memiliki "stimulus" berupa teks/kasus/data sebelum pertanyaan).
    - Jumlah soal SEDANG: ${counts.sedang}
    - Sisanya (${counts.pilihanGanda - counts.hots - counts.sedang}) adalah soal LOTS/Mudah.
    
    Penomoran:
    - Tentukan secara ACAK nomor mana saja yang menjadi HOTS, SEDANG, dan Sisanya dari rentang 1 sampai ${counts.pilihanGanda}.
    
    Struktur JSON:
    {
      "kop": { "lembaga": "${institutionHeader}", "satuan_pendidikan": "${level === 'MTs' ? 'MADRASAH TSANAWIYAH' : 'MADRASAH ALIYAH'} DARUL HUDA", "tahun_ajaran": "${academicYear}" },
      "pilihan_ganda": [
        {
          "no": 1, 
          "tipe": "HOTS", 
          "stimulus": "Teks pengantar soal hots...", 
          "pertanyaan": "...", 
          "opsi": {"a": "", "b": "", "c": "", "d": "" ${isMA ? ', "e": ""' : ''}}, 
          "kunci": ""
        }
      ],
      "salah_benar": [...],
      "menjodohkan": [...],
      "essay": [...]
    }`;

    const userQuery = `Hasilkan ${counts.pilihanGanda} soal PG (${counts.hots} HOTS dengan stimulus, ${counts.sedang} Sedang) untuk ${level} ${grade} mapel ${subject}. Materi: ${topicsString}.`;

    const callApi = async (retryCount = 0) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json", temperature: 0.8 }
          })
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const content = JSON.parse(data.candidates[0].content.parts[0].text);
        
        if (content.pilihan_ganda) {
          content.pilihan_ganda.sort((a, b) => a.no - b.no);
        }
        
        setGeneratedExam(content);
        setLoading(false);
      } catch (err) {
        if (retryCount < 5) {
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => callApi(retryCount + 1), delay);
        } else {
          setError("Gagal menghasilkan soal. Silakan coba lagi.");
          setLoading(false);
        }
      }
    };

    callApi();
  };

  const handleTopicChange = (key: string, value: string) => {
    setTopics(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="app-container">
      <header className="flex items-center justify-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-slate-50">Generator Soal Madrasah</h1>
      </header>

      <div className="main-grid">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-400" /> Konfigurasi
            </p>
            
            <div className="btn-toggle-group">
              <button 
                onClick={() => setLevel('MTs')} 
                className={`btn-toggle ${level === 'MTs' ? 'active' : ''}`}
              >
                MTs
              </button>
              <button 
                onClick={() => setLevel('MA')} 
                className={`btn-toggle ${level === 'MA' ? 'active' : ''}`}
              >
                MA
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/50 p-2 rounded-xl border border-slate-700">
              <div 
                onClick={() => fileInputRef.current?.click()} 
                className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors"
              >
                {logo ? <img src={logo} className="w-full h-full object-contain rounded" alt="Logo" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleLogoUpload} />
              <input
                type="text"
                value={institutionHeader}
                onChange={(e) => setInstitutionHeader(e.target.value)}
                className="flex-1 bg-transparent border-none text-[11px] text-slate-300 focus:ring-0 p-0"
                placeholder="Header Lembaga"
              />
            </div>

            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Mata Pelajaran"
              className="input-field"
            />
            
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="text" 
                value={examDay} 
                onChange={(e) => setExamDay(e.target.value)} 
                placeholder="Hari" 
                className="input-field" 
              />
              <input 
                type="text" 
                value={examDate} 
                onChange={(e) => setExamDate(e.target.value)} 
                placeholder="Tanggal" 
                className="input-field" 
              />
            </div>

            {[1, 2].map(n => (
              <input 
                key={n} 
                type="text" 
                value={(topics as any)[`topic${n}`]} 
                onChange={(e) => handleTopicChange(`topic${n}`, e.target.value)} 
                placeholder={`Materi ${n}`} 
                className="input-field" 
              />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-100">Parameter Soal</p>
            <div className="stats-card">
              <div className="stat-row text-blue-400">
                <span>Total PG</span>
                <input 
                  type="number" 
                  value={counts.pilihanGanda} 
                  onChange={(e) => setCounts({...counts, pilihanGanda: parseInt(e.target.value) || 0})} 
                  className="stat-input" 
                />
              </div>
              <div className="stat-row text-amber-400">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Jml HOTS</span>
                <input 
                  type="number" 
                  value={counts.hots} 
                  onChange={(e) => setCounts({...counts, hots: parseInt(e.target.value) || 0})} 
                  className="stat-input" 
                />
              </div>
              <div className="stat-row text-emerald-400">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Jml Sedang</span>
                <input 
                  type="number" 
                  value={counts.sedang} 
                  onChange={(e) => setCounts({...counts, sedang: parseInt(e.target.value) || 0})} 
                  className="stat-input" 
                />
              </div>
              
              <div className="h-px bg-slate-700 my-1"></div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] text-slate-500 text-center uppercase">S/B</label>
                  <input 
                    type="number" 
                    value={counts.salahBenar} 
                    onChange={(e) => setCounts({...counts, salahBenar: parseInt(e.target.value) || 0})} 
                    className="stat-input w-full" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] text-slate-500 text-center uppercase">Essay</label>
                  <input 
                    type="number" 
                    value={counts.essay} 
                    onChange={(e) => setCounts({...counts, essay: parseInt(e.target.value) || 0})} 
                    className="stat-input w-full" 
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-generate"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            Generate Soal
          </button>
          
          {error && <p className="text-red-400 text-[10px] text-center bg-red-400/10 py-1 rounded border border-red-400/20">{error}</p>}
        </div>

        {/* Preview Area */}
        <div className="preview-container">
          <div className="paper-content" id="exam-paper">
            {generatedExam ? (
              <>
                <div className="border-b-[3px] border-double border-black pb-3 mb-5 flex items-center gap-4 text-center">
                  {logo ? (
                    <img src={logo} className="w-16 h-16 object-contain" alt="Logo" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 border border-black flex items-center justify-center text-[8px] text-center p-1">
                      LOGO KEMENAG
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="font-bold uppercase text-base leading-tight">{generatedExam.kop.lembaga}</h2>
                    <h3 className="font-bold uppercase text-lg leading-tight">{generatedExam.kop.satuan_pendidikan}</h3>
                    <p className="text-[10px] italic">Bondowoso, Jawa Timur, Indonesia</p>
                    <p className="text-sm font-bold mt-1">TAHUN PELAJARAN {generatedExam.kop.tahun_ajaran}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 text-[11px] mb-5 border border-black p-2">
                  <div className="space-y-0.5">
                    <p><strong>Mata Pelajaran:</strong> {subject}</p>
                    <p><strong>Materi:</strong> {Object.values(topics).filter(t => t).join(', ')}</p>
                    <p><strong>Hari:</strong> {examDay}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p><strong>Tingkat/Kelas:</strong> {level}/{grade}</p>
                    <p><strong>Tanggal:</strong> {examDate}</p>
                    <p><strong>Waktu:</strong> 90 Menit</p>
                  </div>
                </div>

                <div className="columns-2 gap-8 [column-rule:1px_solid_#eee] print:[column-rule:1px_solid_#000]">
                  <div className="mb-6 break-inside-avoid-column">
                    <div className="font-bold border-b border-black mb-3 text-[12px] pb-0.5 uppercase">I. PILIHAN GANDA</div>
                    <div className="space-y-4">
                      {generatedExam.pilihan_ganda?.map((item: any, idx: number) => (
                        <div key={idx} className="question break-inside-avoid mb-4">
                          <div className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono mb-1.5 inline-block border border-slate-200 print:bg-transparent print:border-slate-300">
                            No. {item.no} | {item.tipe || 'SEDANG'}
                          </div>
                          
                          {item.stimulus && (
                            <div className="bg-slate-50 p-2 border-l-2 border-black mb-2 italic text-[10px] leading-relaxed print:bg-transparent">
                              {item.stimulus}
                            </div>
                          )}

                          <div className="flex gap-2 text-[11px]">
                            <span className="font-bold">{item.no}.</span>
                            <div className="flex-1">
                              <p className="font-medium leading-tight">{item.pertanyaan}</p>
                              <div className="flex flex-col gap-0.5 mt-1.5 pl-2">
                                <p>a. {item.opsi.a}</p>
                                <p>b. {item.opsi.b}</p>
                                <p>c. {item.opsi.c}</p>
                                <p>d. {item.opsi.d}</p>
                                {item.opsi.e && <p>e. {item.opsi.e}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {generatedExam.essay?.length > 0 && (
                    <div className="break-inside-avoid-column">
                      <div className="font-bold border-b border-black mb-3 text-[12px] pb-0.5 uppercase">II. URAIAN</div>
                      <div className="space-y-3">
                        {generatedExam.essay.map((it: any, i: number) => (
                          <div key={i} className="flex gap-2 text-[11px] break-inside-avoid mb-2">
                            <span className="font-bold">{i+1}.</span>
                            <p className="leading-tight">{it.pertanyaan}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <FileText className="w-20 h-20 opacity-10 mb-4" />
                <p className="font-bold text-slate-400">Belum Ada Data</p>
                <p className="text-xs text-slate-400 mt-1">Isi konfigurasi dan klik Generate</p>
              </div>
            )}
          </div>
          
          {generatedExam && (
            <button 
              onClick={() => window.print()} 
              className="print-badge"
            >
              <Printer className="w-4 h-4" />
              Cetak Naskah Soal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
