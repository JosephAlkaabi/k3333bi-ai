
import React, { useState, useEffect, useRef } from 'react';
import { Category, SnapArticle, GenerationState, TelegramConfig } from './types';
import { fetchNewsAndGenerateSnap } from './geminiService';

const App: React.FC = () => {
  const [articles, setArticles] = useState<SnapArticle[]>([]);
  const [genState, setGenState] = useState<GenerationState>({
    loading: false,
    error: null,
    currentProgress: ""
  });
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [tgConfig, setTgConfig] = useState<TelegramConfig>({
    botToken: localStorage.getItem('tg_bot_token') || '',
    chatId: localStorage.getItem('tg_chat_id') || '',
    enabled: localStorage.getItem('tg_enabled') === 'true'
  });

  const categories = Object.values(Category);
  const autoPilotTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    localStorage.setItem('tg_bot_token', tgConfig.botToken);
    localStorage.setItem('tg_chat_id', tgConfig.chatId);
    localStorage.setItem('tg_enabled', String(tgConfig.enabled));
  }, [tgConfig]);

  const testTelegramToken = async () => {
    if (!tgConfig.botToken) {
      alert("⚠️ يرجى إدخال التوكن أولاً");
      return;
    }
    setIsTestingToken(true);
    // تنظيف التوكن في حال أضاف المستخدم كلمة bot في البداية
    let token = tgConfig.botToken.trim();
    if (token.toLowerCase().startsWith('bot')) {
      token = token.substring(3);
      setTgConfig(prev => ({ ...prev, botToken: token }));
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        alert(`✅ تم التحقق بنجاح!\nاسم البوت: @${data.result.username}`);
      } else {
        alert(`❌ فشل التحقق: ${data.description}`);
      }
    } catch (err) {
      alert("❌ خطأ في الاتصال بخوادم تليقرام");
    } finally {
      setIsTestingToken(false);
    }
  };

  const bakeTextToImage = async (base64: string, text: string): Promise<string> => {
    try {
      await document.fonts.load('bold 70px Tajawal');
    } catch (e) {
      console.warn("Font loading failed");
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        ctx.drawImage(img, 0, 0, 1080, 1920);
        const gradient = ctx.createLinearGradient(0, 1400, 0, 1920);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 1400, 1080, 520);

        ctx.fillStyle = '#FFFC00';
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        ctx.font = 'bold 75px Tajawal, sans-serif';

        const words = text.split(' ');
        const maxWidth = 900;
        const lineHeight = 100;
        const lines: string[] = [];
        let currentLine = '';

        for (let n = 0; n < words.length; n++) {
          const testLine = currentLine + (currentLine ? ' ' : '') + words[n];
          if (ctx.measureText(testLine).width > maxWidth && n > 0) {
            lines.push(currentLine);
            currentLine = words[n];
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine);

        let y = 1680 - ((lines.length - 1) * lineHeight / 2);
        lines.forEach((l) => {
          ctx.fillText(l, 540, y);
          y += lineHeight;
        });

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 45px Tajawal, sans-serif';
        ctx.fillText('👻 K3333BI', 540, 1850);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  };

  const base64ToBlob = (base64: string) => {
    try {
      const parts = base64.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const uInt8Array = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
      return new Blob();
    }
  };

  const sendToTelegram = async (article: SnapArticle) => {
    let token = tgConfig.botToken.trim();
    if (token.toLowerCase().startsWith('bot')) {
      token = token.substring(3);
    }
    const chatId = tgConfig.chatId.trim();

    if (!token || !chatId) {
      alert("⚠️ يرجى ضبط الإعدادات (التوكن وآيدي الدردشة) أولاً.");
      return false;
    }

    try {
      const bakedHook = await bakeTextToImage(article.hookImageUrl, article.title);
      const bakedDetails = await bakeTextToImage(article.detailsImageUrl, "التفاصيل في السنابة القادمة");

      const url = `https://api.telegram.org/bot${token}/sendPhoto`;
      const fullCaption = `<b>${article.title}</b>\n\n${article.description}\n\n👻 Snapchat: K3333BI\n\n🔗 المصادر:\n${article.sources?.map(s => `<a href="${s.uri}">${s.title}</a>`).join('\n') || 'بحث ذكي'}`;
      
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', base64ToBlob(bakedHook), 'hook.png');
      formData.append('caption', fullCaption.substring(0, 1024));
      formData.append('parse_mode', 'HTML');
      
      const res = await fetch(url, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        let msg = "فشل الإرسال";
        if (data.error_code === 401) msg = "التوكن (Token) غير صحيح. راجع @BotFather";
        else if (data.description) msg = data.description;
        throw new Error(msg);
      }

      // إرسال صورة التفاصيل بدون كابشن
      const formData2 = new FormData();
      formData2.append('chat_id', chatId);
      formData2.append('photo', base64ToBlob(bakedDetails), 'details.png');
      await fetch(url, { method: 'POST', body: formData2 });

      return true;
    } catch (err: any) {
      alert(`❌ ${err.message}`);
      return false;
    }
  };

  const handleGenerate = async (category: Category) => {
    if (genState.loading) return;
    setGenState({ loading: true, error: null, currentProgress: `جاري البحث والتحليل لـ ${category}...` });
    try {
      const newSnap = await fetchNewsAndGenerateSnap(category);
      newSnap.hookImageUrl = await bakeTextToImage(newSnap.hookImageUrl, newSnap.title);
      setArticles(prev => [newSnap, ...prev]);
      setGenState({ loading: false, error: null, currentProgress: "" });
      if (tgConfig.enabled) await sendToTelegram(newSnap);
    } catch (err: any) {
      setGenState({ loading: false, error: "فشل التوليد. راجع الاتصال أو مفتاح API.", currentProgress: "" });
      setIsAutoPilot(false); 
    }
  };

  useEffect(() => {
    if (isAutoPilot) {
      const runCycle = () => {
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        handleGenerate(randomCat);
      };
      runCycle();
      autoPilotTimer.current = setInterval(runCycle, 900000); 
    } else if (autoPilotTimer.current) {
      clearInterval(autoPilotTimer.current);
    }
    return () => { if (autoPilotTimer.current) clearInterval(autoPilotTimer.current); };
  }, [isAutoPilot]);

  return (
    <div className="min-h-screen bg-[#020617] text-white pb-24 font-['Tajawal']" dir="rtl">
      <header className="sticky top-0 z-50 bg-[#020617]/90 backdrop-blur-xl border-b border-white/5 p-4 shadow-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center text-black shadow-lg shadow-yellow-400/20">
              <i className="fa-brands fa-snapchat text-2xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">سناب تيك</h1>
              <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest flex items-center gap-1">K3333BI</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition-all active:scale-95"
            >
              <i className="fa-solid fa-paper-plane text-sky-400"></i>
            </button>
            <button 
              onClick={() => setIsAutoPilot(!isAutoPilot)}
              className={`px-4 py-2 rounded-full font-bold text-xs transition-all flex items-center gap-2 border ${isAutoPilot ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
            >
              <i className={`fa-solid ${isAutoPilot ? 'fa-circle-play animate-pulse' : 'fa-robot'}`}></i>
              {isAutoPilot ? 'الطيار الآلي يعمل' : 'نشر تلقائي'}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            <h3 className="text-2xl font-black mb-2 text-yellow-400">إعدادات تليقرام</h3>
            <p className="text-slate-400 text-sm mb-6">تأكد من صحة التوكن وآيدي الدردشة للإرسال.</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">BOT TOKEN</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={tgConfig.botToken}
                    onChange={(e) => setTgConfig({...tgConfig, botToken: e.target.value})}
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-yellow-400 outline-none font-mono"
                    placeholder="12345:ABC..."
                  />
                  <button 
                    onClick={testTelegramToken}
                    disabled={isTestingToken}
                    className="bg-sky-500 hover:bg-sky-400 text-white px-4 rounded-2xl text-[10px] font-bold disabled:opacity-50"
                  >
                    {isTestingToken ? <i className="fa-solid fa-spinner animate-spin"></i> : "فحص"}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">CHAT ID</label>
                <input 
                  type="text" 
                  value={tgConfig.chatId}
                  onChange={(e) => setTgConfig({...tgConfig, chatId: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-yellow-400 outline-none"
                  placeholder="-100..."
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold">النشر الآلي عند التوليد</span>
                <button 
                  onClick={() => setTgConfig({...tgConfig, enabled: !tgConfig.enabled})}
                  className={`w-12 h-6 rounded-full relative transition-colors ${tgConfig.enabled ? 'bg-sky-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${tgConfig.enabled ? 'left-6.5' : 'left-0.5'}`}></div>
                </button>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full bg-white text-black font-black py-4 rounded-2xl mt-2 hover:bg-yellow-400 transition-colors active:scale-95">حفظ البيانات</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <section className="mb-12 text-center md:text-right">
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">محتوى <span className="text-yellow-400">K3333BI</span> الحصري</h2>
          <p className="text-slate-400 text-lg max-w-2xl md:mr-0 mr-auto">توليد احترافي لصور السناب مع دمج النصوص العربية آلياً بجودة عالية.</p>
        </section>

        <section className="mb-12 flex flex-wrap gap-3 justify-center md:justify-start">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleGenerate(cat)}
              disabled={genState.loading}
              className="bg-white/5 hover:bg-white/10 px-6 py-4 rounded-3xl border border-white/5 transition-all disabled:opacity-50 flex items-center gap-3 active:scale-95"
            >
              <CategoryIcon category={cat} />
              <span className="text-sm font-bold">{cat}</span>
            </button>
          ))}
        </section>

        {genState.loading && !isAutoPilot && (
          <div className="mb-10 text-center animate-pulse py-10 bg-white/5 rounded-[40px] border border-white/5">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 text-black shadow-lg">
              <i className="fa-solid fa-wand-magic-sparkles text-2xl"></i>
            </div>
            <p className="text-yellow-400 font-bold text-lg">{genState.currentProgress}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {articles.map(article => (
            <StoryCard key={article.id} article={article} onSendTelegram={sendToTelegram} />
          ))}
        </div>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#020617]/80 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-full shadow-2xl flex items-center gap-10 z-[60]">
        <button className="text-yellow-400 text-xl active:scale-125 transition-transform"><i className="fa-solid fa-house"></i></button>
        <button 
          onClick={() => handleGenerate(categories[Math.floor(Math.random() * categories.length)])} 
          className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center text-black shadow-xl shadow-yellow-400/30 hover:scale-110 active:scale-90 transition-all border-4 border-slate-900"
        >
          <i className="fa-solid fa-plus text-2xl"></i>
        </button>
        <button onClick={() => setShowSettings(true)} className="text-slate-400 text-xl hover:text-white active:scale-125 transition-transform"><i className="fa-solid fa-paper-plane"></i></button>
      </nav>
    </div>
  );
};

const CategoryIcon: React.FC<{ category: Category }> = ({ category }) => {
  const icons = {
    [Category.AI]: "fa-brain text-blue-400",
    [Category.CARS]: "fa-car-side text-red-400",
    [Category.GADGETS]: "fa-mobile-screen text-purple-400",
    [Category.AGRICULTURE]: "fa-seedling text-green-400",
    [Category.TRENDS]: "fa-bolt text-yellow-400",
    [Category.FUNNY]: "fa-face-laugh-squint text-orange-400",
    [Category.IDEAS]: "fa-lightbulb text-yellow-500",
  };
  return <i className={`fa-solid ${icons[category] || 'fa-star'}`}></i>;
};

const StoryCard: React.FC<{ 
  article: SnapArticle; 
  onSendTelegram: (article: SnapArticle) => Promise<boolean> 
}> = ({ article, onSendTelegram }) => {
  const [frame, setFrame] = useState<'hook' | 'details'>('hook');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    const success = await onSendTelegram(article);
    setStatus(success ? 'success' : 'error');
    setIsSending(false);
    setTimeout(() => setStatus('idle'), 4000);
  };

  return (
    <div className="bg-white/5 rounded-[40px] overflow-hidden border border-white/5 group hover:border-white/10 transition-all flex flex-col shadow-2xl">
      <div className="relative aspect-[9/16] overflow-hidden cursor-pointer" onClick={() => setFrame(frame === 'hook' ? 'details' : 'hook')}>
        <img src={frame === 'hook' ? article.hookImageUrl : article.detailsImageUrl} alt={article.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-20">
          <div className={`h-1 flex-1 rounded-full ${frame === 'hook' ? 'bg-white' : 'bg-white/20'}`}></div>
          <div className={`h-1 flex-1 rounded-full ${frame === 'details' ? 'bg-white' : 'bg-white/20'}`}></div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90 p-8 flex flex-col justify-end">
          <span className="inline-block bg-yellow-400 text-black px-3 py-1 rounded-lg text-[10px] font-black uppercase mb-3 self-start shadow-lg">
            {frame === 'hook' ? 'الهوك' : 'التفاصيل'}
          </span>
          <h3 className="text-2xl font-black mb-3 text-white drop-shadow-md">{article.title}</h3>
          {frame === 'details' && <p className="text-slate-300 text-sm line-clamp-6 leading-relaxed bg-black/40 backdrop-blur-md p-4 rounded-3xl">{article.description}</p>}
        </div>
      </div>
      <div className="p-6 bg-white/[0.02] grid grid-cols-2 gap-3">
        <button onClick={() => {
          const link = document.createElement('a');
          link.href = frame === 'hook' ? article.hookImageUrl : article.detailsImageUrl;
          link.download = `K3333BI-${article.id}.png`;
          link.click();
        }} className="bg-white/10 text-white py-3 rounded-2xl font-bold text-xs hover:bg-white/20 transition-all">
          <i className="fa-solid fa-download mr-2"></i> حفظ
        </button>
        <button 
          onClick={handleSend}
          disabled={isSending}
          className={`py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${status === 'success' ? 'bg-green-600' : status === 'error' ? 'bg-red-600' : 'bg-sky-600 hover:bg-sky-500'} text-white`}
        >
          {isSending ? <i className="fa-solid fa-spinner animate-spin"></i> : status === 'success' ? <i className="fa-solid fa-check"></i> : status === 'error' ? <i className="fa-solid fa-xmark"></i> : <i className="fa-solid fa-paper-plane"></i>}
          {status === 'idle' ? 'إرسال تليقرام' : status === 'success' ? 'تم الإرسال' : 'فشل'}
        </button>
      </div>
    </div>
  );
};

export default App;
