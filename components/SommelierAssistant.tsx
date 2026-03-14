
import React from 'react';

interface SommelierAssistantProps {
  onOpenPage: () => void;
}

const SommelierAssistant: React.FC<SommelierAssistantProps> = ({ onOpenPage }) => {
  return (
    <div className="fixed bottom-8 right-8 z-[200]">
      <button 
        onClick={onOpenPage}
        className="group relative flex items-center justify-center w-16 h-16 bg-gold rounded-full shadow-2xl hover:scale-110 transition-all duration-500 border-2 border-transparent hover:border-white/20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-gold to-white/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <svg className="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
        </svg>
        
        <span className="absolute right-full mr-4 whitespace-nowrap bg-luxury-black text-gold px-4 py-2 text-[10px] uppercase tracking-[0.2em] rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gold/20 shadow-xl">
          Hablar con el Sommelier
        </span>
      </button>
    </div>
  );
};

export default SommelierAssistant;
