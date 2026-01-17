
import React, { useState, useEffect, useRef } from 'react';
import { Category, SnapArticle, GenerationState, PublishConfig } from './types';
import { fetchNewsAndGenerateSnap } from './geminiService';

const App: React.FC = () => {
  const [articles, setArticles] = useState<SnapArticle[]>([]);
  const [genState, setGenState] = useState<GenerationState>({
    loading: false,
    error: null,
    currentProgress: ""
  });
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<PublishConfig>({
    tgBotToken: localStorage.getItem('tg_bot_token') || '',
    tgChatId: localStorage.getItem('tg_chat_id') || '',
    tgEnabled: localStorage.getItem('tg_enabled') === 'true',
    snapEnabled: localStorage.getItem('snap_enabled') === 'true',
    snapWebhookUrl: localStorage.getItem('snap_webhook') || ''
  });

  const categories = Object.values(Category);
  const autoPilotTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    localStorage.setItem('tg_bot_token', config.tgBotToken);
    localStorage.setItem('tg_chat_id', config.tgChatId);
    localStorage.setItem('tg_enabled', String(config.tgEnabled));
    localStorage.setItem('snap_enabled', String(config.snapEnabled));
    localStorage.setItem('snap_webhook', config.snapWebhookUrl);
  }, [config]);

  const bakeFullArticleToImage = async (article: SnapArticle): Promise<string> => {
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
        if (!ctx) return resolve(article.imageUrl);

        // الأساس: الصورة المولدة
        ctx.drawImage(img, 0, 0, 1080, 1920);

        // تظليل علوي للعنوان
        const gradTop = ctx.createLinearGradient(0, 0, 0, 650);
        gradTop.addColorStop(0, 'rgba(0,0,0,0.95)');
        gradTop.addColorStop(1, 'transparent');
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, 0, 1080, 650);

        // إطار زجاجي (Glassmorphism) للتفاصيل
        const frameX = 50;
        const frameY = 1280;
        const frameW = 980;
        const frameH = 500;
        const radius = 60;

        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(frameX, frameY, frameW, frameH, radius);
        } else {
            // Fallback for older browsers
            ctx.rect(frameX, frameY, frameW, frameH);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 50;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        ctx.direction = 'rtl';
        ctx.textAlign = 'center';

        const wrapText = (text: string, maxWidth: number) => {
          const words = text.split(' ');
          const lines = [];
          let currentLine = '';
          for (let w of words) {
            let test = currentLine + (currentLine ? ' ' : '') + w;
            if (ctx.measureText(test).width > maxWidth) {
              lines.push(currentLine);
              currentLine = w;
            } else { currentLine = test; }
          }
          lines.push(currentLine);
          return lines;
        };

        // 1. العنوان - بخط عريض وأصفر سناب
        ctx.fillStyle = '#FFFC00';
        ctx.font = 'bold 95px Tajawal, sans-serif';
        const titleLines = wrapText(article.title, 920);
        let titleY = 280;
        titleLines.forEach(line => {
          ctx.fillText(line, 540, titleY);
          titleY += 115;
        });

        // شارة الفئة
        ctx.fillStyle = '#FFFC00';
        ctx.font = 'bold 38px Tajawal, sans-serif';
        ctx.fillText(`⚡ ${article.category} ⚡`, 540, frameY + 80);

        // 2. التفاصيل داخل الإطار
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '500 52px Tajawal, sans-serif';
        const descLines = wrapText(article.description, 880);
        let descY = frameY + 180;
        descLines.forEach((line, i) => {
          if (i < 3) { // نكتفي بـ 3 أسطر للمحافظة على التنسيق
            ctx.fillText(line, 540, descY);
            descY += 88;
          }
        });

        // 3. التاريخ والبراند
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = 'bold 34px Tajawal, sans-serif';
        ctx.fillText(`${article.newsDate}`, 540, frameY + 440);

        ctx.fillStyle = '#FFFC00';
        ctx.font = '800 55px Tajawal, sans-serif';
        ctx.fillText('👻 K3333BI', 540, 1860);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(article.imageUrl);
      img.src = article.imageUrl;
    });
  };

  const base64ToBlob = (base64: string) => {
    try {
      const parts = base64.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return new Blob([arr], { type: contentType });
    } catch (e) { return new Blob(); }
  };

  const publishToSnapchat = async (article: SnapArticle) => {
    if (config.snapWebhookUrl) {
      try {
        await fetch(config.snapWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            articleId: article.id, 
            imageUrl: article.imageUrl, 
            title: article.title 
          })
        });
      } catch (e) { console.error("Webhook Error", e); }
    }
    console.log("Auto-publishing to Snapchat logic handled.");
    return true;
  };

  const publishToTelegram = async (article: SnapArticle) => {
    let token = config.tgBotToken.trim();
    if (token.toLowerCase().startsWith('bot')) token = token.substring(3);
    const chatId = config.tgChatId.trim();
    if (!token || !chatId) return false;

    try {
      const url = `https://api.telegram.org/bot${token}/sendPhoto`;
      const caption = `<b>${article.title}</b>\n\n📅 ${article.newsDate}\n\n${article.description}\n\n👻 Snapchat: K3333BI\n\n🔗 المصادر المحققة:\n${article.sources?.map(s => `<a href="${s.uri}">${s.title}</a>`).join('\n') || 'تحقق ذكي'}`;
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', base64ToBlob(article.imageUrl), 'snap_final.png');
      formData.append('caption', caption.substring(0, 1024));
      formData.append('parse_mode', 'HTML');
      const res = await fetch(url, { method: 'POST', body: formData });
      return res.ok;
    } catch (err) { return false; }
  };

  const handleGenerate = async (category: Category) => {
    if (genState.loading) return;
    setGenState({ loading: true, error: null, currentProgress: `جاري تحضير جرعة من الضحك والمعلومات عن ${category}...` });
    try {
      const newSnap = await fetchNewsAndGenerateSnap(category);
      newSnap.imageUrl = await bakeFullArticleToImage(newSnap);
      setArticles(prev => [newSnap, ...prev]);
      setGenState({ loading: false, error: null, currentProgress: "" });
      
      if (config.tgEnabled) await publishToTelegram(newSnap);
      if (config.snapEnabled) await publishToSnapchat(newSnap);
    } catch (err: any) {
      setGenState({ loading: false, error: "حدث خطأ أثناء التوليد.", currentProgress: "" });
      setIsAutoPilot(false); 
    }
  };

  useEffect(() => {
    if (isAutoPilot) {
      const run = () => handleGenerate(categories[Math.floor(Math.random() * categories.length)]);
      run();
      autoPilotTimer.current = setInterval(run, 1500000); // كل 25 دقيقة
    } else if (autoPilotTimer.current) {
      clearInterval(autoPilotTimer.current);
    }
    return () => { if (autoPilotTimer.current) clearInterval(autoPilotTimer.current); };
  }, [isAutoPilot]);

  return (
    <div className="min-h-screen bg-[#020617] text-white pb-24 font-['Tajawal']" dir="rtl">
      <header className="sticky top-0 z-50 bg-[#020617]/95 backdrop-blur-2xl border-b border-white/5 p-4 shadow-2xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-400 rounded-[20px] flex items-center justify-center text-black shadow-lg shadow-yellow-400/20 transform hover:rotate-12 transition-transform">
              <i className="fa-brands fa-snapchat text-3xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">سناب تيك <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded-md mr-1">V2</span></h1>
              <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">K3333BI • كوميدي ساخر</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSettings(true)} className="w-11 h-11 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition-all active:scale-90"><i className="fa-solid fa-gear text-slate-300"></i></button>
            <button onClick={() => setIsAutoPilot(!isAutoPilot)} className={`px-5 py-2.5 rounded-full font-black text-xs transition-all flex items-center gap-2 border shadow-lg ${isAutoPilot ? 'bg-green-500/20 border-green-500 text-green-400 shadow-green-500/10' : 'bg-white/5 border-white/10 text-slate-400'}`}>
              <i className={`fa-solid ${isAutoPilot ? 'fa-circle-dot animate-pulse' : 'fa-power-off'}`}></i>
              {isAutoPilot ? 'نظام النشر يعمل' : 'بدء النشر الآلي'}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/10 rounded-[50px] p-10 max-w-lg w-full shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button onClick={() => setShowSettings(false)} className="absolute top-8 left-8 text-slate-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-2xl"></i></button>
            <h3 className="text-3xl font-black mb-8 text-yellow-400 text-center">أتمتة المحتوى</h3>
            
            <div className="space-y-8">
              <div className="p-6 bg-white/5 rounded-[35px] border border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-white"><i className="fa-brands fa-telegram text-xl"></i></div>
                  <span className="font-black text-lg">بوت تليقرام</span>
                  <button onClick={() => setConfig({...config, tgEnabled: !config.tgEnabled})} className={`mr-auto w-12 h-6 rounded-full relative transition-all ${config.tgEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.tgEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="space-y-4">
                  <input type="text" value={config.tgBotToken} onChange={(e) => setConfig({...config, tgBotToken: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-3 text-sm outline-none focus:border-sky-400 transition-colors font-mono" placeholder="Bot Token (مثال: 12345:ABC...)" />
                  <input type="text" value={config.tgChatId} onChange={(e) => setConfig({...config, tgChatId: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-3 text-sm outline-none focus:border-sky-400 transition-colors" placeholder="Chat ID (مثال: -100...)" />
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-[35px] border border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-black"><i className="fa-brands fa-snapchat text-xl"></i></div>
                  <span className="font-black text-lg">سناب شات</span>
                  <button onClick={() => setConfig({...config, snapEnabled: !config.snapEnabled})} className={`mr-auto w-12 h-6 rounded-full relative transition-all ${config.snapEnabled ? 'bg-yellow-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.snapEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">سيتم إرسال الصور المولدة جاهزة للنشر الفوري. يمكنك استخدام Webhook للربط مع Make.com أو Zapier.</p>
                <input type="text" value={config.snapWebhookUrl} onChange={(e) => setConfig({...config, snapWebhookUrl: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-3 text-sm outline-none focus:border-yellow-400 transition-colors" placeholder="Webhook URL (اختياري)" />
              </div>

              <button onClick={() => setShowSettings(false)} className="w-full bg-yellow-400 text-black font-black py-5 rounded-[30px] hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 active:scale-95 text-lg">حفظ كافة الإعدادات</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <section className="mb-16 text-center md:text-right pt-8">
          <h2 className="text-5xl md:text-8xl font-black mb-6 leading-tight tracking-tight">نشر <span className="text-yellow-400">ساخر</span> وذكي</h2>
          <p className="text-slate-400 text-xl leading-relaxed max-w-3xl md:mr-0 mr-auto">أخبار حقيقية بلمسة كوميدية متميزة، وتصاميم سينمائية جاهزة لخطف الأنظار في سناب شات.</p>
        </section>

        <section className="mb-16 flex flex-wrap gap-4 justify-center md:justify-start">
          {categories.map((cat) => (
            <button key={cat} onClick={() => handleGenerate(cat)} disabled={genState.loading} className="bg-white/5 hover:bg-white/10 px-8 py-5 rounded-full border border-white/5 transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50 group">
              <CategoryIcon category={cat} />
              <span className="text-base font-black group-hover:text-yellow-400 transition-colors">{cat}</span>
            </button>
          ))}
        </section>

        {genState.loading && (
          <div className="mb-16 text-center py-24 bg-white/[0.02] rounded-[70px] border border-white/5 shadow-inner backdrop-blur-sm">
            <div className="w-28 h-28 bg-yellow-400 rounded-[35px] flex items-center justify-center mx-auto mb-8 text-black shadow-2xl shadow-yellow-400/40 animate-pulse">
              <i className="fa-solid fa-face-grin-tears text-5xl"></i>
            </div>
            <h3 className="text-yellow-400 font-black text-3xl mb-3 tracking-wide animate-pulse">{genState.currentProgress}</h3>
            <p className="text-slate-500 text-sm">نحن نبحث عن الفكاهة في قلب الحقيقة...</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-14">
          {articles.map(article => (
            <StoryCard key={article.id} article={article} onPublishSnap={publishToSnapchat} onPublishTG={publishToTelegram} />
          ))}
        </div>

        {articles.length === 0 && !genState.loading && (
          <div className="text-center py-32 border-2 border-dashed border-white/5 rounded-[60px] opacity-30">
            <i className="fa-solid fa-newspaper text-8xl mb-6"></i>
            <p className="text-2xl font-bold">لا يوجد محتوى حالياً. ابدأ بالضحك والتوليد الآن!</p>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-3xl border border-white/10 px-12 py-6 rounded-full shadow-2xl flex items-center gap-14 z-[60]">
        <button className="text-yellow-400 text-3xl hover:scale-125 transition-transform"><i className="fa-solid fa-house"></i></button>
        <button onClick={() => handleGenerate(categories[Math.floor(Math.random() * categories.length)])} className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center text-black shadow-2xl shadow-yellow-400/50 hover:scale-110 active:scale-90 transition-all border-8 border-[#020617]">
          <i className="fa-solid fa-plus text-3xl"></i>
        </button>
        <button onClick={() => setShowSettings(true)} className="text-slate-400 text-3xl hover:text-white transition-transform"><i className="fa-solid fa-paper-plane"></i></button>
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
    [Category.TOURISM]: "fa-plane-departure text-sky-400",
  };
  return <i className={`fa-solid ${icons[category] || 'fa-star'} text-xl`}></i>;
};

const StoryCard: React.FC<{ 
  article: SnapArticle; 
  onPublishSnap: (article: SnapArticle) => Promise<boolean>;
  onPublishTG: (article: SnapArticle) => Promise<boolean>;
}> = ({ article, onPublishSnap, onPublishTG }) => {
  const [isPublishing, setIsPublishing] = useState<'snap' | 'tg' | null>(null);

  const handlePublish = async (type: 'snap' | 'tg') => {
    setIsPublishing(type);
    if (type === 'snap') await onPublishSnap(article);
    else await onPublishTG(article);
    setIsPublishing(null);
  };

  return (
    <div className="bg-slate-900/40 rounded-[60px] overflow-hidden border border-white/5 group hover:border-white/20 transition-all flex flex-col shadow-2xl relative group">
      <div className="absolute top-8 left-8 z-30 flex flex-col gap-3">
        <span className="bg-yellow-400 text-black text-[11px] font-black px-4 py-1.5 rounded-full flex items-center gap-2 shadow-xl border border-white/10">
          <i className="fa-solid fa-face-grin-tears"></i> منشور ساخر
        </span>
        <span className="bg-black/60 backdrop-blur-xl text-white text-[10px] font-bold px-4 py-1.5 rounded-full border border-white/10 text-center">
          {article.category}
        </span>
      </div>
      
      <div className="relative aspect-[9/16] overflow-hidden bg-slate-800">
        <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <button onClick={() => {
                const link = document.createElement('a');
                link.href = article.imageUrl;
                link.download = `K3333BI-${article.id}.png`;
                link.click();
              }} className="bg-white text-black p-5 rounded-full shadow-2xl hover:scale-110 transition-transform">
                <i className="fa-solid fa-expand text-2xl"></i>
             </button>
        </div>
      </div>

      <div className="p-8 bg-slate-900/90 backdrop-blur-3xl border-t border-white/5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => handlePublish('snap')}
            disabled={isPublishing !== null}
            className="bg-yellow-400 text-black py-5 rounded-[25px] font-black text-sm hover:bg-yellow-300 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-yellow-400/10"
          >
            {isPublishing === 'snap' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-snapchat text-xl"></i>}
            نشر سناب
          </button>
          <button 
            onClick={() => handlePublish('tg')}
            disabled={isPublishing !== null}
            className="bg-sky-500 text-white py-5 rounded-[25px] font-black text-sm hover:bg-sky-400 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-sky-500/10"
          >
            {isPublishing === 'tg' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-telegram text-xl"></i>}
            تليقرام
          </button>
        </div>
        <button 
          onClick={() => {
            const link = document.createElement('a');
            link.href = article.imageUrl;
            link.download = `SNAP-${article.id}.png`;
            link.click();
          }}
          className="w-full bg-white/5 text-slate-400 py-3 rounded-2xl text-[11px] font-bold hover:bg-white/10 border border-white/5 transition-all text-center"
        >
          <i className="fa-solid fa-cloud-arrow-down mr-2"></i> حفظ الصورة النهائية
        </button>
      </div>
    </div>
  );
};

export default App;
