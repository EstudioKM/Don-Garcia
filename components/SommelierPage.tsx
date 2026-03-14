
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { OrderItem } from '../types';
import { getMenuFromDB } from '../services/menuRepository';
import { createOrder, getInProgressOrder, updateInProgressOrder, clearInProgressOrder } from '../services/orderRepository';
import { getSettingsFromDB } from '../services/settingsRepository';

// --- Utilerías de Audio ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Lógica de Menú ---
const normalizeText = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const placeOrderFunctionDeclaration: FunctionDeclaration = { 
  name: 'placeOrder', 
  parameters: { 
    type: Type.OBJECT, 
    description: 'IMPERATIVO: Cuando el usuario exprese su deseo de ordenar un plato o bebida, llama a esta función. Asegúrate de extraer el NOMBRE EXACTO del plato o bebida de la carta y la cantidad.', 
    properties: { 
      items: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: { 
            name: { type: Type.STRING, description: 'El nombre exacto del plato o bebida según figura en la carta.' }, 
            quantity: { type: Type.NUMBER, description: 'La cantidad solicitada, por defecto 1 si no se especifica.' } 
          }, 
          required: ['name', 'quantity'] 
        } 
      } 
    }, 
    required: ['items'] 
  } 
};

const confirmOrderFunctionDeclaration: FunctionDeclaration = { 
  name: 'confirmOrder', 
  parameters: { 
    type: Type.OBJECT, 
    description: 'Llama a esta función solo para finalizar el pedido y enviar a cocina.', 
    properties: {} 
  } 
};

// --- Componente Principal ---
interface SommelierPageProps { onClose: () => void; onNewOrder?: (items: OrderItem[]) => void; }

export const SommelierPage: React.FC<SommelierPageProps> = ({ onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [isUserSpeaking, setIsUserSpeaking] = useState(false); 
  const [transcription, setTranscription] = useState('');
  const [statusText, setStatusText] = useState('Toque para iniciar');
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<OrderItem[]>([]);
  const [mobileView, setMobileView] = useState<'ai' | 'order'>('ai');
  const [menuData, setMenuData] = useState<any>(null);
  
  const currentOrderRef = useRef<OrderItem[]>([]);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animationFrameRef = useRef<number>(0);
  const isInitialLoad = useRef(true);

  useEffect(() => { currentOrderRef.current = currentOrder; }, [currentOrder]);

  useEffect(() => {
    const loadData = async () => {
      setStatusText("Cargando carta...");
      const [data, existingItems] = await Promise.all([
        getMenuFromDB(),
        getInProgressOrder('Mesa 4')
      ]);
      setMenuData(data);
      setCurrentOrder(existingItems);
      setStatusText('Toque para iniciar');
      isInitialLoad.current = false;
    };
    loadData();
  }, []);
  
  useEffect(() => {
    if (!isInitialLoad.current) {
        updateInProgressOrder('Mesa 4', currentOrder);
    }
  }, [currentOrder]);


  useEffect(() => {
    if (!isActive) return;
    const checkVolume = () => {
        if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setIsUserSpeaking(average > 10);
        }
        animationFrameRef.current = requestAnimationFrame(checkVolume);
    };
    checkVolume();
    return () => { cancelAnimationFrame(animationFrameRef.current); };
  }, [isActive]);

  const findMenuItem = (name: string): any | null => {
      if (!name || !menuData) {
        return { name: name, price: 'Consultar', description: 'Pedido especial' };
      }
      const search = normalizeText(name);
      
      const categoriesToSearch = Object.keys(menuData).filter(category => 
        category !== 'notas' && category !== 'presentacion' && Array.isArray(menuData[category])
      );

      // 1. Búsqueda exacta
      for (const category of categoriesToSearch) {
        const items = menuData[category] as any[];
        const found = items.find(item => item.name && normalizeText(item.name) === search);
        if (found) {
            return { ...found, description: found.description || '' };
        }
      }

      // 2. Búsqueda parcial (contiene)
      for (const category of categoriesToSearch) {
        const items = menuData[category] as any[];
        const found = items.find(item => item.name && normalizeText(item.name).includes(search));
        if (found) {
            return { ...found, description: found.description || '' };
        }
      }

       // 3. Búsqueda inversa (el search contiene al item)
       for (const category of categoriesToSearch) {
        const items = menuData[category] as any[];
        const found = items.find(item => item.name && search.includes(normalizeText(item.name)));
        if (found) {
            return { ...found, description: found.description || '' };
        }
      }
      
      return { name: name, price: 'Consultar', description: 'Pedido especial' };
  };

  const generateMenuContext = () => {
      if (!menuData) return "Menú no disponible.";
      let context = "";
      for (const category in menuData) {
          if (category === 'notas' || category === 'presentacion') continue;
          const itemsList = menuData[category].map((i: any) => `${i.name} ($${i.price})`).join(", ");
          context += `CATEGORÍA ${category.toUpperCase()}: ${itemsList}.\n`;
      }
      return context;
  };

  const stopSession = () => {
    try {
        streamRef.current?.getTracks().forEach(track => track.stop());
        sessionPromiseRef.current?.then(session => session.close());
        sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
        sourcesRef.current.clear();
        if (audioContextInRef.current && audioContextInRef.current.state !== 'closed') audioContextInRef.current.close();
        if (audioContextOutRef.current && audioContextOutRef.current.state !== 'closed') audioContextOutRef.current.close();
    } catch(e) { console.error("Error stopping session", e); }
    setIsActive(false);
    setStatusText('Sesión finalizada');
  };

  const submitOrderToBackend = async (itemsToSubmit: OrderItem[]) => {
      if (itemsToSubmit.length === 0) return false;
      setIsProcessingOrder(true);
      setStatusText("Enviando a cocina...");
      stopSession();
      try {
          const success = await createOrder(itemsToSubmit, 'Mesa 4');
          if (success) {
              setLastSubmittedOrder(itemsToSubmit);
              await clearInProgressOrder('Mesa 4');
              setCurrentOrder([]);
              setOrderSuccess(true);
              return true;
          }
      } catch (error) { console.error("Error enviando orden:", error); }
      finally { setIsProcessingOrder(false); }
      return false;
  };

  const startSession = async () => {
    const settings = await getSettingsFromDB();
    let memoryContext = "";
    if (currentOrderRef.current.length > 0) {
        const itemsList = currentOrderRef.current.map(i => `${i.quantity}x ${i.name}`).join(", ");
        memoryContext = `\n\n[MEMORIA]: Ya hay items en la comanda: ${itemsList}.`;
    }

    const systemPrompt = `
    ROL: Sommelier experto de "Don García".
    
    INSTRUCCIONES CRÍTICAS:
    1. Si piden algo, LLAMA a 'placeOrder'. NO hables en el mismo turno de la llamada.
    2. Espera el resultado de la función para confirmar verbalmente: "Agregado, ¿desea algo más?".
    3. No repitas confirmaciones si ya las hiciste.

    ${generateMenuContext()}
    ${memoryContext}
    
    PERSONALIDAD: ${settings.systemPrompt || 'Elegante y servicial.'}
    `;

    try {
      setOrderSuccess(false);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      analyserRef.current = audioContextInRef.current.createAnalyser();
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatusText('Conectando...');
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true); setStatusText('Le escucho...');
            const source = audioContextInRef.current!.createMediaStreamSource(streamRef.current!);
            source.connect(analyserRef.current!);
            processorRef.current = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(session => session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processorRef.current!);
            processorRef.current?.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
                sourcesRef.current.clear();
                setIsSpeaking(false);
                nextStartTimeRef.current = 0;
                return;
            }

            if(message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                  if (fc.name === 'placeOrder') {
                      const items = (fc.args as any)?.items || [];
                      const validItems = items.map((item: any) => ({ ...findMenuItem(item.name), quantity: item.quantity }));
                      if(validItems.length > 0) {
                        setCurrentOrder(prev => [...prev, ...validItems]);
                        setMobileView('order'); // Activar la vista de la comanda para ver el item agregado
                      }
                      sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Agregados exitosamente." } } }));
                  } else if (fc.name === 'confirmOrder') {
                      if (currentOrderRef.current.length > 0) await submitOrderToBackend(currentOrderRef.current);
                      else sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Error: comanda vacía." } } }));
                  }
              }
            }
            if (message.serverContent?.outputTranscription) setTranscription(prev => prev + message.serverContent.outputTranscription.text); 
            if (message.serverContent?.turnComplete) setTimeout(() => setTranscription(''), 8000); 

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true); setStatusText('Respondiendo...');
              const ctx = audioContextOutRef.current!;
              if (nextStartTimeRef.current < ctx.currentTime) nextStartTimeRef.current = ctx.currentTime;
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) { setIsSpeaking(false); setStatusText('Le escucho...'); } };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e) => { console.error('Error:', e); stopSession(); },
          onclose: () => { stopSession(); }
        },
        config: { 
            responseModalities: [Modality.AUDIO], 
            outputAudioTranscription: {}, 
            tools: [{ googleSearch: {} }, { functionDeclarations: [placeOrderFunctionDeclaration, confirmOrderFunctionDeclaration] }], 
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voice } } }, 
            systemInstruction: systemPrompt 
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) { // Especificar el tipo 'any' para el error
      console.error("Error al iniciar la sesión del Sommelier:", err); 
      if (err.name === 'NotAllowedError') {
        setStatusText('Permiso de micrófono denegado. Por favor, habilítelo en la configuración de su navegador.');
      } else {
        setStatusText('Error de micrófono'); 
      }
    }
  };

  if (orderSuccess) {
      const total = lastSubmittedOrder.reduce((acc, item) => acc + (parseInt(item.price?.replace(/\$|\./g,'') || '0') * item.quantity), 0);
      return (
        <div className="fixed inset-0 z-[300] bg-[#050505] flex items-center justify-center p-4 sm:p-6">
            <div className="bg-stone-900 border border-gold/30 p-6 sm:p-10 max-w-md w-full shadow-[0_0_50px_rgba(176,141,72,0.15)] animate-fadeInUp">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gold text-black rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></div>
                    <h2 className="text-2xl sm:text-3xl font-serif text-white mb-2">Pedido Confirmado</h2>
                    <p className="text-stone-400 text-xs uppercase tracking-widest">Su comanda ya está en cocina</p>
                </div>
                <div className="bg-black/30 p-4 sm:p-6 rounded-sm mb-8 border border-stone-800 max-h-60 overflow-y-auto order-scrollbar">
                    <ul className="space-y-3 mb-6">{lastSubmittedOrder.map((item, i) => <li key={i} className="flex justify-between text-sm"><span className="text-white pr-2"><span className="text-gold font-bold">{item.quantity}x</span> {item.name}</span><span className="text-stone-500 whitespace-nowrap">{item.price}</span></li>)}</ul>
                    <div className="border-t border-stone-700 pt-4 flex justify-between items-center"><span className="text-xs uppercase tracking-widest text-stone-500">Total</span><span className="text-xl font-serif text-gold">${total.toLocaleString('es-AR')}</span></div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={onClose} className="flex-1 bg-transparent border border-stone-700 text-stone-400 py-3 uppercase tracking-widest text-[10px] hover:border-gold hover:text-white transition-all">Cerrar</button>
                    <button onClick={startSession} className="flex-1 bg-gold text-black py-3 uppercase tracking-widest text-[10px] font-bold hover:bg-white transition-all">Nuevo Pedido</button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[300] bg-[#050505] flex flex-col md:flex-row overflow-hidden font-sans text-stone-300">
      <div className={`w-full h-full flex flex-col justify-between p-6 border-b md:border-b-0 md:border-r border-gold/20 bg-gradient-to-b from-stone-900 to-black ${mobileView === 'ai' ? 'flex' : 'hidden'} md:flex md:w-1/2 relative`}>
        <div className="flex justify-between items-start z-20">
            <button onClick={() => { stopSession(); onClose(); }} className="text-gold text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors flex items-center gap-2">
                <span className="text-lg">&larr;</span> Salir
            </button>
            <div className="text-right">
                <h2 className="text-2xl font-serif text-white tracking-tight">El Sommelier</h2>
                <p className={`text-gold text-[10px] uppercase tracking-[0.2em] font-bold mt-1`}>{statusText}</p>
            </div>
        </div>
        <div className="flex-grow flex items-center justify-center relative">
             <button onClick={isActive ? stopSession : startSession} className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-full flex items-center justify-center transition-transform duration-500 z-10 ${isActive ? 'scale-100' : 'hover:scale-105'}`}>
                <div className={`absolute inset-0 rounded-full border border-gold/40 transition-all duration-100 ${isUserSpeaking ? 'scale-125 opacity-100 border-gold' : 'scale-100 opacity-20'}`}></div>
                <div className={`absolute inset-0 rounded-full border border-gold/20 transition-all duration-100 delay-75 ${isUserSpeaking ? 'scale-110 opacity-80' : 'scale-100 opacity-20'}`}></div>
                <div className={`w-full h-full rounded-full bg-black border border-gold/30 flex items-center justify-center shadow-[0_0_50px_rgba(176,141,72,0.1)] overflow-hidden relative`}>
                    <div className={`absolute inset-0 bg-gold/10 blur-2xl transition-opacity duration-300 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
                    {!isActive ? (
                        <div className="text-gold opacity-50 flex flex-col items-center animate-pulse">
                            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                            <span className="text-[10px] tracking-widest uppercase">Tocar para Hablar</span>
                        </div>
                    ) : (
                        <div className="flex gap-1 h-12 items-center">
                            {[1,2,3,4,5].map(i => <div key={i} className={`w-1 bg-gold rounded-full transition-all duration-150 ${isSpeaking ? 'h-8 animate-bounce' : 'h-2'}`} style={{animationDelay: `${i*0.1}s`}}></div>)}
                        </div>
                    )}
                </div>
            </button>
        </div>
        <div className="z-20 w-full min-h-[100px] max-h-[150px] overflow-y-auto order-scrollbar bg-black/20 p-4 rounded border-t border-white/5 backdrop-blur-sm">
             {transcription ? (
                 <p className="text-stone-300 italic text-lg leading-relaxed animate-fadeInUp text-center">"{transcription}"</p>
             ) : (
                 <p className="text-stone-600 text-xs text-center uppercase tracking-widest mt-4">Esperando voz...</p>
             )}
        </div>
      </div>
      <div className={`w-full h-full bg-[#0a0a0a] flex-col relative ${mobileView === 'order' ? 'flex' : 'hidden'} md:flex md:w-1/2`}>
        <div className="p-6 md:p-10 flex-grow flex flex-col overflow-hidden">
            <div className="flex justify-between items-end mb-6 border-b border-stone-800 pb-4">
                <div><h3 className="text-gold text-xs uppercase tracking-[0.4em] font-bold mb-1">Mesa 4</h3><h2 className="text-2xl font-serif text-white">Comanda en Curso</h2></div>
                <div className="text-right"><p className="text-stone-500 text-[10px] uppercase tracking-widest">Total</p><p className="text-white font-bold text-xl">${currentOrder.reduce((acc, item) => acc + (parseInt(item.price?.replace(/\$|\./g,'') || '0') * item.quantity), 0).toLocaleString('es-AR')}</p></div>
            </div>
            <ul className="flex-grow overflow-y-auto space-y-4 pr-2 order-scrollbar relative">
                {currentOrder.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-stone-700 opacity-50"><svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg><p className="text-sm font-serif italic">"Pida un vino o una entrada..."</p></div>) : (currentOrder.map((item, idx) => (<li key={idx} className="bg-stone-900/40 border border-stone-800/50 p-4 rounded-sm flex justify-between items-start animate-fadeInUp"><div className="flex gap-4"><span className="flex items-center justify-center w-6 h-6 bg-gold/10 text-gold text-xs font-bold rounded-full border border-gold/20">{item.quantity}</span><div><p className="text-white font-medium text-sm leading-tight">{item.name}</p><p className="text-stone-500 text-[10px] mt-1 italic">{item.description}</p></div></div><span className="text-gold text-sm font-bold">{item.price}</span></li>)))}
            </ul>
            <div className="mt-6 pt-6 border-t border-stone-800"><button onClick={() => submitOrderToBackend(currentOrder)} disabled={currentOrder.length === 0 || isProcessingOrder} className="w-full bg-gold text-black py-4 uppercase tracking-[0.3em] text-xs font-black hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(197,160,89,0.2)]">{isProcessingOrder ? 'Enviando...' : 'Confirmar Pedido'}</button></div>
        </div>
      </div>
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-black/50 backdrop-blur-lg border border-white/10 p-2 rounded-full shadow-2xl">
          <button onClick={() => setMobileView('ai')} className={`px-5 py-2 rounded-full text-xs uppercase tracking-widest font-bold transition-colors ${mobileView === 'ai' ? 'bg-gold text-black' : 'text-stone-400'}`}>Asistente</button>
          <button onClick={() => setMobileView('order')} className={`relative px-5 py-2 rounded-full text-xs uppercase tracking-widest font-bold transition-colors ${mobileView === 'order' ? 'bg-gold text-black' : 'text-stone-400'}`}>
              Comanda
              {currentOrder.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center border-2 border-black">{currentOrder.length}</span>}
          </button>
      </div>
    </div>
  );
};