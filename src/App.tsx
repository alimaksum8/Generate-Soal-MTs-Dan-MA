import React, { useState, useEffect, useRef } from 'react';
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
  Coffee,
  LogOut,
  History,
  Save,
  User,
  Database,
  Trash2,
  Lock,
  Mail,
  LogIn,
  Search,
  X,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
  limit 
} from 'firebase/firestore';

// --- API Configuration ---
const apiKey = process.env.GEMINI_API_KEY; 
const MODEL_NAME = "gemini-3-flash-preview";

const App = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSavedDataModal, setShowSavedDataModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [savedExams, setSavedExams] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [level, setLevel] = useState('MTs');
  const [academicYear, setAcademicYear] = useState('2024/2025');
  const [institutionHeader, setInstitutionHeader] = useState('ASESMEN MADRASAH SEMESTER');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [examDay, setExamDay] = useState('');
  const [examDate, setExamDate] = useState('');
  const [logo, setLogo] = useState(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topics, setTopics] = useState<string[]>(['']);
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
  const [hideKop, setHideKop] = useState(false);
  const [useStimulus, setUseStimulus] = useState(false);
  const [useVisuals, setUseVisuals] = useState(true);
  const [hotsLevels, setHotsLevels] = useState<string[]>(['C4', 'C5', 'C6']);
  const [sedangLevels, setSedangLevels] = useState<string[]>(['C2', 'C3']);

  const renderVisual = (visual: any) => {
    if (!visual) return null;
    
    // Normalize properties
    const type = String(visual.type || '').toLowerCase();
    let content = visual.content || visual.svg || visual.data || visual.url || visual.src || '';

    if (type === 'svg') {
      // Cleanup markdown if AI wraps it
      content = content.replace(/```svg/g, '').replace(/```xml/g, '').replace(/```/g, '').trim();
      
      // Auto-wrap if missing <svg tag or if it seems to be just path/inner content
      const needsWrap = !content.includes('<svg');
      
      return (
        <div 
          className="my-1.5 flex justify-center bg-white p-2 border border-black/10 rounded-sm overflow-hidden min-h-[80px] max-h-[160px]"
          dangerouslySetInnerHTML={{ 
            __html: needsWrap 
              ? `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; max-height:140px;">${content}</svg>` 
              : content.replace('<svg', '<svg style="max-height:140px;"') 
          }}
        />
      );
    }

    if (type === 'image' || type === 'url' || (content.startsWith('http') || content.startsWith('data:image'))) {
      return (
        <div className="my-1.5 flex justify-center bg-white p-2 border border-black/10 rounded-sm overflow-hidden">
          <img src={content} alt="Ilustrasi" className="max-h-[160px] object-contain" referrerPolicy="no-referrer" />
        </div>
      );
    }
    
    if (type === 'placeholder' || !type) {
      return (
        <div className="my-1.5 border-2 border-dashed border-black/20 bg-slate-50 p-4 flex flex-col items-center justify-center gap-2 text-center rounded-sm min-h-[100px]">
          <ImageIcon className="w-6 h-6 text-slate-300" />
          <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Area Gambar / Ilustrasi</p>
          <p className="text-[8px] text-slate-400 italic max-w-[250px] leading-tight">{content || 'Gambar tidak tersedia'}</p>
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    setGrade('');
  }, [level]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchExams();
    }
  }, [user]);

  const fetchExams = async () => {
    if (!user) return;
    try {
      console.log("Fetching exams for user:", user.uid);
      const q = query(
        collection(db, 'exams'),
        where('userId', '==', user.uid),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const exams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("Fetched exams count:", exams.length);
      setSavedExams(exams);
    } catch (err: any) {
      console.error("Error fetching exams detail:", err);
      if (err.message && err.message.includes('permissions')) {
        setError("Izin ditolak. Pastikan database Firestore sudah aktif dan Rules sudah dideploy.");
      }
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError("Email dan Password wajib diisi.");
      return;
    }
    
    setAuthLoading(true);
    setError(null);
    try {
      // Try to sign in
      await signInWithEmailAndPassword(auth, email, password);
      setShowLoginModal(false);
      setPassword('');
    } catch (err: any) {
      // If user doesn't exist, auto-register (tanpa daftar)
      if (err.code === 'auth/user-not-found') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          setShowLoginModal(false);
          setPassword('');
        } catch (createErr: any) {
          setError("Gagal masuk. Pastikan email valid & password minimal 6 karakter.");
        }
      } else if (err.code === 'auth/wrong-password') {
        setError("Password salah.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Format email tidak valid.");
      } else {
        // Some other error, try to create user anyway if it's "tanpa daftar" logic
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          setShowLoginModal(false);
          setPassword('');
        } catch (finalErr: any) {
          setError("Gagal masuk/daftar ke sistem.");
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const saveExamToCloud = async () => {
    if (!user || !generatedExam) return;
    try {
      setLoading(true);
      
      // Deteksi semester dari header (biasanya mengandung "GANJIL" atau "GENAP")
      const semMatch = institutionHeader.match(/SEMESTER\s+(GANJIL|GENAP)/i);
      const extractedSemester = semMatch ? semMatch[1].toUpperCase() : 'UTAMA';

      const examData = {
        ...generatedExam,
        userId: user.uid,
        createdAt: serverTimestamp(),
        subject,
        grade,
        level,
        academicYear,
        semester: extractedSemester,
        examDate,
        examDay,
        topics,
        // Nama identitas naskah sesuai permintaan user
        displayName: `${subject} - Kelas ${grade} (${extractedSemester} ${academicYear})`
      };
      await addDoc(collection(db, 'exams'), examData);
      await fetchExams();
      setLoading(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'exams');
    }
  };

  const deleteExam = async (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'exams', examId));
      setSavedExams(prev => prev.filter(ex => ex.id !== examId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `exams/${examId}`);
    }
  };

  const loadExamFromSaved = (exam: any) => {
    setGeneratedExam(exam);
    setSubject(exam.subject || '');
    setGrade(exam.grade || '');
    setLevel(exam.level || 'MTs');
    setAcademicYear(exam.academicYear || '');
    setExamDate(exam.examDate || '');
    setExamDay(exam.examDay || '');
    setTopics(Array.isArray(exam.topics) ? exam.topics : ['']);
    setShowHistory(false);
  };

  const updateExamHeader = async (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      setLoading(true);
      const semMatch = institutionHeader.match(/SEMESTER\s+(GANJIL|GENAP)/i);
      const extractedSemester = semMatch ? semMatch[1].toUpperCase() : 'UTAMA';

      const updateData = {
        institutionHeader,
        academicYear,
        semester: extractedSemester,
        subject,
        grade,
        level,
        examDate,
        examDay,
        displayName: `${subject} - Kelas ${grade} (${extractedSemester} ${academicYear})`,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'exams', examId), updateData);
      
      setSavedExams(prev => prev.map(ex => 
        ex.id === examId ? { ...ex, ...updateData } : ex
      ));
      
      setLoading(false);
      alert('Kop/Header naskah berhasil diperbarui!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}`);
      setLoading(false);
    }
  };

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
    const activeTopics = topics.filter(t => t.trim() !== '');
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
          "visual": { "type": "svg", "content": "<svg>...</svg>" },
          "pertanyaan": "...", 
          "opsi": {"a": "", "b": "", "c": "", "d": "" ${isMA ? ', "e": ""' : ''}}, 
          "kunci": "a"
        }
      ]`;
    }

    if (enabledTypes.salahBenar) {
      outputFormat += `,
      "salah_benar": [
        { "no": 1, "tipe": "Dasar/Sedang/HOTS", "visual": null, "pertanyaan": "...", "kunci": "Benar" }
      ]`;
    }

    if (enabledTypes.menjodohkan) {
      outputFormat += `,
      "menjodohkan": {
        "soal": [
          { "no": 1, "tipe": "Dasar/Sedang/HOTS", "visual": null, "pertanyaan": "...", "kunci": "..." }
        ],
        "pilihan_jawaban": ["...", "...", "..."]
      }`;
    }

    if (enabledTypes.essay) {
      outputFormat += `,
      "essay": [
        { "no": 1, "tipe": "Dasar/Sedang/HOTS", "visual": null, "pertanyaan": "..." }
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
    4. Pilihan Ganda: Jenjang MA memiliki 5 opsi (A-E), MTs memiliki 4 opsi (A-D).
    5. Stimulus: ${useStimulus ? 'WAJIB sertakan stimulus (teks, kutipan, atau konteks) untuk setiap butir soal jika memungkinkan.' : 'JANGAN gunakan stimulus. Langsung ke pertanyaan inti.'}
    6. Visual: ${useVisuals ? `Anda WAJIB menyertakan minimal 3-5 visual SVG yang relevan di seluruh naskah (misal: pada soal HOTS).
       - HANYA gunakan type "svg". DILARANG menggunakan "placeholder".
       - Jika pertanyaan atau stimulus mengandung kata-kata seperti "amati gambar", "perhatikan gambar", "berdasarkan ilustrasi", "lihatlah diagram", atau sejenisnya, maka Anda WAJIB menyertakan objek "visual" berisi SVG yang relevan dengan pertanyaan tersebut.
       - Jika materi tidak memiliki diagram standar (seperti matematika), buatlah ilustrasi SVG kreatif yang relevan:
         * Contoh Sejarah: Simbol/ikon artefak, peta sederhana, pilar, atau timbangan keadilan.
         * Contoh Agama: Kaligrafi sederhana, simbol tempat ibadah (masjid/ka'bah), atau ikon silsilah.
         * Contoh IPA/Biologi: Struktur sel, rantai makanan, atau simbol atom.
         * Contoh Bahasa: Ikon buku, pulpen, atau balon teks dialog.
       - Tehnical SVG:
         * Gunakan stroke="black", stroke-width="1.5", dan fill="none" (atau warna pastel sangat muda).
         * WAJIB sertakan viewBox (misal: viewBox="0 0 200 200").
         * Ukuran visual harus kompak (preferensi aspek rasio 1:1 atau 2:2) agar tidak memakan banyak tempat.
         * Pastikan SVG bersih dan valid.` : 'DILARANG KERAS menyertakan visual, gambar, SVG, atau ilustrasi dalam bentuk apapun. Jangan sertakan field "visual" dalam JSON.'}`;

    let countsText = `PENTING: `;
    const countsParts = [];
    if (enabledTypes.pilihanGanda) countsParts.push(`Hasilkan tepat ${counts.pilihanGanda} soal PG (${counts.hots} HOTS, ${counts.sedang} Sedang)`);
    if (enabledTypes.salahBenar) countsParts.push(`${counts.salahBenar} soal Salah/Benar`);
    if (enabledTypes.menjodohkan) countsParts.push(`${counts.menjodohkan} soal Menjodohkan`);
    if (enabledTypes.essay) countsParts.push(`${counts.essay} soal Essay`);
    
    countsText += countsParts.join(', ') + '.';

    const hotsLevelsText = hotsLevels.length > 0 ? `dengan level kognitif ${hotsLevels.join('/')}` : '';
    const sedangLevelsText = sedangLevels.length > 0 ? `dengan level kognitif ${sedangLevels.join('/')}` : '';

    const systemPrompt = `Anda adalah pakar kurikulum dan pembuat soal ujian profesional untuk lingkungan Madrasah (ASESMEN MADRASAH SEMESTER). 
    Tugas Anda adalah membuat naskah soal, kisi-kisi, dan kunci jawaban yang berkualitas tinggi, valid, dan reliabel sesuai dengan standar Kurikulum Merdeka dan K-13.

    ${criteria}

    PENTING: Penempatan soal HOTS dan Sedang harus diacak nomornya (jangan dikelompokkan di awal atau di akhir). Sebarkan tingkat kesulitan secara merata di seluruh nomor soal.

    FORMAT OUTPUT (JSON):
    ${outputFormat}

    ${countsText}. 
    - Untuk soal HOTS: ${hotsLevelsText}
    - Untuk soal SEDANG: ${sedangLevelsText}
    
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

  const addTopic = () => {
    setTopics([...topics, '']);
  };

  const removeTopic = (index: number) => {
    if (topics.length > 1) {
      const newTopics = [...topics];
      newTopics.splice(index, 1);
      setTopics(newTopics);
    } else {
      setTopics(['']);
    }
  };

  const handleTopicChange = (index: number, value: string) => {
    const newTopics = [...topics];
    newTopics[index] = value;
    setTopics(newTopics);
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

      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
              <h1 className="text-2xl font-bold text-slate-50 tracking-tight">MADRASAH DARUL HUDA</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Professional Production Grade</p>
              <p className="text-[9px] text-blue-400/80 uppercase tracking-wider font-bold mt-0.5">Developer: Ali Maksum</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <button 
              onClick={() => setShowSavedDataModal(true)}
              className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-full font-bold text-xs hover:bg-slate-700 transition-all border border-slate-700"
            >
              <Database className="w-4 h-4 text-blue-400" />
              DATABASE
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-3 bg-slate-900/50 p-1.5 pl-4 rounded-full border border-slate-700">
              <div className="text-right">
                <p className="text-[10px] font-bold text-white leading-none">{user.email?.split('@')[0]}</p>
                <p className="text-[8px] text-slate-500">{user.email}</p>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-full font-bold text-xs hover:bg-blue-50 transition-colors shadow-lg">
              <Lock className="w-4 h-4" />
              MASUK SISTEM
            </button>
          )}
        </div>
      </header>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center mb-8">
                <div className="bg-blue-600/20 p-4 rounded-2xl mb-4">
                  <Lock className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Akses Sistem</h2>
                <p className="text-slate-400 text-sm mt-1">Gunakan Email & Password untuk masuk</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Email Madrasah</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh@madrasah.com"
                      className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>

                {error && <p className="text-red-400 text-[10px] text-center font-bold bg-red-400/10 py-2 rounded-lg border border-red-400/20">{error}</p>}

                <button 
                  type="submit" 
                  disabled={authLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 transition-all mt-4"
                >
                  {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5" /> MASUK / DAFTAR</>}
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowLoginModal(false)}
                  className="w-full py-3 text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-widest transition-colors"
                >
                  Batal
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Data Modal */}
      <AnimatePresence>
        {showSavedDataModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600/20 p-2.5 rounded-xl">
                    <Database className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Database Naskah</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Manajemen Data Tersimpan</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSavedDataModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 bg-slate-800/30 border-b border-slate-800">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Cari Mata Pelajaran atau Kelas..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {savedExams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Database className="w-16 h-16 text-slate-800 mb-4" />
                    <h3 className="text-slate-400 font-bold">Belum Ada Naskah</h3>
                    <p className="text-slate-600 text-xs mt-1">Generate naskah dan simpan ke cloud untuk melihatnya di sini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedExams
                      .filter(ex => 
                        ex.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        ex.grade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ex.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((ex) => (
                      <motion.div 
                        key={ex.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group relative bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:border-blue-500/50 hover:bg-slate-800 transition-all cursor-pointer shadow-lg overflow-hidden"
                        onClick={() => {
                          loadExamFromSaved(ex);
                          setShowSavedDataModal(false);
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col gap-1">
                            <div className="px-2.5 py-1 rounded-md bg-blue-600/10 border border-blue-600/20 text-[9px] font-bold text-blue-400 uppercase tracking-wider inline-block w-fit">
                              {ex.level} {ex.grade}
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-0.5">
                              {ex.semester || 'SESI'} {ex.academicYear}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {ex.createdAt?.toDate ? new Date(ex.createdAt.toDate()).toLocaleDateString('id-ID') : 'Baru saja'}
                          </div>
                        </div>
                        
                        <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                          {ex.subject}
                        </h4>
                        
                        <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Ready to Load</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => updateExamHeader(ex.id, e)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-400/10 text-orange-400 hover:bg-orange-400/20 border border-orange-400/20 transition-all text-[9px] font-bold uppercase"
                              title="Update Header/Kop dengan data form saat ini"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              Update Kop
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if(confirm('Hapus naskah ini?')) deleteExam(ex.id, e);
                              }}
                              className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-slate-900 border-t border-slate-800 text-center">
                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Total: {savedExams.length} Naskah Tersimpan</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="main-grid">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 custom-scrollbar">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Settings className="w-3 h-3" /> Identitas Ujian</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors normal-case font-medium text-[10px]">
                  <input 
                    type="checkbox" 
                    checked={hideKop} 
                    onChange={(e) => setHideKop(e.target.checked)}
                    className="w-3 h-3 rounded-sm bg-slate-800 border-slate-600 text-blue-500 focus:ring-0"
                  />
                  Tanpa Kop
                </label>
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

              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value.toUpperCase())} placeholder="Mata Pelajaran" className="input-field font-bold" />
              
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={examDay} onChange={(e) => setExamDay(e.target.value.toUpperCase())} placeholder="Hari" className="input-field" />
                <input type="text" value={examDate} onChange={(e) => setExamDate(e.target.value)} placeholder="Tanggal" className="input-field" />
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Materi Utama</p>
                  <button 
                    onClick={addTopic}
                    className="p-1 rounded-md bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-all"
                    title="Tambah Materi"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {topics.map((topic, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={topic} 
                      onChange={(e) => handleTopicChange(index, e.target.value.toUpperCase())} 
                      placeholder={`Materi Utama ${index + 1}`} 
                      className="input-field text-[11px] flex-1" 
                    />
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => removeTopic(index)}
                        className="p-1.5 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-all border border-red-400/20"
                        title="Hapus Materi"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parameter Soal</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 transition-colors font-medium text-[10px]">
                    <input 
                      type="checkbox" 
                      checked={useVisuals} 
                      onChange={(e) => setUseVisuals(e.target.checked)}
                      className="w-3 h-3 rounded-sm bg-slate-800 border-slate-600 text-blue-500 focus:ring-0"
                    />
                    Gambar
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 transition-colors font-medium text-[10px]">
                    <input 
                      type="checkbox" 
                      checked={useStimulus} 
                      onChange={(e) => setUseStimulus(e.target.checked)}
                      className="w-3 h-3 rounded-sm bg-slate-800 border-slate-600 text-blue-500 focus:ring-0"
                    />
                    Stimulus
                  </label>
                </div>
              </div>
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
                <div className="flex flex-col gap-1 pb-1.5 border-b border-slate-800/30">
                  <div className="stat-row text-amber-400 border-none pb-0">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Target HOTS</span>
                    <input type="number" disabled={!enabledTypes.pilihanGanda} value={counts.hots} onChange={(e) => setCounts({...counts, hots: parseInt(e.target.value) || 0})} className={`stat-input ${!enabledTypes.pilihanGanda ? 'opacity-30' : ''}`} />
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 ml-4 mt-1">
                    {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(lvl => (
                      <label key={lvl} className={`flex items-center gap-1 cursor-pointer text-[9px] transition-colors ${hotsLevels.includes(lvl) ? 'text-amber-400' : 'text-slate-500 hover:text-slate-400'}`}>
                        <input 
                          type="checkbox" 
                          checked={hotsLevels.includes(lvl)}
                          onChange={(e) => {
                            if (e.target.checked) setHotsLevels([...hotsLevels, lvl]);
                            else setHotsLevels(hotsLevels.filter(l => l !== lvl));
                          }}
                          className="w-2.5 h-2.5 rounded-sm bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                        />
                        {lvl}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1 pb-1.5 border-b border-slate-800/30">
                  <div className="stat-row text-emerald-400 border-none pb-0">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Target Sedang</span>
                    <input type="number" disabled={!enabledTypes.pilihanGanda} value={counts.sedang} onChange={(e) => setCounts({...counts, sedang: parseInt(e.target.value) || 0})} className={`stat-input ${!enabledTypes.pilihanGanda ? 'opacity-30' : ''}`} />
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 ml-4 mt-1">
                    {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(lvl => (
                      <label key={lvl} className={`flex items-center gap-1 cursor-pointer text-[9px] transition-colors ${sedangLevels.includes(lvl) ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-400'}`}>
                        <input 
                          type="checkbox" 
                          checked={sedangLevels.includes(lvl)}
                          onChange={(e) => {
                            if (e.target.checked) setSedangLevels([...sedangLevels, lvl]);
                            else setSedangLevels(sedangLevels.filter(l => l !== lvl));
                          }}
                          className="w-2.5 h-2.5 rounded-sm bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                        />
                        {lvl}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-slate-700 my-1 hidden"></div>
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

          <div className="pt-4 mt-8 border-t border-slate-800/50">
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-700 bg-slate-900/30 text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold"
              >
                <History className="w-4 h-4" />
                Riwayat Naskah ({savedExams.length})
              </button>
              
              {showHistory && (
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {savedExams.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-4 italic">Belum ada naskah tersimpan</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {savedExams.map((ex) => (
                        <div 
                          key={ex.id} 
                          onClick={() => loadExamFromSaved(ex)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 cursor-pointer group text-[10px]"
                        >
                          <div className="flex-1 overflow-hidden">
                            <p className="text-slate-300 font-bold truncate">{ex.subject}</p>
                            <p className="text-slate-500 truncate">{ex.level} {ex.grade} - {ex.academicYear}</p>
                          </div>
                          <button 
                            onClick={(e) => deleteExam(ex.id, e)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-auto border-t border-slate-700">
            <button 
              onClick={handleGenerate} 
              disabled={loading || !user} 
              className={`btn-generate w-full ${!user ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              {user ? 'Generate Naskah Produksi' : 'Silakan Login Terlebih Dahulu'}
            </button>
            {error && <p className="text-red-400 text-[10px] mt-2 text-center">{error}</p>}
          </div>
        </div>

        {/* Preview Area */}
        <div className="preview-container">
          <div className="paper-content" id="exam-paper">
            {generatedExam ? (
              <>
                {!hideKop && (
                  <>
                    <div className="border-b-[4px] border-double border-black pb-1 mb-2 flex items-center gap-6 text-center">
                      {logo ? (
                        <img src={logo} className="w-20 h-20 object-contain" alt="Logo" />
                      ) : (
                        <div className="w-24 h-24 bg-slate-50 border-2 border-black flex items-center justify-center text-[9px] font-bold text-center p-2 leading-tight">
                          LOGO<br/>LEMBAGA
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="font-bold uppercase text-lg leading-tight tracking-tight">{generatedExam.kop.lembaga}</h2>
                        <h3 className="font-bold uppercase text-xl leading-tight">
                          {level === 'MTs' ? 'MADRASAH TSANAWIYAH DARUL HUDA' : 'MADRASAH ALIYAH DARUL HUDA'}
                        </h3>
                        <p className="text-sm font-bold mt-0.5 uppercase tracking-wide">TAHUN PELAJARAN {generatedExam.kop.tahun_ajaran}</p>
                        <p className="text-[9px] font-medium leading-tight">Jl. KH. Moch. Chozin Toyib No.2 Rt 01/ Rw 01 Desa pengarang Kec. Jambesari Darus Sholah Kab. Bondowoso</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 text-[11px] mb-3 border-2 border-black p-2 bg-slate-50/50">
                      <div className="space-y-0.5">
                        <p className="flex gap-2"><span className="w-24 font-bold">Mata Pelajaran</span>: <span className="font-bold">{subject}</span></p>
                        <p className="flex gap-2"><span className="w-24 font-bold">Materi Utama</span>: <span>{Object.values(topics).filter(t => t).join(', ')}</span></p>
                        <p className="flex gap-2"><span className="w-24 font-bold">Hari / Tanggal</span>: <span>{examDay}, {examDate}</span></p>
                      </div>
                      <div className="space-y-0.5 pl-8 border-l border-black/20">
                        <p className="flex gap-2"><span className="w-24 font-bold">Tingkat / Kelas</span>: <span className="font-bold">{level} / {grade}</span></p>
                        <p className="flex gap-2"><span className="w-24 font-bold">Alokasi Waktu</span>: <span>90 Menit</span></p>
                      </div>
                    </div>
                  </>
                )}

                <div className="columns-2 gap-10 [column-rule:1px_solid_#000] text-justify">
                  {generatedExam.pilihan_ganda?.length > 0 && (
                    <div className="mb-4">
                      <div className="font-bold border-b-2 border-black mb-2 text-[13px] pb-0.5 uppercase">I. PILIHAN GANDA</div>
                      <div className="space-y-3">
                        {generatedExam.pilihan_ganda.map((item: any, idx: number) => (
                          <div key={idx} className="question break-inside-avoid mb-2">
                            {item.tipe && item.tipe !== 'LOTS' && item.tipe !== 'Dasar' && (
                              <div className="flex justify-end mb-0.5">
                                <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                    {item.tipe}
                                </span>
                              </div>
                            )}
                            {item.stimulus && <div className="bg-slate-50 p-2 border border-black/10 border-l-4 border-l-black mb-1.5 italic text-[10.5px] leading-relaxed shadow-sm">{item.stimulus}</div>}
                            {renderVisual(item.visual)}
                            <div className="flex gap-2 text-[11.5px]">
                              <span className="font-bold min-w-[18px]">{item.no}.</span>
                              <div className="flex-1">
                                <p className="font-semibold leading-tight mb-1">{item.pertanyaan}</p>
                                {renderOptions(item.opsi)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedExam.salah_benar?.length > 0 && (
                    <div className="mb-4">
                        <div className="font-bold border-b-2 border-black mb-2 text-[13px] pb-0.5 uppercase">II. SALAH / BENAR</div>
                        <div className="space-y-1">
                            {generatedExam.salah_benar.map((it: any, i: number) => (
                                <div key={i} className="break-inside-avoid mb-2">
                                    {it.tipe && it.tipe !== 'LOTS' && it.tipe !== 'Dasar' && (
                                      <div className="flex justify-end mb-0.5">
                                        <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                            {it.tipe}
                                        </span>
                                      </div>
                                    )}
                                    {renderVisual(it.visual)}
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
                    <div className="mb-4">
                        <div className="font-bold border-b-2 border-black mb-2 text-[13px] pb-0.5 uppercase">III. MENJODOHKAN</div>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="space-y-1">
                              {generatedExam.menjodohkan.soal.map((it: any, i: number) => (
                                  <div key={i} className="break-inside-avoid mb-2">
                                      {it.tipe && it.tipe !== 'LOTS' && it.tipe !== 'Dasar' && (
                                        <div className="flex justify-end mb-0.5">
                                          <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                              {it.tipe}
                                          </span>
                                        </div>
                                      )}
                                      {renderVisual(it.visual)}
                                      <div className="flex gap-2 text-[11.5px]">
                                          <span className="font-bold">{it.no}.</span>
                                          <p className="flex-1 border-b border-dotted border-black/40 pb-0.5">{it.pertanyaan}</p>
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
                    <div className="mb-2">
                      <div className="font-bold border-b-2 border-black mb-2 text-[13px] pb-0.5 uppercase">IV. URAIAN / ESSAY</div>
                      <div className="space-y-3">
                        {generatedExam.essay.map((it: any, i: number) => (
                          <div key={i} className="break-inside-avoid mb-2">
                            {it.tipe && it.tipe !== 'LOTS' && it.tipe !== 'Dasar' && (
                              <div className="flex justify-end mb-0.5">
                                <span className="text-[7px] font-bold border border-black px-1 py-0 uppercase tracking-tighter leading-none">
                                    {it.tipe}
                                </span>
                              </div>
                            )}
                            {renderVisual(it.visual)}
                            <div className="flex gap-2 text-[11.5px]">
                              <span className="font-bold min-w-[18px]">{it.no}.</span>
                              <div className="flex-1">
                                  <p className="font-semibold leading-tight">{it.pertanyaan}</p>
                                  <div className="mt-2 border-b border-dotted border-black/30 h-4 w-full"></div>
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
            <div className="absolute bottom-8 right-8 flex gap-3">
                {user && (
                  <button 
                    onClick={saveExamToCloud} 
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-xl border border-slate-700"
                  >
                    <Save className="w-5 h-5" /> Simpan ke Cloud
                  </button>
                )}
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
