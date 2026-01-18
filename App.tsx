
import React, { useState, useEffect, useRef } from 'react';
import { Category, SnapArticle, GenerationState, PublishConfig } from './types';
import { fetchNewsAndGenerateSnap, editNewsArticle } from './geminiService';

const App: React.FC = () => {
  const [articles, setArticles] = useState<SnapArticle[]>([]);
  const [genState, setGenState] = useState<GenerationState>({
    loading: false,
    error: null,
    currentProgress: ""
  });
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // الحالة الفعلية للإعدادات المستخدمة في النشر
  const [config, setConfig] = useState<PublishConfig>({
    tgBotToken: localStorage.getItem('tg_bot_token') || '',
    tgChatId: localStorage.getItem('tg_chat_id') || '',
    tgEnabled: localStorage.getItem('tg_enabled') === 'true'
  });

  // حالة مؤقتة للنموذج (Form) لمنع التغييرات غير المكتملة من الحفظ التلقائي
  const [formConfig, setFormConfig] = useState({
    tgBotToken: localStorage.getItem('tg_bot_token') || '',
    tgChatId: localStorage.getItem('tg_chat_id') || '',
    tgEnabled: localStorage.getItem('tg_enabled') === 'true'
  });

  const categories = Object.values(Category);
  const autoPilotTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // تحديث الإعدادات النشطة والحفظ في التخزين المحلي
  const handleSaveConfig = () => {
    localStorage.setItem('tg_bot_token', formConfig.tgBotToken);
    localStorage.setItem('tg_chat_id', formConfig.tgChatId);
    localStorage.setItem('tg_enabled', String(formConfig.tgEnabled));
    setConfig({ ...formConfig });
    setShowSettings(false);
  };

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

        ctx.drawImage(img, 0, 0, 1080, 1920);

        const gradTop = ctx.createLinearGradient(0, 0, 0, 750);
        gradTop.addColorStop(0, 'rgba(0,0,0,1)'); 
        gradTop.addColorStop(0.4, 'rgba(0,0,0,0.85)');
        gradTop.addColorStop(1, 'transparent');
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, 0, 1080, 750);

        const frameX = 50;
        const frameY = 1250;
        const frameW = 980;
        const frameH = 540;
        const radius = 60;

        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(frameX, frameY, frameW, frameH, radius);
        else ctx.rect(frameX, frameY, frameW, frameH);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 60;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 252, 0, 0.4)';
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

        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#FFFC00';
        ctx.font = 'bold 98px Tajawal, sans-serif';
        const titleLines = wrapText(article.title, 940);
        let titleY = 280;
        titleLines.forEach(line => {
          ctx.fillText(line, 540, titleY);
          titleY += 115;
        });
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#FFFC00';
        ctx.font = 'bold 40px Tajawal, sans-serif';
        ctx.fillText(`⚡ ${article.category} ⚡`, 540, frameY + 80);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '500 46px Tajawal, sans-serif';
        const descLines = wrapText(article.description, 900);
        let descY = frameY + 185;
        descLines.forEach((line, i) => {
          if (i < 5) {
            ctx.fillText(line, 540, descY);
            descY += 78;
          }
        });

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 30px Tajawal, sans-serif';
        ctx.fillText(`${article.newsDate}`, 540, frameY + 490);

        const wmW = 240;
        const wmH = 55;
        const wmX = (1080 - wmW) / 2;
        const wmY = 1840;
        
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(wmX, wmY, wmW, wmH, 15);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.strokeStyle = '#FFFC00';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#FFFC00';
        ctx.font = 'bold 28px Tajawal, sans-serif';
        ctx.fillText('👻 K3333BI', 540, wmY + 38);
        ctx.restore();

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

  const publishToTelegram = async (article: SnapArticle) => {
    let token = config.tgBotToken.trim();
    if (token.toLowerCase().startsWith('bot')) token = token.substring(3);
    const chatId = config.tgChatId.trim();
    if (!token || !chatId || !config.tgEnabled) return false;

    try {
      const url = `https://api.telegram.org/bot${token}/sendPhoto`;
      const caption = `<b>${article.title}</b>\n\n📅 ${article.newsDate}\n\n${article.description}\n\n👻 Snapchat: K3333BI\n\n🔗 المصادر:\n${article.sources?.map(s => `<a href="${s.uri}">${s.title}</a>`).join('\n') || 'تحقق ذكي'}`;
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', base64ToBlob(article.imageUrl), 'story.png');
      formData.append('caption', caption.substring(0, 1024));
      formData.append('parse_mode', 'HTML');
      const res = await fetch(url, { method: 'POST', body: formData });
      return res.ok;
    } catch (err) { return false; }
  };

  const handleGenerate = async (category: Category) => {
    if (genState.loading) return;
    setGenState({ loading: true, error: null, currentProgress: `جاري صيد خبر ذكي عن ${category}...` });
    try {
      const newSnap = await fetchNewsAndGenerateSnap(category);
      newSnap.imageUrl = await bakeFullArticleToImage(newSnap);
      setArticles(prev => [newSnap, ...prev]);
      setGenState({ loading: false, error: null, currentProgress: "" });
      
      if (config.tgEnabled) await publishToTelegram(newSnap);
    } catch (err: any) {
      setGenState({ loading: false, error: "فشل التوليد. تحقق من الاتصال.", currentProgress: "" });
      setIsAutoPilot(false); 
    }
  };

  const handleEditArticle = async (article: SnapArticle, command: string) => {
    const updatedData = await editNewsArticle(article, command);
    const updatedArticle = { ...article, title: updatedData.title, description: updatedData.content };
    updatedArticle.imageUrl = await bakeFullArticleToImage(updatedArticle);
    setArticles(prev => prev.map(a => a.id === article.id ? updatedArticle : a));
  };

  useEffect(() => {
    if (isAutoPilot) {
      const run = () => handleGenerate(categories[Math.floor(Math.random() * categories.length)]);
      run();
      autoPilotTimer.current = setInterval(run, 1500000); 
    } else if (autoPilotTimer.current) {
      clearInterval(autoPilotTimer.current);
    }
    return () => { if (autoPilotTimer.current) clearInterval(autoPilotTimer.current); };
  }, [isAutoPilot]);

  const isTelegramConfigured = config.tgBotToken && config.tgChatId;

  return (
    <div className="min-h-screen bg-[#020617] text-white pb-24 font-['Tajawal']" dir="rtl">
      <header className="sticky top-0 z-50 bg-[#020617]/95 backdrop-blur-2xl border-b border-white/5 p-4 shadow-2xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-400 rounded-[20px] flex items-center justify-center text-black shadow-lg shadow-yellow-400/20 transform hover:rotate-12 transition-transform">
              <i className="fa-solid fa-newspaper text-3xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">سناب تيك <span className="text-[10px] bg-sky-500 text-white px-1.5 py-0.5 rounded-md mr-1 uppercase">Pro</span></h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                K3333BI 
                {isTelegramConfigured && <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
                {isTelegramConfigured ? 'متصل بالتليقرام' : 'غير متصل'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSettings(true)} className="relative w-11 h-11 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition-all active:scale-90">
              <i className="fa-solid fa-gear text-slate-300"></i>
              {isTelegramConfigured && <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 rounded-full border-2 border-[#020617] flex items-center justify-center text-[8px] font-bold">L</span>}
            </button>
            <button onClick={() => setIsAutoPilot(!isAutoPilot)} className={`px-5 py-2.5 rounded-full font-black text-xs transition-all flex items-center gap-2 border shadow-lg ${isAutoPilot ? 'bg-green-500/20 border-green-500 text-green-400 shadow-green-500/10' : 'bg-white/5 border-white/10 text-slate-400'}`}>
              <i className={`fa-solid ${isAutoPilot ? 'fa-circle-dot animate-pulse' : 'fa-power-off'}`}></i>
              {isAutoPilot ? 'النظام نشط' : 'بدء النشر'}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/10 rounded-[50px] p-10 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <button onClick={() => { setFormConfig({...config}); setShowSettings(false); }} className="absolute top-8 left-8 text-slate-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-2xl"></i></button>
            <h3 className="text-3xl font-black mb-8 text-sky-400 text-center">تثبيت حساب التليقرام</h3>
            
            <div className="space-y-8">
              <div className="p-6 bg-white/5 rounded-[35px] border border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-white"><i className="fa-brands fa-telegram text-xl"></i></div>
                  <div className="flex flex-col">
                    <span className="font-black text-lg leading-none">ربط البوت</span>
                    <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">Permanent Connection</span>
                  </div>
                  <button onClick={() => setFormConfig({...formConfig, tgEnabled: !formConfig.tgEnabled})} className={`mr-auto w-12 h-6 rounded-full relative transition-all ${formConfig.tgEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formConfig.tgEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <span className="absolute right-5 -top-2.5 bg-slate-900 px-2 text-[10px] font-bold text-slate-500 uppercase">Bot Token</span>
                    <input type="text" value={formConfig.tgBotToken} onChange={(e) => setFormConfig({...formConfig, tgBotToken: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-sky-400 transition-colors font-mono" placeholder="7123456789:AAH..." />
                  </div>
                  <div className="relative">
                    <span className="absolute right-5 -top-2.5 bg-slate-900 px-2 text-[10px] font-bold text-slate-500 uppercase">Chat ID</span>
                    <input type="text" value={formConfig.tgChatId} onChange={(e) => setFormConfig({...formConfig, tgChatId: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-sky-400 transition-colors" placeholder="-100123456789" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={handleSaveConfig} className="w-full bg-sky-500 text-white font-black py-5 rounded-[30px] hover:bg-sky-400 transition-all shadow-xl shadow-sky-500/20 active:scale-95 text-lg flex items-center justify-center gap-3">
                  <i className="fa-solid fa-lock"></i>
                  حفظ وتثبيت الحساب
                </button>
                <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">سيتم حفظ البيانات بشكل دائم في هذا المتصفح</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <section className="mb-16 text-center md:text-right pt-8">
          <h2 className="text-5xl md:text-8xl font-black mb-6 leading-tight tracking-tight">أخبار <span className="text-rose-500">ذكية</span></h2>
          <p className="text-slate-400 text-xl leading-relaxed max-w-3xl md:mr-0 mr-auto">صناعة محتوى ساخر ومكتمل، مع نشر آلي ثابت ومستقر لقناتك على التليقرام.</p>
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
            <div className="w-28 h-28 bg-rose-500 rounded-[35px] flex items-center justify-center mx-auto mb-8 text-white shadow-2xl shadow-rose-500/40 animate-pulse">
              <i className="fa-solid fa-wand-magic-sparkles text-5xl"></i>
            </div>
            <h3 className="text-rose-500 font-black text-3xl mb-3 tracking-wide animate-pulse">جاري تحضير المحتوى...</h3>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-14">
          {articles.map(article => (
            <StoryCard key={article.id} article={article} onPublishTG={publishToTelegram} onEdit={handleEditArticle} isTGEnabled={config.tgEnabled} />
          ))}
        </div>
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-3xl border border-white/10 px-12 py-6 rounded-full shadow-2xl flex items-center gap-14 z-[60]">
        <button className="text-yellow-400 text-3xl hover:scale-125 transition-transform"><i className="fa-solid fa-house"></i></button>
        <button onClick={() => handleGenerate(categories[Math.floor(Math.random() * categories.length)])} className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-rose-500/50 hover:scale-110 active:scale-90 transition-all border-8 border-[#020617]">
          <i className="fa-solid fa-plus text-3xl"></i>
        </button>
        <button onClick={() => setShowSettings(true)} className="text-slate-400 text-3xl hover:text-white transition-transform relative">
          <i className="fa-solid fa-paper-plane"></i>
          {isTelegramConfigured && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-slate-900"></span>}
        </button>
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
    [Category.HEALTH]: "fa-heart-pulse text-rose-400",
    [Category.BEAUTY]: "fa-sparkles text-pink-400",
    [Category.FUNNY]: "fa-face-laugh-squint text-orange-400",
    [Category.IDEAS]: "fa-lightbulb text-yellow-500",
    [Category.TOURISM]: "fa-plane-departure text-sky-400",
  };
  return <i className={`fa-solid ${icons[category] || 'fa-star'} text-xl`}></i>;
};

const StoryCard: React.FC<{ 
  article: SnapArticle; 
  onPublishTG: (article: SnapArticle) => Promise<boolean>;
  onEdit: (article: SnapArticle, command: string) => Promise<void>;
  isTGEnabled: boolean;
}> = ({ article, onPublishTG, onEdit, isTGEnabled }) => {
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showEditPanel, setShowEditPanel] = useState<boolean>(false);
  const [command, setCommand] = useState<string>('');

  const handlePublish = async () => {
    setIsPublishing(true);
    await onPublishTG(article);
    setIsPublishing(false);
  };

  const handleApplyEdit = async () => {
    if (!command.trim()) return;
    setIsEditing(true);
    await onEdit(article, command);
    setIsEditing(false);
    setShowEditPanel(false);
    setCommand('');
  };

  return (
    <div className="bg-slate-900/40 rounded-[60px] overflow-hidden border border-white/5 group hover:border-white/20 transition-all flex flex-col shadow-2xl relative">
      <div className="absolute top-8 left-8 z-30 flex flex-col gap-3">
        <span className="bg-yellow-400 text-black text-[11px] font-black px-4 py-1.5 rounded-full flex items-center gap-2 shadow-xl border border-white/10">
          <i className="fa-solid fa-check-circle"></i> خبر محقق
        </span>
      </div>
      
      <div className="relative aspect-[9/16] overflow-hidden bg-slate-800">
        <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110" />
        
        {showEditPanel && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-40 p-8 flex flex-col justify-center gap-6 animate-in slide-in-from-bottom duration-300">
            <h4 className="text-rose-400 font-black text-xl text-center">أوامر الذكاء الاصطناعي</h4>
            <textarea 
              value={command} 
              onChange={(e) => setCommand(e.target.value)}
              className="w-full h-40 bg-white/5 border border-white/10 rounded-3xl p-5 text-sm outline-none focus:border-rose-500 transition-colors resize-none text-white"
              placeholder="مثال: اجعل الخبر كوميدياً أكثر، أو حوله إلى صيغة سؤال محير..."
            />
            <div className="flex gap-4">
              <button 
                onClick={handleApplyEdit}
                disabled={isEditing}
                className="flex-1 bg-rose-500 text-white py-4 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg shadow-rose-500/20"
              >
                {isEditing ? <i className="fa-solid fa-spinner animate-spin"></i> : 'تنفيذ'}
              </button>
              <button 
                onClick={() => setShowEditPanel(false)}
                className="px-6 bg-white/5 text-slate-400 py-4 rounded-2xl text-sm hover:bg-white/10 transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-slate-900/90 backdrop-blur-3xl border-t border-white/5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handlePublish}
            disabled={isPublishing || !isTGEnabled}
            className={`py-5 rounded-[25px] font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl ${isTGEnabled ? 'bg-sky-500 text-white hover:bg-sky-400 shadow-sky-500/10' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}
          >
            {isPublishing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-telegram text-xl"></i>}
            نشر فوري
          </button>
          <button 
            onClick={() => setShowEditPanel(true)}
            className="bg-white/5 text-rose-400 py-5 rounded-[25px] font-black text-sm hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-3 border border-white/5"
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            تحسين AI
          </button>
        </div>
        <button 
          onClick={() => {
            const link = document.createElement('a');
            link.href = article.imageUrl;
            link.download = `STORY-${article.id}.png`;
            link.click();
          }}
          className="w-full bg-white/5 text-slate-400 py-3 rounded-2xl text-[11px] font-bold hover:bg-white/10 border border-white/5 transition-all text-center"
        >
          <i className="fa-solid fa-cloud-arrow-down mr-2"></i> حفظ في الألبوم
        </button>
      </div>
    </div>
  );
};

export default App;
