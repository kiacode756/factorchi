import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  Loader2,
  Trash2,
  Plus,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Send,
  Printer,
  QrCode,
  Share2,
  Copy,
  Info,
  CreditCard,
  ExternalLink,
  Lock,
  AlertCircle,
  Check,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { Invoice, InvoiceItem, Profile } from '../types';
import {
  formatToman,
  toPersianDigits,
  copyToClipboard,
  formatPhoneForWhatsApp,
  formatNumberWithCommas,
  removeCommas,
  persianToEnglishDigits,
} from '../lib/utils';

interface VoiceInvoiceCreatorProps {
  onSaveInvoice: (invoice: Partial<Invoice>) => Promise<Invoice>;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onNavigateToBilling?: () => void;
  profile?: Profile | null;
}

export const VoiceInvoiceCreator: React.FC<VoiceInvoiceCreatorProps> = ({
  onSaveInvoice,
  onNavigateToInvoice,
  onNavigateToBilling,
  profile,
}) => {
  const isExpired = Boolean(
    profile &&
    profile.role !== 'admin' &&
    profile.email?.toLowerCase() !== 'bagherikiarash74@gmail.com' &&
    profile.subscription_status === 'expired'
  );
  // Mode: record vs upload vs text simulation
  const [mode, setMode] = useState<'record' | 'upload' | 'text'>('record');
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [simulatedText, setSimulatedText] = useState<string>(
    'فاکتور برای آقای محمدی شرکت آریا تلفن ۰۹۱۲۱۲۳۴۵۶۷ دو عدد طرح هویت بصری و لوگو هر کدام ۲ میلیون تومان و یک عدد مشاوره برندینگ ۱ میلیون پانصد هزار تومان'
  );

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>('');
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  // File Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<number>(0); // 0, 1, 2
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [aiConfidence, setAiConfidence] = useState<number>(95);

  // Form State - Initialized completely empty for new invoice
  const [invoiceName, setInvoiceName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<{ id: string; name: string; quantity: number | string; unit_price: number | string }[]>([
    { id: 'itm-1', name: '', quantity: '1', unit_price: '' },
  ]);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [taxRate, setTaxRate] = useState<number | string>('');
  const [notes, setNotes] = useState<string>('');

  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedPayLink, setCopiedPayLink] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<{
    type: 'error' | 'success' | 'info';
    message: string;
  } | null>(null);

  const showNotice = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setVoiceNotice({ type, message });
    setTimeout(() => {
      setVoiceNotice((curr) => (curr?.message === message ? null : curr));
    }, 6000);
  };

  const isSavingRef = useRef(false);
  const lastSaveTimestampRef = useRef<number>(0);
  const clientRequestIdRef = useRef<string | null>(null);

  // Helper to safely parse numeric inputs (treat empty string as 0 in calculations)
  const parseNum = (val: string | number | undefined | null): number => {
    if (val === '' || val === undefined || val === null) return 0;
    const clean = removeCommas(persianToEnglishDigits(String(val)));
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, [audioUrl]);

  // Audio duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [isRecording]);

  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Start direct voice recording
  const startRecording = async () => {
    try {
      // Configure high-quality audio recording with auto gain and noise cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Boost low volume input
          sampleRate: 44100,
        },
      });
      audioChunksRef.current = [];
      liveTranscriptRef.current = '';
      setLiveTranscript('');

      // Set up AudioContext and Analyser for real-time visual feedback and volume detection
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(updateVolume);
            }
          };
          updateVolume();
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext volume visualizer init warning:', audioCtxErr);
      }

      let chosenMime = '';
      if (typeof MediaRecorder !== 'undefined') {
        const supportedTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/aac',
          'audio/ogg;codecs=opus',
          'audio/ogg',
        ];
        for (const type of supportedTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            chosenMime = type;
            break;
          }
        }
      }

      const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch (_) {}
        }
        setAudioLevel(0);

        const actualType = recorder.mimeType || chosenMime || 'audio/webm';
        const recordedBlob = new Blob(audioChunksRef.current, { type: actualType });
        setAudioBlob(recordedBlob);
        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());

        // Automatically trigger Gemini AI extraction on stop
        processVoiceWithAI(recordedBlob);
      };

      // Optional Browser Speech Recognition for Persian (interim live text aid)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognizer = new SpeechRecognition();
          recognizer.lang = 'fa-IR';
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.onresult = (event: any) => {
            let current = '';
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript + ' ';
            }
            const clean = current.trim();
            if (clean) {
              liveTranscriptRef.current = clean;
              setLiveTranscript(clean);
            }
          };
          recognizer.onerror = (err: any) => {
            console.warn('Speech recognition notice:', err);
          };
          recognizer.start();
          speechRecognitionRef.current = recognizer;
        } catch (e) {
          console.warn('Speech recognition init error:', e);
        }
      }

      recorder.start(100); // Collect in smaller chunks (100ms) to prevent lost packets
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showNotice('دسترسی به میکروفون امکان‌پذیر نشد. لطفاً در تنظیمات مرورگر اجازه استفاده از میکروفون را بدهید یا از تب «شبیه‌ساز متن گفتار» استفاده فرمایید.');
    }
  };

  // Stop direct voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      } catch (_) {}
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
    }
  };

  // Toggle Audio Playback
  const togglePlayAudio = () => {
    if (!audioElementRef.current) return;
    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  // Handle file drop / select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        showNotice('حجم فایل نباید بیشتر از ۲۵ مگابایت باشد.');
        return;
      }
      setUploadedFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setAudioBlob(file);
      // Automatically trigger AI extraction on file selection
      processVoiceWithAI(file);
    }
  };

  // Process Voice / File / Text with AI
  const processVoiceWithAI = async (customParam?: string | Blob | File | React.MouseEvent | any) => {
    let explicitText: string | undefined;
    let explicitAudio: Blob | File | undefined;

    if (typeof customParam === 'string') {
      explicitText = customParam.trim();
    } else if (customParam && (customParam instanceof Blob || customParam instanceof File)) {
      explicitAudio = customParam;
    }

    const currentAudio = explicitAudio || audioBlob || uploadedFile;
    const isTextMode = mode === 'text' || !!explicitText;
    const textToSend = explicitText || (mode === 'text' ? simulatedText.trim() : (liveTranscriptRef.current || '').trim());

    if (isExpired) {
      showNotice('دوره اشتراک شما به پایان رسیده است. برای صدور فاکتور صوتی، لطفاً فیش واریز خود را در بخش مدیریت اشتراک ارسال فرمایید.');
      if (onNavigateToBilling) onNavigateToBilling();
      return;
    }

    if (isTextMode && !textToSend) {
      showNotice('لطفاً متن فاکتور یا گفتار را وارد کنید یا یکی از نمونه‌های آماده را انتخاب فرمایید.');
      return;
    }

    if (!isTextMode && !currentAudio && !textToSend) {
      showNotice('لطفاً ابتدا با میکروفون صدا ضبط کنید، یک فایل صوتی انتخاب کنید یا از تب «شبیه‌ساز متن گفتار» استفاده فرمایید.');
      return;
    }

    if (!isTextMode && currentAudio && currentAudio.size < 200 && (!textToSend || textToSend.trim().length < 2)) {
      showNotice('صدای ضبط‌شده بسیار کوتاه یا فاقد محتوا است. لطفاً مجدداً دکمه ضبط را فشار داده و با صدای رسا صحبت فرمایید.');
      return;
    }

    setProcessing(true);
    setProcessStep(0); // Transcription step

    try {
      const stepTimer1 = setTimeout(() => setProcessStep(1), 350);
      const stepTimer2 = setTimeout(() => setProcessStep(2), 700);

      let response: Response;

      // When audio is present, always send the actual audio file to the backend
      // and include live transcript as an auxiliary hint.
      if (!isTextMode && currentAudio) {
        const formData = new FormData();
        const ext = currentAudio.type?.includes('mp4') ? 'm4a' : currentAudio.type?.includes('wav') ? 'wav' : 'webm';
        formData.append('audio_file', currentAudio, `voice.${ext}`);
        formData.append('mimeType', currentAudio.type || 'audio/webm');
        if (textToSend) {
          formData.append('live_transcript', textToSend);
        }
        response = await fetch('/api/ai/voice-to-invoice', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'x-user-id': profile?.id || '',
          },
          body: formData,
        });
      } else {
        // Pure text mode or simulated text
        response = await fetch('/api/ai/voice-to-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-user-id': profile?.id || '',
          },
          body: JSON.stringify({ text: textToSend }),
        });
      }

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      let result: any = null;
      if (isJson) {
        try {
          result = await response.json();
        } catch (jsonErr) {
          console.warn('[Voice AI] Error parsing response JSON:', jsonErr);
        }
      }

      if (response.status === 403) {
        showNotice(result?.error || 'اشتراک شما منقضی شده است. برای فعال‌سازی ۳۰ روزه، فیش واریز را بارگذاری فرمایید.');
        if (onNavigateToBilling) onNavigateToBilling();
        setProcessing(false);
        return;
      }

      const applyInvoiceData = (d: any) => {
        setTranscriptionText(d.transcription || textToSend || 'استخراج هوشمند اطلاعات فاکتور با هوش مصنوعی انجام شد');
        if (d.invoice_name) setInvoiceName(d.invoice_name);
        if (d.customer_name) setCustomerName(d.customer_name);
        if (d.customer_phone) setCustomerPhone(d.customer_phone);
        
        const validItems = Array.isArray(d.items) && d.items.length > 0 
          ? d.items.filter((it: any) => it.name && it.name.trim()) 
          : [];

        if (validItems.length > 0) {
          setItems(
            validItems.map((it: any, idx: number) => ({
              id: `itm-${Date.now()}-${idx}`,
              name: it.name || '',
              quantity: it.quantity ? String(it.quantity) : '1',
              unit_price: it.unit_price ? String(it.unit_price) : '',
            }))
          );
        } else {
          setItems([{ id: `itm-${Date.now()}-0`, name: '', quantity: '1', unit_price: '' }]);
          if (!d.customer_name && !textToSend && (!d.transcription || d.transcription.length < 3)) {
            showNotice('متن یا قلمی از ویس ضبط‌شده تشخیص داده نشد. لطفاً در محیطی آرام‌تر یا با صدای واضح‌تر صحبت فرمایید یا از تب «شبیه‌ساز متن گفتار» استفاده کنید.', 'info');
          }
        }

        if (d.discount_type === 'percent') {
          setDiscountType('percent');
          setDiscountValue(d.discount_percent ? String(d.discount_percent) : '');
        } else {
          setDiscountType('amount');
          setDiscountValue(typeof d.discount === 'number' && d.discount > 0 ? String(d.discount) : '');
        }

        setTaxRate(typeof d.tax_rate === 'number' && d.tax_rate > 0 ? String(d.tax_rate) : '');
        if (d.notes) setNotes(d.notes);
        if (d.confidence) setAiConfidence(d.confidence);
      };

      if (response.ok && result && result.success && result.data) {
        applyInvoiceData(result.data);
      } else if (!isJson) {
        // Fallback: server/proxy returned non-JSON. If live transcript is present, retry with text
        if (textToSend && textToSend.trim().length >= 2) {
          try {
            const retryResp = await fetch('/api/ai/voice-to-invoice', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-user-id': profile?.id || '',
              },
              body: JSON.stringify({ text: textToSend }),
            });
            const retryContentType = retryResp.headers.get('content-type') || '';
            if (retryResp.ok && retryContentType.includes('application/json')) {
              const retryData = await retryResp.json();
              if (retryData?.success && retryData?.data) {
                applyInvoiceData(retryData.data);
                showNotice('اطلاعات فاکتور با موفقیت از متن گفتار استخراج شد.', 'success');
                return;
              }
            }
          } catch (retryErr) {
            console.warn('[Voice AI] Text fallback failed:', retryErr);
          }
        }
        showNotice('ارتباط با سرور برقرار نشد یا پاسخی نامعتبر دریافت گردید. لطفاً مجدداً تلاش فرمایید.');
      } else {
        showNotice(result?.error || 'خطا در برقراری ارتباط با سرویس هوش مصنوعی.');
      }
    } catch (err) {
      console.error('Error processing audio with AI:', err);
      showNotice('خطا در پردازش هوش مصنوعی. لطفاً دوباره تلاش فرمایید.');
    } finally {
      setProcessing(false);
    }
  };

  // Item modifications
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { id: `itm-${Date.now()}`, name: '', quantity: '1', unit_price: '' },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce(
    (sum, item) => sum + parseNum(item.quantity) * parseNum(item.unit_price),
    0
  );
  const parsedDiscountNum = parseNum(discountValue);
  const calculatedDiscountAmount = discountType === 'percent'
    ? Math.round(subtotal * (parsedDiscountNum / 100))
    : parsedDiscountNum;
  const discountedSubtotal = Math.max(0, subtotal - calculatedDiscountAmount);
  const taxAmount = Math.round(discountedSubtotal * (parseNum(taxRate) / 100));
  const finalTotal = discountedSubtotal + taxAmount;

  // Format timer MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${toPersianDigits(mins.toString().padStart(2, '0'))}:${toPersianDigits(
      secs.toString().padStart(2, '0')
    )}`;
  };

  // Apply Prompt Example
  const applyExamplePrompt = async (exampleText: string) => {
    setSimulatedText(exampleText);
    setMode('text');
    await processVoiceWithAI(exampleText);
  };

  // Save Invoice
  const handleSaveInvoice = async () => {
    // Prevent duplicate triggers, rapid multi-clicks, or re-saving an already saved invoice
    if (isSaving || isSavingRef.current || savedInvoice) {
      return;
    }
    const now = Date.now();
    if (now - lastSaveTimestampRef.current < 2500) {
      return;
    }
    lastSaveTimestampRef.current = now;
    isSavingRef.current = true;
    setIsSaving(true);

    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = `req-${now}-${Math.random().toString(36).slice(2, 9)}`;
    }

    const chosenName = invoiceName.trim() || (customerName.trim() ? `فاکتور ${customerName.trim()}` : (items[0]?.name?.trim() ? `فاکتور ${items[0].name.trim()}` : 'فاکتور جدید'));

    try {
      const newInv = await onSaveInvoice({
        client_request_id: clientRequestIdRef.current,
        idempotency_key: clientRequestIdRef.current,
        title: chosenName,
        invoice_name: chosenName,
        invoice_number: chosenName,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: items.map((it) => ({
          id: it.id,
          name: it.name || 'کالا / خدمت',
          quantity: parseNum(it.quantity) || 1,
          unit_price: parseNum(it.unit_price),
        })),
        discount: calculatedDiscountAmount,
        discount_type: discountType,
        discount_percent: discountType === 'percent' ? parsedDiscountNum : (subtotal > 0 && calculatedDiscountAmount > 0 ? Math.round((calculatedDiscountAmount / subtotal) * 100) : 0),
        tax_rate: parseNum(taxRate),
        total_amount: finalTotal,
        status: 'sent',
        voice_input_used: true,
        voice_input_method: mode,
        notes,
        origin: window.location.origin,
      } as any);

      setSavedInvoice(newInv);

      // Generate WhatsApp Link
      try {
        const wpRes = await fetch('/api/whatsapp/send-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: newInv.id,
            customer_phone: customerPhone,
            origin: window.location.origin,
          }),
        });

        if (wpRes.ok) {
          const wpData = await wpRes.json();
          if (wpData.success && wpData.whatsapp_link) {
            setWhatsappLink(wpData.whatsapp_link);
          }
        } else {
          const formattedPhone = formatPhoneForWhatsApp(customerPhone);
          const payUrl = `${window.location.origin}/payment/${newInv.id}`;
          const fallbackMsg = `سلام ${customerName || 'مشتری'} عزیز 🌸\nفاکتور شماره ${newInv.invoice_number} صادر شد.\n\n💰 مبلغ کل: ${formatToman(newInv.total_amount)}\n\n💳 مشاهده و پرداخت:\n${payUrl}\n\nبا تشکر`;
          const fallbackUrl = formattedPhone 
            ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fallbackMsg)}`
            : `https://wa.me/?text=${encodeURIComponent(fallbackMsg)}`;
          setWhatsappLink(fallbackUrl);
        }
      } catch (e) {
        const formattedPhone = formatPhoneForWhatsApp(customerPhone);
        const payUrl = `${window.location.origin}/payment/${newInv.id}`;
        const fallbackMsg = `فاکتور شماره ${newInv.invoice_number}\nمبلغ: ${formatToman(newInv.total_amount)}\nلینک پرداخت: ${payUrl}`;
        const fallbackUrl = formattedPhone 
          ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fallbackMsg)}`
          : `https://wa.me/?text=${encodeURIComponent(fallbackMsg)}`;
        setWhatsappLink(fallbackUrl);
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      // Reset clientRequestId on actual error so user can retry safely
      clientRequestIdRef.current = null;
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  // Helper to inspect phone validity & format
  const getPhoneValidation = (phone: string) => {
    if (!phone) return null;
    const cleanDigits = persianToEnglishDigits(phone).replace(/\D/g, '');
    if (!cleanDigits) return null;

    if (cleanDigits.startsWith('09')) {
      if (cleanDigits.length === 11) {
        return { type: 'valid' as const, message: 'شماره ۱۱ رقمی معتبر ✓', digits: cleanDigits, suggested: cleanDigits };
      }
      if (cleanDigits.length > 11) {
        return {
          type: 'extra' as const,
          message: `شماره بیش از ۱۱ رقم است (${toPersianDigits(cleanDigits.length)} رقم) - رقم یا صفر اضافه دارد!`,
          digits: cleanDigits,
          suggested: cleanDigits.slice(0, 11),
        };
      }
      return {
        type: 'incomplete' as const,
        message: `${toPersianDigits(cleanDigits.length)} از ۱۱ رقم وارد شده`,
        digits: cleanDigits,
        suggested: cleanDigits,
      };
    }

    if (cleanDigits.startsWith('9') && cleanDigits.length === 10) {
      return { type: 'valid' as const, message: 'شماره معتبر (بدون صفر اول) ✓', digits: '0' + cleanDigits, suggested: '0' + cleanDigits };
    }

    if (cleanDigits.startsWith('0098') || cleanDigits.startsWith('98')) {
      const trimmed = cleanDigits.startsWith('0098') ? '0' + cleanDigits.substring(4) : '0' + cleanDigits.substring(2);
      if (trimmed.length === 11) {
        return { type: 'valid' as const, message: 'کد ایران شناسایی شد ✓', digits: trimmed, suggested: trimmed };
      }
    }

    return null;
  };

  const phoneValidation = getPhoneValidation(customerPhone);

  // Update existing saved invoice if fields were modified
  const handleUpdateSavedInvoice = async () => {
    if (!savedInvoice) return;
    setIsSaving(true);
    try {
      const updatedTitle = invoiceName.trim() || savedInvoice.title || savedInvoice.invoice_number;
      const res = await fetch(`/api/invoices/${savedInvoice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': profile?.id || '',
        },
        body: JSON.stringify({
          title: updatedTitle,
          invoice_number: updatedTitle,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: items.map((it) => ({
            id: it.id,
            name: it.name || 'کالا / خدمت',
            quantity: parseNum(it.quantity) || 1,
            unit_price: parseNum(it.unit_price),
          })),
          discount: calculatedDiscountAmount,
          discount_type: discountType,
          discount_percent: discountType === 'percent' ? parsedDiscountNum : (subtotal > 0 && calculatedDiscountAmount > 0 ? Math.round((calculatedDiscountAmount / subtotal) * 100) : 0),
          tax_rate: parseNum(taxRate),
          total_amount: finalTotal,
          notes,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.invoice) {
          setSavedInvoice(json.invoice);
          showNotice(`فاکتور «${json.invoice.title || json.invoice.invoice_number}» با موفقیت ذخیره و به‌روزرسانی شد.`, 'success');
        }
      }
    } catch (err) {
      console.error('Failed to update invoice:', err);
      showNotice('خطا در به‌روزرسانی فاکتور');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form to start a fresh invoice
  const handleResetFormForNewInvoice = () => {
    setSavedInvoice(null);
    setInvoiceName('');
    setCustomerName('');
    setCustomerPhone('');
    setItems([{ id: `itm-${Date.now()}`, name: '', quantity: '1', unit_price: '' }]);
    setDiscountValue('');
    setTaxRate('');
    setNotes('');
    setSimulatedText('');
    clientRequestIdRef.current = null;
    lastSaveTimestampRef.current = 0;
    isSavingRef.current = false;
    setIsSaving(false);
  };

  // Send WhatsApp message dynamically using current customerPhone & current savedInvoice
  const handleSendWhatsAppDirect = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = formatPhoneForWhatsApp(customerPhone);

    if (customerPhone.trim() && !cleanPhone) {
      showNotice('فرمت شماره تلفن صحیح نیست. لطفاً یک شماره همراه ۱۱ رقمی معتبر وارد فرمایید (مثال: 09136516008).');
      return;
    }

    // Sync updated phone to invoice in backend if savedInvoice exists
    if (savedInvoice && savedInvoice.customer_phone !== customerPhone) {
      try {
        await fetch(`/api/invoices/${savedInvoice.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': profile?.id || '',
          },
          body: JSON.stringify({
            customer_phone: customerPhone,
            customer_name: customerName,
          }),
        });
        setSavedInvoice((prev) => (prev ? { ...prev, customer_phone: customerPhone, customer_name: customerName } : null));
      } catch (err) {
        console.error('Failed to sync updated phone:', err);
      }
    }

    const payUrl = savedInvoice ? `${window.location.origin}/payment/${savedInvoice.id}` : `${window.location.origin}/payment/inv-105`;
    const itemsSummary = items
      .filter((it) => it.name.trim())
      .map((item, idx) => `${idx + 1}. ${item.name} (${item.quantity} عدد) - ${(Number(item.unit_price) || 0).toLocaleString('fa-IR')} ت`)
      .join('\n');
    const formattedAmount = finalTotal.toLocaleString('fa-IR');
    const customerGreeting = customerName ? `${customerName} عزیز` : 'مشتری گرامی';
    const invNumber = savedInvoice?.title || savedInvoice?.invoice_number || invoiceName.trim() || 'جدید';
    const message = `سلام ${customerGreeting} 🌸\nفاکتور «${invNumber}» برای شما صادر شد.\n\n📋 *اقلام فاکتور:*\n${itemsSummary}\n\n💰 *مبلغ قابل پرداخت:* ${formattedAmount} تومان\n🔗 *لینک مشاهده و پرداخت آنلاین:*\n${payUrl}\n\nبا تشکر از اعتماد شما 🙏\n_صادر شده توسط فاکتورچی_`;

    const wpUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    // Also notify server to mark sent_via_whatsapp and update phone
    try {
      fetch('/api/whatsapp/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: savedInvoice?.id,
          customer_phone: customerPhone,
          origin: window.location.origin,
        }),
      }).catch(() => {});
    } catch (err) {}

    window.open(wpUrl, '_blank');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Hidden audio element for preview */}
      {audioUrl && (
        <audio
          ref={audioElementRef}
          src={audioUrl}
          onEnded={() => setIsPlayingAudio(false)}
          className="hidden"
        />
      )}

      {/* Left Column: Voice Input, Audio Controls, and Extraction Form */}
      <div className="xl:col-span-6 space-y-5">
        {/* Voice Notice Banner */}
        {voiceNotice && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 shadow-sm ${
              voiceNotice.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                : voiceNotice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-900/60 text-teal-700 dark:text-teal-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {voiceNotice.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              )}
              <span className="font-medium leading-relaxed">{voiceNotice.message}</span>
            </div>
            <button
              onClick={() => setVoiceNotice(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Voice Input Container */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-md shadow-teal-500/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  ساخت سریع فاکتور با صوت هوشمند
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  اقلام را به فارسی بگویید یا فایل صوتی را آپلود کنید
                </p>
              </div>
            </div>
          </div>

          {/* Expired Subscription Lock Alert */}
          {isExpired && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/30 text-rose-900 dark:text-rose-200 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 shadow-sm">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h4 className="font-bold text-sm text-rose-700 dark:text-rose-300">
                    امکان صدور فاکتور صوتی غیرفعال است (پایان اشتراک)
                  </h4>
                  <p className="text-xs text-rose-800 dark:text-rose-300/90 leading-relaxed">
                    اشتراک شما به پایان رسیده و حساب کاربری موقتاً قفل شده است. برای فعال‌سازی مجدد ۳۰ روزه، لطفاً فیش واریزی خود را در بخش مدیریت اشتراک بارگذاری فرمایید تا توسط مدیر سیستم بررسی و تأیید گردد.
                  </p>
                  {onNavigateToBilling && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={onNavigateToBilling}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>انتقال به صفحه ارسال فیش و تمدید اشتراک</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Info & Guidance Box */}
          <div className="mb-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-500/20 overflow-hidden text-xs transition-all">
            <button
              onClick={() => setInfoCollapsed(!infoCollapsed)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-teal-800 dark:text-teal-300 font-semibold bg-teal-100/50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>💡 راهنمای ضبط و نمونه جملات صوتی</span>
              </div>
              {infoCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {!infoCollapsed && (
              <div className="p-4 space-y-3 text-slate-700 dark:text-slate-300">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  کافیست به زبان محاوره‌ای و روان صحبت کنید. هوش مصنوعی نام مشتری، اقلام، تعداد، مبالغ و تخفیف‌ها را تفکیک می‌کند.
                </p>

                <div className="space-y-1.5">
                  <span className="font-bold text-[11px] text-teal-700 dark:text-teal-300">
                    نمونه جملات آماده (برای تست سریع کلیک کنید):
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    <button
                      onClick={() =>
                        applyExamplePrompt(
                          'فاکتور برای آقای محمدی، ۲ تا لوگو هر کدوم ۲ میلیون، ۵۰۰ هزار تومن تخفیف'
                        )
                      }
                      className="text-right p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-teal-500/20 hover:border-teal-500 text-[11px] text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-between group"
                    >
                      <span>🗣️ «فاکتور آقای محمدی، ۲ تا لوگو دونه‌ای ۲ میلیون، ۵۰۰ هزار تومن تخفیف»</span>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                        تخفیف تومانی ⚡
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        applyExamplePrompt(
                          'سفارش خانم حسینی، ۴ تا هودی هر کدوم ۵۰۰ هزار تومن، ۱۰ درصد تخفیف'
                        )
                      }
                      className="text-right p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-teal-500/20 hover:border-teal-500 text-[11px] text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-between group"
                    >
                      <span>🗣️ «سفارش خانم حسینی، ۴ تا هودی دونه‌ای ۵۰۰ هزار تومن، ۱۰ درصد تخفیف»</span>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                        تخفیف درصدی ⚡
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        applyExamplePrompt(
                          'شرکت آلفا، ۱۰ ماگ دونه‌ای ۱۵۰ هزار تومن، ۵ تیشرت دونه‌ای ۳۰۰ هزار تومن، ۵ درصد تخفیف و ۱۰ درصد مالیات'
                        )
                      }
                      className="text-right p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-teal-500/20 hover:border-teal-500 text-[11px] text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-between group"
                    >
                      <span>🗣️ «شرکت آلفا، ۱۰ ماگ ۱۵۰ تومن، ۵ تیشرت ۳۰۰ تومن، ۵٪ تخفیف و ۱۰٪ مالیات»</span>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                        ترکیبی ⚡
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        applyExamplePrompt(
                          'سفارش آقای رحیمی یک عدد ساعت هوشمند ۳ میلیون تومن، ۵۰۰۰ تومن تخفیف بده'
                        )
                      }
                      className="text-right p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-teal-500/20 hover:border-teal-500 text-[11px] text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-between group"
                    >
                      <span>🗣️ «آقای رحیمی یک ساعت هوشمند ۳ میلیون تومن، ۵۰۰۰ تومن تخفیف بده»</span>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                        تخفیف ۵۰۰۰ تومانی ⚡
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mode Switcher: Record vs Upload vs Text Simulation */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-5 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setMode('record')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'record'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>🎙️ ضبط صدا</span>
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'upload'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>📁 فایل صوتی</span>
            </button>
            <button
              onClick={() => setMode('text')}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'text'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✍️ متن گفتار</span>
            </button>
          </div>

          {/* Text Simulation Mode UI */}
          {mode === 'text' && (
            <div className="p-4 border-2 border-dashed border-teal-500/30 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  متن گفتار ویس فارسی (تایپ یا شبیه‌سازی صحبت کردن):
                </label>
                <textarea
                  value={simulatedText}
                  onChange={(e) => setSimulatedText(e.target.value)}
                  rows={3}
                  placeholder="مثال: فاکتور برای آقای محمدی شرکت آریا تلفن ۰۹۱۲۱۲۳۴۵۶۷ دو عدد طرح هویت بصری و لوگو هر کدام ۲ میلیون تومان..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none leading-relaxed resize-none"
                />
              </div>

              {/* Quick sample buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  تست سریع با نمونه‌های آماده:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const t = 'فاکتور برای آقای محمدی شرکت آریا تلفن ۰۹۱۲۱۲۳۴۵۶۷ دو عدد طرح هویت بصری و لوگو هر کدام ۲ میلیون تومان و یک عدد مشاوره برندینگ ۱ میلیون پانصد هزار تومان';
                      setSimulatedText(t);
                      processVoiceWithAI(t);
                    }}
                    className="text-[10px] py-1 px-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 hover:bg-teal-100 transition-colors"
                  >
                    نمونه ۱: آقای محمدی شرکت آریا (۲ قلم با قیمت)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const t = 'فاکتور به نام خانم رضایی شماره ۰۹۱۲۳۴۵۶۷۸۹ سه عدد طراحی سایت هر کدام ۵ میلیون تومان، ۵۰۰ هزار تومان تخفیف';
                      setSimulatedText(t);
                      processVoiceWithAI(t);
                    }}
                    className="text-[10px] py-1 px-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 hover:bg-teal-100 transition-colors"
                  >
                    نمونه ۲: خانم رضایی با تخفیف
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => processVoiceWithAI(simulatedText)}
                  disabled={processing || !simulatedText.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-500/20 disabled:opacity-50 transition-all hover:scale-[1.01]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>استخراج هوشمند اطلاعات فاکتور</span>
                </button>
              </div>
            </div>
          )}

          {/* Record Mode UI */}
          {mode === 'record' && (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-teal-500/30 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
              {/* Mic Main Button */}
              <div className="relative mb-4">
                {isRecording && (
                  <span className="absolute -inset-3 rounded-full bg-rose-500/20 animate-ping" />
                )}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={processing}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all hover:scale-105 active:scale-95 ${
                    isRecording
                      ? 'bg-rose-600 shadow-rose-500/40 animate-pulse'
                      : 'bg-gradient-to-tr from-teal-600 to-emerald-500 shadow-teal-500/30'
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-8 h-8 fill-white" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Status, Volume Meter, and Timer */}
              {isRecording ? (
                <div className="text-center space-y-2 w-full max-w-xs">
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                    <span>در حال ضبط صدا... برای پایان کلیک کنید</span>
                  </div>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-wider">
                    {formatTimer(recordDuration)}
                  </div>

                  {/* Real-time Voice Volume & Waveform Feedback */}
                  <div className="bg-slate-200/80 dark:bg-slate-800/80 rounded-xl p-2.5 space-y-1.5 border border-slate-300/60 dark:border-slate-700/60">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      <span>سطح بلندی صدای ورودی:</span>
                      <span className={audioLevel > 15 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400'}>
                        {audioLevel > 15 ? 'عالی و رسا 🟢' : audioLevel > 5 ? 'متوسط 🟡' : 'خیلی ضعیف (نزدیک‌تر صحبت کنید) 🔴'}
                      </span>
                    </div>
                    {/* Visual Volume Bar */}
                    <div className="w-full bg-slate-300 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-75 ${
                          audioLevel > 15
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : 'bg-gradient-to-r from-amber-500 to-rose-500'
                        }`}
                        style={{ width: `${Math.max(5, audioLevel)}%` }}
                      />
                    </div>

                    {/* Live speech preview if detected by browser speech engine */}
                    {liveTranscript && (
                      <div className="mt-2 text-right bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2 text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
                        <span className="font-bold block text-[10px] text-emerald-600 dark:text-emerald-400 mb-0.5">در حال شنیدن و تبدیل:</span>
                        <p className="line-clamp-2 leading-relaxed">{liveTranscript}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    برای شروع ضبط کلیک کنید
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    میکروفون فعال خواهد شد و می‌توانید با صدای معمولی یا رسا فاکتور را بخوانید
                  </p>
                </div>
              )}

              {/* Recorded Audio Controls */}
              {audioUrl && !isRecording && (
                <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-800/70 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlayAudio}
                      className="p-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors shrink-0"
                      title={isPlayingAudio ? 'توقف' : 'پخش'}
                    >
                      {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      ویس ضبط شده ({formatTimer(recordDuration)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => {
                        setAudioUrl(null);
                        setAudioBlob(null);
                        setRecordDuration(0);
                      }}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                      title="حذف و ضبط مجدد"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={processVoiceWithAI}
                      disabled={processing}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>پردازش با هوش مصنوعی</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Mode UI */}
          {mode === 'upload' && (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-teal-500/30 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer text-center space-y-2"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <FileAudio className="w-8 h-8" />
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  برای انتخاب فایل صوتی کلیک کنید یا فایل را اینجا بکشید
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  فرمت‌های مجاز: MP3, WAV, M4A, WEBM, OGG (حداکثر ۲۵ مگابایت)
                </p>
              </div>

              {uploadedFile && (
                <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-800/70 p-3 rounded-xl">
                  <div className="flex items-center gap-2 truncate">
                    <button
                      onClick={togglePlayAudio}
                      className="p-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                    >
                      {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 justify-end shrink-0">
                    <button
                      onClick={() => {
                        setUploadedFile(null);
                        setAudioUrl(null);
                        setAudioBlob(null);
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="حذف فایل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={processVoiceWithAI}
                      disabled={processing}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>استخراج اطلاعات</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Processing Steps Animation */}
          {processing && (
            <div className="mt-4 p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>در حال پردازش هوشمند ویس با هوش مصنوعی Gemini...</span>
              </div>
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <div className={`flex items-center gap-1.5 ${processStep >= 0 ? 'text-teal-600 font-semibold' : ''}`}>
                  <span>{processStep >= 0 ? '✅' : '⏳'}</span>
                  <span>شنیدن و درک صوت فارسی با Gemini Multimodal</span>
                </div>
                <div className={`flex items-center gap-1.5 ${processStep >= 1 ? 'text-teal-600 font-semibold' : ''}`}>
                  <span>{processStep >= 1 ? '✅' : '⏳'}</span>
                  <span>استخراج هوشمند نام مشتری، اقلام، تعداد، قیمت و تخفیف‌ها</span>
                </div>
                <div className={`flex items-center gap-1.5 ${processStep >= 2 ? 'text-teal-600 font-semibold' : ''}`}>
                  <span>{processStep >= 2 ? '✅' : '⏳'}</span>
                  <span>تکمیل و آماده‌سازی آنی پیش‌نمایش فاکتور</span>
                </div>
              </div>
            </div>
          )}

          {/* Transcription Text Result (if present) */}
          {transcriptionText && (
            <div className="mt-4 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">متن استخراج شده از صدا:</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  دقت: {toPersianDigits(aiConfidence)}٪
                </span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 italic leading-relaxed">
                «{transcriptionText}»
              </p>
            </div>
          )}
        </div>

        {/* Editable Invoice Form */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                مشخصات و اقلام فاکتور (قابل ویرایش)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اطلاعات استخراج شده را بررسی و در صورت تمایل ویرایش کنید
              </p>
            </div>
            <button
              onClick={addItemRow}
              className="px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن ردیف</span>
            </button>
          </div>

          {/* Invoice Name / Title Input */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/80 shadow-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="block text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>نام یا عنوان فاکتور:</span>
                <span className="text-[10px] font-normal text-teal-700 dark:text-teal-300">(به انتخاب شما؛ بدون شماره پیش‌فرض خودکار)</span>
              </label>
              {invoiceName.trim() ? (
                <span className="text-[10px] text-teal-700 dark:text-teal-300 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                  <span>ثبت با نام اختصاصی شما</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  می‌توانید عنوان دلخواه وارد کنید
                </span>
              )}
            </div>
            <input
              type="text"
              value={invoiceName}
              onChange={(e) => setInvoiceName(e.target.value)}
              placeholder="مثال: طراحی وب‌سایت آریا، سفارش خرید پوشاک، پروژه بازسازی یا عنوان دلخواه شما"
              className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
            />
            {/* Quick Suggestion Chips */}
            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap text-[10px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">پیشنهاد سریع:</span>
              {customerName.trim() && (
                <button
                  type="button"
                  onClick={() => setInvoiceName(`فاکتور ${customerName.trim()}`)}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-teal-100 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                >
                  فاکتور {customerName.trim()}
                </button>
              )}
              {items[0]?.name?.trim() && (
                <button
                  type="button"
                  onClick={() => setInvoiceName(`فاکتور ${items[0].name.trim()}`)}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-teal-100 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                >
                  فاکتور {items[0].name.trim()}
                </button>
              )}
              <button
                type="button"
                onClick={() => setInvoiceName(`پروژه ${customerName.trim() || 'اختصاصی'}`)}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-teal-100 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
              >
                پروژه {customerName.trim() || 'اختصاصی'}
              </button>
              {invoiceName && (
                <button
                  type="button"
                  onClick={() => setInvoiceName('')}
                  className="px-1.5 py-0.5 rounded-md text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>

          {/* Customer info fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نام مشتری / شرکت:
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: آقای محمدی"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  شماره تماس مشتری:
                </label>
                {phoneValidation && (
                  <span
                    className={`text-[11px] font-medium flex items-center gap-1 ${
                      phoneValidation.type === 'valid'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : phoneValidation.type === 'extra'
                        ? 'text-rose-500 dark:text-rose-400 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {phoneValidation.type === 'valid' && <Check className="w-3 h-3" />}
                    {phoneValidation.type === 'extra' && <AlertCircle className="w-3 h-3 animate-pulse text-rose-500" />}
                    <span>{phoneValidation.message}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    const engVal = persianToEnglishDigits(e.target.value).replace(/[^\d+]/g, '');
                    setCustomerPhone(engVal);
                    if (savedInvoice) {
                      setSavedInvoice((prev) => (prev ? { ...prev, customer_phone: engVal } : null));
                    }
                  }}
                  placeholder="09121234567"
                  className={`w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                    phoneValidation?.type === 'extra'
                      ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                      : phoneValidation?.type === 'valid'
                      ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'
                  } text-slate-900 dark:text-white focus:outline-none focus:ring-2 text-left dir-ltr`}
                />
              </div>
              {phoneValidation?.type === 'extra' && (
                <div className="mt-1.5 flex items-center justify-between p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px]">
                  <span className="text-rose-700 dark:text-rose-300 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>یک یا چند صفر/رقم اضافی است ({toPersianDigits(phoneValidation.digits.length)} رقم)</span>
                  </span>
                  {phoneValidation.suggested && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerPhone(phoneValidation.suggested!);
                        if (savedInvoice) {
                          setSavedInvoice((prev) => (prev ? { ...prev, customer_phone: phoneValidation.suggested! } : null));
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                    >
                      اصلاح خودکار به ۱۱ رقم
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                اقلام کالا و خدمات:
              </label>
              {/* Desktop table column headers */}
              <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium px-2 w-[calc(100%-8rem)]">
                <span className="col-span-6">شرح کالا یا خدمت</span>
                <span className="col-span-2 text-center">تعداد</span>
                <span className="col-span-3 text-right">قیمت واحد (تومان)</span>
                <span className="col-span-1"></span>
              </div>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const rowTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                return (
                  <div key={item.id || idx}>
                    {/* Desktop View (Table Grid) */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 items-center text-xs">
                      {/* Name */}
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          placeholder="شرح کالا یا خدمت"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <div dir="ltr" className="w-full">
                          <input
                            type="text"
                            dir="ltr"
                            value={item.quantity ? toPersianDigits(item.quantity) : ''}
                            onChange={(e) => {
                              const raw = removeCommas(persianToEnglishDigits(e.target.value));
                              if (/^\d*$/.test(raw)) {
                                handleItemChange(idx, 'quantity', raw);
                              }
                            }}
                            placeholder="۱"
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center font-mono [direction:ltr]"
                          />
                        </div>
                      </div>

                      {/* Unit price */}
                      <div className="col-span-3">
                        <div dir="ltr" className="w-full">
                          <input
                            type="text"
                            dir="ltr"
                            value={item.unit_price ? formatNumberWithCommas(item.unit_price) : ''}
                            onChange={(e) => {
                              const raw = removeCommas(persianToEnglishDigits(e.target.value));
                              if (/^\d*$/.test(raw)) {
                                handleItemChange(idx, 'unit_price', raw);
                              }
                            }}
                            placeholder="۰"
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-right font-mono [direction:ltr]"
                          />
                        </div>
                      </div>

                      {/* Remove */}
                      <div className="col-span-1 flex justify-center">
                        <button
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors p-1"
                          title="حذف ردیف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile View (Touch-friendly Card) */}
                    <div className="sm:hidden p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5 text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                          ردیف {toPersianDigits(idx + 1)}
                        </span>
                        <div className="flex items-center gap-2">
                          {rowTotal > 0 && (
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {formatToman(rowTotal)}
                            </span>
                          )}
                          <button
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length <= 1}
                            className="text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors p-1"
                            title="حذف ردیف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Description Input */}
                      <div>
                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          شرح کالا یا خدمت:
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          placeholder="نام کالا یا نوع خدمت..."
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      {/* Quantity & Unit Price */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-medium">
                            تعداد:
                          </label>
                          <div dir="ltr" className="w-full">
                            <input
                              type="text"
                              dir="ltr"
                              value={item.quantity ? toPersianDigits(item.quantity) : ''}
                              onChange={(e) => {
                                const raw = removeCommas(persianToEnglishDigits(e.target.value));
                                if (/^\d*$/.test(raw)) {
                                  handleItemChange(idx, 'quantity', raw);
                                }
                              }}
                              placeholder="۱"
                              className="w-full px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center font-mono [direction:ltr]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-medium">
                            قیمت واحد (تومان):
                          </label>
                          <div dir="ltr" className="w-full">
                            <input
                              type="text"
                              dir="ltr"
                              value={item.unit_price ? formatNumberWithCommas(item.unit_price) : ''}
                              onChange={(e) => {
                                const raw = removeCommas(persianToEnglishDigits(e.target.value));
                                if (/^\d*$/.test(raw)) {
                                  handleItemChange(idx, 'unit_price', raw);
                                }
                              }}
                              placeholder="۰"
                              className="w-full px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-right font-mono [direction:ltr]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discount & Tax */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  تخفیف:
                </label>
                <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-700/70 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (discountType !== 'amount') {
                        setDiscountType('amount');
                        if (parsedDiscountNum > 0 && subtotal > 0) {
                          setDiscountValue(String(calculatedDiscountAmount));
                        }
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      discountType === 'amount'
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    تومان
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (discountType !== 'percent') {
                        setDiscountType('percent');
                        if (parsedDiscountNum > 0 && subtotal > 0) {
                          const pct = Math.min(100, Math.round((parsedDiscountNum / subtotal) * 100));
                          setDiscountValue(String(pct));
                        }
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      discountType === 'percent'
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    درصد (٪)
                  </button>
                </div>
              </div>

              <div dir="ltr" className="w-full relative">
                <input
                  type="text"
                  dir="ltr"
                  value={
                    discountType === 'amount'
                      ? (discountValue ? formatNumberWithCommas(discountValue) : '')
                      : discountValue
                  }
                  onChange={(e) => {
                    const raw = removeCommas(persianToEnglishDigits(e.target.value));
                    if (discountType === 'percent') {
                      if (/^\d*$/.test(raw)) {
                        const num = Number(raw);
                        if (raw === '' || (num >= 0 && num <= 100)) {
                          setDiscountValue(raw);
                        }
                      }
                    } else {
                      if (/^\d*$/.test(raw)) {
                        setDiscountValue(raw);
                      }
                    }
                  }}
                  placeholder={discountType === 'percent' ? 'مثلاً ۱۰ درصد' : '۰ تومان'}
                  className={`w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-right font-mono [direction:ltr] ${
                    discountType === 'percent' ? 'pl-8' : ''
                  }`}
                />
                {discountType === 'percent' && (
                  <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold pointer-events-none">
                    ٪
                  </span>
                )}
              </div>

              {/* Sub-label showing conversion */}
              {parsedDiscountNum > 0 && subtotal > 0 && (
                <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1 font-medium text-right">
                  {discountType === 'percent'
                    ? `معادل ${formatToman(calculatedDiscountAmount)} کسر می‌شود`
                    : `معادل ${toPersianDigits(Math.min(100, Math.round((parsedDiscountNum / subtotal) * 100)))}٪ از کل فاکتور`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                درصد مالیات ارزش افزوده (٪):
              </label>
              <div dir="ltr" className="w-full">
                <input
                  type="number"
                  dir="ltr"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center [direction:ltr]"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              یادداشت یا شرایط تسویه:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="توضیحات اختیاری فاکتور..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {savedInvoice ? (
              <>
                <button
                  type="button"
                  id="update-invoice-btn"
                  onClick={handleUpdateSavedInvoice}
                  disabled={isSaving}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>ذخیره تغییرات در فاکتور «{savedInvoice.title || savedInvoice.invoice_number}»</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetFormForNewInvoice}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>صدور فاکتور جدید</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                id="save-invoice-btn"
                onClick={handleSaveInvoice}
                disabled={isSaving || !!savedInvoice}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>ثبت و صدور فاکتور نهایی</span>
              </button>
            )}
          </div>

          {/* Post-save WhatsApp Direct Share & Payment Link Banner */}
          {savedInvoice && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>فاکتور «{savedInvoice.title || savedInvoice.invoice_number}» با موفقیت ثبت شد!</span>
                </div>
                {onNavigateToInvoice && (
                  <button
                    onClick={() => onNavigateToInvoice(savedInvoice.id)}
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <span>مشاهده فاکتور</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Payment Link Quick Actions */}
              <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-600" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">لینک پرداخت اختصاصی مشتری:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const payUrl = `${window.location.origin}/payment/${savedInvoice.id}`;
                      await copyToClipboard(payUrl);
                      setCopiedPayLink(true);
                      setTimeout(() => setCopiedPayLink(false), 2000);
                      showNotice('لینک پرداخت با موفقیت کپی شد', 'success');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-teal-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedPayLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPayLink ? 'کپی شد ✓' : 'کپی لینک پرداخت'}</span>
                  </button>
                  <a
                    href={`/payment/${savedInvoice.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>صفحه پرداخت</span>
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                  <span>ارسال به واتس‌اپ مشتری:</span>
                  {customerPhone ? (
                    <span className="font-bold text-teal-700 dark:text-teal-300 dir-ltr bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800 text-xs">
                      {toPersianDigits(customerPhone)}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">(شماره وارد نشده است)</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSendWhatsAppDirect}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال مستقیم در واتس‌اپ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Live Mockup PDF Invoice Preview */}
      <div className="xl:col-span-6 sticky top-20">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          {/* Watermark/Accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Mockup Header Controls */}
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3.5 mb-5 no-print">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-teal-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                پیش‌نمایش زنده فاکتور چاپی
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors"
                title="چاپ یا ذخیره PDF"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">چاپ / PDF</span>
              </button>
            </div>
          </div>

          {/* Printable Invoice Container */}
          <div className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            {/* Invoice Top Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-lg font-black text-teal-800 tracking-tight">فاکتور فروش کالا و خدمات</h1>
                <p className="text-xs text-slate-500 mt-0.5">{profile?.business_name || 'نام فروشگاه / کسب‌وکار شما'}</p>
                <p className="text-[11px] text-slate-400">تلفن: {profile?.phone ? toPersianDigits(profile.phone) : '۰۹XXXXXXXXX'}</p>
              </div>

              <div className="text-left text-xs space-y-1">
                <div className="flex items-center justify-end gap-2 text-slate-600">
                  <span className="font-bold text-slate-800">
                    {invoiceName.trim() || savedInvoice?.title || savedInvoice?.invoice_number || 'پیش‌نویس فاکتور'}
                  </span>
                  <span>:نام / عنوان فاکتور</span>
                </div>
                <div className="flex items-center justify-end gap-2 text-slate-500">
                  <span>{new Date().toLocaleDateString('fa-IR')}</span>
                  <span>:تاریخ صدور</span>
                </div>
                <div className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                  وضعیت: {savedInvoice?.status === 'paid' ? 'پرداخت شده' : 'در انتظار پرداخت'}
                </div>
              </div>
            </div>

            {/* Buyer Info */}
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400">خریدار: </span>
                  <span className="font-bold text-slate-800">{customerName || '---'}</span>
                </div>
                <div>
                  <span className="text-slate-400">تلفن: </span>
                  <span className="font-medium text-slate-700 dir-ltr">{customerPhone ? toPersianDigits(customerPhone) : '---'}</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2">شرح کالا / خدمات</th>
                    <th className="py-2 px-2 text-center w-12">تعداد</th>
                    <th className="py-2 px-2 text-left w-24">قیمت واحد</th>
                    <th className="py-2 px-2 text-left w-28">قیمت کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-2 text-center text-slate-400">{toPersianDigits(idx + 1)}</td>
                      <td className="py-2 px-2 font-medium text-slate-800">{item.name || 'کالا / خدمت'}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{toPersianDigits(parseNum(item.quantity) || 0)}</td>
                      <td className="py-2 px-2 text-left text-slate-600">{formatToman(parseNum(item.unit_price))}</td>
                      <td className="py-2 px-2 text-left font-semibold text-slate-900">
                        {formatToman(parseNum(item.quantity) * parseNum(item.unit_price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Breakdown */}
            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>جمع اقلام:</span>
                  <span>{formatToman(subtotal)}</span>
                </div>
                {calculatedDiscountAmount > 0 && (
                  <div className="flex items-center justify-between text-rose-600">
                    <span>
                      تخفیف
                      {discountType === 'percent' && parsedDiscountNum > 0 ? ` (${toPersianDigits(parsedDiscountNum)}٪)` : ''}:
                    </span>
                    <span>- {formatToman(calculatedDiscountAmount)}</span>
                  </div>
                )}
                {parseNum(taxRate) > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>مالیات ({toPersianDigits(parseNum(taxRate))}٪):</span>
                    <span>+ {formatToman(taxAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-black text-sm text-teal-900 border-t border-slate-300 pt-1.5">
                  <span>مبلغ قابل پرداخت:</span>
                  <span>{formatToman(finalTotal)}</span>
                </div>
              </div>
            </div>

            {/* Footer Notes and QR Code */}
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[11px] text-slate-500">
              <div className="space-y-1 max-w-[70%]">
                <p className="font-semibold text-slate-700">توضیحات و شرایط:</p>
                <p className="text-slate-600 leading-relaxed">{notes || '---'}</p>
                {profile?.card_number && (
                  <p className="text-[10px] text-slate-500 dir-ltr text-right">
                    شماره کارت جهت واریز: {profile.card_number}
                  </p>
                )}
              </div>

              {/* QR Code Mockup */}
              <div className="text-center p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="w-14 h-14 bg-slate-900 flex items-center justify-center text-white rounded">
                  <QrCode className="w-10 h-10" />
                </div>
                <span className="text-[9px] font-bold text-slate-600 mt-1 block">پرداخت سریع</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
