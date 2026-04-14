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
  Activity,
  Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- API Configuration ---
const apiKey = process.env.GEMINI_API_KEY; 
const MODEL_NAME = "gemini-3-flash-preview";

const App = () => {
  const [level, setLevel] = useState('MTs');
  const [academicYear, setAcademicYear] = useState('2024/2025');
  const [institutionHeader, setInstitutionHeader] = useState('KEMENTERIAN AGAMA REPUBLIK INDONESIA');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
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
    pilihanGanda: 10,
    hots: 3,
    sedang: 3,
    salahBenar: 5,
    menjodohkan: 5,
    essay: 2
  });
  const [enabledTypes, setEnabledTypes] = useState({
    pilihanGanda: true,
    salahBenar: true,
    menjodohkan: true,
    essay: true
  });
  const [loading, setLoading] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGrade('');
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
    const hasEnabledType = Object.values(enabledTypes).some(v => v);
    
    if (!subject || activeTopics.length === 0 || !grade) {
      setError("Mohon isi Mata Pelajaran, Kelas, dan minimal satu Materi.");
      return;
    }

    if (!hasEnabledType) {
      setError("Mohon pilih minimal satu jenis soal (PG, S/B, Jodoh, atau Essay).");
      return;
    }

    setLoading(true);
    setError(null);

    const topicsString = activeTopics.join(', ');
    const isMA = level === 'MA';

    let outputFormat = `{
      "kop": { 
        "lembaga": "${institutionHeader}", 
        "tahun_ajaran": "${academicYear}"
      }`;

    if (enabledTypes.pilihanGanda) {
      outputFormat += `,
      "pilihan_ganda": [
        {
          "no": 1, 
          "tipe": "HOTS", 
          "stimulus": "...", 
          "pertanyaan": "...", 
          "opsi": {"a": "", "b": "", "c": "", "d": "" ${isMA ? ', "e": ""' : ''}}, 
          "kunci": "a"
        }
      ]`;
    }

    if (enabledTypes.salahBenar) {
      outputFormat += `,
      "salah_benar": [
        { "no": 1, "tipe": "Dasar/Sedang/HOTS", "pertanyaan": "...", "kunci": "Benar" }
      ]`;
    }

    if (enabledTypes.menjodohkan) {
      outputFormat += `,
      "menjodohkan": {
        "soal": [
          { "no": 1, "tipe": "Dasar/Sedang/HOTS", "pertanyaan": "...", "kunci": "..." }
        ],
        "pilihan_jawaban": ["...", "...", "..."]
      }`;
    }

    if (enabledTypes.essay) {
      outputFormat += `,
      "essay": [
        { "no": 1, "tipe": "Dasar/Sedang/HOTS", "pertanyaan": "..." }
      ]`;
    }

    outputFormat += `,
      "kisi_kisi": [
        { "no": 1, "materi": "...", "indikator": "...", "level_kognitif": "...", "bentuk_soal": "Pilihan Ganda/Salah Benar/Menjodohkan/Essay" }
      ],
      "kunci_jawaban_lengkap": {
        "pg": "1.A, 2.B, ...",
        "sb": "1.Benar, 2.Salah, ...",
        "jodoh": "1-A, 2-C, ...",
        "essay": "1. Jawaban essay..., 2. Jawaban essay..."
      }
    }`;

    let criteria = `
    KRITERIA SOAL:
    1. Bahasa: Gunakan Bahasa Indonesia yang baku, formal, dan mudah dipahami.
    2. Konten: Harus relevan dengan materi ${topicsString} untuk jenjang ${level} kelas ${grade}.
    3. HOTS (Higher Order Thinking Skills): Harus memiliki stimulus (teks/kasus/data) dan mengukur kemampuan analisis/evaluasi.
    4. Pilihan Ganda: Jenjang MA memiliki 5 opsi (A-E), MTs memiliki 4 opsi (A-D).`;

    let countsText = `PENTING: `;
    const countsParts = [];
    if (enabledTypes.pilihanGanda) countsParts.push(`Hasilkan tepat ${counts.pilihanGanda} soal PG (${counts.hots} HOTS, ${counts.sedang} Sedang)`);
    if (enabledTypes.salahBenar) countsParts.push(`${counts.salahBenar} soal Salah/Benar`);
    if (enabledTypes.menjodohkan) countsParts.push(`${counts.menjodohkan} soal Menjodohkan`);
    if (enabledTypes.essay) countsParts.push(`${counts.essay} soal Essay`);
    
    countsText += countsParts.join(', ') + '.';

    const systemPrompt = `Anda adalah pakar kurikulum dan pembuat soal ujian profesional untuk lingkungan Madrasah (Kementerian Agama RI). 
    Tugas Anda adalah membuat naskah soal, kisi-kisi, dan kunci jawaban yang berkualitas tinggi, valid, dan reliabel sesuai dengan standar Kurikulum Merdeka dan K-13.

    ${criteria}

    PENTING: Penempatan soal HOTS dan Sedang harus diacak nomornya (jangan dikelompokkan di awal atau di akhir). Sebarkan tingkat kesulitan secara merata di seluruh nomor soal.

    FORMAT OUTPUT (JSON):
    ${outputFormat}

    ${countsText}. 
    PENTING: Buatlah Kisi-kisi soal yang mencakup SEMUA butir soal yang dibuat (Pilihan Ganda, Salah/Benar, Menjodohkan, dan Essay) dengan nomor urut yang sesuai. Kunci jawaban harus lengkap untuk semua bagian.`;

    const userQuery = `Buatlah naskah soal ujian untuk mata pelajaran ${subject} kelas ${grade} ${level}. Materi utama: ${topicsString}.`;

    const callApi = async (retryCount = 0) => {
      try {
        if (!apiKey) throw new Error("API Key tidak ditemukan.");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
          })
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const content = JSON.parse(data.candidates[0].content.parts[0].text);
        
        if (content.pilihan_ganda) content.pilihan_ganda.sort((a: any, b: any) => a.no - b.no);
        if (content.salah_benar) content.salah_benar.sort((a: any, b: any) => a.no - b.no);
        if (content.menjodohkan?.soal) content.menjodohkan.soal.sort((a: any, b: any) => a.no - b.no);
        if (content.essay) content.essay.sort((a: any, b: any) => a.no - b.no);
        if (content.kisi_kisi) content.kisi_kisi.sort((a: any, b: any) => a.no - b.no);
        setGeneratedExam(content);
        setLoading(false);
      } catch (err: any) {
        if (retryCount < 2) {
          setTimeout(() => callApi(retryCount + 1), 2000);
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

  const renderOptions = (opsi: any) => {
    const options = Object.entries(opsi)
      .filter(([key, val]) => val && ['a', 'b', 'c', 'd', 'e'].includes(key))
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    const maxLen = Math.max(...options.map(([_, val]) => String(val).length));
    
    // Horizontal: "a, b, c, d"
    if (maxLen < 12) {
      return (
        <div className="flex flex-row flex-wrap gap-x-6 gap-y-1 pl-1 text-[11.5px]">
          {options.map(([key, val]) => (
            <p key={key}><span className="font-bold">{key.toUpperCase()}.</span> {val as string}</p>
          ))}
        </div>
      );
    }
    
    // Grid: "a, c / b, d"
    if (maxLen < 35) {
      const pairs = [];
      if (options.length === 4) {
        pairs.push(options[0], options[2], options[1], options[3]);
      } else if (options.length === 5) {
        pairs.push(options[0], options[2], options[1], options[3], options[4]);
      } else {
        pairs.push(...options);
      }

      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-1 text-[11.5px]">
          {pairs.map(([key, val]) => (
            <p key={key}><span className="font-bold">{key.toUpperCase()}.</span> {val as string}</p>
          ))}
        </div>
      );
    }
    
    // Vertical: "a / b / c / d"
    return (
      <div className="flex flex-col gap-1 pl-1 text-[11.5px]">
        {options.map(([key, val]) => (
          <p key={key}><span className="font-bold">{key.toUpperCase()}.</span> {val as string}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md"
          >
            <div className="relative mb-6">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Coffee className="w-8 h-8 text-blue-400 animate-pulse" />
              </div>
            </div>
            <motion.h2 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black text-white tracking-[0.2em] uppercase text-center"
            >
              Ngopi Dulu
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-slate-400 text-sm mt-3 font-medium tracking-wide"
            >
              Ali Maksum Sedang Berfikir Keras...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-center gap-3 mb-6">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-slate-50 tracking-tight">MADRASAH DARUL HUDA</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Professional Production Grade</p>
            <p className="text-[9px] text-blue-400/80 uppercase tracking-wider font-bold mt-0.5">Developer: Ali Maksum</p>
        </div>
      </header>

      <div className="main-grid">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 custom-scrollbar">
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
                <input
                    type="text"
                    value={institutionHeader}
                    onChange={(e) => setInstitutionHeader(e.target.value)}
                    className="flex-1 bg-transparent border-none text-[11px] text-slate-300 focus:ring-0 p-0"
                    placeholder="Header Lembaga"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="Tahun Ajaran" className="input-field" />
                  <select 
                    value={grade} 
                    onChange={(e) => setGrade(e.target.value)} 
                    className="input-field appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Pilih Kelas</option>
                    {(level === 'MTs' ? ['VII', 'VIII', 'IX'] : ['X', 'XI', 'XII']).map(g => (
                      <option key={g} value={g} className="bg-slate-900 text-white">{g}</option>
                    ))}
                  </select>
              </div>

              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mata Pelajaran" className="input-field font-bold" />
              
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={examDay} onChange={(e) => setExamDay(e.target.value)} placeholder="Hari" className="input-field" />
                <input type="text" value={examDate} onChange={(e) => setExamDate(e.target.value)} placeholder="Tanggal" className="input-field" />
              </div>

              <div className="space-y-1.5">
                  {[1, 2, 3, 4].map(n => (
                  <input key={n} type="text" value={(topics as any)[`topic${n}`]} onChange={(e) => handleTopicChange(`topic${n}`, e.target.value)} placeholder={`Materi Utama ${n}`} className="input-field text-[11px]" />
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parameter Soal</p>
              <div className="stats-card">
                <div className="stat-row text-blue-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={enabledTypes.pilihanGanda} 
                      onChange={(e) => setEnabledTypes({...enabledTypes, pilihanGanda: e.target.checked})}
                      className="w-3 h-3 rounded-sm bg-slate-800 border-slate-600 text-blue-500 focus:ring-0"
                    />
                    <span>Total Pilihan Ganda</span>
                  </label>
                  <input type="number" disabled={!enabledTypes.pilihanGanda} value={counts.pilihanGanda} onChange={(e) => setCounts({...counts, pilihanGanda: parseInt(e.target.value) || 0})} className={`stat-input ${!enabledTypes.pilihanGanda ? 'opacity-30' : ''}`} />
                </div>
                <div className="stat-row text-amber-400">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Target HOTS</span>
                  <input type="number" disabled={!enabledTypes.pilihanGanda} value={counts.hots} onChange={(e) => setCounts({...counts, hots: parseInt(e.target.value) || 0})} className={`stat-input ${!enabledTypes.pilihanGanda ? 'opacity-30' : ''}`} />
                </div>
                <div className="stat-row text-emerald-400">
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Target Sedang</span>
                  <input type="number" disabled={!enabledTypes.pilihanGanda} value={counts.sedang} onChange={(e) => setCounts({...counts, sedang: parseInt(e.target.value) || 0})} className={`stat-input ${!enabledTypes.pilihanGanda ? 'opacity-30' : ''}`} />
                </div>
                <div className="h-px bg-slate-700 my-1"></div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-[8px] text-slate-500 text-center uppercase flex items-center justify-center gap-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={enabledTypes.salahBenar} 
                            onChange={(e) => setEnabledTypes({...enabledTypes, salahBenar: e.target.checked})}
                            className="w-2 h-2 rounded-sm bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0"
                          />
                          S/B
                        </label>
                        <input type="number" disabled={!enabledTypes.salahBenar} value={counts.salahBenar} onChange={(e) => setCounts({...counts, salahBenar: parseInt(e.target.value) || 0})} className={`stat-input w-full ${!enabledTypes.salahBenar ? 'opacity-30' : ''}`} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[8px] text-slate-500 text-center uppercase flex items-center justify-center gap-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={enabledTypes.menjodohkan} 
                            onChange={(e) => setEnabledTypes({...enabledTypes, menjodohkan: e.target.checked})}
                            className="w-2 h-2 rounded-sm bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0"
                          />
                          Jodoh
                        </label>
                        <input type="number" disabled={!enabledTypes.menjodohkan} value={counts.menjodohkan} onChange={(e) => setCounts({...counts, menjodohkan: parseInt(e.target.value) || 0})} className={`stat-input w-full ${!enabledTypes.menjodohkan ? 'opacity-30' : ''}`} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[8px] text-slate-500 text-center uppercase flex items-center justify-center gap-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={enabledTypes.essay} 
                            onChange={(e) => setEnabledTypes({...enabledTypes, essay: e.target.checked})}
                            className="w-2 h-2 rounded-sm bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0"
                          />
                          Essay
                        </label>
                        <input type="number" disabled={!enabledTypes.essay} value={counts.essay} onChange={(e) => setCounts({...counts, essay: parseInt(e.target.value) || 0})} className={`stat-input w-full ${!enabledTypes.essay ? 'opacity-30' : ''}`} />
                    </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-auto border-t border-slate-700">
            <button onClick={handleGenerate} disabled={loading} className="btn-generate w-full">
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              Generate Naskah Produksi
            </button>
            {error && <p className="text-red-400 text-[10px] mt-2 text-center">{error}</p>}
          </div>
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
                    <h2 className="font-bold uppercase text-lg leading-tight tracking-tight">YAYASAN PONDOK PESANTREN DARUL HUDA PENGARANG</h2>
                    <h2 className="font-bold uppercase text-lg leading-tight tracking-tight">{generatedExam.kop.lembaga}</h2>
                    <h3 className="font-bold uppercase text-xl leading-tight">
                      {level === 'MTs' ? 'MADRASAH TSANAWIYAH DARUL HUDA' : 'MADRASAH ALIYAH DARUL HUDA'}
                    </h3>
                    <p className="text-sm font-bold mt-1">TAHUN PELAJARAN {generatedExam.kop.tahun_ajaran}</p>
                    <p className="text-[10px] font-medium mt-1">Jl. KH. Moch. Chozin Toyib No.2 Rt 01/ Rw 01 Desa pengarang Kec. Jambesari Darus Sholah Kab. Bondowoso</p>
                  </div>
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
                  </div>
                </div>

                <div className="columns-2 gap-10 [column-rule:1px_solid_#000] text-justify">
                  {generatedExam.pilihan_ganda?.length > 0 && (
                    <div className="mb-6">
                      <div className="font-bold border-b-2 border-black mb-4 text-[13px] pb-1 uppercase">I. PILIHAN GANDA</div>
                      <div className="space-y-6">
                        {generatedExam.pilihan_ganda.map((item: any, idx: number) => (
                          <div key={idx} className="question break-inside-avoid mb-6">
                            {item.tipe && item.tipe !== 'LOTS' && item.tipe !== 'Dasar' && (
                              <div className="flex justify-end mb-1">
                                <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                    {item.tipe}
                                </span>
                              </div>
                            )}
                            {item.stimulus && <div className="bg-slate-50 p-3 border border-black/10 border-l-4 border-l-black mb-3 italic text-[10.5px] leading-relaxed shadow-sm">{item.stimulus}</div>}
                            <div className="flex gap-2 text-[11.5px]">
                              <span className="font-bold min-w-[18px]">{item.no}.</span>
                              <div className="flex-1">
                                <p className="font-semibold leading-snug mb-2">{item.pertanyaan}</p>
                                {renderOptions(item.opsi)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedExam.salah_benar?.length > 0 && (
                    <div className="mb-6">
                        <div className="font-bold border-b-2 border-black mb-4 text-[13px] pb-1 uppercase">II. SALAH / BENAR</div>
                        <div className="space-y-3">
                            {generatedExam.salah_benar.map((it: any, i: number) => (
                                <div key={i} className="break-inside-avoid mb-4">
                                    {it.tipe && it.tipe !== 'LOTS' && it.tipe !== 'Dasar' && (
                                      <div className="flex justify-end mb-1">
                                        <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                            {it.tipe}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex gap-2 text-[11.5px]">
                                        <span className="font-bold">{it.no}.</span>
                                        <p>{it.pertanyaan} (S/B)</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  {generatedExam.menjodohkan?.soal?.length > 0 && (
                    <div className="mb-6">
                        <div className="font-bold border-b-2 border-black mb-4 text-[13px] pb-1 uppercase">III. MENJODOHKAN</div>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-3">
                              {generatedExam.menjodohkan.soal.map((it: any, i: number) => (
                                  <div key={i} className="break-inside-avoid mb-4">
                                      {it.tipe && it.tipe !== 'LOTS' && it.tipe !== 'Dasar' && (
                                        <div className="flex justify-end mb-1">
                                          <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                              {it.tipe}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex gap-2 text-[11.5px]">
                                          <span className="font-bold">{it.no}.</span>
                                          <p className="flex-1 border-b border-dotted border-black/40 pb-1">{it.pertanyaan}</p>
                                          <span className="min-w-[80px] border-b border-black text-center"></span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                          <div className="bg-slate-50 border border-black p-3 rounded">
                            <p className="text-[10px] font-bold mb-2 uppercase border-b border-black/20 pb-1">Pilihan Jawaban:</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px]">
                              {generatedExam.menjodohkan.pilihan_jawaban?.map((choice: string, idx: number) => (
                                <p key={idx} className="flex gap-2">
                                  <span className="font-bold">{String.fromCharCode(65 + idx)}.</span>
                                  <span>{choice}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                    </div>
                  )}

                  {generatedExam.essay?.length > 0 && (
                    <div className="">
                      <div className="font-bold border-b-2 border-black mb-4 text-[13px] pb-1 uppercase">IV. URAIAN / ESSAY</div>
                      <div className="space-y-5">
                        {generatedExam.essay.map((it: any, i: number) => (
                          <div key={i} className="break-inside-avoid mb-4">
                            {it.tipe && it.tipe !== 'LOTS' && it.tipe !== 'Dasar' && (
                              <div className="flex justify-end mb-1">
                                <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                    {it.tipe}
                                </span>
                              </div>
                            )}
                            <div className="flex gap-2 text-[11.5px]">
                              <span className="font-bold min-w-[18px]">{it.no}.</span>
                              <div className="flex-1">
                                  <p className="font-semibold leading-snug">{it.pertanyaan}</p>
                                  <div className="mt-4 border-b border-dotted border-black/30 h-4 w-full"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Page Kisi-kisi */}
                <div className="mt-10 pt-10 border-t-4 border-double border-black break-before-page">
                  <h2 className="text-center font-bold text-lg mb-6 uppercase">KISI-KISI SOAL {subject}</h2>
                  <table className="w-full border-collapse border-2 border-black text-[10px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black p-2 w-8">No</th>
                        <th className="border border-black p-2">Materi</th>
                        <th className="border border-black p-2">Indikator Soal</th>
                        <th className="border border-black p-2 w-20">Level</th>
                        <th className="border border-black p-2 w-24">Bentuk Soal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedExam.kisi_kisi?.map((k: any, idx: number) => (
                        <tr key={idx}>
                          <td className="border border-black p-2 text-center">{k.no}</td>
                          <td className="border border-black p-2">{k.materi}</td>
                          <td className="border border-black p-2">{k.indikator}</td>
                          <td className="border border-black p-2 text-center">{k.level_kognitif}</td>
                          <td className="border border-black p-2 text-center">{k.bentuk_soal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Page Kunci Jawaban */}
                <div className="mt-10 pt-10 border-t-4 border-double border-black break-before-page">
                  <h2 className="text-center font-bold text-lg mb-6 uppercase">KUNCI JAWABAN {subject}</h2>
                  <div className="grid grid-cols-1 gap-6 text-[11px]">
                    {generatedExam.kunci_jawaban_lengkap?.pg && (
                      <div className="border border-black p-4 rounded bg-slate-50">
                        <h3 className="font-bold mb-2 border-b border-black pb-1">I. PILIHAN GANDA</h3>
                        <p className="leading-relaxed">{generatedExam.kunci_jawaban_lengkap.pg}</p>
                      </div>
                    )}
                    {generatedExam.kunci_jawaban_lengkap?.sb && (
                      <div className="border border-black p-4 rounded bg-slate-50">
                        <h3 className="font-bold mb-2 border-b border-black pb-1">II. SALAH / BENAR</h3>
                        <p className="leading-relaxed">{generatedExam.kunci_jawaban_lengkap.sb}</p>
                      </div>
                    )}
                    {generatedExam.kunci_jawaban_lengkap?.jodoh && (
                      <div className="border border-black p-4 rounded bg-slate-50">
                        <h3 className="font-bold mb-2 border-b border-black pb-1">III. MENJODOHKAN</h3>
                        <p className="leading-relaxed">{generatedExam.kunci_jawaban_lengkap.jodoh}</p>
                      </div>
                    )}
                    {generatedExam.kunci_jawaban_lengkap?.essay && (
                      <div className="border border-black p-4 rounded bg-slate-50">
                        <h3 className="font-bold mb-2 border-b border-black pb-1">IV. URAIAN / ESSAY</h3>
                        <p className="whitespace-pre-wrap leading-relaxed">{generatedExam.kunci_jawaban_lengkap.essay}</p>
                      </div>
                    )}
                  </div>
                </div>

              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <FileText className="w-20 h-20 opacity-10 mb-4" />
                <p className="font-bold text-slate-400">Siap Produksi Naskah</p>
              </div>
            )}
          </div>
          
          {generatedExam && (
            <div className="absolute bottom-8 right-8">
                <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-xl">
                  <Printer className="w-5 h-5" /> Cetak / Simpan PDF
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
