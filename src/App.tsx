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
const apiKey = process.env.GEMINI_API_KEY; 
const MODEL_NAME = "gemini-3-flash-preview";

const App = () => {
  const [level, setLevel] = useState('MTs');
  const [examType, setExamType] = useState('Asesmen Sumatif Akhir Semester');
  const [semester, setSemester] = useState('Ganjil');
  const [academicYear, setAcademicYear] = useState('2024/2025');
  const [institutionHeader, setInstitutionHeader] = useState('KEMENTERIAN AGAMA REPUBLIK INDONESIA');
  const [institutionName, setInstitutionName] = useState('MADRASAH DARUL HUDA');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('VII');
  const [examDay, setExamDay] = useState('');
  const [examDate, setExamDate] = useState('');
  const [logo, setLogo] = useState(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topics, setTopics] = useState({
    topic1: '',
    topic2: '',
    topic3: '',
    topic4: ''
  });
  const [counts, setCounts] = useState({
    pilihanGanda: 15,
    hots: 5,
    sedang: 5,
    salahBenar: 0,
    menjodohkan: 0,
    essay: 5
  });
  const [loading, setLoading] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (level === 'MTs') setGrade('VII');
    else setGrade('X');
  }, [level]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Ukuran gambar terlalu besar. Maksimal 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
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

    const systemPrompt = `Anda adalah pakar kurikulum dan pembuat soal ujian profesional untuk lingkungan Madrasah (Kementerian Agama RI). 
    Tugas Anda adalah membuat naskah soal yang berkualitas tinggi, valid, dan reliabel sesuai dengan standar Kurikulum Merdeka dan K-13.

    KRITERIA SOAL:
    1. Bahasa: Gunakan Bahasa Indonesia yang baku, formal, dan mudah dipahami.
    2. Konten: Harus relevan dengan materi ${topicsString} untuk jenjang ${level} kelas ${grade}.
    3. HOTS (Higher Order Thinking Skills): 
       - Harus memiliki stimulus (teks, gambar deskriptif, tabel data, atau kasus).
       - Mengukur kemampuan analisis (C4), evaluasi (C5), atau kreasi (C6).
       - Stimulus harus berfungsi (pertanyaan tidak bisa dijawab tanpa membaca stimulus).
    4. Pilihan Ganda:
       - Opsi jawaban harus homogen dan logis.
       - Hanya ada satu kunci jawaban yang benar.
       - Jenjang MA memiliki 5 opsi (A-E), MTs memiliki 4 opsi (A-D).
    5. Essay/Uraian: Pertanyaan harus membutuhkan jawaban deskriptif yang mendalam.

    FORMAT OUTPUT (JSON):
    {
      "kop": { 
        "lembaga": "${institutionHeader}", 
        "satuan_pendidikan": "${institutionName}", 
        "tahun_ajaran": "${academicYear}",
        "jenis_ujian": "${examType}",
        "semester": "${semester}"
      },
      "pilihan_ganda": [
        {
          "no": 1, 
          "tipe": "HOTS", 
          "stimulus": "Teks stimulus...", 
          "pertanyaan": "Pertanyaan...", 
          "opsi": {"a": "", "b": "", "c": "", "d": "" ${isMA ? ', "e": ""' : ''}}, 
          "kunci": "a"
        }
      ],
      "essay": [
        { "no": 1, "pertanyaan": "...", "kunci_pedoman": "..." }
      ]
    }

    PENTING: Hasilkan tepat ${counts.pilihanGanda} soal PG (${counts.hots} HOTS, ${counts.sedang} Sedang, sisanya LOTS) dan ${counts.essay} soal Essay.`;

    const userQuery = `Buatlah naskah soal ${examType} ${semester} untuk mata pelajaran ${subject} kelas ${grade} ${level}. Materi utama: ${topicsString}.`;

    const callApi = async (retryCount = 0) => {
      try {
        if (!apiKey) throw new Error("API Key tidak ditemukan di environment.");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
          })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'API Error');
        }
        
        const data = await response.json();
        const content = JSON.parse(data.candidates[0].content.parts[0].text);
        
        if (content.pilihan_ganda) {
          content.pilihan_ganda.sort((a: any, b: any) => a.no - b.no);
        }
        
        setGeneratedExam(content);
        setLoading(false);
      } catch (err: any) {
        console.error("Generation Error:", err);
        if (retryCount < 2) {
          const delay = Math.pow(2, retryCount) * 2000;
          setTimeout(() => callApi(retryCount + 1), delay);
        } else {
          setError(err.message || "Gagal menghasilkan soal. Silakan coba lagi.");
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
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-slate-50 tracking-tight">Madrasah Exam Studio</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Professional Production Grade</p>
        </div>
      </header>

      <div className="main-grid">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-3 h-3" /> Identitas Ujian
            </p>
            
            <div className="btn-toggle-group">
              <button onClick={() => setLevel('MTs')} className={`btn-toggle ${level === 'MTs' ? 'active' : ''}`}>MTs</button>
              <button onClick={() => setLevel('MA')} className={`btn-toggle ${level === 'MA' ? 'active' : ''}`}>MA</button>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/50 p-2 rounded-xl border border-slate-700">
              <div onClick={() => fileInputRef.current?.click()} className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors border border-slate-600">
                {logo ? <img src={logo} className="w-full h-full object-contain rounded" alt="Logo" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleLogoUpload} accept="image/*" />
              <div className="flex-1">
                <input
                    type="text"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className="w-full bg-transparent border-none text-[11px] font-bold text-slate-100 focus:ring-0 p-0"
                    placeholder="Nama Madrasah"
                />
                <input
                    type="text"
                    value={institutionHeader}
                    onChange={(e) => setInstitutionHeader(e.target.value)}
                    className="w-full bg-transparent border-none text-[9px] text-slate-400 focus:ring-0 p-0"
                    placeholder="Header Lembaga"
                />
              </div>
            </div>

            <select 
                value={examType} 
                onChange={(e) => setExamType(e.target.value)}
                className="input-field appearance-none cursor-pointer"
            >
                <option value="Asesmen Sumatif Akhir Semester">Asesmen Sumatif Akhir Semester (ASAS)</option>
                <option value="Asesmen Sumatif Tengah Semester">Asesmen Sumatif Tengah Semester (ASTS)</option>
                <option value="Ujian Madrasah">Ujian Madrasah (UM)</option>
                <option value="Try Out Ujian">Try Out Ujian</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input-field">
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                </select>
                <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="Tahun Ajaran" className="input-field" />
            </div>

            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mata Pelajaran" className="input-field font-bold" />
            
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={examDay} onChange={(e) => setExamDay(e.target.value)} placeholder="Hari" className="input-field" />
              <input type="text" value={examDate} onChange={(e) => setExamDate(e.target.value)} placeholder="Tanggal" className="input-field" />
            </div>

            <div className="space-y-1.5">
                {[1, 2, 3].map(n => (
                <input key={n} type="text" value={(topics as any)[`topic${n}`]} onChange={(e) => handleTopicChange(`topic${n}`, e.target.value)} placeholder={`Materi Utama ${n}`} className="input-field text-[11px]" />
                ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parameter Soal</p>
            <div className="stats-card">
              <div className="stat-row text-blue-400">
                <span>Total Pilihan Ganda</span>
                <input type="number" value={counts.pilihanGanda} onChange={(e) => setCounts({...counts, pilihanGanda: parseInt(e.target.value) || 0})} className="stat-input" />
              </div>
              <div className="stat-row text-amber-400">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Target HOTS</span>
                <input type="number" value={counts.hots} onChange={(e) => setCounts({...counts, hots: parseInt(e.target.value) || 0})} className="stat-input" />
              </div>
              <div className="stat-row text-emerald-400">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Target Sedang</span>
                <input type="number" value={counts.sedang} onChange={(e) => setCounts({...counts, sedang: parseInt(e.target.value) || 0})} className="stat-input" />
              </div>
              <div className="h-px bg-slate-700 my-1"></div>
              <div className="stat-row text-slate-300">
                <span>Jumlah Essay</span>
                <input type="number" value={counts.essay} onChange={(e) => setCounts({...counts, essay: parseInt(e.target.value) || 0})} className="stat-input" />
              </div>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={loading} className="btn-generate">
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            Generate Naskah Produksi
          </button>
          
          {error && <div className="text-red-400 text-[10px] p-2 bg-red-400/10 rounded border border-red-400/20 flex items-start gap-2">
            <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>}
        </div>

        {/* Preview Area */}
        <div className="preview-container">
          <div className="paper-content" id="exam-paper">
            {generatedExam ? (
              <>
                <div className="border-b-[4px] border-double border-black pb-3 mb-5 flex items-center gap-6 text-center">
                  {logo ? (
                    <img src={logo} className="w-20 h-20 object-contain" alt="Logo" />
                  ) : (
                    <div className="w-20 h-20 bg-slate-50 border-2 border-black flex items-center justify-center text-[9px] font-bold text-center p-2 leading-tight">
                      LOGO<br/>LEMBAGA
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="font-bold uppercase text-lg leading-tight tracking-tight">{generatedExam.kop.lembaga}</h2>
                    <h3 className="font-bold uppercase text-xl leading-tight">{generatedExam.kop.satuan_pendidikan}</h3>
                    <p className="text-[10px] font-medium mt-1">Alamat: Jl. Raya Pendidikan No. 123, Bondowoso, Jawa Timur</p>
                    <p className="text-[10px] italic">Email: info@madrasah.sch.id | Website: www.madrasah.sch.id</p>
                  </div>
                </div>

                <div className="text-center mb-6">
                    <h4 className="font-bold uppercase text-base underline decoration-2 underline-offset-4">{generatedExam.kop.jenis_ujian}</h4>
                    <p className="text-sm font-bold mt-1">SEMESTER {generatedExam.kop.semester.toUpperCase()} TAHUN PELAJARAN {generatedExam.kop.tahun_ajaran}</p>
                </div>

                <div className="grid grid-cols-2 text-[11px] mb-6 border-2 border-black p-3 bg-slate-50/50">
                  <div className="space-y-1">
                    <p className="flex gap-2"><span className="w-24 font-bold">Mata Pelajaran</span>: <span className="font-bold">{subject}</span></p>
                    <p className="flex gap-2"><span className="w-24 font-bold">Materi Utama</span>: <span>{Object.values(topics).filter(t => t).join(', ')}</span></p>
                    <p className="flex gap-2"><span className="w-24 font-bold">Hari / Tanggal</span>: <span>{examDay}, {examDate}</span></p>
                  </div>
                  <div className="space-y-1 pl-8 border-l border-black/20">
                    <p className="flex gap-2"><span className="w-24 font-bold">Tingkat / Kelas</span>: <span className="font-bold">{level} / {grade}</span></p>
                    <p className="flex gap-2"><span className="w-24 font-bold">Alokasi Waktu</span>: <span>90 Menit</span></p>
                    <p className="flex gap-2"><span className="w-24 font-bold">Kurikulum</span>: <span>Merdeka / K-13</span></p>
                  </div>
                </div>

                <div className="columns-2 gap-10 [column-rule:1px_solid_#000] text-justify">
                  <div className="mb-6 break-inside-avoid-column">
                    <div className="font-bold border-b-2 border-black mb-4 text-[13px] pb-1 uppercase flex justify-between items-center">
                        <span>I. PILIHAN GANDA</span>
                        <span className="text-[9px] font-normal italic">Pilihlah jawaban yang paling tepat!</span>
                    </div>
                    <div className="space-y-6">
                      {generatedExam.pilihan_ganda?.map((item: any, idx: number) => (
                        <div key={idx} className="question break-inside-avoid mb-6">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[8px] font-bold border border-black px-1.5 py-0.5 uppercase tracking-tighter">
                                {item.tipe || 'LOTS'}
                            </span>
                          </div>
                          
                          {item.stimulus && (
                            <div className="bg-slate-50 p-3 border border-black/10 border-l-4 border-l-black mb-3 italic text-[10.5px] leading-relaxed shadow-sm">
                              {item.stimulus}
                            </div>
                          )}

                          <div className="flex gap-2 text-[11.5px]">
                            <span className="font-bold min-w-[18px]">{item.no}.</span>
                            <div className="flex-1">
                              <p className="font-semibold leading-snug mb-2">{item.pertanyaan}</p>
                              <div className="flex flex-col gap-1 pl-1">
                                <p className="flex gap-2"><span>A.</span> <span>{item.opsi.a}</span></p>
                                <p className="flex gap-2"><span>B.</span> <span>{item.opsi.b}</span></p>
                                <p className="flex gap-2"><span>C.</span> <span>{item.opsi.c}</span></p>
                                <p className="flex gap-2"><span>D.</span> <span>{item.opsi.d}</span></p>
                                {item.opsi.e && <p className="flex gap-2"><span>E.</span> <span>{item.opsi.e}</span></p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {generatedExam.essay?.length > 0 && (
                    <div className="break-inside-avoid-column">
                      <div className="font-bold border-b-2 border-black mb-4 text-[13px] pb-1 uppercase">II. URAIAN / ESSAY</div>
                      <div className="space-y-5">
                        {generatedExam.essay.map((it: any, i: number) => (
                          <div key={i} className="flex gap-2 text-[11.5px] break-inside-avoid mb-4">
                            <span className="font-bold min-w-[18px]">{i+1}.</span>
                            <div className="flex-1">
                                <p className="font-semibold leading-snug">{it.pertanyaan}</p>
                                <div className="mt-4 border-b border-dotted border-black/30 h-4 w-full"></div>
                                <div className="mt-4 border-b border-dotted border-black/30 h-4 w-full"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-12 pt-8 border-t border-black/10 flex justify-between text-[11px] italic break-inside-avoid">
                    <div className="text-center w-48">
                        <p>Mengetahui,</p>
                        <p>Kepala Madrasah</p>
                        <div className="h-20"></div>
                        <p className="font-bold underline">( __________________________ )</p>
                        <p>NIP. ..........................................</p>
                    </div>
                    <div className="text-center w-48">
                        <p>Bondowoso, {examDate || '....................'}</p>
                        <p>Guru Mata Pelajaran</p>
                        <div className="h-20"></div>
                        <p className="font-bold underline">( __________________________ )</p>
                        <p>NIP. ..........................................</p>
                    </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <div className="bg-slate-50 p-8 rounded-full mb-6">
                    <FileText className="w-24 h-24 opacity-20" />
                </div>
                <h3 className="text-xl font-bold text-slate-400">Siap Produksi Naskah</h3>
                <p className="text-sm text-slate-400 mt-2 max-w-xs text-center">Silakan lengkapi konfigurasi di samping untuk menghasilkan naskah soal profesional standar Kemenag.</p>
              </div>
            )}
          </div>
          
          {generatedExam && (
            <div className="absolute bottom-8 right-8 flex gap-3">
                <button 
                  onClick={() => window.print()} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-xl hover:scale-105 active:scale-95"
                >
                  <Printer className="w-5 h-5" />
                  Cetak / Simpan PDF
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
