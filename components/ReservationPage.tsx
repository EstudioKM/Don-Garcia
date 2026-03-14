import React, { useState } from 'react';
import ReservationFlow from './ReservationFlow';

const ReservationPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBackClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.hash = '/';
  };

  return (
    <div className="bg-luxury-black text-white flex flex-col min-h-[100dvh]">
      {/* Encabezado Fijo */}
      <header className="p-6 flex justify-between items-start border-b border-white/5 bg-luxury-black z-10 sticky top-0">
        <div>
          <h1 className="text-xl font-serif text-gold tracking-widest font-bold leading-none">DON GARCÍA</h1>
          <p className="text-stone-500 text-[9px] uppercase tracking-[0.3em] mt-1">La Casona 1930</p>
        </div>
        <a href="#/" onClick={handleBackClick} className="text-[10px] text-stone-500 hover:text-gold uppercase tracking-widest transition-colors font-bold flex items-center">
            <span className="mr-1">←</span> VOLVER
        </a>
      </header>

      {/* Contenido Principal */}
      <main className="flex-grow p-4 sm:p-6 pb-32 max-w-2xl mx-auto w-full">
        <ReservationFlow 
          onSubmittingChange={setIsSubmitting} 
        />
      </main>
    </div>
  );
};

export default ReservationPage;
