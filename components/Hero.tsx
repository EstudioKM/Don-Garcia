import React from 'react';

const Hero: React.FC = () => {
  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Es un ancla de scroll (ej. #about).
    event.preventDefault();
    const href = event.currentTarget.getAttribute('href');
    const targetId = href?.substring(1);
    if (targetId) {
      const section = document.getElementById(targetId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };
  
  const handleReservationClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.hash = '/reservar';
  };

  return (
    <section id="home" className="relative h-[100dvh] w-full flex flex-col items-center justify-center text-white overflow-hidden">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1554998171-89445e31c52b?auto=format&fit=crop&q=80&w=1974" 
          alt="Primer plano de carnes cocinándose sobre fuegos de parrilla"
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-black/70"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 animate-fadeInUp">
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-serif mb-4 text-gold tracking-tighter">
          Don García
        </h1>
        <p className="text-base sm:text-lg md:text-xl font-serif italic mb-2 text-stone-300">
          — La Casona 1930 —
        </p>
        <p className="text-white/90 text-sm sm:text-base md:text-lg mb-12 max-w-2xl mx-auto leading-relaxed">
          La tradición de los fuegos y el río en el corazón de un patrimonio histórico.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a href="#/reservar" onClick={handleReservationClick} className="w-full sm:w-auto bg-gold text-white px-12 py-3 border-2 border-gold rounded-sm hover:bg-transparent hover:text-gold transition-all duration-500 uppercase tracking-[0.2em] text-[11px] font-black shadow-lg">
            Reservar Mesa
          </a>
          <a href="#menu" onClick={handleLinkClick} className="w-full sm:w-auto border-2 border-gold text-gold px-12 py-3 rounded-sm hover:bg-gold hover:text-white transition-all duration-500 uppercase tracking-[0.2em] text-[11px] font-black">
            Ver la Carta
          </a>
        </div>
      </div>
      
      {/* Scroll Down Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
        <a href="#about" onClick={handleLinkClick} className="animate-bounce block">
          <svg className="w-6 h-6 text-white/50 hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </a>
      </div>
    </section>
  );
};

export default Hero;